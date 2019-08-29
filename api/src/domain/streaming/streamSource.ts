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
export class WaitHandle {
  private waitResolve?: () => void;
  private waitPromise?: Promise<void>;

  public constructor() {
    this.resume();
  }

  public resume(): void {
    if (this.waitResolve != null) {
      this.waitResolve();
    }

    this.waitPromise = new Promise(resolve => {
      this.waitResolve = resolve;
    });
  }

  public wait(): Promise<void> {
    return this.waitPromise!;
  }
}

class QueueResultsIterator<T> implements AsyncIterator<T> {
  private readonly onceDoneHandlers: (() => void)[] = [];
  private readonly results: IteratorResult<T>[] = [];
  private readonly resolvers: ((result: IteratorResult<T>) => void)[] = [];

  public once(e: "done", handler: () => void) {
    this.onceDoneHandlers.push(handler);
  }

  public next(): Promise<IteratorResult<T>> {
    return new Promise<IteratorResult<T>>(resolve => {
      const result = this.results.shift();
      if (result != null) {
        this.resolve(result, resolve);
      } else {
        this.resolvers.push(resolve);
      }
    });
  }

  private resolve(
    result: IteratorResult<T>,
    resolve: (result: IteratorResult<T>) => void
  ) {
    resolve(result);
    if (result.done) {
      this.onceDoneHandlers.forEach(handler => handler());
    }
  }

  public addResult(result: ProcessingQueueResult<T>) {
    // casting to `any` to workaround a bug in Typescript's IteratorResult definition:
    // https://github.com/microsoft/TypeScript/issues/2983
    // https://github.com/microsoft/TypeScript/issues/11375
    // Will be fixed with TS 3.6
    const itResult = result.done ? (result as any) : result;
    const resolve = this.resolvers.shift();
    if (resolve != null) {
      this.resolve(itResult, resolve);
    } else {
      this.results.push(itResult);
    }
  }
}

type ProcessingQueueResult<R> = { done: false; value: R } | { done: true };

/**
 * ProcessingQueue allows to enqueue work items, and dequeue the processed results.
 *
 * The `getResults` method will return an async iterator that asynchronously yields the processed
 * work items added through the `enqueue` method, and will not return until `complete` is called.
 *
 */
export class ProcessingQueue<I, R> {
  private inQueue: I[] = [];
  private iterators: QueueResultsIterator<R>[] = [];
  private results: ProcessingQueueResult<R>[] = [];
  private process: (item: I) => AsyncIterable<R>;
  private completed = false;
  private waiter = new WaitHandle();

  public constructor(process: (item: I) => AsyncIterable<R>) {
    this.process = process;
    this.runProcessingLoop();
  }

  public enqueue(item: I) {
    this.inQueue.push(item);
    this.waiter.resume();
  }

  public complete() {
    this.completed = true;
    this.waiter.resume();
  }

  public getResults(): AsyncIterable<R> {
    const it = new QueueResultsIterator<R>();

    it.once("done", () => {
      // to allow freeing consumed iterators, remove reference when done
      this.iterators.splice(this.iterators.indexOf(it), 1);
    });

    for (const res of this.results) {
      it.addResult(res);
    }

    this.iterators.push(it);
    return {
      [Symbol.asyncIterator]() {
        return it;
      }
    };
  }

  public *getProcessedResults(): IterableIterator<R> {
    for (const result of this.results) {
      if (!result.done) {
        yield result.value;
      }
    }
  }

  private async runProcessingLoop() {
    await setImmediateAsync();
    while (!this.completed || this.inQueue.length > 0) {
      const item = this.inQueue.shift();

      if (item != null) {
        for await (const value of this.process(item)) {
          this.addProcessedResult({ done: false, value });
        }
      } else if (!this.completed) {
        // wait for more data or completion
        await this.waiter.wait();
      }
    }

    this.addProcessedResult({ done: true });
  }

  private addProcessedResult(result: ProcessingQueueResult<R>) {
    this.results.push(result);
    for (const it of this.iterators) {
      it.addResult(result);
    }
  }
}

/**
 * promise version of setImmediate
 * */
function setImmediateAsync() {
  return new Promise(setImmediate);
}

type NodeCallback1<T> = (error?: Error | T) => void;

/**
 * StreamSource accumulates buffers of data in memory, and allows to consume the processed results,
 * either through an async iterator or a stream.
 */
export class StreamSource {
  private readonly processingQueue: ProcessingQueue<Buffer, Buffer>;
  private _lastAccessed: number;
  private completed: boolean;

  public readonly id: string;

  public constructor(params: {
    id: string;
    processor: (buffer: Buffer) => AsyncIterable<Buffer>;
  }) {
    const { id, processor } = params;
    this.id = id;
    this.processingQueue = new ProcessingQueue(processor);
    this._lastAccessed = Date.now();
    this.completed = false;
  }

  public getReadableStream() {
    return stream.Readable.from(this.consume());
  }

  public getWritableStream() {
    const src = this;
    return new stream.Writable({
      write(chunk: any, _encoding: string, callback: NodeCallback1<null>) {
        if (!(chunk instanceof Buffer)) {
          callback(new Error("Only buffers are valid input"));
        } else {
          src.add(chunk);
          callback();
        }
      },

      final(callback: NodeCallback1<null>) {
        src.complete();
        callback();
      }
    });
  }

  public async *consume(): AsyncIterable<Buffer> {
    for await (const chunk of this.processingQueue.getResults()) {
      this._lastAccessed = Date.now();
      yield chunk;
    }
  }

  public async add(buffer: Buffer) {
    this.processingQueue.enqueue(buffer);
    this._lastAccessed = Date.now();
  }

  public complete() {
    this.processingQueue.complete();
    this.completed = true;
    this._lastAccessed = Date.now();
  }

  public lastAccessed() {
    return this._lastAccessed;
  }

  public stats() {
    const processedBuffers = Array.from(
      this.processingQueue.getProcessedResults()
    );

    return {
      buffers: processedBuffers.length,
      lastAccessed: this._lastAccessed,
      completed: this.completed,
      totalByteCount: processedBuffers.reduce((tot, b) => tot + b.byteLength, 0)
    };
  }
}
