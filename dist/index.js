#!/usr/bin/env node
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
const commander_1 = require("commander");
const config_1 = require("./config");
const processor_1 = require("./processor");
const sentry_1 = require("./sentry");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Initialize Sentry early
sentry_1.sentry.init({
    enableTracing: true,
    debug: process.env.NODE_ENV === "development",
});
async function main() {
    const transaction = sentry_1.sentry.startTransaction("twmap.main", "cli");
    try {
        const cliStartTime = Date.now();
        transaction.addBreadcrumb("Starting twmap CLI", "info", {
            args: process.argv,
            cwd: process.cwd(),
            version: process.version,
        });
        commander_1.program
            .name("twmap")
            .description("Extract and optimize Tailwind utility classes")
            .version("1.0.0")
            .option("-c, --config <path>", "path to config file")
            .option("-i, --input <patterns...>", "input file patterns")
            .option("-o, --output <path>", "output CSS file path")
            .option("-m, --mode <mode>", "class name generation mode (hash|incremental|readable)")
            .option("-p, --prefix <prefix>", "prefix for generated class names")
            .option("--dry-run", "preview changes without modifying files")
            .option("--init", "create a sample config file")
            .parse();
        const options = commander_1.program.opts();
        // Set Sentry context with CLI options
        transaction.setContext("cli_options", options);
        // Handle init command
        if (options.init) {
            sentry_1.logger.info("Initializing twmap config file");
            createSampleConfig();
            transaction.setTag("operation", "init");
            transaction.addBreadcrumb("Config file initialized", "info");
            return;
        }
        sentry_1.logger.info("Loading configuration");
        // Load configuration
        const config = (0, config_1.loadConfig)(options.config);
        // Override config with CLI options
        if (options.input)
            config.input = options.input;
        if (options.output)
            config.output = options.output;
        if (options.mode)
            config.mode = options.mode;
        if (options.prefix)
            config.prefix = options.prefix;
        // Set config context for Sentry
        transaction.setContext("config", {
            mode: config.mode,
            prefix: config.prefix,
            inputCount: config.input.length,
            outputPath: config.output,
            ignoreCount: config.ignore.length,
            cssCompressor: config.cssCompressor,
        });
        // Validate configuration
        sentry_1.logger.info("Validating configuration");
        (0, config_1.validateConfig)(config);
        console.log("🚀 Starting twmap process...");
        console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);
        if (options.dryRun) {
            sentry_1.logger.info("Running in dry-run mode");
            console.log("🔍 Dry run mode - no files will be modified");
            transaction.setTag("dry_run", "true");
            // Run processor in dry-run mode
            const processor = new processor_1.TwmapProcessor(config, true);
            await processor.process();
            return;
        }
        sentry_1.logger.info("Creating processor and starting processing");
        transaction.setTag("dry_run", "false");
        // Create processor and run
        const processor = new processor_1.TwmapProcessor(config);
        await processor.process();
        const totalTime = Date.now() - cliStartTime;
        sentry_1.logger.performance("totalCLI", totalTime);
        sentry_1.logger.info("Processing completed successfully");
        transaction.setTag("success", "true");
        transaction.setData("total_time", totalTime);
    }
    catch (error) {
        transaction.setTag("success", "false");
        transaction.setTag("error", "true");
        sentry_1.logger.error("Error during main execution", error, {
            command: "main",
            options: commander_1.program.opts(),
        });
        console.error("❌ Error:", error instanceof Error ? error.message : error);
        await sentry_1.sentry.flush();
        process.exit(1);
    }
    finally {
        transaction.finish();
    }
}
function createSampleConfig() {
    const configPath = path.join(process.cwd(), "twmap.config.js");
    if (fs.existsSync(configPath)) {
        console.log("⚠️  Config file already exists at:", configPath);
        return;
    }
    const sampleConfig = `module.exports = {
  // Input file patterns to scan for class names
  input: [
    './src/**/*.{tsx,jsx,html}',
    './components/**/*.{tsx,jsx}',
    './examples/**/*.{tsx,jsx,html}',
    './app/**/*.{tsx,jsx,html}',
    './pages/**/*.{tsx,jsx,html}',
    './layouts/**/*.{tsx,jsx,html}'
  ],
  
  // Output path for the generated CSS file
  output: './twmap.css',
  
  // Class name generation mode
  // 'hash' - generates short hash-based names (e.g., 'tw-a1b2c3')
  // 'incremental' - generates incremental names (e.g., 'tw-0', 'tw-1')
  // 'readable' - generates somewhat readable names (e.g., 'tw-textcenter')
  mode: 'hash',
  
  // Prefix for all generated class names
  prefix: 'tw-',
  
  // Patterns to ignore during scanning
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}'
  ]
};
`;
    fs.writeFileSync(configPath, sampleConfig, "utf-8");
    console.log("✅ Sample config file created at:", configPath);
    console.log('📝 Edit the config file to customize settings, then run "twmap" again.');
}
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, _promise) => {
    sentry_1.logger.fatal("Unhandled Promise Rejection", reason, {
        source: "unhandledRejection",
        reason: reason?.toString(),
    });
    sentry_1.sentry.flush().finally(() => {
        process.exit(1);
    });
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    sentry_1.logger.fatal("Uncaught Exception", error, {
        source: "uncaughtException",
        stack: error.stack,
    });
    sentry_1.sentry.flush().finally(() => {
        process.exit(1);
    });
});
// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    sentry_1.logger.info(`Received ${signal}, shutting down gracefully`);
    try {
        await sentry_1.sentry.close();
    }
    catch (error) {
        sentry_1.logger.warn("Error during Sentry shutdown", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    process.exit(0);
};
// Listen for shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
main().catch(async (error) => {
    sentry_1.logger.fatal("Fatal error in main", error);
    try {
        await sentry_1.sentry.flush();
    }
    catch (flushError) {
        sentry_1.logger.warn("Failed to flush Sentry during fatal error", {
            error: flushError instanceof Error ? flushError.message : String(flushError),
        });
    }
    process.exit(1);
});
