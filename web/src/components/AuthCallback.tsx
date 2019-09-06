import React, { useEffect, useContext, useState } from "react";
import * as queryString from "../lib/queryString";

import ErrorMessage from "./ErrorMessage";
import { AppStateContext, SetAppState, AppState } from "../AppState";
import { apiFetch, saveAccessToken } from "../common/fetch";

type CallbackState = "Processing" | Error;
type SetCallbackState = (state: CallbackState) => void;

export default function AuthCallback() {
  const [callbackState, setCallbackState] = useState<CallbackState>(
    "Processing"
  );

  const setAppState = useContext(AppStateContext).setState;

  useEffect(() => processQueryString({ setAppState, setCallbackState }), [
    setAppState
  ]);

  if (callbackState === "Processing") {
    return <div>Processing response...</div>;
  } else {
    return ErrorMessage({ err: callbackState });
  }
}

function processQueryString(params: {
  setCallbackState: SetCallbackState;
  setAppState: SetAppState;
}) {
  processQueryStringAsync(params);
}

async function processQueryStringAsync(params: {
  setCallbackState: SetCallbackState;
  setAppState: SetAppState;
}) {
  const { setCallbackState, setAppState } = params;
  try {
    const { code, error } = queryString.parse();

    if (error != null) {
      setCallbackState(new Error(error));
    } else if (code == null) {
      setCallbackState(new Error("Code missing"));
    } else {
      await processSuccessCode({ code, setAppState });
    }
  } catch (err) {
    console.log("Auth callback processing error:", err);
    setCallbackState(err);
  }
}

async function processSuccessCode(params: {
  code: string;
  setAppState: SetAppState;
}) {
  const { code, setAppState } = params;
  // if this call is successful, an authentication cookie will be set in the response.
  const resp = await apiFetch("/auth/process-callback", {
    method: "POST",
    data: { code }
  });
  const auth = await resp.json();
  const { accessToken } = auth.token;
  localStorage.setItem("accessToken", accessToken);
  setAppState(AppState.player);
}
