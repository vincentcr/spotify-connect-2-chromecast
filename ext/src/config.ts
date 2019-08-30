export interface Config {
  API_URL: string;
  WS_URL: string;
  EXTENSION_ID: string;
}

export const config: Config = {
  API_URL: "http://localhost:3001/api",
  WS_URL: "ws://localhost:3001/api/stream/ws",
  EXTENSION_ID: "cnacmfaijadbkeoommccobapimcngmcl"
};
