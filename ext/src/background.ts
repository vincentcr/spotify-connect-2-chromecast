/**
 * background "worker" script
 */

import { Message, MessageCode } from "./messages";
import { storeAccessToken } from "./fetch";
import { startStreamDemo } from "./streams";
import { captureTab } from "./captureTab";

// Listen to messages sent from other parts of the extension.
chrome.runtime.onMessage.addListener(processMessage);
// Listen to messages sent from the web site part of the app
chrome.runtime.onMessageExternal.addListener(processMessage);

function processMessage(msg: Message) {
  console.debug("processMessage", msg);
  switch (msg.code) {
    case MessageCode.captureTab:
      captureTab();
      break;
    case MessageCode.streamDemo:
      startStreamDemo();
      break;
    case MessageCode.accessToken:
      storeAccessToken(msg.accessToken);
      break;
    default:
      throw new Error(`Unknown message: ${msg} - ${JSON.stringify(msg)}`);
  }
}
