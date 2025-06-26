"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwmapProcessor = void 0;
const glob_1 = require("glob");
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const css_generator_1 = require("./css-generator");
const sentry_1 = require("./sentry");
class TwmapProcessor {
    // dryRun: if true, do not write files, just print what would change
    constructor(config, dryRun = false) {
        this.mappings = new Map();
        this.config = config;
        this.fileParser = dryRun ? new parser_1.FileParser(true) : new parser_1.FileParser();
        this.classGenerator = new generator_1.ClassNameGenerator(config);
        this.cssGenerator = new css_generator_1.CSSGenerator();
        this.dryRun = dryRun;
    }
    async process() {
        const transaction = sentry_1.sentry.startTransaction("twmap.process", "processor");
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
            sentry_1.logger.info("🔍 Scanning files...");
            const startTime = Date.now();
            const files = await this.findFiles();
            const findFilesTime = Date.now() - startTime;
            sentry_1.logger.performance("findFiles", findFilesTime, {
                filesFound: files.length,
            });
            sentry_1.logger.info(`📁 Found ${files.length} files to process`);
            transaction.setData("files_found", files.length);
            transaction.addBreadcrumb(`Found ${files.length} files`, "info", {
                count: files.length,
            });
            sentry_1.logger.info("🎨 Parsing class names...");
            const parseStartTime = Date.now();
            const parseResults = await Promise.all(files.map((file) => this.fileParser.parseFile(file)));
            const parseTime = Date.now() - parseStartTime;
            const successfulParses = parseResults.filter((r) => r.success);
            const failedParses = parseResults.filter((r) => !r.success);
            sentry_1.logger.performance("parseFiles", parseTime, {
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
                sentry_1.logger.warn(`⚠️  Failed to parse ${failedParses.length} files:`);
                failedParses.forEach((result) => {
                    if (result.error) {
                        sentry_1.logger.error(`Parse failed: ${result.filePath}: ${result.error}`, undefined, {
                            filePath: result.filePath,
                            error: result.error,
                        });
                    }
                });
            }
            sentry_1.logger.info("🔄 Generating class mappings...");
            const mappingStartTime = Date.now();
            this.generateMappings(successfulParses);
            const mappingTime = Date.now() - mappingStartTime;
            sentry_1.logger.performance("generateMappings", mappingTime, {
                mappingsGenerated: this.mappings.size,
            });
            transaction.setData("mappings_generated", this.mappings.size);
            sentry_1.logger.info("📝 Updating source files...");
            const updateStartTime = Date.now();
            await Promise.all(successfulParses.map((result) => this.updateSourceFile(result)));
            const updateTime = Date.now() - updateStartTime;
            sentry_1.logger.performance("updateSourceFiles", updateTime, {
                filesUpdated: successfulParses.length,
            });
            sentry_1.logger.info("📦 Generating CSS file...");
            const cssStartTime = Date.now();
            await this.generateCSSFile();
            const cssTime = Date.now() - cssStartTime;
            sentry_1.logger.performance("generateCSS", cssTime);
            const stats = this.cssGenerator.generateStats(Array.from(this.mappings.entries()).map(([original, generated]) => ({
                original,
                generated,
            })));
            sentry_1.logger.info(stats);
            if (this.dryRun) {
                const changedFiles = successfulParses.filter((result) => result.classNames.length > 0);
                sentry_1.logger.info(`🔍 Dry run summary: ${changedFiles.length} files would be updated.`);
                changedFiles.forEach((result) => sentry_1.logger.info(`  - ${result.filePath}`));
            }
            sentry_1.logger.info(`✅ Process completed! CSS file generated at: ${this.config.output}`);
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
            sentry_1.logger.performance("totalProcess", totalTime, processResult);
        }
        catch (error) {
            transaction.setTag("error", "true");
            transaction.setData("error_details", {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            sentry_1.logger.error("Error during processing", error, {
                stage: "process",
                dryRun: this.dryRun,
            });
            throw error;
        }
        finally {
            transaction.finish();
        }
    }
    async findFiles() {
        const allFiles = new Set();
        for (const pattern of this.config.input) {
            try {
                const matches = await (0, glob_1.glob)(pattern, {
                    ignore: this.config.ignore,
                    absolute: true,
                });
                matches.forEach((file) => allFiles.add(file));
            }
            catch (error) {
                sentry_1.logger.warn(`Warning: Could not process glob pattern "${pattern}": ${error}`);
            }
        }
        return Array.from(allFiles);
    }
    generateMappings(parseResults) {
        const allClassNames = new Set();
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
        sentry_1.logger.info(`🎯 Generated ${this.mappings.size} unique class mappings`);
    }
    // Helper for parallel file updating
    async updateSourceFile(result) {
        if (result.classNames.length > 0) {
            try {
                this.fileParser.replaceClassNamesInFile(result.filePath, this.mappings, this.dryRun);
                process.stdout.write(this.dryRun ? "d" : ".");
            }
            catch (error) {
                sentry_1.logger.error(`Failed to update file ${result.filePath}:`, error);
                process.stdout.write("✗");
            }
        }
    }
    async generateCSSFile() {
        if (this.dryRun) {
            sentry_1.logger.info(`Dry run: CSS file would be generated at ${this.config.output}`);
            return;
        }
        // Deduplicate mappings by normalized @apply value
        const seenApply = new Map();
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
        const classMappings = Array.from(seenApply.values());
        await this.cssGenerator.generateCSS(classMappings, this.config.output, this.config.cssCompressor);
    }
    getMappings() {
        return new Map(this.mappings);
    }
    reset() {
        this.mappings.clear();
        this.classGenerator.reset();
    }
}
exports.TwmapProcessor = TwmapProcessor;
