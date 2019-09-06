import { config } from "../../web/src/common/config";
import { apiFetch } from "../../web/src/common/fetch";

class AudioStreamWebSocket {
  private static readonly MaxReconnectAttempts = 8;
  private static instance?: AudioStreamWebSocket;

  private readonly pendingBuffers: Uint8Array[] = [];
  private reconnectAttempts = 0;
  private ws?: WebSocket;

  private constructor() {
    this.connect();
  }

  public static getInstance() {
    if (this.instance == null) {
      this.instance = new AudioStreamWebSocket();
    }
    return this.instance;
  }

  private connect() {
    this.reconnectAttempts++;
    this.ws = new WebSocket(config.WS_URL);
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushPendingBuffers();
    };
    this.ws.onerror = ev => this.onError(ev);
    this.ws.onclose = ev => this.onClose(ev);
    this.ws.onmessage = ev => this.onMessage(ev);
  }

  public enqueue(buf: Uint8Array) {
    if (this.ws!.readyState === WebSocket.OPEN) {
      this.send(buf);
    } else {
      this.pendingBuffers.push(buf);
    }
  }

  private flushPendingBuffers() {
    let buf: Uint8Array | undefined;
    do {
      buf = this.pendingBuffers.shift();
      if (buf != null) {
        this.send(buf);
      }
    } while (buf != null);
  }

  private send(buf: Uint8Array) {
    this.ws!.send(buf);
  }

  private onMessage(ev: Event) {
    console.log("websocket message: ", ev);
  }

  private onError(ev: Event) {
    console.log("websocket error: ", ev);
  }

  private onClose(ev: CloseEvent) {
    console.log("websocket closed: ", ev);
    if (this.canReconnect()) {
      const timeout = this.reconnectTimeout();
      setTimeout(() => this.connect(), timeout);
    }
  }

  private canReconnect() {
    return this.reconnectAttempts < AudioStreamWebSocket.MaxReconnectAttempts;
  }

  private reconnectTimeout() {
    return 256 * (1 + Math.random() * Math.pow(2, this.reconnectAttempts));
  }
}

interface AudioStreamCreateParams {
  stereo: boolean;
}

class AudioStreamUploader {
  private readonly conn: AudioStreamWebSocket;
  public readonly id: string;
  private readonly idBytes: Uint8Array;

  public static async create(params: AudioStreamCreateParams) {
    const resp = await apiFetch("/stream/", {
      method: "POST",
      data: { contentType: "audio/pcm", ...params }
    });
    const { id } = await resp.json();
    return new AudioStreamUploader(id, AudioStreamWebSocket.getInstance());
  }

  private constructor(id: string, conn: AudioStreamWebSocket) {
    this.id = id;
    const enc = new TextEncoder();
    this.idBytes = enc.encode(id);
    this.conn = conn;
  }

  public enqueue(data: Uint8Array) {
    const buf = new Uint8Array(this.id.length + data.length);
    buf.set(this.idBytes);
    buf.set(data, this.id.length);
    this.conn.enqueue(buf);
  }

  public complete() {
    this.enqueue(new Uint8Array(0));
  }
}

const SILENCE_CUTOFF_SECONDS = 5;

interface AudioStreamUploadSessionOptions {
  autoStopOnSilence?: boolean;
}

export class AudioStreamUploadSession {
  private readonly ctx: AudioContext;
  private readonly upload: AudioStreamUploader;
  public readonly complete: () => void;
  private readonly autoStopOnSilence: boolean;
  private silenceStartAt = -1;

  public static async create(
    stream: MediaStream,
    options: AudioStreamUploadSessionOptions = {}
  ) {
    const { autoStopOnSilence = false } = options;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const channelCount = src.channelCount;
    if (channelCount !== 1 && channelCount !== 2) {
      throw new Error(
        "Unsupported number of channels. Should be 1 or 2, but got " +
          channelCount
      );
    }

    const stereo = channelCount === 2;
    const upload = await AudioStreamUploader.create({ stereo });
    return new AudioStreamUploadSession({
      src,
      ctx,
      upload,
      autoStopOnSilence
    });
  }

