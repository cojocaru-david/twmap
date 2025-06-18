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
exports.loadConfig = loadConfig;
exports.validateConfig = validateConfig;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function loadConfig(configPath) {
    const defaultConfig = {
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
    }
    catch (_error) {
        console.warn(`Warning: Could not load config file ${configPath}. Using defaults.`);
        return defaultConfig;
    }
}
function validateConfig(config) {
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
