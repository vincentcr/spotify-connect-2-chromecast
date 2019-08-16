import * as path from "path";
import { promises as fs } from "fs";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";
import { Mp3SourceProcessor } from "../../../src/domain/streaming/mp3SourceProcessor";

chai.use(chaiAsPromised);
const { expect } = chai;

const FIXTURE_DIR = path.join(__dirname, "..", "..", "fixtures");

describe("The Mp3SourceProcessor class", () => {
  describe("The process method", () => {
    let inputStereoPcms: Buffer;
    let inputMonoPcm: Buffer;
    let expectedStereoOutput: Buffer;
    let expectedMonoOutput: Buffer;

    before(async () => {
      // processor expects channels concatenated together in one array
      inputStereoPcms = Buffer.concat(
        await loadFixtures("input-stereo-left.pcm", "input-stereo-right.pcm")
      );
      [expectedStereoOutput] = await loadFixtures("output-stereo.mp3");
      [inputMonoPcm] = await loadFixtures("input-mono.pcm");
      [expectedMonoOutput] = await loadFixtures("output-mono.mp3");
    });

    it("Should output mp3 audio data from stereo PCM input", async () => {
      const processor = await Mp3SourceProcessor.create({ stereo: true });

      const actualOutput = Buffer.concat(
        await consumeAsyncIterable(processor.process(inputStereoPcms))
      );

      expect(actualOutput.equals(expectedStereoOutput)).to.be.true;
    });

    it("Should output mp3 audio data from mono PCM input", async () => {
      const processor = await Mp3SourceProcessor.create({ stereo: false });

      const actualOutput = Buffer.concat(
        await consumeAsyncIterable(processor.process(inputMonoPcm))
      );
      expect(actualOutput.equals(expectedMonoOutput)).to.be.true;
    });

    for (const extraBytesLeft of [0, 1, 32, 10000]) {
      for (const extraBytesRight of [0, 1, 32, 10000]) {
        it(`should handle a buffer that's a slice of a larger ArrayBuffer (extraBytesLeft: ${extraBytesLeft}, extraBytesRight:${extraBytesRight})`, async () => {
          const totalSize =
            extraBytesLeft + inputStereoPcms.length + extraBytesRight;
          const arrayBuffer = new ArrayBuffer(totalSize);
          const buf = Buffer.from(
            arrayBuffer,
            extraBytesLeft,
            inputStereoPcms.length
          );
          inputStereoPcms.copy(buf);
          const processor = await Mp3SourceProcessor.create({ stereo: true });

          const actualOutput = Buffer.concat(
            await consumeAsyncIterable(processor.process(inputStereoPcms))
          );
          expect(actualOutput.equals(expectedStereoOutput)).to.be.true;
        });
      }
    }

    describe("Should reject invalid input", async () => {
      it("When channel are not a multiple of the number of channels", async () => {
        const processor = await Mp3SourceProcessor.create({ stereo: true });

        const left = Buffer.from([1, 2, 3, 4]);
        const right = Buffer.from([1, 2, 3]);

        expect(
          consumeAsyncIterable(processor.process(Buffer.concat([left, right])))
        ).to.be.rejectedWith(
          "channel data size not a multiple of the number of channels"
        );
      });

      it("When channel size is not a multiple of 4", async () => {
        const processor = await Mp3SourceProcessor.create({ stereo: true });

        const left = Buffer.from([1, 2, 3]);
        const right = Buffer.from([1, 2, 3]);

        expect(
          consumeAsyncIterable(processor.process(Buffer.concat([left, right])))
        ).to.be.rejectedWith("channel data size not a multiple of 4");
      });
    });
  });
});

///////////////////////// helpers /////////////////////////

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
