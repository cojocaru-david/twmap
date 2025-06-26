import { ParseResult } from "./types";
export declare class FileParser {
    private tailwindClassRegex;
    private dryRun;
    constructor(dryRun?: boolean);
    parseFile(filePath: string): Promise<ParseResult>;
    private parseHTML;
    private parseJSX;
    private deduplicateClassNames;
    private containsTailwindClasses;
    /**
     * Replaces class/className attributes in a file with mapped class names.
     * If dryRun is true, prints what would change instead of writing.
     * Handles errors gracefully.
     */
    replaceClassNamesInFile(filePath: string, replacements: Map<string, string>, dryRun?: boolean): void;
}
