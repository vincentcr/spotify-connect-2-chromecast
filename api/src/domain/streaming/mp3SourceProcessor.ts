import { VError } from "verror";
import { Lame } from "lame-wasm";

export class Mp3SourceProcessor {
  private static lame?: Lame;
  private readonly lame: Lame;

  public static async create() {
    const lame = await this.getLame();
    return new Mp3SourceProcessor(lame);
  }

  private static async getLame() {
    if (this.lame == null) {
      this.lame = await Lame.load({ debug: false });
    }
    return this.lame;
  }

  private constructor(lame: Lame) {
    this.lame = lame;
  }
  public async *process(buffer: Buffer): AsyncIterable<Buffer> {
    const channels = this.splitToPcmChannels(buffer);
    yield* this.lame.encode(...channels);
  }

  private splitToPcmChannels(buf: Buffer) {
    const numChannels = buf.readInt8(0);
    const bufOffset = buf.byteOffset;
    const allChannels = buf.buffer.slice(
      buf.byteOffset + 1,
      buf.byteOffset + buf.length
    );
    const totalChannelSize = allChannels.byteLength;
    const channels: Float32Array[] = new Array(numChannels);

    function throwDataError(msg: string) {
      throw new VError(
        {
          name: "InvalidChannelDataError",
          info: {
            numChannels,
            totalChannelSize,
            totalChannelSizeBytes: allChannels.byteLength,
            bufferSize: buf.length,
            bufOffset,
            bufferByteLength: buf.byteLength,
            bufferUnderlyingBufferByteLength: buf.buffer.byteLength
          }
        },
        msg
      );
    }

    if (totalChannelSize % numChannels !== 0) {
      throwDataError("channel data size not a multiple of number of channel");
    }
    const channelSize = totalChannelSize / numChannels;

    if (channelSize % 4 !== 0) {
      throwDataError("channel data size not a multiple of 4");
    }

    for (let i = 0; i < numChannels; i++) {
      const slice = allChannels.slice(i * channelSize, (i + 1) * channelSize);
      const chan = new Float32Array(slice);
      if (!chan.every(f => f >= -1 && f <= 1)) {
        throwDataError(
          `not every element of channel ${i} is in the range [-1,1]`
        );
      }
      channels[i] = chan;
    }

    return channels;
  }
}

// export interface StreamSourceProcessor {
//   process(buffer: Buffer): void;
//   onProcessed(handler: (buffer: Buffer) => void): void;

//   complete(): void;
//   onCompleted(handler: () => void): void;
// }

// export class Mp3SourceProcessor implements StreamSourceProcessor {
//   private static lame?: Lame;

//   private readonly lame: Lame;
//   private readonly emitter: EventEmitter;
//   private completed = false;
//   private processing = false;

//   public static async create() {
//     const lame = await this.getLame();
//     return new Mp3SourceProcessor(lame);
//   }

//   private static async getLame() {
//     if (this.lame == null) {
//       this.lame = await Lame.load();
//     }
//     return this.lame;
//   }

//   private constructor(lame: Lame) {
//     this.lame = lame;
//     this.emitter = new EventEmitter();
//   }

//   public process(buffer: Buffer) {
//     this.processing = true;
//     const channels = this.splitToPcmChannels(buffer);
//     for (const encoded of this.lame.encode(...channels)) {
//       this.emitter.emit("processed", Buffer.from(encoded.buffer));
//     }
//     this.processing = false;

//     if (this.completed) {
//       this.emitter.emit("completed");
//     }
//   }

//   public onProcessed(handler: (buffer: Buffer) => void) {
//     this.emitter.on("processed", handler);
//   }

//   public complete() {
//     this.completed = true;
//     if (!this.processing) {
//       this.emitter.emit("completed");
//     }
//   }

//   public onCompleted(handler: () => void) {
//     this.emitter.on("completed", handler);
//   }

//   private splitToPcmChannels(buf: Buffer) {
//     const numChannels = buf.readInt8(0);
//     const bufOffset = buf.byteOffset;
//     const allChannels = buf.buffer.slice(
//       buf.byteOffset + 1,
//       buf.byteOffset + 1 + buf.byteLength
//     );
//     const totalChannelSize = allChannels.byteLength;
//     const channels: Float32Array[] = new Array(numChannels);

//     function throwDataError(msg: string) {
//       throw new VError(
//         {
//           name: "InvalidChannelDataError",
//           info: {
//             numChannels,
//             totalChannelSize,
//             totalChannelSizeBytes: allChannels.byteLength,
//             bufferSize: buf.length,
//             bufOffset,
//             bufferByteLength: buf.byteLength,
//             bufferUnderlyingBufferByteLength: buf.buffer.byteLength
//           }
//         },
//         msg
//       );
//     }

//     if (totalChannelSize % numChannels !== 0) {
//       throwDataError("channel data size not a multiple of number of channel");
//     }
//     const channelSize = totalChannelSize / numChannels;

//     if (channelSize % 4 !== 0) {
//       throwDataError("channel data size not a multiple of 4");
//     }

//     for (let i = 0; i < numChannels; i++) {
//       const slice = allChannels.slice(i * channelSize, (i + 1) * channelSize);
//       const chan = new Float32Array(slice);
//       if (!chan.every(f => f >= -1 && f <= 1)) {
//         throwDataError(
//           `not every element of channel ${i} is in the range [-1,1]`
//         );
//       }
//       channels[i] = chan;
//     }

//     // async function onDataAsync(buffer: Buffer) {
//     //   const nChans = buffer.readUInt8(0);
//     //   if ((buffer.length - 1) % nChans !== 0) {
//     //     throw new Error(
//     //       `id ${id}: channel total length ${buffer.length -
//     //         1} not a multiple of num channels ${nChans} (byte ${buffer[0]})`
//     //     );
//     //   }
//     //   if (nChans !== 2) {
//     //     throw new Error(`id ${id}: expected 2 channels, got ${nChans}`);
//     //   }
//     //   const chanLen = (buffer.length - 1) / 2;

//     //   await Promise.all([
//     //     leftFile.write(buffer, 1, chanLen),
//     //     rightFile.write(buffer, chanLen + 1)
//     //   ]);
//     // }

//     return channels;
//   }
// }
