"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwmapProcessor = void 0;
const glob_1 = require("glob");
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const css_generator_1 = require("./css-generator");
const Sentry = __importStar(require("@sentry/node"));
const { logger } = Sentry;
const SENTRY_DSN = process.env.SENTRY_DSN;
// Simple logger utility
const loggerConsole = {
    info: (msg) => {
        console.log(msg);
    },
    warn: (msg) => {
        console.warn(msg);
        if (SENTRY_DSN)
            Sentry.captureMessage(msg, 'warning');
    },
    error: (msg, err) => {
        console.error(msg, err);
        if (SENTRY_DSN)
            Sentry.captureException(err || msg);
        if (SENTRY_DSN)
            Sentry.captureMessage(msg, 'error');
    }
};
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
    async findFiles() {
        const allFiles = new Set();
        for (const pattern of this.config.input) {
            try {
                const matches = await (0, glob_1.glob)(pattern, {
                    ignore: this.config.ignore,
                    absolute: true
                });
                matches.forEach(file => allFiles.add(file));
            }
            catch (error) {
                loggerConsole.warn(`Warning: Could not process glob pattern "${pattern}": ${error}`);
            }
        }
        return Array.from(allFiles);
    }
    generateMappings(parseResults) {
        const allClassNames = new Set();
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
    async updateSourceFile(result) {
        if (result.classNames.length > 0) {
            try {
                this.fileParser.replaceClassNamesInFile(result.filePath, this.mappings, this.dryRun);
                process.stdout.write(this.dryRun ? 'd' : '.');
            }
            catch (error) {
                loggerConsole.error(`Failed to update file ${result.filePath}:`, error);
                process.stdout.write('✗');
            }
        }
    }
    async generateCSSFile() {
        if (this.dryRun) {
            loggerConsole.info(`Dry run: CSS file would be generated at ${this.config.output}`);
            return;
        }
        // Deduplicate mappings by normalized @apply value
        const seenApply = new Map();
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
