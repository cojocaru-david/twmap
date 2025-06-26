import * as fs from "fs";
import * as path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { JSDOM } from "jsdom";
import { ParseResult } from "./types";
import { sentry, logger } from "./sentry";

export class FileParser {
  private tailwindClassRegex = /\b[a-z-]+(?:-[a-z0-9]+)*(?:\/[0-9]+)?\b/g;
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.dryRun = dryRun;
  }

  async parseFile(filePath: string): Promise<ParseResult> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const extension = path.extname(filePath).toLowerCase();

      let classNames: string[] = [];

      if (extension === ".html") {
        classNames = this.parseHTML(content);
      } else if ([".jsx", ".tsx", ".js", ".ts"].includes(extension)) {
        classNames = this.parseJSX(content, filePath);
      }

      return {
        filePath,
        classNames: this.deduplicateClassNames(classNames),
        success: true,
      };
    } catch (_error) {
      logger.error(`Failed to parse file: ${filePath}`, _error, {
        filePath,
        extension: path.extname(filePath).toLowerCase(),
      });

      return {
        filePath,
        classNames: [],
        success: false,
        error: _error instanceof Error ? _error.message : "Unknown error",
      };
    }
  }

  private parseHTML(content: string): string[] {
    const classNames: string[] = [];

    try {
      const dom = new JSDOM(content);
      const elements = dom.window.document.querySelectorAll("[class]");

      elements.forEach((element) => {
        const classAttr = element.getAttribute("class");
        if (classAttr) {
          classNames.push(classAttr);
        }
      });
    } catch (_error) {
      logger.error("Failed to parse HTML content", _error, {
        contentLength: content.length,
        parseMethod: "jsdom",
      });

      // Fallback to regex parsing if DOM parsing fails
      const classMatches = content.match(/class\s*=\s*["']([^"']*)["']/g);
      if (classMatches) {
        classMatches.forEach((match) => {
          const classValue = match.match(/["']([^"']*)["']/);
          if (classValue && classValue[1]) {
            classNames.push(classValue[1]);
          }
        });
      }
    }

    return classNames;
  }

  private parseJSX(content: string, filePath: string): string[] {
    const classNames: string[] = [];

    try {
      const ast = parse(content, {
        sourceType: "module",
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          "jsx",
          "typescript",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "asyncGenerators",
          "functionBind",
          "exportDefaultFrom",
          "exportNamespaceFrom",
          "dynamicImport",
        ],
      });

      traverse(ast, {
        JSXAttribute(path) {
          const attrName = path.node.name;
          if (
            attrName.type === "JSXIdentifier" &&
            (attrName.name === "className" || attrName.name === "class")
          ) {
            const value = path.node.value;

            if (value && value.type === "StringLiteral") {
              classNames.push(value.value);
            } else if (value && value.type === "JSXExpressionContainer") {
              // Handle template literals and simple expressions
              const expression = value.expression;
              if (expression.type === "TemplateLiteral") {
                // Extract static parts from template literal
                expression.quasis.forEach((quasi) => {
                  if (quasi.value.raw) {
                    classNames.push(quasi.value.raw);
                  }
                });
              } else if (expression.type === "StringLiteral") {
                classNames.push(expression.value);
              } else {
                logger.warn(
                  `Skipping dynamic className in ${filePath} at line ${path.node.loc?.start.line || "?"}: cannot statically analyze.`,
                  {
                    filePath,
                    line: path.node.loc?.start.line,
                    expressionType: expression.type,
                  },
                );
                // Warn about dynamic/complex expressions
                console.warn(
                  `[twmap] Skipping dynamic className in ${filePath} at line ${path.node.loc?.start.line || "?"}: cannot statically analyze.`,
                );
              }
            }
          }
        },
      });
    } catch (_error) {
      logger.error("Failed to parse JSX content", _error, {
        filePath,
        contentLength: content.length,
        parseMethod: "babel",
      });

      // Fallback to regex parsing if AST parsing fails
      const classMatches = content.match(
        /(?:className|class)\s*=\s*(?:["']([^"']*)["']|{["']([^"']*)["']})/g,
      );
      if (classMatches) {
        classMatches.forEach((match) => {
          const classValue = match.match(/["']([^"']*)["']/);
          if (classValue && classValue[1]) {
            classNames.push(classValue[1]);
          }
        });
      }
    }

    return classNames;
  }

  private deduplicateClassNames(classNames: string[]): string[] {
    const uniqueClassNames = new Set<string>();

    classNames.forEach((className) => {
      const trimmed = className.trim();
      if (trimmed && this.containsTailwindClasses(trimmed)) {
        uniqueClassNames.add(trimmed);
      }
    });

    return Array.from(uniqueClassNames);
  }
  private containsTailwindClasses(className: string): boolean {
    // Simple heuristic to check if a class string contains Tailwind classes
    const classes = className.split(/\s+/);
    return classes.some((cls) => {
      // Common Tailwind patterns
      return (
        /^(bg-|text-|p-|m-|px-|py-|pl-|pr-|pt-|pb-|mx-|my-|ml-|mr-|mt-|mb-|w-|h-|min-|max-|flex|grid|border|rounded|shadow|opacity|transform|transition|hover:|focus:|active:|sm:|md:|lg:|xl:|2xl:|space-|divide-|ring-|outline-|cursor-|select-|pointer-|underline|overline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|italic|not-italic|font-|leading-|tracking-|align-|whitespace-|break-|overflow-|object-|clear-|float-|table-|border-|rounded-|shadow-|blur-|brightness-|contrast-|grayscale|invert|sepia|saturate|hue-rotate|drop-shadow)/.test(
          cls,
        ) ||
        /^(absolute|relative|fixed|static|sticky|block|inline|inline-block|flex|inline-flex|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|flow-root|grid|inline-grid|contents|list-item|hidden|visible|invisible|collapse)$/.test(
          cls,
        ) ||
        /^(container|sr-only|not-sr-only|focus-within|motion-safe|motion-reduce|first|last|odd|even|first-of-type|last-of-type|only-of-type|visited|target|open|default|checked|indeterminate|placeholder-shown|autofill|disabled|read-only|required|valid|invalid|in-range|out-of-range)$/.test(
          cls,
        ) ||
        /^[a-z]+-\d+/.test(cls) ||
        /^-?[a-z]+-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(
          cls,
        ) ||
        /^(top|right|bottom|left|inset)-/.test(cls) ||
        /^z-\d+$/.test(cls)
      );
    });
  }

  /**
   * Replaces class/className attributes in a file with mapped class names.
   * If dryRun is true, prints what would change instead of writing.
   * Handles errors gracefully.
   */
  replaceClassNamesInFile(
    filePath: string,
    replacements: Map<string, string>,
    dryRun = this.dryRun,
  ): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      let modifiedContent = content;

      // Sort replacements by length (longest first) to avoid partial replacements
      const sortedReplacements = Array.from(replacements.entries()).sort(
        (a, b) => b[0].length - a[0].length,
      );

      sortedReplacements.forEach(([original, replacement]) => {
        // Escape special regex characters in the original class string
        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Replace in class attributes (HTML)
        const htmlRegex = new RegExp(
          `(class\\s*=\\s*["'])([^"']*?)${escapedOriginal}([^"']*?)(["'])`,
          "g",
        );
        modifiedContent = modifiedContent.replace(
          htmlRegex,
          (match, prefix, before, after, suffix) => {
            const newClasses = `${before}${replacement}${after}`
              .replace(/\s+/g, " ")
              .trim();
            return `${prefix}${newClasses}${suffix}`;
          },
        );
        // Replace in className attributes (JSX)
        const jsxRegex = new RegExp(
          `(className\\s*=\\s*["'])([^"']*?)${escapedOriginal}([^"']*?)(["'])`,
          "g",
        );
        modifiedContent = modifiedContent.replace(
          jsxRegex,
          (match, prefix, before, after, suffix) => {
            const newClasses = `${before}${replacement}${after}`
              .replace(/\s+/g, " ")
              .trim();
            return `${prefix}${newClasses}${suffix}`;
          },
        );
      });

      if (dryRun) {
        if (content !== modifiedContent) {
          console.log(`[Dry Run] Would update: ${filePath}`);
        }
        return;
      }
      if (content !== modifiedContent) {
        fs.writeFileSync(filePath, modifiedContent, "utf-8");
      }
    } catch (_error) {
      logger.error(`Error writing file ${filePath}:`, _error, {
        filePath,
        operation: "replaceClassNamesInFile",
        dryRun,
        replacementsCount: replacements.size,
      });
      console.error(`Error writing file ${filePath}:`, _error);
    }
  }
}
