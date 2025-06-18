import { Config } from './types';
import * as path from 'path';
import * as fs from 'fs';

export function loadConfig(configPath?: string): Config {
  const defaultConfig: Config = {
    input: ['./src/**/*.{tsx,jsx,html}'],
    output: './twmap.css',
    mode: 'hash',
    prefix: 'tw-',
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
    cssCompressor: false
  };

  if (!configPath) {
    configPath = path.join(process.cwd(), 'twmap.config.js');
  }

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    // Clear require cache to allow for config reloading
    delete require.cache[require.resolve(configPath)];
    const userConfig = require(configPath);
    
    return {
      ...defaultConfig,
      ...userConfig
    };
  } catch (_error) {
    console.warn(`Warning: Could not load config file ${configPath}. Using defaults.`);
    return defaultConfig;
  }
}

export function validateConfig(config: Config): void {
  if (!Array.isArray(config.input) || config.input.length === 0) {
    throw new Error('Config "input" must be a non-empty array of glob patterns');
  }

  if (typeof config.output !== 'string' || !config.output.trim()) {
    throw new Error('Config "output" must be a non-empty string');
  }

  if (!['hash', 'incremental', 'readable'].includes(config.mode)) {
    throw new Error('Config "mode" must be one of: "hash", "incremental", "readable"');
  }

  if (typeof config.prefix !== 'string') {
    throw new Error('Config "prefix" must be a string');
  }

  if (!Array.isArray(config.ignore)) {
    throw new Error('Config "ignore" must be an array');
  }
}
