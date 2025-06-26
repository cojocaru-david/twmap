import * as Sentry from "@sentry/node";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const SENTRY_DSN =
  process.env.SENTRY_DSN ||
  "https://f99f56f8031b08a14c577a038d2b7064@o4507588654071808.ingest.de.sentry.io/4509519132360784";
const NODE_ENV = process.env.NODE_ENV || "production";

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enableTracing?: boolean;
  debug?: boolean;
  enableProfiling?: boolean;
  sampleRate?: number;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
}

export interface SentryContext {
  [key: string]: unknown;
}

export interface TransactionInterface {
  setTag(key: string, value: string): void;
  setData(key: string, value: unknown): void;
  setContext(key: string, context: SentryContext): void;
  addBreadcrumb(
    message: string,
    level?: Sentry.SeverityLevel,
    data?: SentryContext,
  ): void;
  finish(): void;
}

class SentryService {
  private static instance: SentryService;
  private initialized = false;
  private enabled = false;

  private constructor() {}

  static getInstance(): SentryService {
    if (!SentryService.instance) {
      SentryService.instance = new SentryService();
    }
    return SentryService.instance;
  }

  init(config?: SentryConfig): void {
    if (this.initialized) return;

    const dsn = config?.dsn || SENTRY_DSN;

    if (!dsn) {
      console.warn("Sentry DSN not provided. Error reporting disabled.");
      this.initialized = true;
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment: config?.environment || NODE_ENV,
        release: config?.release || this.getVersion(),
        debug: config?.debug || NODE_ENV === "development",

        // Performance monitoring
        tracesSampleRate:
          config?.tracesSampleRate ?? (NODE_ENV === "production" ? 0.1 : 1.0),
        profilesSampleRate:
          config?.profilesSampleRate ?? (NODE_ENV === "production" ? 0.1 : 1.0),

        // Error sampling
        sampleRate: config?.sampleRate ?? 1.0,

        // Enhanced integrations
        integrations: [
          // Default integrations are included automatically
          Sentry.httpIntegration(),
          Sentry.fsIntegration(),
          Sentry.consoleIntegration(),
          Sentry.contextLinesIntegration(),
          Sentry.localVariablesIntegration(),
        ],

        // Enhanced error filtering
        beforeSend: (event, hint) => {
          // Filter out some noise but keep important errors
          if (event.exception) {
            const error = event.exception.values?.[0];
            const errorValue = error?.value || "";
            const errorType = error?.type || "";

            // Skip common non-critical errors
            if (
              errorValue.includes("ENOENT") &&
              errorValue.includes("node_modules")
            ) {
              return null;
            }

            // Skip permission errors on temp files
            if (errorValue.includes("EACCES") && errorValue.includes("tmp")) {
              return null;
            }

            // Skip network timeout errors during development
            if (
              NODE_ENV === "development" &&
              (errorType.includes("ETIMEDOUT") ||
                errorType.includes("ECONNREFUSED"))
            ) {
              return null;
            }
          }

          // Add additional context to all events
          event.extra = event.extra || {};
          event.extra.nodeVersion = process.version;
          event.extra.platform = process.platform;
          event.extra.arch = process.arch;
          event.extra.cwd = process.cwd();
          event.extra.memory = process.memoryUsage();
          event.extra.uptime = process.uptime();

          // Add hint information if available
          if (hint?.originalException) {
            event.extra.originalException = String(hint.originalException);
          }

          return event;
        },

        beforeSendTransaction: (event) => {
          // Add runtime context to all transactions
          event.contexts = event.contexts || {};
          event.contexts.runtime = {
            name: "node",
            version: process.version,
          };
          event.contexts.os = {
            name: os.type(),
            version: os.release(),
            kernel_version: os.release(),
          };
          event.contexts.device = {
            arch: process.arch,
            memory_size: os.totalmem(),
            free_memory: os.freemem(),
            processor_count: os.cpus().length,
          };

          return event;
        },

        // Additional options
        maxBreadcrumbs: 100,
        attachStacktrace: true,
        sendDefaultPii: false,
      });

      // Set comprehensive initial context
      this.setInitialContext();

      this.enabled = true;
      this.initialized = true;

