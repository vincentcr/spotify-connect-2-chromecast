import { createContext } from "react";

export enum AppState {
  auth = "auth",
  authCallback = "authCallback",
  player = "player"
}

export type SetAppState = (state: AppState) => void;

export interface TAppStateContext {
  state: AppState;
  setState: SetAppState;
}

export const AppStateContext = createContext({
  state: AppState.player,
  setState: () => {}
} as TAppStateContext);
