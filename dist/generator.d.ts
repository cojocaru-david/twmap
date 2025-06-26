import { Config } from "./types";
export declare class ClassNameGenerator {
    private config;
    private usedNames;
    private incrementalCounter;
    constructor(config: Config);
    generateClassName(originalClasses: string): string;
    private normalizeClasses;
    private generateHashedName;
    private generateIncrementalName;
    private generateReadableName;
    reset(): void;
}
