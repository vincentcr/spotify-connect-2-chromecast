import { AudioStreamUploadSession } from "./streams";
import { castStream } from "../../web/src/common/cast";

export function captureTab() {
  chrome.tabCapture.capture({ audio: true }, handleCapturedStream);
}

function handleCapturedStream(stream: MediaStream) {
  handleCapturedStreamAsync(stream).catch(err => {
    console.error("handleCapturedStreamAsync error", err);
  });
}

async function handleCapturedStreamAsync(stream: MediaStream) {
  const session = await AudioStreamUploadSession.create(stream);
  console.debug(
    "stream upload session created. Stream URL: ",
    session.streamUrl()
  );
}
