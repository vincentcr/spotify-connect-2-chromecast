/// <reference types="chrome" />
import { config } from "../common/config";

import { ExtMessage, ExtMessageCode } from "../common/ExtensionMessages";

export function getExtensionMessenger() {
  const messenger = getExtensionMessengerImpl();
  return {
    sendAccessToken(accessToken: string) {
      messenger.sendMessage({
        code: ExtMessageCode.accessToken,
        accessToken
      });
    },

    captureTab(castDeviceName: string) {
      messenger.sendMessage({
        code: ExtMessageCode.captureTab,
        castDeviceName
      });
    }
  };
}

interface BrowserExtensionCommunicator {
  sendMessage(msg: ExtMessage): void;
}

const NullBrowserExtensionCommunicator = {
  sendMessage(msg: ExtMessage) {
    console.log("NullBrowserExtension.sendMessage:", msg);
  }
};

const ChromeExtensionMessenger = {
  sendMessage(msg: ExtMessage) {
    console.log("ChromeExtensionMessenger:sendMessage", msg);
    chrome.runtime.sendMessage(config.CHROME_EXTENSION_ID, msg);
  }
};

function getExtensionMessengerImpl(): BrowserExtensionCommunicator {
  if (hasChromeExtension()) {
    return ChromeExtensionMessenger;
  } else {
    return NullBrowserExtensionCommunicator;
  }
}

function hasChromeExtension() {
  return typeof chrome !== "undefined" && chrome.runtime != null;
}
