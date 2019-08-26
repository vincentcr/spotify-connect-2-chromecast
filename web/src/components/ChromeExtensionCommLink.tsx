import { useEffect, useContext } from "react";
import { AppState, AppStateContext } from "../AppState";

const CHROME_EXT_ID = "cnacmfaijadbkeoommccobapimcngmcl";

/**
 * This component renders nothing. It serves as the communication link with the Chrome extension,
 * when present. Having this link be a React component allows us to listen to application state
 * changes events.
 */
export function ChromeExtensionCommLink() {
  const { state, setState } = useContext(AppStateContext);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime == null) {
      // the chrome extension is not installed
      return;
    }

    chrome.runtime.sendMessage(CHROME_EXT_ID, {
      hello: "goodbye " + new Date()
    });

    if (state === AppState.player) {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken == null) {
        setState(AppState.auth);
      } else {
        chrome.runtime.sendMessage(CHROME_EXT_ID, { accessToken });
      }
    }
  }, [setState, state]);

  return null;
}
