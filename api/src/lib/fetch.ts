import nodeFetch, { RequestInit, Response } from "node-fetch";
import * as VError from "verror";

export { Response } from "node-fetch";

export type FetchOptions = {
  headers?: Record<string, string>;
  data?: { [key: string]: any };
} & Omit<RequestInit, "headers">;

export async function fetch(url: string, options: FetchOptions = {}) {
  const { headers = {}, data, ...otherOptions } = options;
  if (headers["content-type"] == null) {
    headers["content-type"] = "application/json";
  }

  const body = formatData(data, headers["content-type"]);

  const allOptions = { ...otherOptions, headers, body };

  const resp = await nodeFetch(url, allOptions);

  if (!resp.ok) {
    throw new VError(
      {
        name: "FetchError",
        info: {
          status: resp.status,
          method: allOptions.method || "GET",
          url,
          body: await failsafeResponseText(resp)
        }
      },
      `Unexpected response status code ${resp.status}`
    );
  }
  return resp;
}

async function failsafeResponseText(resp: Response) {
  try {
    return await resp.text();
  } catch (err) {
    return `[unable to fetch response text: ${err.stack}]`;
  }
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
