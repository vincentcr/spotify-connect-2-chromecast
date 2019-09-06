import React, { useEffect, useContext, useState } from "react";
import * as queryString from "../lib/queryString";

import { ErrorHandler } from "./ErrorHandler";
import { apiFetch, saveAccessToken } from "../common/fetch";
import { AppStateContext, DefaultAppState } from "../AppState";

type AuthCallbackState = { code: "processing" } | { code: "error"; error: any };

export default function AuthCallback() {
  const [state, setState] = useState<AuthCallbackState>({
    code: "processing"
  });

  const setAppState = useContext(AppStateContext).setState;
  const { code, error } = queryString.parse();

  useEffect(() => {
    process({ code, error })
      .then(() => {
        console.log("set app state to default =>", { DefaultAppState });
        setAppState(DefaultAppState);
      })
      .catch(error => {
        setState({ code: "error", error });
      });
  }, [code, error, setAppState]);

  if (state.code === "processing") {
    return <div>Processing response...</div>;
  } else {
    return <ErrorHandler error={state.error}></ErrorHandler>;
  }
}

async function process(params: { code?: string; error?: string }) {
  const { code, error } = params;

  if (error != null) {
    throw new Error(error);
  } else if (code == null) {
    throw new Error("Code missing");
  } else {
    await processSuccessCode(code);
  }
}

async function processSuccessCode(code: string) {
  // if this call is successful, an authentication cookie will be set in the response.
  const resp = await apiFetch("/auth/process-callback", {
    method: "POST",
    data: { code }
  });
  const auth = await resp.json();
  const { accessToken } = auth;
  saveAccessToken(accessToken);
}
