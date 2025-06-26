import { ClassNameGenerator } from "../src/generator";
import { Config } from "../src/types";

describe("ClassNameGenerator", () => {
  const baseConfig: Config = {
    input: [],
    output: "",
    mode: "hash",
    prefix: "tw-",
    ignore: [],
  };

  it("should generate unique hash names", () => {
    const gen = new ClassNameGenerator({ ...baseConfig, mode: "hash" });
    const name1 = gen.generateClassName("text-center p-4");
    const name2 = gen.generateClassName("bg-blue-500");
    expect(name1).not.toEqual(name2);
    expect(name1).toMatch(/^tw-/);
  });

  it("should generate incremental names", () => {
    const gen = new ClassNameGenerator({ ...baseConfig, mode: "incremental" });
    const name1 = gen.generateClassName("a");
    const name2 = gen.generateClassName("b");
    expect(name1).toBe("tw-0");
    expect(name2).toBe("tw-1");
  });

  it("should generate readable names", () => {
    const gen = new ClassNameGenerator({ ...baseConfig, mode: "readable" });
    const name = gen.generateClassName("text-center p-4 bg-blue-500");
    expect(name).toMatch(/^tw-/);
    expect(name.length).toBeLessThanOrEqual(13); // prefix + up to 10 chars
  });
});
