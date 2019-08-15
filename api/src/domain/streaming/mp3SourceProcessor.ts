import { VError } from "verror";
import { Lame } from "lame-wasm";

export class Mp3SourceProcessor {
  private readonly lame: Lame;
  private numChannels: number;

  public static async create(params: { stereo: boolean }) {
    const lame = await Lame.load(params);
    return new Mp3SourceProcessor(lame);
  }

  private constructor(lame: Lame) {
    this.lame = lame;
    this.numChannels = lame.numChannels();
  }

  public async *process(buffer: Buffer): AsyncIterable<Buffer> {
    const channels = this.splitToPcmChannels(buffer);
    yield* this.lame.encode(...channels);
  }

  // buffer contains the data for all channels, concatenated in one buffer,
  // and preceded by a byte indicating the number of channels
  // the number of channels must match the lame encoder's settings.
  private splitToPcmChannels(buf: Buffer) {
    const bufOffset = buf.byteOffset;
    const allChannels = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.length
    );
    const totalChannelSize = allChannels.byteLength;
    const channels: Float32Array[] = new Array(this.numChannels);

    const throwDataError = (msg: string) => {
      throw new VError(
        {
          name: "InvalidChannelDataError",
          info: {
            numChannels: this.numChannels,
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
    };

    if (totalChannelSize % this.numChannels !== 0) {
      throwDataError(
        "channel data size not a multiple of the number of channels"
      );
    }
    const channelSize = totalChannelSize / this.numChannels;

    if (channelSize % 4 !== 0) {
      throwDataError("channel data size not a multiple of 4");
    }

    for (let i = 0; i < this.numChannels; i++) {
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
