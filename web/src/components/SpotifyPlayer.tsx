/// <reference types="spotify-web-playback-sdk" />

import React, { useState, useEffect } from "react";

import { apiFetch } from "../common/fetch";
import { ErrorHandler } from "./ErrorHandler";
import { CastDevice } from "../common/cast";
import * as queryString from "../lib/queryString";
import { getExtensionMessenger } from "../lib/ExtensionMessenger";
import { AuthError } from "../lib/errors";

const extMessenger = getExtensionMessenger();

interface User {
  id: string;
  displayName: string;
  email: string;
}

enum PlayerStateCode {
  init,
  error,
  ready
}

type PlayerState =
  | {
      code: PlayerStateCode.init;
    }
  | {
      code: PlayerStateCode.error;
      error: Error;
    }
  | {
      code: PlayerStateCode.ready;
      user: User;
    };

type SetPlayerState = (state: PlayerState) => void;

type SetPlaybackState = (state: Spotify.PlaybackState) => void;

export default function SpotifyPlayer() {
  // player state
  const [playerState, setPlayerState] = useState<PlayerState>({
    code: PlayerStateCode.init
  });

  // playback state
  const [playbackState, setPlaybackState] = useState<
    Spotify.PlaybackState | undefined
  >(undefined);

  const castDevice = parseDeviceFromQueryString();
  if (castDevice == null) {
    throw new Error("Invalid state: spotify player with no cast device");
  }

  const playerName = makePlayerName(castDevice);

  useEffect(
    () =>
      setupSpotifySdk({
        playerName,
        setPlayerState,
        setPlaybackState
      }),
    [playerName]
  );

  useEffect(() => {
    if (playerState.code === PlayerStateCode.ready) {
      extMessenger.captureTab(castDevice.fullName);
    }
  }, [playerState.code, castDevice.fullName]);

  let content;
  switch (playerState.code) {
    case PlayerStateCode.init:
      content = <p>Initializing...</p>;
      break;
    case PlayerStateCode.ready:
      content = <p>Ready! Connected as {playerState.user.displayName}</p>;
      break;
    case PlayerStateCode.error:
      content = <ErrorHandler error={playerState.error} />;
      break;
  }

  const style = {
    border: "1px solid 323232",
    margin: "4px",
    padding: "2px"
  };

  return (
    <div style={style}>
      <h3>{playerName}</h3>
      {content}
      <PlaybackStateView state={playbackState} />
    </div>
  );
}

function parseDeviceFromQueryString(): CastDevice | undefined {
  const { fullName, friendlyName } = queryString.parse();
  if (fullName != null && friendlyName != null) {
    return { fullName, friendlyName };
  }
}

function makePlayerName(device: CastDevice) {
  return "[Desktop] " + device.friendlyName;
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
  setPlaybackState: SetPlaybackState;
}) {
  console.log("setupSpotifySdk");
  loadSpotifySdkScript();
  window.onSpotifyWebPlaybackSDKReady = () => onSpotifySDKReady(params);
  setupIFrameWorkaround();
}

function loadSpotifySdkScript() {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  script.async = true;
  document.body.appendChild(script);
}

function onSpotifySDKReady(params: {
  playerName: string;
  setPlayerState: SetPlayerState;
  setPlaybackState: SetPlaybackState;
}) {
  console.log("onSpotifySDKReady");

  const { playerName, setPlayerState, setPlaybackState } = params;
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
    const auth = await resp.json();
    user = auth.spotify;
    return auth.spotify.accessToken;
  }

  function handleTokenError(error: any) {
    player.disconnect();
    if (error.response != null && error.response.status === 401) {
      setPlayerState({ code: PlayerStateCode.error, error: new AuthError() });
    } else {
      setPlayerState({ code: PlayerStateCode.error, error });
    }
  }

  // Error handling
  player.addListener("authentication_error", ({ message }) => {
    console.log(new Error("Spotify authentication error: " + message));
    setPlayerState({ code: PlayerStateCode.error, error: new AuthError() });
  });
  player.addListener("account_error", ({ message }) => {
    console.log(new Error("Spotify account error: " + message));
    setPlayerState({ code: PlayerStateCode.error, error: new AuthError() });
  });
  player.addListener("initialization_error", ({ message }) => {
    setPlayerState({
      code: PlayerStateCode.error,
      error: new Error("Spotify initialization error: " + message)
    });
  });
  player.addListener("playback_error", ({ message }) => {
    setPlayerState({
      code: PlayerStateCode.error,
      error: new Error("Spotify playback error: " + message)
    });
  });

  // Playback status updates
  player.addListener("player_state_changed", playbackState => {
    console.log("Spotify Player: player_state_changed:", playbackState);
    setPlaybackState(playbackState);
  });

  let playbackStateUpdateInterval: NodeJS.Timeout | undefined;
  player.addListener("ready", ({ device_id: deviceId }) => {
    console.log("Spotify Player: ready", { deviceId, user });
    setPlayerState({ code: PlayerStateCode.ready, user: user as User });

    //periodically update the playback state
    playbackStateUpdateInterval = setInterval(() => {
      player.getCurrentState().then(playbackState => {
        if (playbackState != null) {
          setPlaybackState(playbackState);
        }
      });
    }, 200);
  });

  player.addListener("not_ready", ({ device_id: deviceId }) => {
    console.log("Spotify Player: not_ready", { deviceId });
    setPlayerState({ code: PlayerStateCode.init });
    if (playbackStateUpdateInterval != null) {
      clearInterval(playbackStateUpdateInterval);
    }
  });

  // Connect to the player!
  player.connect();
}

// Workaround to SDK bug with Chrome >= 74
// See: https://github.com/spotify/web-playback-sdk/issues/75#issuecomment-487325589
function setupIFrameWorkaround() {
  const iframe = document.querySelector(
    'iframe[src="https://sdk.scdn.co/embedded/index.html"]'
  ) as HTMLElement;

  if (iframe != null) {
    iframe.style.display = "block";
    iframe.style.position = "absolute";
    iframe.style.top = "-1000px";
    iframe.style.left = "-1000px";
  }
}
