import * as React from "react";
import "./Popup.scss";
import { ExtMessageCode } from "../../../web/src/common/ExtensionMessages";

export default function Popup() {
  function startStreamDemo() {
    chrome.runtime.sendMessage({ code: ExtMessageCode.streamDemo });
  }

  return (
    <div className="popupContainer">
      <div>
        <button onClick={startStreamDemo}>Start Streaming Demo</button>
      </div>
    </div>
  );
}
