import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

console.log("index.tsx", window.location.href, window.location.origin);

ReactDOM.render(<App />, document.getElementById("root"));
