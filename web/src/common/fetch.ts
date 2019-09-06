import { config } from "./config";
import { FetchError, AuthError } from "../lib/errors";

export type FetchOptions = {
  headers?: Record<string, string>;
  data?: { [key: string]: any };
} & Omit<RequestInit, "headers">;

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const url = config.API_URL + path;

  const { headers = {} } = options;
  const accessToken = getAccessToken();
  if (accessToken != null) {
    headers.authorization = "Bearer " + accessToken;
  }

  return await fetch(url, {
    ...options,
    credentials: "include",
    headers
  });
}

export async function fetch(url: string, options: FetchOptions = {}) {
  const { headers = {}, data, ...otherOptions } = options;
  if (headers["content-type"] == null) {
    headers["content-type"] = "application/json";
  }

  const body = formatData(data, headers["content-type"]);
  const allOptions = { ...otherOptions, headers, body };
  const resp = await window.fetch(url, allOptions);

  if (!resp.ok) {
    const err = new FetchError(
      `Unexpected response status code ${
        resp.status
      } for request ${allOptions.method ||
        "GET"} ${url}. body: ${await resp.text()}`,
      resp
    );
    if (resp.status === 401) {
      clearAccessToken();
      throw new AuthError(resp.statusText, err);
    } else {
      throw err;
    }
  }
  return resp;
}

function formatData(
  data: { [key: string]: any } | undefined,
  contentType: string
) {
  if (data == null) {
    return undefined;
  } else if (contentType === "application/json") {
    return JSON.stringify(data);
  } else if (contentType === "application/x-www-form-urlencoded") {
    return urlEncode(data);
  } else {
    throw new Error("Unsupported content-type: " + contentType);
  }
}

function urlEncode(data: { [key: string]: any }) {
  return Object.entries(data)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");
}

let accessToken: string | null | undefined;
export function getAccessToken() {
  if (accessToken === undefined) {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

export function saveAccessToken(newAccessToken: string) {
  console.log("storing access token", newAccessToken);
  localStorage.setItem("accessToken", newAccessToken);
  accessToken = newAccessToken;
}

function clearAccessToken() {
  localStorage.removeItem("accessToken");
  accessToken = null;
}
