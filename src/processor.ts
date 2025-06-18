import { glob } from 'glob';
import { Config, ClassMapping, ParseResult } from './types';
import { FileParser } from './parser';
import { ClassNameGenerator } from './generator';
import { CSSGenerator } from './css-generator';
import * as _path from 'path';
import * as Sentry from '@sentry/node';
const { logger } = Sentry;
const SENTRY_DSN = process.env.SENTRY_DSN;


// Simple logger utility
const loggerConsole = {
  info: (msg: string) => {
    console.log(msg);
  },
  warn: (msg: string) => {
    console.warn(msg);
    if (SENTRY_DSN) Sentry.captureMessage(msg, 'warning');
  },
  error: (msg: string, err?: any) => {
    console.error(msg, err);
    if (SENTRY_DSN) Sentry.captureException(err || msg);
    if (SENTRY_DSN) Sentry.captureMessage(msg, 'error');
  }
};

export class TwmapProcessor {
  private config: Config;
  private fileParser: FileParser;
  private classGenerator: ClassNameGenerator;
  private cssGenerator: CSSGenerator;
  private mappings = new Map<string, string>();
  private dryRun: boolean;

  // dryRun: if true, do not write files, just print what would change
  constructor(config: Config, dryRun = false) {
    this.config = config;
    this.fileParser = dryRun ? new FileParser(true) : new FileParser();
    this.classGenerator = new ClassNameGenerator(config);
    this.cssGenerator = new CSSGenerator();
    this.dryRun = dryRun;
  }

  async process(): Promise<void> {
    // Log analytics about the user environment
    logger.info(`Analytics: platform=${process.platform}, arch=${process.arch}, node=${process.version}, cwd=${process.cwd()}`);
    logger.info("Starting twmap process...", { config: [this.config] });
     
    loggerConsole.info('🔍 Scanning files...');
    const files = await this.findFiles();
    loggerConsole.info(`📁 Found ${files.length} files to process`);

    loggerConsole.info('🎨 Parsing class names...');
    const parseResults = await Promise.all(files.map(file => this.fileParser.parseFile(file)));
    
    const successfulParses = parseResults.filter(r => r.success);
    const failedParses = parseResults.filter(r => !r.success);

    if (failedParses.length > 0) {
      loggerConsole.warn(`⚠️  Failed to parse ${failedParses.length} files:`);
      logger.error(`Failed to parse ${failedParses.length} files:`, { files: failedParses.map(f => f.filePath) });
      failedParses.forEach(result => {
        logger.error(`Parse failed: ${result.filePath}: ${result.error}`, { filePath: result.filePath, error: result.error });
        loggerConsole.warn(`Parse failed: ${result.filePath}: ${result.error}`);
      });
    }

    loggerConsole.info('🔄 Generating class mappings...');
    this.generateMappings(successfulParses);

    loggerConsole.info('📝 Updating source files...');
    await Promise.all(successfulParses.map(result => this.updateSourceFile(result)));

    loggerConsole.info('📦 Generating CSS file...');
    await this.generateCSSFile();

    const stats = this.cssGenerator.generateStats(Array.from(this.mappings.entries()).map(([original, generated]) => ({ original, generated })));
    loggerConsole.info(stats);

    if (this.dryRun) {
      const changedFiles = successfulParses.filter(result => result.classNames.length > 0);
      loggerConsole.info(`🔍 Dry run summary: ${changedFiles.length} files would be updated.`);
      changedFiles.forEach(result => loggerConsole.info(`  - ${result.filePath}`));
    }

    loggerConsole.info(`✅ Process completed! CSS file generated at: ${this.config.output}`);
  }

  private async findFiles(): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of this.config.input) {
      try {
        const matches = await glob(pattern, {
          ignore: this.config.ignore,
          absolute: true
        });
        
        matches.forEach(file => allFiles.add(file));
      } catch (error) {
        loggerConsole.warn(`Warning: Could not process glob pattern "${pattern}": ${error}`);
      }
    }

    return Array.from(allFiles);
  }

  private generateMappings(parseResults: ParseResult[]): void {
    const allClassNames = new Set<string>();

    // Collect all unique class name combinations
    parseResults.forEach(result => {
      result.classNames.forEach(className => {
        allClassNames.add(className);
      });
    });

    // Generate mappings for each unique class combination
    allClassNames.forEach(className => {
      if (!this.mappings.has(className)) {
        const generatedName = this.classGenerator.generateClassName(className);
        this.mappings.set(className, generatedName);
      }
    });

    loggerConsole.info(`🎯 Generated ${this.mappings.size} unique class mappings`);
  }

  // Helper for parallel file updating
  private async updateSourceFile(result: ParseResult): Promise<void> {
    if (result.classNames.length > 0) {
      try {
        this.fileParser.replaceClassNamesInFile(result.filePath, this.mappings, this.dryRun);
        process.stdout.write(this.dryRun ? 'd' : '.');
      } catch (error) {
        loggerConsole.error(`Failed to update file ${result.filePath}:`, error);
        process.stdout.write('✗');
      }
    }
  }

  private async generateCSSFile(): Promise<void> {
    if (this.dryRun) {
      loggerConsole.info(`Dry run: CSS file would be generated at ${this.config.output}`);
      return;
    }
    // Deduplicate mappings by normalized @apply value
    const seenApply = new Map<string, ClassMapping>();
    for (const [original, generated] of this.mappings.entries()) {
      // Normalize the original class string (sort classes)
      const normalized = original
        .split(/\s+/)
        .filter(cls => cls.trim().length > 0)
        .sort()
        .join(' ');
      if (!seenApply.has(normalized)) {
        seenApply.set(normalized, { original, generated });
      }
    }
    const classMappings: ClassMapping[] = Array.from(seenApply.values());
    await this.cssGenerator.generateCSS(classMappings, this.config.output, this.config.cssCompressor);
  }

  getMappings(): Map<string, string> {
    return new Map(this.mappings);
  }

  reset(): void {
    this.mappings.clear();
    this.classGenerator.reset();
  }
}
