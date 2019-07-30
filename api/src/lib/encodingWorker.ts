import * as os from "os";
import { Lame } from "lame-wasm";
import { Worker, isMainThread, parentPort } from "worker_threads";

const NUM_WORKERS = Math.max(1, Math.ceil(os.cpus().length / 2));
const workers: Worker[] = new Array(NUM_WORKERS);

if (isMainThread) {
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(__filename);
    workers[i] = worker;
    // worker.
  }
}

let workerRoundRobinIdx = 0;

export function encode(data: Buffer): Promise<Buffer> {
  if (isMainThread) {
    workerRoundRobinIdx = (workerRoundRobinIdx + 1) % NUM_WORKERS;
    const worker = workers[i];
  }
}

async function createEncoder() {
  return Lame.load();
}

// function encode(data: Uint8Array, callback: (err, data) => void) {}

// export function start() {
//   if (isMainThread) {
//     const worker = new Worker(__filename);
//     worker.once("message", message => {
//       console.log(message); // Prints 'Hello, world!'.
//     });
//     worker.postMessage("Hello, world!");
//   } else {
//     // When a message from the parent thread is received, send it back:
//     parentPort.once("message", message => {
//       parentPort.postMessage(message);
//     });
//   }
// }

// class EncodingWorker {
//   private readonly worker: Worker;
//   private constructor(worker: Worker) {
//     this.worker = worker;
//   }

//   public static create() {
//     const worker = new Worker(__filename);
//     return new EncodingWorker(worker);
//   }

//   public enqueue(data: Buffer) {}
// }

// export function create() {
//   return EncodingWorker.create();
// }
