import { apiFetch } from "./fetch";
import { config } from "../config";

class AudioStreamConnection {
  private static readonly MaxReconnectAttempts = 8;
  private static instance?: AudioStreamConnection;

  private readonly pendingBuffers: Uint8Array[] = [];
  private reconnectAttempts = 0;
  private ws?: WebSocket;

  private constructor() {
    this.connect();
  }

  public static getInstance() {
    if (AudioStreamConnection.instance == null) {
      AudioStreamConnection.instance = new AudioStreamConnection();
    }
    return AudioStreamConnection.instance;
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
    return this.reconnectAttempts < AudioStreamConnection.MaxReconnectAttempts;
  }

  private reconnectTimeout() {
    return 256 * (1 + Math.random() * Math.pow(2, this.reconnectAttempts));
  }
}

interface AudioStreamCreateParams {
  stereo: boolean;
}

export class AudioStream {
  private readonly conn: AudioStreamConnection;
  public readonly id: string;
  private readonly idBytes: Uint8Array;

  private constructor(id: string, conn: AudioStreamConnection) {
    this.id = id;
    const enc = new TextEncoder();
    this.idBytes = enc.encode(id);
    this.conn = conn;
  }

  public static async create(params: AudioStreamCreateParams) {
    const resp = await apiFetch("/stream/", {
      method: "POST",
      data: { contentType: "audio/pcm", ...params }
    });
    const { id } = await resp.json();
    return new AudioStream(id, AudioStreamConnection.getInstance());
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

export async function uploadMediaStream(stream: MediaStream) {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const stereo = src.channelCount === 2;
  const upload = await AudioStream.create({ stereo });

  console.log(
    `Uploading stream.URL:\n####\nhttp://localhost:3001/api/stream/${upload.id}\n####\n\n`,
    "src: ",
    src,
    { stereo },
    "tracks: ",
    stream.getAudioTracks()
  );

  const input = ctx.createGain();
  const processor = ctx.createScriptProcessor();
  src.connect(input);
  input.connect(processor);
  processor.connect(ctx.destination);

  let silenceStartAt = -1;
  function processAudio(ev: AudioProcessingEvent) {
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

    // check if no sound data for at least <SILENCE_CUTOFF_SECONDS> secs.
    // if so, pause processing until we get non-silent data again.
    const silent = allChannels.slice(1).every(b => b === 0);

    if (!silent) {
      silenceStartAt = -1;
    } else if (silenceStartAt < 0) {
      silenceStartAt = ev.playbackTime;
    } else if (ev.playbackTime - silenceStartAt > SILENCE_CUTOFF_SECONDS) {
      console.log("silence cutoff threshold reached");
      input.disconnect(processor);
      src.disconnect(input);
      processor.removeEventListener("audioprocess", processAudio);
      upload.complete();
      return;
    }

    upload.enqueue(allChannels);
    // console.log({ command: "record", buf });
  }

  processor.addEventListener("audioprocess", processAudio);

  console.log("done setting up!");
}

export function test() {
  const stream = createTestStream();
  uploadMediaStream(stream)
    .then(() => {
      console.log("test uploadMediaStream: done");
    })
    .catch(err => {
      console.log("test uploadMediaStream: error", err);
    });
}

function createTestStream(): MediaStream {
  const url =
    "https://upload.wikimedia.org/wikipedia/en/d/dc/Strawberry_Fields_Forever_(Beatles_song_-_sample).ogg";
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";

  const ctx = new AudioContext();
  const streamDest = ctx.createMediaStreamDestination();
  const source = ctx.createMediaElementSource(audio);
  source.connect(streamDest);

  audio.play();

  return streamDest.stream;
}