  private constructor(params: {
    ctx: AudioContext;
    src: MediaStreamAudioSourceNode;
    upload: AudioStreamUploader;
    autoStopOnSilence: boolean;
  }) {
    const { ctx, src, upload, autoStopOnSilence } = params;
    this.ctx = ctx;
    this.upload = upload;
    this.autoStopOnSilence = autoStopOnSilence;

    const input = this.ctx.createGain();
    const processor = this.ctx.createScriptProcessor();
    src.connect(input);
    input.connect(processor);
    processor.connect(this.ctx.destination);

    const processAudio = this.processAudio.bind(this);

    this.complete = () => {
      input.disconnect(processor);
      src.disconnect(input);
      processor.removeEventListener("audioprocess", processAudio);
      upload.complete();
    };

    processor.addEventListener("audioprocess", processAudio);
  }

  public streamUrl() {
    return config.API_URL + "/stream/" + this.upload.id;
  }

  private processAudio(ev: AudioProcessingEvent) {
    const chans: Float32Array[] = [];
    for (let i = 0; i < ev.inputBuffer.numberOfChannels; i++) {
      chans[i] = ev.inputBuffer.getChannelData(i);
    }

    const allChannelsSize = chans.reduce((tot, ch) => tot + ch.byteLength, 0);
    const eqLen = chans.every(ch => ch.byteLength === chans[0].byteLength);
    if (!eqLen) {
      throw new Error(
        "channels should have equal length. got lengths: " +
          chans.map(ch => ch.byteLength).join(",")
      );
    }

    const allChannels = new Uint8Array(allChannelsSize);
    let offset = 0;
    for (const chan of chans) {
      const asUint8a = new Uint8Array(chan.buffer);
      allChannels.set(asUint8a, offset);
      offset += asUint8a.byteLength;
    }

    const proceed = this.checkSilence({
      allChannels,
      playbackTime: ev.playbackTime
    });

    if (proceed) {
      this.upload.enqueue(allChannels);
    }
  }

  /**
   * When enabled, check if no sound data for at least <SILENCE_CUTOFF_SECONDS> secs. If so, stop
   * processing.
   */
  private checkSilence(params: {
    allChannels: Uint8Array;
    playbackTime: number;
  }) {
    const { allChannels, playbackTime } = params;
    let proceed = true;
    if (this.autoStopOnSilence) {
      const silent = allChannels.every(b => b === 0);
      if (!silent) {
        this.silenceStartAt = -1;
      } else if (this.silenceStartAt < 0) {
        this.silenceStartAt = playbackTime;
      } else if (playbackTime - this.silenceStartAt > SILENCE_CUTOFF_SECONDS) {
        console.log(
          "silence cutoff threshold reached after playing for",
          playbackTime,
          "seconds"
        );
        this.complete();
        proceed = false;
      }
    }

    return proceed;
  }
}

export function startStreamDemo() {
  demoRunAsync().catch(err => {
    console.log("test uploadMediaStream: error", err);
  });
}

async function demoRunAsync() {
  const audio = demoCreateAudio();
  const stream = demoCreateMediaStream(audio);
  const sess = await AudioStreamUploadSession.create(stream);
  console.log("Stream URL:", sess.streamUrl());
  audio.play();
  audio.addEventListener("ended", () => {
    console.log("audio stream ended, completing session");
    sess.complete();
  });
}

function demoCreateAudio() {
  const url =
    "https://upload.wikimedia.org/wikipedia/en/d/dc/Strawberry_Fields_Forever_(Beatles_song_-_sample).ogg";
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  for (const evtName of ["play", "pause", "ended", "error"]) {
    audio.addEventListener(evtName, evt => {
      console.log("audio event:", evtName, evt);
    });
  }
  return audio;
}

function demoCreateMediaStream(audio: HTMLAudioElement) {
  const ctx = new AudioContext();
  const streamDest = ctx.createMediaStreamDestination();
  const source = ctx.createMediaElementSource(audio);
  source.connect(streamDest);
  return streamDest.stream;
}
