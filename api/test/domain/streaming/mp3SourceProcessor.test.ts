import * as path from "path";
import { promises as fs } from "fs";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";
import { Mp3SourceProcessor } from "../../../src/domain/streaming/mp3SourceProcessor";
import { Lame } from "lame-wasm";

chai.use(chaiAsPromised);
const { expect } = chai;

const FIXTURE_DIR = path.join(__dirname, "..", "..", "fixtures");

describe("The Mp3SourceProcessor class", () => {
  describe("The process method", () => {
    it("Should output mp3 audio data from stereo PCM input", async () => {
      const processor = await Mp3SourceProcessor.create();

      const inputPcms = await loadFixtures(
        "input-stereo-left.pcm",
        "input-stereo-right.pcm"
      );

      const expectedOutput = await fs.readFile(
        path.join(FIXTURE_DIR, "output-stereo.mp3")
      );

      // processor expects channels concatenated together in one array,
      // preceded by a byte indicating the number of channels
      const input = Buffer.concat([
        Buffer.from([inputPcms.length]),
        ...inputPcms
      ]);

      const actualOutput = Buffer.concat(
        await consumeAsyncIterable(processor.process(input))
      );

      expect(actualOutput.equals(expectedOutput)).to.be.true;
    });

    it("Should output mp3 audio data from mono PCM input", async () => {
      const lame = await Lame.load({ stereo: false });
      const processor = await Mp3SourceProcessor.create(lame);

      const inputPcms = await loadFixtures("input-mono.pcm");

      const expectedOutput = await fs.readFile(
        path.join(FIXTURE_DIR, "output-mono.mp3")
      );

      // processor expects channels concatenated together in one array,
      // preceded by a byte indicating the number of channels
      const input = Buffer.concat([
        Buffer.from([inputPcms.length]),
        ...inputPcms
      ]);

      const actualOutput = Buffer.concat(
        await consumeAsyncIterable(processor.process(input))
      );
      expect(actualOutput.equals(expectedOutput)).to.be.true;
    });

    it("should handle a buffer that's a slice of a larger ArrayBuffer", async () => {
      const inputPcms = await loadFixtures(
        "input-stereo-left.pcm",
        "input-stereo-right.pcm"
      );

      const expectedOutput = await fs.readFile(
        path.join(FIXTURE_DIR, "output-stereo.mp3")
      );

      // processor expects channels concatenated together in one array,
      // preceded by a byte indicating the number of channels
      const input = Buffer.concat([
        Buffer.from([inputPcms.length]),
        ...inputPcms
      ]);

      for (const extraBytesLeft of [0]) {
        for (const extraBytesRight of [0, 1, 10000]) {
          const totalSize = extraBytesLeft + input.length + extraBytesRight;
          const arrayBuffer = new ArrayBuffer(totalSize);
          const buf = Buffer.from(arrayBuffer, extraBytesLeft, input.length);
          input.copy(buf);
          const processor = await Mp3SourceProcessor.create();

          const actualOutput = Buffer.concat(
            await consumeAsyncIterable(processor.process(input))
          );
          expect(
            actualOutput.equals(expectedOutput),
            `failed with extraBytesLeft=${extraBytesLeft}, extraBytesRight=${extraBytesRight}`
          ).to.be.true;
        }
      }
    });

    describe("Should reject invalid input", async () => {
      it("When the number of channels is invalid", async () => {
        const processor = await Mp3SourceProcessor.create();

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([-1])]))
          )
        ).to.be.rejectedWith("Invalid number of channels in input");

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([0])]))
          )
        ).to.be.rejectedWith("Invalid number of channels in input");

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([1])]))
          )
        ).to.be.rejectedWith("Invalid number of channels in input");

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([3])]))
          )
        ).to.be.rejectedWith("Invalid number of channels in input");

        const monoLame = await Lame.load({ stereo: false });
        const monoProcessor = await Mp3SourceProcessor.create(monoLame);
        expect(
          consumeAsyncIterable(
            monoProcessor.process(Buffer.concat([Buffer.from([2])]))
          )
        ).to.be.rejectedWith("Invalid number of channels in input");
      });

      it("When channel data have unequal size", async () => {
        const processor = await Mp3SourceProcessor.create();

        const left = Buffer.from([1, 2, 3, 4]);
        const right = Buffer.from([1, 2, 3]);

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([2]), left, right]))
          )
        ).to.be.rejectedWith(
          "channel data size not a multiple of the number of channels"
        );
      });

      it("When channel size is not a multiple of 4", async () => {
        const processor = await Mp3SourceProcessor.create();

        const left = Buffer.from([1, 2, 3]);
        const right = Buffer.from([1, 2, 3]);

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([2]), left, right]))
          )
        ).to.be.rejectedWith("channel data size not a multiple of 4");
      });

      it("When channel values are not within [-1,1]", async () => {
        const processor = await Mp3SourceProcessor.create();
        const left = bufferFromFloats(1.0, 0, 0.5);
        const right = bufferFromFloats(1.0, 1.1, 1);

        expect(
          consumeAsyncIterable(
            processor.process(Buffer.concat([Buffer.from([2]), left, right]))
          )
        ).to.be.rejectedWith(
          "not every element of channel 1 is in the range [-1,1]"
        );
      });
    });
  });
});

///////////////////////// helpers /////////////////////////

function bufferFromFloats(...floats: number[]) {
  const buf = Buffer.alloc(floats.length * 4);
  floats.forEach((f, i) => {
    buf.writeFloatLE(f, i * 4);
  });

  return buf;
}

function loadFixtures(...fnames: string[]) {
  return Promise.all(
    fnames.map(fname => {
      const absFname = path.join(FIXTURE_DIR, fname);
      const data = fs.readFile(absFname);
      return data;
    })
  );
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
