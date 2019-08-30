import React, { useState } from "react";
import Authenticate from "./components/Authenticate";
import AuthCallback from "./components/AuthCallback";
import Player from "./components/Player";
import ErrorMessage from "./components/ErrorMessage";
import { AppState, AppStateContext } from "./AppState";
import { ChromeExtensionCommLink } from "./components/ChromeExtensionCommLink";

const App = () => {
  const stateName = (window.location.hash.substr(1) ||
    AppState.player) as keyof typeof AppState;
  const initialState = AppState[stateName];

  const [state, _setState] = useState<AppState>(initialState);

  function setState(state: AppState) {
    _setState(state);
    window.location.hash = "#" + state;
    window.location.search = "";
  }

  const MainComponent = mainComponentFromState(state, stateName);

  return (
    <div>
      <h2>Spotify Player</h2>
      <AppStateContext.Provider value={{ state, setState }}>
        <ChromeExtensionCommLink />
        <MainComponent />
      </AppStateContext.Provider>
    </div>
  );
};

function mainComponentFromState(state: AppState, stateName: string) {
  switch (state) {
    case AppState.auth:
      return Authenticate;
    case AppState.authCallback:
      return AuthCallback;
    case AppState.player:
      return () => Player({ playerName: "Web Playback demo" });
    default:
      const err = new Error(`Unknown state ${stateName}`);
      return () => ErrorMessage({ err });
  }
}

export default App;
