export interface Config {
  API_URL: string;
  WS_URL: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_AUTH_REDIRECT_URL: string;
  CHROME_EXTENSION_ID: string;
}

export const config: Config = {
  API_URL: "http://localhost:3001/api",
  WS_URL: "ws://localhost:3001/api/stream/ws",
  SPOTIFY_CLIENT_ID: "3a9d438d5c3145b4bacca565985da0d2",
  SPOTIFY_AUTH_REDIRECT_URL: "http://localhost:3000/#authCallback",
  CHROME_EXTENSION_ID: "cnacmfaijadbkeoommccobapimcngmcl"
};
