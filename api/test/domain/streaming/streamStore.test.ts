import * as timekeeper from "timekeeper";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";
import {
  StreamStore,
  StreamStoreConfig
} from "../../../src/domain/streaming/streamStore";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("The StreamStore class", () => {
  let store: StreamStore;
  afterEach(() => {
    store.shutdown();
    timekeeper.reset();
  });

  it("auto cleanup at specified interval", async () => {
    store = mockStore({
      STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS: 2,
      STREAM_STORE_CACHE_MAX_SIZE: 1024,
      STREAM_STORE_CACHE_STALE_THREHSOLD_MS: 4
    });
    let now = Date.now();
    await freezeAndYield(now);

    const s1 = await store.create({ stereo: true });
    verifyStoreState(store, [s1.id]);
    await freezeAndYield(now + 6);
    verifyStoreState(store, []);
  });

  describe("The cleanupCache method", () => {
    it("should remove streams when they are stale (too old)", async () => {
      let now = Date.now();

      store = mockStore({
        STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
        STREAM_STORE_CACHE_MAX_SIZE: 1024,
        STREAM_STORE_CACHE_STALE_THREHSOLD_MS: 5
      });

      await freezeAndYield(now);
      const s1 = await store.create({ stereo: true });
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 2;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 2;
      await freezeAndYield(now);
      const s2 = await store.create({ stereo: true });
      store.cleanupCache();
      verifyStoreState(store, [s1.id, s2.id]);

      now += 2;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, [s2.id]);

      now += 4;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, []);
    });

    it("using a stream extends their lifetime", async () => {
      let now = Date.now();

      store = mockStore({
        STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
        STREAM_STORE_CACHE_MAX_SIZE: 1024,
        STREAM_STORE_CACHE_STALE_THREHSOLD_MS: 5
      });

      await freezeAndYield(now);
      const s1 = await store.create({ stereo: true });
      const s2 = await store.create({ stereo: true });
      store.cleanupCache();
      verifyStoreState(store, [s1.id, s2.id]);

      now += 4;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, [s1.id, s2.id]);

      s1.add(Buffer.alloc(0));
      now += 2;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 4;
      await freezeAndYield(now);
      await consumeAsyncIterable(s1.consume(), { max: 1 });
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 4;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 4;
      await freezeAndYield(now);
      s1.complete();
      store.cleanupCache();
      verifyStoreState(store, [s1.id]);

      now += 6;
      await freezeAndYield(now);
      store.cleanupCache();
      verifyStoreState(store, []);
    });

    it("should remove streams when the cache has reached maximum size", async () => {
      store = mockStore({
        STREAM_STORE_CACHE_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
        STREAM_STORE_CACHE_MAX_SIZE: 3,
        STREAM_STORE_CACHE_STALE_THREHSOLD_MS: 60 * 60 * 1000
      });

      const s1 = await store.create({ stereo: true });
      await setTimeoutAsync(1); // make sure the timestamp for the next source is different

      const s2 = await store.create({ stereo: true });
      await setTimeoutAsync(1);

      const s3 = await store.create({ stereo: true });
      await setTimeoutAsync(1);

      verifyStoreState(store, [s1.id, s2.id, s3.id]);

      const s4 = await store.create({ stereo: true });
      await setTimeoutAsync(1);

      // s1 was evicted as max size reached
      verifyStoreState(store, [s2.id, s3.id, s4.id]);

      // use s2 so it's not the next one to be evicted
      s2.add(Buffer.alloc(0));
      await setTimeoutAsync(1);

      const s5 = await store.create({ stereo: true });
      await setTimeoutAsync(1);

      // s3 was evicted as was least recently used
      verifyStoreState(store, [s2.id, s4.id, s5.id]);
    });
  });
});

///////////////////////// helpers /////////////////////////

function verifyStoreState(store: StreamStore, expected: string[]) {
  expect(store.count()).to.equal(expected.length);
  for (const [idx, id] of expected.entries()) {
    expect(store.get(id), `id at index ${idx} was not present`).to.exist;
  }
}

function mockStore(config: StreamStoreConfig) {
  const mockCreateProcessor = async () => mockProcess;
  return new StreamStore({ config, createProcessor: mockCreateProcessor });
}

async function* mockProcess(b: Buffer): AsyncIterable<Buffer> {
  yield b;
  yield Buffer.concat([b, b]);
}

async function consumeAsyncIterable<T>(
  it: AsyncIterable<T>,
  options: { max: number } = { max: Infinity }
) {
  let results: T[] = [];
  for await (const r of it) {
    results.push(r);
    if (results.length === options.max) {
      break;
    }
  }
  return results;
}

async function freezeAndYield(time: number) {
  timekeeper.freeze(time);
  await setTimeoutAsync(0);
}

function setTimeoutAsync(timeoutMs: number) {
  return new Promise(resolve => {
    setTimeout(resolve, timeoutMs);
  });
}