      console.log(
        "✅ Sentry initialized successfully with enhanced monitoring",
      );
    } catch (error) {
      console.warn("⚠️ Failed to initialize Sentry:", error);
      this.initialized = true;
    }
  }

  private setInitialContext(): void {
    // Set system context
    Sentry.setContext("system", {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      hostname: os.hostname(),
      cwd: process.cwd(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      uptime: process.uptime(),
      pid: process.pid,
      ppid: process.ppid,
    });

    // Set environment context
    Sentry.setContext("environment", {
      nodeEnv: NODE_ENV,
      hasYarnLock: fs.existsSync(path.join(process.cwd(), "yarn.lock")),
      hasPackageLock: fs.existsSync(
        path.join(process.cwd(), "package-lock.json"),
      ),
      hasBunLock: fs.existsSync(path.join(process.cwd(), "bun.lockb")),
      packageManager: this.getPackageManager(),
    });

    // Set user context (anonymous but trackable)
    Sentry.setUser({
      id: this.generateAnonymousId(),
      username: "twmap-user",
    });

    // Set comprehensive tags
    Sentry.setTag("tool", "twmap");
    Sentry.setTag("tool_version", this.getVersion());
    Sentry.setTag("platform", process.platform);
    Sentry.setTag("node_version", process.version);
    Sentry.setTag("arch", process.arch);
    Sentry.setTag("environment", NODE_ENV);

    // Add initial breadcrumb
    this.addBreadcrumb("Sentry initialized", "sentry", "info", {
      version: this.getVersion(),
      environment: NODE_ENV,
      platform: process.platform,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  captureException(
    error: Error | unknown,
    context?: SentryContext,
  ): string | undefined {
    if (!this.enabled) return undefined;

    // Enhanced error context
    const enhancedContext: SentryContext = {
      ...context,
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };

    // Add stack trace and error details if available
    if (error instanceof Error) {
      enhancedContext.errorName = error.name;
      enhancedContext.errorMessage = error.message;
      enhancedContext.errorStack = error.stack;
    }

    return Sentry.captureException(error, {
      contexts: {
        custom: enhancedContext,
        process: {
          argv: process.argv,
          execPath: process.execPath,
          versions: process.versions,
        },
      },
      tags: {
        source: "twmap",
        timestamp: new Date().toISOString(),
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
      },
      level: "error",
    });
  }

  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = "info",
    context?: SentryContext,
  ): string | undefined {
    if (!this.enabled) return undefined;

    const enhancedContext: SentryContext = {
      ...context,
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };

    return Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: enhancedContext,
        process: {
          argv: process.argv,
          execPath: process.execPath,
          versions: process.versions,
        },
      },
      tags: {
        source: "twmap",
        timestamp: new Date().toISOString(),
        message_level: level,
      },
    });
  }

  addBreadcrumb(
    message: string,
    category?: string,
    level?: Sentry.SeverityLevel,
    data?: SentryContext,
  ): void {
    if (!this.enabled) return;

    Sentry.addBreadcrumb({
      message,
      category: category || "twmap",
      level: level || "info",
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
      },
      timestamp: Date.now() / 1000,
    });
  }

  setTag(key: string, value: string): void {
    if (!this.enabled) return;
    Sentry.setTag(key, value);
  }

  setContext(key: string, value: SentryContext): void {
    if (!this.enabled) return;
    Sentry.setContext(key, value);
  }

  startTransaction(name: string, op?: string): TransactionInterface {
    if (!this.enabled) {
      return this.createMockTransaction();
    }

    const transaction = Sentry.startSpan(
      {
        name,
        op: op || "twmap.operation",
        attributes: {
          "twmap.operation": name,
          "twmap.timestamp": new Date().toISOString(),
          "twmap.version": this.getVersion(),
        },
      },
      (span) => {
        return {
          setTag: (key: string, value: string) => {
            span.setAttributes({ [key]: value });
            Sentry.setTag(key, value);
          },
          setData: (key: string, value: unknown) => {
            span.setAttributes({ [key]: String(value) });
            Sentry.setContext(key, { [key]: value });
          },
          setContext: (key: string, context: SentryContext) => {
            Sentry.setContext(key, context);
          },
          addBreadcrumb: (
            message: string,
            level?: Sentry.SeverityLevel,
            data?: SentryContext,
          ) => {
            this.addBreadcrumb(message, name, level, data);
          },
          finish: () => {
            span.end();
          },
        };
      },
    );

    return transaction;
  }

  private createMockTransaction(): TransactionInterface {
    return {
      setTag: () => {},
      setData: () => {},
      setContext: () => {},
      addBreadcrumb: () => {},
      finish: () => {},
    };
  }

  async flush(timeout = 2000): Promise<boolean> {
    if (!this.enabled) return true;

    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      console.warn("Failed to flush Sentry events:", error);
      return false;
    }
  }

  async close(timeout = 2000): Promise<boolean> {
    if (!this.enabled) return true;

    try {
      return await Sentry.close(timeout);
    } catch (error) {
      console.warn("Failed to close Sentry:", error);
      return false;
    }
  }

  private getVersion(): string {
    try {
      const packageJsonPath = path.join(__dirname, "..", "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );
        return packageJson.version || "unknown";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  private getPackageManager(): string {
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
    if (fs.existsSync(path.join(cwd, "package-lock.json"))) return "npm";
    return "unknown";
  }

  private generateAnonymousId(): string {
    // Generate a consistent anonymous ID based on system info
    const crypto = require("crypto");
    const systemInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${process.version}`;
    return crypto
      .createHash("sha256")
      .update(systemInfo)
      .digest("hex")
      .substring(0, 16);
  }
}

// Export singleton instance
export const sentry = SentryService.getInstance();

// Export Sentry for direct access when needed
export { Sentry };

// Enhanced logger with comprehensive Sentry integration
export const logger = {
  debug: (message: string, context?: SentryContext) => {
    console.debug(`🔍 ${message}`);
    sentry.addBreadcrumb(message, "debug", "debug", {
      ...context,
      level: "debug",
      source: "logger",
    });
  },

  info: (message: string, context?: SentryContext) => {
    console.log(`ℹ️ ${message}`);
    sentry.addBreadcrumb(message, "info", "info", {
      ...context,
      level: "info",
      source: "logger",
    });
  },

  warn: (message: string, context?: SentryContext) => {
    console.warn(`⚠️ ${message}`);

    // Capture warning with enhanced context
    sentry.captureMessage(message, "warning", {
      ...context,
      level: "warning",
      source: "logger",
      stack: new Error().stack, // Include stack trace for warnings
    });

    sentry.addBreadcrumb(message, "warning", "warning", {
      ...context,
      level: "warning",
      source: "logger",
    });
  },

  error: (
    message: string,
    error?: Error | unknown,
    context?: SentryContext,
  ) => {
    console.error(`❌ ${message}`, error);

    const enhancedContext: SentryContext = {
      ...context,
      message,
      level: "error",
      source: "logger",
    };

    if (error instanceof Error) {
      // Capture the actual error with full context
      sentry.captureException(error, {
        ...enhancedContext,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
      });
    } else if (error) {
      // Capture non-Error objects
      sentry.captureMessage(`${message}: ${String(error)}`, "error", {
        ...enhancedContext,
        errorData: error,
        errorType: typeof error,
      });
    } else {
      // Capture just the message
      sentry.captureMessage(message, "error", enhancedContext);
    }

    sentry.addBreadcrumb(message, "error", "error", {
      ...enhancedContext,
      error: error?.toString(),
    });
  },

  fatal: (
    message: string,
    error?: Error | unknown,
    context?: SentryContext,
  ) => {
    console.error(`💥 FATAL: ${message}`, error);

    const enhancedContext: SentryContext = {
      ...context,
      message,
      level: "fatal",
      source: "logger",
      fatal: true,
    };

    if (error instanceof Error) {
      sentry.captureException(error, {
        ...enhancedContext,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
      });
    } else if (error) {
      sentry.captureMessage(`FATAL: ${message}: ${String(error)}`, "fatal", {
        ...enhancedContext,
        errorData: error,
        errorType: typeof error,
      });
    } else {
      sentry.captureMessage(`FATAL: ${message}`, "fatal", enhancedContext);
    }

    sentry.addBreadcrumb(message, "fatal", "fatal", {
      ...enhancedContext,
      error: error?.toString(),
    });
  },

  // Performance tracking helper
  performance: (
    operationName: string,
    duration: number,
    context?: SentryContext,
  ) => {
    const message = `Performance: ${operationName} took ${duration}ms`;
    console.log(`⚡ ${message}`);

    sentry.addBreadcrumb(message, "performance", "info", {
      ...context,
      operationName,
      duration,
      level: "performance",
      source: "logger",
    });

    // Also set as Sentry context for performance monitoring
    sentry.setContext("performance", {
      lastOperation: operationName,
      lastDuration: duration,
      timestamp: new Date().toISOString(),
    });
  },

  // Progress tracking for long operations
  progress: (
    operation: string,
    current: number,
    total: number,
    context?: SentryContext,
  ) => {
    const percentage = Math.round((current / total) * 100);
    const message = `Progress: ${operation} ${current}/${total} (${percentage}%)`;

    if (
      current % Math.max(1, Math.floor(total / 10)) === 0 ||
      current === total
    ) {
      console.log(`📊 ${message}`);
    }

    sentry.addBreadcrumb(message, "progress", "info", {
      ...context,
      operation,
      current,
      total,
      percentage,
      level: "progress",
      source: "logger",
    });
  },
};
