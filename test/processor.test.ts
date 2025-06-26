import { TwmapProcessor } from "../src/processor";
import { Config } from "../src/types";
import * as fs from "fs";
import * as path from "path";

describe("TwmapProcessor", () => {
  const tmpFile = path.join(__dirname, "tmp-e2e.html");
  const cssFile = path.join(__dirname, "tmp-e2e.css");
  const config: Config = {
    input: [tmpFile],
    output: cssFile,
    mode: "hash",
    prefix: "tw-",
    ignore: [],
  };

  beforeEach(() => {
    fs.writeFileSync(
      tmpFile,
      '<div class="text-center p-4 bg-blue-500">Hello</div>',
      "utf-8",
    );
    if (fs.existsSync(cssFile)) fs.unlinkSync(cssFile);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    if (fs.existsSync(cssFile)) fs.unlinkSync(cssFile);
  });

  it("should process files and generate CSS (dry run)", async () => {
    const processor = new TwmapProcessor(config, true);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    await processor.process();
    expect(fs.existsSync(cssFile)).toBe(false); // dry run, no CSS file
    spy.mockRestore();
  });

  it("should process files and generate CSS (real run)", async () => {
    const processor = new TwmapProcessor(config, false);
    await processor.process();
    expect(fs.existsSync(cssFile)).toBe(true);
    const css = fs.readFileSync(cssFile, "utf-8");
    expect(css).toMatch(/@apply text-center p-4 bg-blue-500/);
  });
});
