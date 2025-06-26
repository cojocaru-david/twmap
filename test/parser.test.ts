import { FileParser } from "../src/parser";
import * as fs from "fs";
import * as path from "path";

describe("FileParser", () => {
  const parser = new FileParser();

  it("should extract class names from HTML", () => {
    const html = `<div class="text-center p-4 bg-blue-500">Hello</div>`;
    const classNames = parser["parseHTML"](html);
    expect(classNames).toContain("text-center p-4 bg-blue-500");
  });

  it("should extract className from JSX", () => {
    const jsx = `<div className="flex items-center p-2">JSX</div>`;
    const classNames = parser["parseJSX"](jsx, "Component.tsx");
    expect(classNames).toContain("flex items-center p-2");
  });

  it("should replace class names in HTML file", () => {
    const tmpFile = path.join(__dirname, "tmp.html");
    fs.writeFileSync(tmpFile, '<div class="foo bar">Test</div>', "utf-8");
    const replacements = new Map<string, string>([["foo bar", "tw-abc"]]);
    parser.replaceClassNamesInFile(tmpFile, replacements);
    const result = fs.readFileSync(tmpFile, "utf-8");
    expect(result).toContain('class="tw-abc"');
    fs.unlinkSync(tmpFile);
  });

  it("should support dry run mode", () => {
    const tmpFile = path.join(__dirname, "tmp2.html");
    fs.writeFileSync(tmpFile, '<div class="foo bar">Test</div>', "utf-8");
    const replacements = new Map<string, string>([["foo bar", "tw-abc"]]);
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    parser.replaceClassNamesInFile(tmpFile, replacements, true);
    const result = fs.readFileSync(tmpFile, "utf-8");
    expect(result).toContain('class="foo bar"'); // not changed
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Would update"));
    fs.unlinkSync(tmpFile);
    spy.mockRestore();
  });
});
