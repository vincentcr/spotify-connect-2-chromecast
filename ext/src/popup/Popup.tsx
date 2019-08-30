import * as React from "react";
import "./Popup.scss";
import { MessageCode, sendMessage } from "../messages";

export default function Popup() {
  function startTabCapture() {
    sendMessage({ code: MessageCode.captureTab });
  }

  function startStreamDemo() {
    sendMessage({ code: MessageCode.streamDemo });
  }

  return (
    <div className="popupContainer">
      <div>
        <button onClick={startTabCapture}>Start Capture</button>
      </div>
      <div>
        <button onClick={startStreamDemo}>Start Streaming Demo</button>
      </div>
    </div>
  );
}
