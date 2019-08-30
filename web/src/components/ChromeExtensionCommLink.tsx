import { useEffect, useContext } from "react";
import { AppState, AppStateContext } from "../AppState";
import { config } from "../config";

/**
 * This component renders nothing. It serves as the communication link with the Chrome extension,
 * when present. Having this link be a React component allows us to listen to application state
 * changes events.
 */
export function ChromeExtensionCommLink() {
  const { state, setState } = useContext(AppStateContext);

  useEffect(() => {
    console.log("ChromeExtensionCommLink", {
      isChrome: typeof chrome !== "undefined",
      hasChromeExtensionAffinity:
        typeof chrome !== "undefined" && chrome.runtime != null,
      state,
      accessToken: localStorage.getItem("accessToken")
    });
    if (typeof chrome === "undefined" || chrome.runtime == null) {
      // the chrome extension is not installed
      return;
    }

    if (state === AppState.player) {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken == null) {
        setState(AppState.auth);
      } else {
        console.log("sending access token message");
        chrome.runtime.sendMessage(config.CHROME_EXTENSION_ID, {
          code: "accessToken",
          accessToken
        });
      }
    }
  }, [setState, state]);

  return null;
}
