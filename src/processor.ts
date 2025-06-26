import { glob } from "glob";
import { Config, ClassMapping, ParseResult } from "./types";
import { FileParser } from "./parser";
import { ClassNameGenerator } from "./generator";
import { CSSGenerator } from "./css-generator";
import { sentry, logger } from "./sentry";
import * as _path from "path";

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
    const transaction = sentry.startTransaction("twmap.process", "processor");

    try {
      // Log analytics about the user environment and add to Sentry context
      const analytics = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: process.cwd(),
        config: {
          mode: this.config.mode,
          inputPatterns: this.config.input.length,
          outputPath: this.config.output,
          dryRun: this.dryRun,
        },
      };

      transaction.setContext("analytics", analytics);
      transaction.addBreadcrumb("Starting twmap process", "info", analytics);
      logger.info("🔍 Scanning files...");

      const startTime = Date.now();
      const files = await this.findFiles();
      const findFilesTime = Date.now() - startTime;

      logger.performance("findFiles", findFilesTime, {
        filesFound: files.length,
      });
      logger.info(`📁 Found ${files.length} files to process`);

      transaction.setData("files_found", files.length);
      transaction.addBreadcrumb(`Found ${files.length} files`, "info", {
        count: files.length,
      });

      logger.info("🎨 Parsing class names...");
      const parseStartTime = Date.now();
      const parseResults = await Promise.all(
        files.map((file) => this.fileParser.parseFile(file)),
      );
      const parseTime = Date.now() - parseStartTime;

      const successfulParses = parseResults.filter((r) => r.success);
      const failedParses = parseResults.filter((r) => !r.success);

      logger.performance("parseFiles", parseTime, {
        totalFiles: files.length,
        successful: successfulParses.length,
        failed: failedParses.length,
      });

      transaction.setData("parse_results", {
        total: parseResults.length,
        successful: successfulParses.length,
        failed: failedParses.length,
      });

      if (failedParses.length > 0) {
        logger.warn(`⚠️  Failed to parse ${failedParses.length} files:`);

        failedParses.forEach((result) => {
          if (result.error) {
            logger.error(
              `Parse failed: ${result.filePath}: ${result.error}`,
              undefined,
              {
                filePath: result.filePath,
                error: result.error,
              },
            );
          }
        });
      }

      logger.info("🔄 Generating class mappings...");
      const mappingStartTime = Date.now();
      this.generateMappings(successfulParses);
      const mappingTime = Date.now() - mappingStartTime;

      logger.performance("generateMappings", mappingTime, {
        mappingsGenerated: this.mappings.size,
      });

      transaction.setData("mappings_generated", this.mappings.size);

      logger.info("📝 Updating source files...");
      const updateStartTime = Date.now();
      await Promise.all(
        successfulParses.map((result) => this.updateSourceFile(result)),
      );
      const updateTime = Date.now() - updateStartTime;

      logger.performance("updateSourceFiles", updateTime, {
        filesUpdated: successfulParses.length,
      });

      logger.info("📦 Generating CSS file...");
      const cssStartTime = Date.now();
      await this.generateCSSFile();
      const cssTime = Date.now() - cssStartTime;

      logger.performance("generateCSS", cssTime);

      const stats = this.cssGenerator.generateStats(
        Array.from(this.mappings.entries()).map(([original, generated]) => ({
          original,
          generated,
        })),
      );
      logger.info(stats);

      if (this.dryRun) {
        const changedFiles = successfulParses.filter(
          (result) => result.classNames.length > 0,
        );
        logger.info(
          `🔍 Dry run summary: ${changedFiles.length} files would be updated.`,
        );
        changedFiles.forEach((result) => logger.info(`  - ${result.filePath}`));
      }

      logger.info(
        `✅ Process completed! CSS file generated at: ${this.config.output}`,
      );

      // Set success context for Sentry
      const totalTime = Date.now() - startTime;
      const processResult = {
        success: true,
        filesProcessed: files.length,
        successfulParses: successfulParses.length,
        failedParses: failedParses.length,
        mappingsGenerated: this.mappings.size,
        totalTime,
        performance: {
          findFiles: findFilesTime,
          parseFiles: parseTime,
          generateMappings: mappingTime,
          updateFiles: updateTime,
          generateCSS: cssTime,
        },
      };

      transaction.setContext("process_result", processResult);
      logger.performance("totalProcess", totalTime, processResult);
    } catch (error) {
      transaction.setTag("error", "true");
      transaction.setData("error_details", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      logger.error("Error during processing", error, {
        stage: "process",
        dryRun: this.dryRun,
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }

  private async findFiles(): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of this.config.input) {
      try {
        const matches = await glob(pattern, {
          ignore: this.config.ignore,
          absolute: true,
        });

        matches.forEach((file) => allFiles.add(file));
      } catch (error) {
        logger.warn(
          `Warning: Could not process glob pattern "${pattern}": ${error}`,
        );
      }
    }

    return Array.from(allFiles);
  }

  private generateMappings(parseResults: ParseResult[]): void {
    const allClassNames = new Set<string>();

    // Collect all unique class name combinations
    parseResults.forEach((result) => {
      result.classNames.forEach((className) => {
        allClassNames.add(className);
      });
    });

    // Generate mappings for each unique class combination
    allClassNames.forEach((className) => {
      if (!this.mappings.has(className)) {
        const generatedName = this.classGenerator.generateClassName(className);
        this.mappings.set(className, generatedName);
      }
    });

    logger.info(`🎯 Generated ${this.mappings.size} unique class mappings`);
  }

  // Helper for parallel file updating
  private async updateSourceFile(result: ParseResult): Promise<void> {
    if (result.classNames.length > 0) {
      try {
        this.fileParser.replaceClassNamesInFile(
          result.filePath,
          this.mappings,
          this.dryRun,
        );
        process.stdout.write(this.dryRun ? "d" : ".");
      } catch (error) {
        logger.error(`Failed to update file ${result.filePath}:`, error);
        process.stdout.write("✗");
      }
    }
  }

  private async generateCSSFile(): Promise<void> {
    if (this.dryRun) {
      logger.info(
        `Dry run: CSS file would be generated at ${this.config.output}`,
      );
      return;
    }
    // Deduplicate mappings by normalized @apply value
    const seenApply = new Map<string, ClassMapping>();
    for (const [original, generated] of this.mappings.entries()) {
      // Normalize the original class string (sort classes)
      const normalized = original
        .split(/\s+/)
        .filter((cls) => cls.trim().length > 0)
        .sort()
        .join(" ");
      if (!seenApply.has(normalized)) {
        seenApply.set(normalized, { original, generated });
      }
    }
    const classMappings: ClassMapping[] = Array.from(seenApply.values());
    await this.cssGenerator.generateCSS(
      classMappings,
      this.config.output,
      this.config.cssCompressor,
    );
  }

  getMappings(): Map<string, string> {
    return new Map(this.mappings);
  }

  reset(): void {
    this.mappings.clear();
    this.classGenerator.reset();
  }
}
