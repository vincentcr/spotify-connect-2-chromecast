import { apiFetch } from "./fetch";

export interface CastDevice {
  fullName: string;
  friendlyName: string;
}

export interface ChromeCastMediaDescriptor {
  contentId: string; // the source url
  contentType?: string;
  streamType?: "BUFFERED" | "LIVE";
  metadata?: {
    type: 0;
    metadataType: 0;
    title?: string;
    images?: [
      {
        url: string;
      }
    ];
  };
}

export async function getCastDevices(): Promise<CastDevice[]> {
  const resp = await apiFetch("/cast/devices");
  return await resp.json();
}

export async function castStream(params: {
  streamUrl: string;
  castDeviceName: string;
}) {
  const { streamUrl, castDeviceName } = params;

  const descriptor: ChromeCastMediaDescriptor = {
    contentId: streamUrl
  };

  const url = `/cast/devices/${castDeviceName}/stream`;
  const resp = await apiFetch(url, {
    method: "POST",
    data: { descriptor }
  });
  const json = await resp.json();
  return json;
}
