import { ClassMapping } from './types';
export declare class CSSGenerator {
    generateCSS(mappings: ClassMapping[], outputPath: string, compress?: boolean): Promise<void>;
    private buildCSSContent;
    private createCSSRule;
    generateStats(mappings: ClassMapping[]): string;
}
