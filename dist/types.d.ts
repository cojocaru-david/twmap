export interface Config {
    input: string[];
    output: string;
    mode: "hash" | "incremental" | "readable";
    prefix: string;
    ignore: string[];
    cssCompressor?: boolean;
}
export interface ClassMapping {
    original: string;
    generated: string;
}
export interface ParseResult {
    filePath: string;
    classNames: string[];
    success: boolean;
    error?: string;
}
