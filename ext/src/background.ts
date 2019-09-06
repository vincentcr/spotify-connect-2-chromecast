/**
 * background "worker" script
 */

import {
  ExtMessage,
  ExtMessageCode
} from "../../web/src/common/ExtensionMessages";
import { startStreamDemo } from "./streams";
import { captureTab } from "./captureTab";
import { saveAccessToken } from "../../web/src/common/fetch";

// Listen to messages sent from other parts of the extension.
chrome.runtime.onMessage.addListener(processMessage);
// Listen to messages sent from the web site part of the app
chrome.runtime.onMessageExternal.addListener(processMessage);

function processMessage(msg: ExtMessage) {
  processMessageAsync(msg).catch(err => {
    console.error("Failed to process message", msg, err);
  });
}

async function processMessageAsync(msg: ExtMessage) {
  console.debug(
    "processMessage",
    msg,
    msg.code,
    ExtMessageCode.accessToken,
    msg.code === ExtMessageCode.accessToken
  );
  switch (msg.code) {
    case ExtMessageCode.captureTab:
      captureTab(msg);
      break;
    case ExtMessageCode.streamDemo:
      startStreamDemo();
      break;
    case ExtMessageCode.accessToken:
      console.log("access token..");
      saveAccessToken(msg.accessToken);
      break;
    default:
      throw new Error(`Unknown message: ${JSON.stringify(msg)}`);
  }
}
