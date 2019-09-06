import React, { useState, useEffect } from "react";
import * as queryString from "./lib/queryString";

import Authenticate from "./components/Authenticate";
import AuthCallback from "./components/AuthCallback";
import { ErrorHandler, ErrorBoundary } from "./components/ErrorHandler";
import { AppState, AppStateContext, DefaultAppState } from "./AppState";
import SpotifyPlayerList from "./components/SpotifyPlayerList";
import SpotifyPlayer from "./components/SpotifyPlayer";
import { getExtensionMessenger } from "./lib/ExtensionMessenger";
import { getAccessToken } from "./common/fetch";

const extMessenger = getExtensionMessenger();

const App = () => {
  const initialState = getStateFromUrl();
  const [state, setStateInternal] = useState<AppState>(initialState);

  function setState(state: AppState, params = {}) {
    window.location.hash = "#" + state;
    window.location.search = queryString.encode(params);
  }

  useEffect(() => {
    window.onhashchange = () => {
      const newState = getStateFromUrl();
      console.log("window.onhashchange", {
        hash: window.location.hash,
        newState
      });
      setStateInternal(newState);
    };
  }, []);

  document.title = "Spotify 2 Chromecast - " + state;

  useEffect(trySendAccessTokenToExtension, [state]);

  const MainComponent = mainComponentFromState(state);
  console.log("App render", {
    state,
    initialState,
    MainComponent,
    href: window.location.href
  });

  return (
    <div>
      <h2>Spotify Player</h2>
      <ErrorBoundary>
        <AppStateContext.Provider value={{ state, setState }}>
          <MainComponent />
        </AppStateContext.Provider>
      </ErrorBoundary>
    </div>
  );
};

function trySendAccessTokenToExtension() {
  const accessToken = getAccessToken();
  if (accessToken != null) {
    extMessenger.sendAccessToken(accessToken);
  }
}

function getStateFromUrl() {
  const hash = window.location.hash.substr(1) as keyof typeof AppState;
  const state = AppState[hash] || DefaultAppState;
  console.log("getStateFromUrl", { hash, state, href: window.location.href });
  return state;
}

function mainComponentFromState(state: AppState) {
  switch (state) {
    case AppState.auth:
      return Authenticate;
    case AppState.authCallback:
      return AuthCallback;
    case AppState.playerList:
      return SpotifyPlayerList;
    case AppState.player:
      return SpotifyPlayer;
    default:
      const err = new Error(`Unknown app state: "${state}"`);
      return () => ErrorHandler({ error: err });
  }
}

export default App;
