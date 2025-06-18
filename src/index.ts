#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig, validateConfig } from './config';
import { TwmapProcessor } from './processor';
import * as path from 'path';
import * as fs from 'fs';
import * as Sentry from '@sentry/node';
import * as dotenv from 'dotenv';

dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    _experiments: { enableLogs: true },
  });
} else {
  console.warn('Sentry DSN not set. Sentry will not report errors.');
}

async function main() {
  program
    .name('twmap')
    .description('Extract and optimize Tailwind utility classes')
    .version('1.0.0')
    .option('-c, --config <path>', 'path to config file')
    .option('-i, --input <patterns...>', 'input file patterns')
    .option('-o, --output <path>', 'output CSS file path')
    .option('-m, --mode <mode>', 'class name generation mode (hash|incremental|readable)')
    .option('-p, --prefix <prefix>', 'prefix for generated class names')
    .option('--dry-run', 'preview changes without modifying files')
    .option('--init', 'create a sample config file')
    .parse();

  const options = program.opts();

  // Handle init command
  if (options.init) {
    createSampleConfig();
    return;
  }

  try {
    // Load configuration
    const config = loadConfig(options.config);

    // Override config with CLI options
    if (options.input) config.input = options.input;
    if (options.output) config.output = options.output;
    if (options.mode) config.mode = options.mode;
    if (options.prefix) config.prefix = options.prefix;

    // Validate configuration
    validateConfig(config);

    console.log('🚀 Starting twmap process...');
    console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);

    if (options.dryRun) {
      console.log('🔍 Dry run mode - no files will be modified');
      // Run processor in dry-run mode
      const processor = new TwmapProcessor(config, true);
      await processor.process();
      return;
    }

    // Create processor and run
    const processor = new TwmapProcessor(config);
    await processor.process();

  } catch (error) {
    if (SENTRY_DSN) Sentry.captureException(error);
    if (SENTRY_DSN) Sentry.captureMessage('❌ Error:', { extra: { error: error instanceof Error ? error.message : error } });
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function createSampleConfig() {
  const configPath = path.join(process.cwd(), 'twmap.config.js');
  
  if (fs.existsSync(configPath)) {
    console.log('⚠️  Config file already exists at:', configPath);
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

  fs.writeFileSync(configPath, sampleConfig, 'utf-8');
  console.log('✅ Sample config file created at:', configPath);
  console.log('📝 Edit the config file to customize settings, then run "twmap" again.');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  if (SENTRY_DSN) Sentry.captureException(reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  if (SENTRY_DSN) Sentry.captureException(error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Ensure Sentry flushes before exit
const flushSentryAndExit = async (code = 1) => {
  if (SENTRY_DSN) {
    try {
      await Sentry.flush(2000); // Wait up to 2 seconds
    } catch (e) {
      // Ignore flush errors
    }
  }
  process.exit(code);
};

main().catch(async error => {
  console.error('❌ Fatal error:', error);
  await flushSentryAndExit(1);
});
