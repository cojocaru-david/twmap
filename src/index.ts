#!/usr/bin/env node

import { program } from "commander";
import { loadConfig, validateConfig } from "./config";
import { TwmapProcessor } from "./processor";
import { sentry, logger } from "./sentry";
import * as path from "path";
import * as fs from "fs";

// Initialize Sentry early
sentry.init({
  enableTracing: true,
  debug: process.env.NODE_ENV === "development",
});

async function main() {
  const transaction = sentry.startTransaction("twmap.main", "cli");

  try {
    const cliStartTime = Date.now();

    transaction.addBreadcrumb("Starting twmap CLI", "info", {
      args: process.argv,
      cwd: process.cwd(),
      version: process.version,
    });

    program
      .name("twmap")
      .description("Extract and optimize Tailwind utility classes")
      .version("1.0.0")
      .option("-c, --config <path>", "path to config file")
      .option("-i, --input <patterns...>", "input file patterns")
      .option("-o, --output <path>", "output CSS file path")
      .option(
        "-m, --mode <mode>",
        "class name generation mode (hash|incremental|readable)",
      )
      .option("-p, --prefix <prefix>", "prefix for generated class names")
      .option("--dry-run", "preview changes without modifying files")
      .option("--init", "create a sample config file")
      .parse();

    const options = program.opts();

    // Set Sentry context with CLI options
    transaction.setContext("cli_options", options);

    // Handle init command
    if (options.init) {
      logger.info("Initializing twmap config file");
      createSampleConfig();
      transaction.setTag("operation", "init");
      transaction.addBreadcrumb("Config file initialized", "info");
      return;
    }

    logger.info("Loading configuration");

    // Load configuration
    const config = loadConfig(options.config);

    // Override config with CLI options
    if (options.input) config.input = options.input;
    if (options.output) config.output = options.output;
    if (options.mode) config.mode = options.mode;
    if (options.prefix) config.prefix = options.prefix;

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
    logger.info("Validating configuration");
    validateConfig(config);

    console.log("🚀 Starting twmap process...");
    console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);

    if (options.dryRun) {
      logger.info("Running in dry-run mode");
      console.log("🔍 Dry run mode - no files will be modified");

      transaction.setTag("dry_run", "true");

      // Run processor in dry-run mode
      const processor = new TwmapProcessor(config, true);
      await processor.process();
      return;
    }

    logger.info("Creating processor and starting processing");
    transaction.setTag("dry_run", "false");

    // Create processor and run
    const processor = new TwmapProcessor(config);
    await processor.process();

    const totalTime = Date.now() - cliStartTime;
    logger.performance("totalCLI", totalTime);
    logger.info("Processing completed successfully");

    transaction.setTag("success", "true");
    transaction.setData("total_time", totalTime);
  } catch (error) {
    transaction.setTag("success", "false");
    transaction.setTag("error", "true");

    logger.error("Error during main execution", error, {
      command: "main",
      options: program.opts(),
    });

    console.error("❌ Error:", error instanceof Error ? error.message : error);
    await sentry.flush();
    process.exit(1);
  } finally {
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
  console.log(
    '📝 Edit the config file to customize settings, then run "twmap" again.',
  );
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, _promise) => {
  logger.fatal("Unhandled Promise Rejection", reason, {
    source: "unhandledRejection",
    reason: reason?.toString(),
  });

  sentry.flush().finally(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.fatal("Uncaught Exception", error, {
    source: "uncaughtException",
    stack: error.stack,
  });

  sentry.flush().finally(() => {
    process.exit(1);
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    await sentry.close();
  } catch (error) {
    logger.warn("Error during Sentry shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  process.exit(0);
};

// Listen for shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

main().catch(async (error) => {
  logger.fatal("Fatal error in main", error);

  try {
    await sentry.flush();
  } catch (flushError) {
    logger.warn("Failed to flush Sentry during fatal error", {
      error:
        flushError instanceof Error ? flushError.message : String(flushError),
    });
  }

  process.exit(1);
});
