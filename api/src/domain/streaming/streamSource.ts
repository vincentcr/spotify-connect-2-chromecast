import * as stream from "stream";

/**
 * WaitHandle allows a promise to wait for a signal that execution can continue.
 *
 * Specifically, the `wait` function returns a promise that resolves when the `resume` function is
 * called.
 *
 * Note that, as the wait method does not add anything to the event loop, it will not on its own
 * prevent the node runtime from exiting if the event loop empties out.
 */
class WaitHandle {
  private idleResolve?: () => void;
  private idlePromise?: Promise<void>;

  public constructor() {
    this.resume();
  }

  public resume() {
    this.idlePromise = new Promise(resolve => {
      if (this.idleResolve != null) {
        this.idleResolve();
      }
      this.idleResolve = resolve;
    });
  }

  public async wait() {
    await setImmediateAsync();
    return this.idlePromise;
  }
}

/**
 * ProcessingQueue allows to enqueue work items, and dequeue the processed results.
 *
 * The `dequeue` method will asynchronously yield the processed work items added through the
 * `enqueue` method, and will not return until `complete` is called.
 */
class ProcessingQueue<I, R> {
  private inQueue: AsyncIterable<R>[] = [];
  private outQueue: R[] = [];
  private completed = false;
  private waiter = new WaitHandle();
  private process: (item: I) => AsyncIterable<R>;

  public constructor(process: (item: I) => AsyncIterable<R>) {
    this.process = process;
  }

  public enqueue(item: I) {
    this.inQueue.push(this.processAsync(item));
    this.waiter.resume();
  }

  private async *processAsync(item: I): AsyncIterable<R> {
    // ensure processing starts after next tick.
    await setImmediateAsync();
    yield* this.process(item);
  }

  public complete() {
    this.completed = true;
    this.waiter.resume();
  }

  public async *dequeue(): AsyncIterable<R> {
    yield* this.getProcessedResults();
    yield* this.getFutureResults();
  }

  public *getProcessedResults(): IterableIterator<R> {
    yield* this.outQueue;
  }

  private async *getFutureResults(): AsyncIterable<R> {
    while (!this.completed || this.inQueue.length > 0) {
      const results = this.inQueue.shift();

      if (results != null) {
        for await (const result of results) {
          this.outQueue.push(result);
          yield result;
        }
      } else if (!this.completed) {
        // wait for more data or completion
        await this.waiter.wait();
      }
    }
  }
}

/**
 * promise version of setImmediate
 * */
function setImmediateAsync() {
  return new Promise(setImmediate);
}

/**
 * StreamSource accumulates buffers of data in memory, and allows to consume the processed results,
 * either through an async iterator or a stream.
 */
export class StreamSource {
  private readonly processingQueue: ProcessingQueue<Buffer, Buffer>;

  public readonly id: string;
  public readonly contentType: string;

  public constructor(params: {
    id: string;
    contentType: string;
    processor: (buffer: Buffer) => AsyncIterable<Buffer>;
  }) {
    const { id, contentType, processor } = params;
    this.id = id;
    this.contentType = contentType;
    this.processingQueue = new ProcessingQueue(processor);
  }

  public getReadableStream() {
    return stream.Readable.from(this.consume());
  }

  public async *consume(): AsyncIterable<Buffer> {
    yield* this.processingQueue.dequeue();
  }

  public async add(buffer: Buffer) {
    this.processingQueue.enqueue(buffer);
  }

  public complete() {
    this.processingQueue.complete();
  }

  public stats() {
    const processedBuffers = Array.from(
      this.processingQueue.getProcessedResults()
    );

    return {
      contentType: this.contentType,
      buffers: processedBuffers.length,
      totalByteCount: processedBuffers.reduce((tot, b) => tot + b.byteLength, 0)
    };
  }
}
