import * as uuid from "uuid/v4";

import { StreamSource } from "./streamSource";
import { Mp3SourceProcessor } from "./mp3SourceProcessor";

const SUPPORTED_CONTENT_TYPES = ["audio/mp3", "audio/mpeg"];

export class StreamStore {
  private static readonly cache: { [id: string]: StreamSource } = {};

  public static async create(params: { contentType: string }) {
    const { contentType } = params;
    if (SUPPORTED_CONTENT_TYPES.indexOf(contentType) < 0) {
      throw new Error(
        `only mp3 streams are supported for now (got "${contentType}")`
      );
    }
    const processor = await Mp3SourceProcessor.create({ stereo: true });
    const id = uuid();
    const src = new StreamSource({
      id,
      contentType,
      processor: b => processor.process(b)
    });
    StreamStore.cache[src.id] = src;
    return src;
  }

  public static get(streamId: string): StreamSource | undefined {
    return StreamStore.cache[streamId];
  }
}
