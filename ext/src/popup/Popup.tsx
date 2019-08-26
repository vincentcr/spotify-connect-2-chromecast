import * as React from "react";
import "./Popup.scss";
import { CommandStartCapture } from "../messages";

export default function Popup() {
  function startTabCapture() {
    chrome.runtime.sendMessage(CommandStartCapture);
  }

  return (
    <div className="popupContainer">
      <button onClick={startTabCapture}>Start Capture</button>
    </div>
  );
}
