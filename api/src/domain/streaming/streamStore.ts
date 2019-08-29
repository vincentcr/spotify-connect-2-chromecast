import * as uuid from "uuid/v4";

import { StreamSource } from "./streamSource";
import { Mp3SourceProcessor } from "./mp3SourceProcessor";
import { getLogger } from "../../lib/logger";
import { Config } from "../../config";

const logger = getLogger("streamStore");

type CreateProcessor = (params: {
  stereo: boolean;
}) => Promise<(buffer: Buffer) => AsyncIterable<Buffer>>;

export type StreamStoreConfig = Pick<
  Config,
  | "STREAM_STORE_CACHE_MAX_SIZE"
  | "STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS"
  | "STREAM_STORE_CACHE_STALE_THREHSOLD_MS"
>;

export class StreamStore {
  private readonly cache: { [id: string]: StreamSource } = {};
  private readonly cacheMaxSize: number;
  private readonly cacheCleanupIntervalMs: number;
  private readonly cacheStaleThresholdMs: number;
  private readonly cacheCleanupIntervalId: NodeJS.Timeout;
  private readonly createProcessor: CreateProcessor;

  public constructor(params: {
    config: StreamStoreConfig;
    createProcessor?: CreateProcessor;
  }) {
    const {
      config,
      createProcessor = StreamStore.createDefaultProcessor
    } = params;

    this.cacheMaxSize = config.STREAM_STORE_CACHE_MAX_SIZE;
    this.cacheCleanupIntervalMs = config.STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS;
    this.cacheStaleThresholdMs = config.STREAM_STORE_CACHE_STALE_THREHSOLD_MS;
    this.createProcessor = createProcessor;

    this.cacheCleanupIntervalId = setInterval(
      () => this.cleanupCache(),
      this.cacheCleanupIntervalMs
    );
  }

  private static async createDefaultProcessor(params: { stereo: boolean }) {
    const processor = await Mp3SourceProcessor.create(params);
    return (buffer: Buffer) => processor.process(buffer);
  }

  public async create(params: { stereo: boolean }) {
    const { stereo } = params;
    const id = uuid();
    const src = new StreamSource({
      id,
      processor: await this.createProcessor({ stereo })
    });
    this.add(src);
    return src;
  }

  private add(src: StreamSource) {
    this.cache[src.id] = src;
    if (Object.keys(this.cache).length >= this.cacheMaxSize) {
      this.cleanupCache();
    }
  }

  public get(streamId: string): StreamSource | undefined {
    return this.cache[streamId];
  }

  public count() {
    return Object.keys(this.cache).length;
  }

  public shutdown() {
    clearInterval(this.cacheCleanupIntervalId);
  }

  /**
   * Remove all sources where the last active timestamp is past the stale threshold, and keep the
   * total number of elements below or equal to cacheMaxSize (using LRU logic for evictions).
   */
  public cleanupCache() {
    const entries = Object.entries(this.cache).sort(
      ([, aSource], [, bSource]) => {
        const aLastActive = aSource.getLastActive();
        const bLastActive = bSource.getLastActive();
        if (aLastActive > bLastActive) {
          return -1;
        } else if (aLastActive < bLastActive) {
          return 1;
        } else {
          return 0;
        }
      }
    );

    let deletedCount = 0;
    const now = Date.now();

    for (let idx = 0; idx < entries.length; idx++) {
      const [id, source] = entries[idx];
      const activeDelta = now - source.getLastActive();
      if (
        idx >= this.cacheMaxSize ||
        activeDelta > this.cacheStaleThresholdMs
      ) {
        logger.debug(
          {
            idx,
            id,
            now,
            activeDelta,
            thresh: this.cacheStaleThresholdMs
          },
          "deleting StreamSource"
        );
        deletedCount++;
        delete this.cache[id];
      }
    }

    if (deletedCount > 0) {
      logger.info("cleanupCache", {
        deletedCount,
        previousTotalCount: entries.length,
        remainingCount: entries.length - deletedCount
      });
    }
  }
}
