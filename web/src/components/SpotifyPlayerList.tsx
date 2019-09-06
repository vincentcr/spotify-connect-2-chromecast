import React, { useEffect, useState } from "react";

import * as queryString from "../lib/queryString";
import { CastDevice, getCastDevices } from "../common/cast";
import { AppState } from "../AppState";
import { ErrorHandler } from "./ErrorHandler";

enum PlayerListStateCode {
  init,
  error,
  ready
}

type PlayerListState =
  | { code: PlayerListStateCode.init }
  | {
      code: PlayerListStateCode.error;
      error: any;
    }
  | {
      code: PlayerListStateCode.ready;
      devices: CastDevice[];
    };

export default function SpotifyPlayerList() {
  const [state, setState] = useState<PlayerListState>({
    code: PlayerListStateCode.init
  });

  console.log("rendering SpotifyPlayerList");

  useEffect(() => {
    getCastDevices()
      .then(devices => {
        setState({ code: PlayerListStateCode.ready, devices });
      })
      .catch(error => {
        setState({ code: PlayerListStateCode.error, error });
      });
  }, []);

  // getCastDevices().then(devices => {
  //   setState({ code: PlayerListStateCode.ready, devices });
  // });

  switch (state.code) {
    case PlayerListStateCode.init:
      return <div>Fetching ChromeCast devices...</div>;
    case PlayerListStateCode.ready:
      return (
        <div>
          {state.devices.map(castDevice => (
            <div key={castDevice.fullName}>
              <a href={mkPlayerLink(castDevice)}>{castDevice.friendlyName}</a>
            </div>
          ))}
        </div>
      );
    case PlayerListStateCode.error:
      return <ErrorHandler error={state.error}></ErrorHandler>;
    default:
      throw new Error("Unhandled state:" + JSON.stringify(state));
  }
}
//http://localhost:3000/?friendlyName=bureau%20(google%20home)&fullName=Google-Home-36b46fd4165717f8eb01cca956e74a16._googlecast._tcp.local.#player?friendlyName=bureau%20(google%20home)&fullName=Google-Home-36b46fd4165717f8eb01cca956e74a16._googlecast._tcp.local.
function mkPlayerLink(castDevice: CastDevice) {
  const { friendlyName, fullName } = castDevice;
  const q = queryString.encode({ friendlyName, fullName });
  return (
    window.location.origin +
    window.location.pathname +
    q +
    "#" +
    AppState.player
  );
}
