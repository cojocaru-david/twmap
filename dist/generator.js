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
exports.ClassNameGenerator = void 0;
const crypto = __importStar(require("crypto"));
class ClassNameGenerator {
    constructor(config) {
        this.usedNames = new Set();
        this.incrementalCounter = 0;
        this.config = config;
    }
    generateClassName(originalClasses) {
        const cleanClasses = this.normalizeClasses(originalClasses);
        switch (this.config.mode) {
            case "hash":
                return this.generateHashedName(cleanClasses);
            case "incremental":
                return this.generateIncrementalName();
            case "readable":
                return this.generateReadableName(cleanClasses);
            default:
                return this.generateHashedName(cleanClasses);
        }
    }
    normalizeClasses(classes) {
        return classes
            .split(/\s+/)
            .filter((cls) => cls.trim().length > 0)
            .sort()
            .join(" ");
    }
    generateHashedName(classes) {
        const hash = crypto.createHash("md5").update(classes).digest("hex");
        const shortHash = hash.substring(0, 6);
        const name = `${this.config.prefix}${shortHash}`;
        // Ensure uniqueness
        let counter = 0;
        let finalName = name;
        while (this.usedNames.has(finalName)) {
            finalName = `${name}-${counter}`;
            counter++;
        }
        this.usedNames.add(finalName);
        return finalName;
    }
    generateIncrementalName() {
        const name = `${this.config.prefix}${this.incrementalCounter.toString(36)}`;
        this.incrementalCounter++;
        return name;
    }
    generateReadableName(classes) {
        const words = classes
            .split(/\s+/)
            .map((cls) => {
            // Extract meaningful parts from Tailwind classes
            const parts = cls.split("-");
            if (parts.length > 0) {
                return parts[0];
            }
            return cls;
        })
            .filter((word, index, array) => array.indexOf(word) === index)
            .slice(0, 3);
        let baseName = words.join("");
        if (baseName.length > 10) {
            baseName = baseName.substring(0, 10);
        }
        const name = `${this.config.prefix}${baseName}`;
        // Ensure uniqueness
        let counter = 0;
        let finalName = name;
        while (this.usedNames.has(finalName)) {
            finalName = `${name}${counter}`;
            counter++;
        }
        this.usedNames.add(finalName);
        return finalName;
    }
    reset() {
        this.usedNames.clear();
        this.incrementalCounter = 0;
    }
}
exports.ClassNameGenerator = ClassNameGenerator;
