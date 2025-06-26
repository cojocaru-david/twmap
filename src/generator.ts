import { Config, ClassMapping as _ClassMapping } from "./types";
import * as crypto from "crypto";

export class ClassNameGenerator {
  private config: Config;
  private usedNames = new Set<string>();
  private incrementalCounter = 0;

  constructor(config: Config) {
    this.config = config;
  }

  generateClassName(originalClasses: string): string {
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

  private normalizeClasses(classes: string): string {
    return classes
      .split(/\s+/)
      .filter((cls) => cls.trim().length > 0)
      .sort()
      .join(" ");
  }

  private generateHashedName(classes: string): string {
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

  private generateIncrementalName(): string {
    const name = `${this.config.prefix}${this.incrementalCounter.toString(36)}`;
    this.incrementalCounter++;
    return name;
  }

  private generateReadableName(classes: string): string {
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

  reset(): void {
    this.usedNames.clear();
    this.incrementalCounter = 0;
  }
}
