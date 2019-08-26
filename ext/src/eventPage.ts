import { Command, CommandStartCapture } from "./messages";
import { AudioStream } from "../../web/src/lib/streamer";

// Listen to messages sent from other parts of the extension.
chrome.runtime.onMessage.addListener((command: Command) => {
  switch (command.command) {
    case CommandStartCapture.command:
      startCapture();
      break;
    default:
      console.log("unknown command: ", command);
  }

  return false;
});

chrome.runtime.onMessageExternal.addListener(function(
  request,
  sender,
  sendResponse
) {
  // if (sender.url == blocklistedWebsite)
  //   return;  // don't allow this web page access
  // if (request.openUrlInEditor)
  //   openUrl(request.openUrlInEditor);
  chrome.extension
    .getBackgroundPage()
    .console.log("onMessageExternal:", request);

  sendResponse({ ping: "pong" });
});

function startCapture() {
  console.log("startCapture");
  chrome.tabCapture.capture({ audio: true }, handleStream);
}

function handleStream(stream: MediaStream) {
  handleStreamAsync(stream).catch(err => {
    console.log("handleStreamAsync error", err);
  });
}

// ref: https://github.com/arblast/Chrome-Audio-Capturer/blob/master/background.js
async function handleStreamAsync(stream: MediaStream) {
  const upload = await AudioStream.create({
    stereo: true
  });
  const tracks = stream.getAudioTracks();
  console.log("handleStream; stream:", stream, "tracks: ", tracks);

  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const input = ctx.createGain();
  src.connect(input);

  const processor = ctx.createScriptProcessor();
  input.connect(processor);
  processor.connect(ctx.destination);

  const buf = [];
  processor.onaudioprocess = ev => {
    console.log("onaudioprocess, ev", ev);
    for (let ch = 0; ch < ev.inputBuffer.numberOfChannels; ++ch) {
      buf[ch] = ev.inputBuffer.getChannelData(ch);
    }
    upload.enqueue(buf);
  };
}
