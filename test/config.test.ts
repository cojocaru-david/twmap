import { loadConfig, validateConfig } from "../src/config";
import * as fs from "fs";
import * as path from "path";

describe("Config", () => {
  it("should load default config if no file", () => {
    const config = loadConfig("__not_exist__.js");
    expect(config.input).toBeDefined();
    expect(config.output).toBeDefined();
  });

  it("should load config from file", () => {
    const tmpFile = path.join(__dirname, "tmp-config.js");
    fs.writeFileSync(
      tmpFile,
      'module.exports = { input: ["./foo"], output: "bar.css", mode: "hash", prefix: "tw-", ignore: [] }',
      "utf-8",
    );
    const config = loadConfig(tmpFile);
    expect(config.input).toContain("./foo");
    expect(config.output).toBe("bar.css");
    fs.unlinkSync(tmpFile);
  });

  it("should throw on invalid config", () => {
    expect(() =>
      validateConfig({
        input: [],
        output: "",
        mode: "hash",
        prefix: 123 as any,
        ignore: null as any,
      } as any),
    ).toThrow();
  });
});
