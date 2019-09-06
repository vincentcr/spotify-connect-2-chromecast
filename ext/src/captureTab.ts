import { AudioStreamUploadSession } from "./streams";
import { castStream } from "../../web/src/common/cast";

interface CapturedTabInfo {
  tabId: number;
  stream: MediaStream;
  session: AudioStreamUploadSession;
}

const capturedTabs: { [id: number]: CapturedTabInfo } = {};

export function captureTab(params: { castDeviceName: string }) {
  captureTabAsync(params).catch(err => {
    console.error("handleCapturedStreamAsync error", err);
  });
}

async function captureTabAsync(params: { castDeviceName: string }) {
  const { castDeviceName } = params;
  const tab = await chromeGetCurrentTab();
  if (capturedTabs[tab.id] == null) {
    const stream = await chromeCaptureTab();
    await handleCapturedStream({ stream, castDeviceName, tabId: tab.id });
  } else {
    console.log("tab", tab.id, "already captured, ignoring");
  }
}

function chromeCaptureTab(): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true }, stream => {
      if (stream != null) {
        resolve(stream);
      } else {
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });
}

function chromeGetCurrentTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true }, tabs => {
      if (tabs.length > 0) {
        resolve(tabs[0]);
      } else {
        reject(new Error("no currently active tab"));
      }
    });
  });
}

async function handleCapturedStream(params: {
  stream: MediaStream;
  castDeviceName: string;
  tabId: number;
}) {
  const { stream, castDeviceName, tabId } = params;
  const session = await AudioStreamUploadSession.create(stream);
  const streamUrl = session.streamUrl();
  const castResult = await castStream({ streamUrl, castDeviceName });
  capturedTabs[tabId] = { tabId, session, stream };
  console.debug("stream upload session created.", { streamUrl, castResult });
}

export function stopCapture(tabId?: number) {
  const captureInfo = capturedTabs[tabId];
  if (captureInfo != null) {
    const track = captureInfo.stream.getAudioTracks()[0];
    track.stop();
  }
}
