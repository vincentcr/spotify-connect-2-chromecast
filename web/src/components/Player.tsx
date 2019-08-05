/// <reference types="spotify-web-playback-sdk" />

import React, { useContext, useState, useEffect } from "react";

import { apiFetch } from "../lib/fetch";
import { AppStateContext, SetAppState, AppState } from "../AppState";
import ErrorMessage from "./ErrorMessage";

interface User {
  id: string;
  displayName: string;
  email: string;
}

type PlayerState =
  | { state: "Init" }
  | {
      state: "Error";
      error: any;
    }
  | {
      state: "Ready";
      user: User;
    };

type SetPlayerState = (state: PlayerState) => void;
type SetPlaybackState = (state: Spotify.PlaybackState) => void;

export default function SpotifyPlayer(props: { playerName: string }) {
  const { playerName } = props;
  const [playerState, setPlayerState] = useState<PlayerState>({
    state: "Init"
  });
  const [playbackState, setPlaybackState] = useState<
    Spotify.PlaybackState | undefined
  >(undefined);
  const setAppState = useContext(AppStateContext).setState;

  useEffect(
    () =>
      setupSpotifySdk({
        playerName,
        setPlayerState,
        setAppState,
        setPlaybackState
      }),
    [setAppState, playerName]
  );

  let content;
  if (playerState.state === "Init") {
    content = <p>Initializing...</p>;
  } else if (playerState.state === "Ready") {
    content = <p>Ready! Connected as {playerState.user.displayName}</p>;
  } else {
    content = ErrorMessage({ err: playerState.error });
  }

  return (
    <div>
      {content}
      <PlaybackStateView state={playbackState} />
    </div>
  );
}

function PlaybackStateView({ state }: { state?: Spotify.PlaybackState }) {
  if (state != null) {
    const track = state.track_window.current_track;
    const song = track.name;
    const album = track.album.name;
    const artist = track.artists.map(a => a.name).join(", ");
    const elapsed = msToTimeString(state.position);
    const total = msToTimeString(state.duration);
    const pausedMessage = state.paused ? "(paused)" : "";

    return (
      <div>
        <p>
          <strong>{artist}</strong>: {song} <em>({album})</em>
        </p>
        <p>
          {elapsed} of {total} {pausedMessage}
        </p>
      </div>
    );
  } else {
    return <div></div>;
  }
}

function msToTimeString(ms: number) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  const secondsPadded = seconds < 10 ? "0" + seconds : seconds;
  return `${minutes}:${secondsPadded}`;
}

function setupSpotifySdk(params: {
  playerName: string;
  setPlayerState: SetPlayerState;
  setAppState: SetAppState;
  setPlaybackState: SetPlaybackState;
}) {
  loadSpotifySdkScript();
  window.onSpotifyWebPlaybackSDKReady = () => setupSpotifyPlayer(params);
}

function loadSpotifySdkScript() {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  script.async = true;
  document.body.appendChild(script);
}

function setupSpotifyPlayer(params: {
  playerName: string;
  setPlayerState: SetPlayerState;
  setAppState: SetAppState;
  setPlaybackState: SetPlaybackState;
}) {
  const { playerName, setPlayerState, setAppState, setPlaybackState } = params;
  let user: User | undefined;
  const player = new window.Spotify.Player({
    name: playerName,
    getOAuthToken: cb => {
      getToken()
        .then(cb)
        .catch(handleTokenError);
    }
  });

  async function getToken() {
    const resp = await apiFetch("/auth/");
    const tok = await resp.json();
    user = tok.user;
    return tok.token.accessToken;
  }

  function handleTokenError(error: any) {
    player.disconnect();
    if (error.response != null && error.response.status === 401) {
      setAppState(AppState.auth);
    } else {
      setPlayerState({ state: "Error", error });
    }
  }

  // Error handling
  player.addListener("authentication_error", ({ message }) => {
    console.log(new Error("Spotify authentication error: " + message));
    setAppState(AppState.auth);
  });
  player.addListener("account_error", ({ message }) => {
    console.log(new Error("Spotify account error: " + message));
    setAppState(AppState.auth);
  });
  player.addListener("initialization_error", ({ message }) => {
    setPlayerState({
      state: "Error",
      error: new Error("Spotify initialization error: " + message)
    });
  });
  player.addListener("playback_error", ({ message }) => {
    setPlayerState({
      state: "Error",
      error: new Error("Spotify playback error: " + message)
    });
  });

  // Playback status updates
  player.addListener("player_state_changed", state => {
    console.log("player_state_changed:", state);
    setPlaybackState(state);
  });

  // Ready
  // eslint-disable-next-line @typescript-eslint/camelcase
  player.addListener("ready", ({ device_id }) => {
    setPlayerState({ state: "Ready", user: user as User });
    console.log("Ready with Device ID", device_id);
    const iframe = document.querySelector(
      'iframe[src="https://sdk.scdn.co/embedded/index.html"]'
    ) as HTMLElement;

    if (iframe != null) {
      iframe.style.display = "block";
      iframe.style.position = "absolute";
      iframe.style.top = "-1000px";
      iframe.style.left = "-1000px";
    }

    setInterval(() => {
      player.getCurrentState().then(state => {
        if (state != null) {
          setPlaybackState(state);
        }
      });
    }, 200);
  });

  // Not Ready
  // eslint-disable-next-line @typescript-eslint/camelcase
  player.addListener("not_ready", ({ device_id }) => {
    console.log("Device ID has gone offline", device_id);
    setPlayerState({ state: "Init" });
  });

  // Connect to the player!
  player.connect();
}
