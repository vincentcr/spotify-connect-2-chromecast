export enum MessageCode {
  captureTab = "captureTab",
  streamDemo = "streamDemo",
  accessToken = "accessToken"
}

// messages without data
export interface SimpleMessage {
  code: MessageCode.captureTab | MessageCode.streamDemo;
}

export interface MessageAccessToken {
  code: MessageCode.accessToken;
  accessToken: string;
}

export type Message = SimpleMessage | MessageAccessToken;

export function sendMessage(msg: Message) {
  chrome.runtime.sendMessage(msg);
}
