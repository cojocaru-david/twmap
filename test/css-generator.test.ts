import { CSSGenerator } from "../src/css-generator";
import { ClassMapping } from "../src/types";
import * as fs from "fs";
import * as path from "path";

describe("CSSGenerator", () => {
  const cssFile = path.join(__dirname, "tmp-gen.css");
  const generator = new CSSGenerator();

  afterEach(() => {
    if (fs.existsSync(cssFile)) fs.unlinkSync(cssFile);
  });

  it("should generate CSS with @apply for mappings", () => {
    const mappings: ClassMapping[] = [
      { original: "text-center p-4 bg-blue-500", generated: "tw-abc" },
      { original: "font-bold", generated: "tw-def" },
    ];
    generator.generateCSS(mappings, cssFile);
    const css = fs.readFileSync(cssFile, "utf-8");
    expect(css).toMatch(/\.tw-abc \{\s+@apply text-center p-4 bg-blue-500;/);
    expect(css).toMatch(/\.tw-def \{\s+@apply font-bold;/);
  });
});
