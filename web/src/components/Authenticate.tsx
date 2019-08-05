import React from "react";

import { config } from "../config";

const scopes =
  "streaming user-read-birthdate user-read-email user-read-private";

function getAuthLink() {
  const scopesEncoded = encodeURIComponent(scopes);
  const redirectUriEncoded = encodeURIComponent(
    config.SPOTIFY_AUTH_REDIRECT_URL
  );
  return (
    `https://accounts.spotify.com/authorize?response_type=code` +
    `&client_id=${config.SPOTIFY_CLIENT_ID}` +
    `&scope=${scopesEncoded}` +
    `&redirect_uri=${redirectUriEncoded}`
  );
}

export default function Authenticate() {
  return (
    <div>
      <a href={getAuthLink()}>Authenticate with Spotify</a>
    </div>
  );
}
