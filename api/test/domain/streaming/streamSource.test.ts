import * as stream from "stream";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";
import {
  WaitHandle,
  ProcessingQueue,
  StreamSource
} from "../../../src/domain/streaming/streamSource";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("The WaitHandle class", () => {
  it("should initalize in the suspended state", async () => {
    const wh = new WaitHandle();
    await expectPromiseSuspended(wh.wait());
  });

  describe("The resume method", () => {
    it("should resolve the wait promise", async () => {
      const wh = new WaitHandle();
      const waited = wh.wait();
      wh.resume();
      await waited;
    });

    it("should return the handle to the suspended state", async () => {
      const wh = new WaitHandle();
      const waited1 = wh.wait();
      wh.resume();
      await waited1;
      await expectPromiseSuspended(wh.wait());
    });

    it("should return the handle to the suspended state if called multiple times", async () => {
      const wh = new WaitHandle();
      const waited1 = wh.wait();
      wh.resume();
      await waited1;

      const waited2 = wh.wait();
      wh.resume();
      await waited2;

      await expectPromiseSuspended(wh.wait());
    });
  });
});

describe("The ProcessingQueue class", () => {
  describe("The getResults method", () => {
    it("should yield enqueued, processed items", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(1);
      q.enqueue(3);
      expect(
        await consumeAsyncIterable(q.getResults(), { max: 4 })
      ).to.deep.equal([1, 2, 3, 6]);
    });

    it("should return results in the order they were enqueued", async () => {
      async function* process(n: number) {
        await setTimeoutAsync(n);
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(4); // takes 4x time to execute as next call, but results should be returned first
      q.enqueue(1);
      expect(
        await consumeAsyncIterable(q.getResults(), { max: 4 })
      ).to.deep.equal([4, 8, 1, 2]);
    });

    it("should suspend execution if there are no processed items to yield", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(1);
      expect(
        await consumeAsyncIterable(q.getResults(), { max: 2 })
      ).to.deep.equal([1, 2]);
      // Requesting more data makes the dequeue method "block"
      await expectPromiseSuspended(
        consumeAsyncIterable(q.getResults(), { max: 3 })
      );
    });

    it("should resume execution after items are enqueued and processed", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(1);

      const iterable = q.getResults();
      const iterator = iterable[Symbol.asyncIterator]();

      let next = await iterator.next();
      expect(next.done).to.equal(false);
      expect(next.value).to.equal(1);

      next = await iterator.next();
      expect(next.done).to.equal(false);
      expect(next.value).to.equal(2);

      const nextPromise = iterator.next();
      // this promise does not resolve yet, because the queue is currently empty
      await expectPromiseSuspended(nextPromise);

      q.enqueue(3);
      // promise now resolves since data has been added
      next = await nextPromise;
      expect(next.done).to.equal(false);
      expect(next.value).to.equal(3);
      next = await iterator.next();
      expect(next.done).to.equal(false);
      expect(next.value).to.equal(6);
    });
  });

  describe("The complete method should make the getResults iterators terminate", () => {
    it("When consume called after complete", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(1);
      q.enqueue(3);
      q.complete();
      await setTimeoutAsync(0);
      expect(await consumeAsyncIterable(q.getResults())).to.deep.equal([
        1,
        2,
        3,
        6
      ]);
    });

    it("When consume called before complete", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.enqueue(1);
      q.enqueue(3);
      const consumePromise = consumeAsyncIterable(q.getResults());
      const completePromise = setTimeoutAsync(8).then(() => q.complete());
      const [results] = await Promise.all([consumePromise, completePromise]);
      expect(results).to.deep.equal([1, 2, 3, 6]);
    });

    it("When there are no results", async () => {
      async function* process(n: number) {
        yield n;
        yield n * 2;
      }

      const q = new ProcessingQueue(process);
      q.complete();
      expect(await consumeAsyncIterable(q.getResults())).to.deep.equal([]);
    });
  });
});

describe("The StreamSource class", () => {
  describe("The consume method", () => {
    it("should yield processed buffers", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      src.add(Buffer.from([2]));
      expect(
        await consumeAsyncIterable(src.consume(), { max: 4 })
      ).to.deep.equal([
        Buffer.from([1]),
        Buffer.from([1, 1]),
        Buffer.from([2]),
        Buffer.from([2, 2])
      ]);
    });

    it("should yield already processed buffers if called a second time", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      src.add(Buffer.from([2]));
      expect(
        await consumeAsyncIterable(src.consume(), { max: 4 })
      ).to.deep.equal([
        Buffer.from([1]),
        Buffer.from([1, 1]),
        Buffer.from([2]),
        Buffer.from([2, 2])
      ]);

      src.add(Buffer.from([3]));
      expect(
        await consumeAsyncIterable(src.consume(), { max: 6 })
      ).to.deep.equal([
        Buffer.from([1]),
        Buffer.from([1, 1]),
        Buffer.from([2]),
        Buffer.from([2, 2]),
        Buffer.from([3]),
        Buffer.from([3, 3])
      ]);
    });

    it("should suspend execution if no data left", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      await expectPromiseSuspended(
        consumeAsyncIterable(src.consume(), { max: 3 })
      );
    });
  });

  describe("The complete method", () => {
    it("should make the consume method complete", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      src.complete();
      expect(await consumeAsyncIterable(src.consume())).to.deep.equal([
        Buffer.from([1]),
        Buffer.from([1, 1])
      ]);
    });
  });

  describe("The getReadableStream method", () => {
    it("should return a stream returning the data yielded from consume", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      src.complete();

      const st = src.getReadableStream();
      expect(st).to.be.instanceOf(stream.Readable);

      expect(await consumeAsyncIterable(st)).to.deep.equal([
        Buffer.from([1]),
        Buffer.from([1, 1])
      ]);
    });

    it("should create independent streams when called multiple times", async () => {
      async function* processor(buffer: Buffer) {
        yield buffer;
        yield Buffer.concat([buffer, buffer]);
      }

      const src = new StreamSource({
        id: "1",
        processor
      });

      src.add(Buffer.from([1]));
      src.add(Buffer.from([2]));
      src.add(Buffer.from([3]));
      src.complete();

      const sts = [
        src.getReadableStream(),
        src.getReadableStream()
        // src.getReadableStream()
      ];

      const results = await Promise.all(
        sts.map(st => consumeAsyncIterable(st, { max: 6 }))
      );
      const expected = [
        Buffer.from([1]),
        Buffer.from([1, 1]),
        Buffer.from([2]),
        Buffer.from([2, 2]),
        Buffer.from([3]),
        Buffer.from([3, 3])
      ];

      expect(results[0]).to.deep.equal(expected);
    });
  });
});

///////////////////////// helpers /////////////////////////

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

/**
 * waits at least minTimeoutMs for a promise to resolve. If it hasn't, it is deemed
 * "suspended" and the assertion succeeds.
 */
async function expectPromiseSuspended(promise: Promise<any>, minTimeoutMs = 3) {
  const started = Date.now();
  let elapsed: number | undefined;
  promise.then(() => {
    elapsed = Date.now() - started;
  });

  await setTimeoutAsync(minTimeoutMs + 1);
  if (elapsed == null) {
    elapsed = Date.now() - started;
  }

  if (minTimeoutMs > elapsed) {
    expect.fail(
      `Expected promise to be suspended, but it resolved after ${elapsed}ms.`
    );
  }
}

// function setImmediateAsync() {
//   return new Promise(setImmediate);
// }

function setTimeoutAsync(timeoutMs: number) {
  return new Promise(resolve => {
    setTimeout(resolve, timeoutMs);
  });
}
