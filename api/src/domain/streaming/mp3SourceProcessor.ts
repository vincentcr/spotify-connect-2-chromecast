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
