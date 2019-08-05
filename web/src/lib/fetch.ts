import { config } from "../config";

export type FetchOptions = {
  headers?: Record<string, string>;
  data?: { [key: string]: any };
} & Omit<RequestInit, "headers">;

export class FetchError extends Error {
  public readonly response: Response;
  public constructor(message: string, response: Response) {
    super(message);
    this.name = "FetchError";
    this.response = response;
  }
}

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const url = config.API_URL + path;

  return await fetch(url, {
    ...options,
    credentials: "include"
  });
}

export async function fetch(url: string, options: FetchOptions = {}) {
  const { headers = {}, data, ...otherOptions } = options;
  if (headers["content-type"] == null) {
    headers["content-type"] = "application/json";
  }

  const body = formatData(data, headers["content-type"]);

  const allOptions = { ...otherOptions, headers, body };
  console.log("making fetch request", url, allOptions);

  const resp = await window.fetch(url, allOptions);

  console.log("got response", resp.status);

  if (!resp.ok) {
    throw new FetchError(
      `Unexpected response status code ${
        resp.status
      } for request ${allOptions.method ||
        "GET"} ${url}. body: ${await resp.text()}`,
      resp
    );
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
