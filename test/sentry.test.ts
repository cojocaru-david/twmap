import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from "bun:test";
import { sentry, logger, SentryConfig, SentryContext } from "../src/sentry";

describe("SentryService", () => {
  let consoleSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: spyOn(console, "log").mockImplementation(() => {}),
      warn: spyOn(console, "warn").mockImplementation(() => {}),
      error: spyOn(console, "error").mockImplementation(() => {}),
      debug: spyOn(console, "debug").mockImplementation(() => {}),
    };

    // Reset sentry service for each test
    (sentry as any).initialized = false;
    (sentry as any).enabled = false;
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.debug.mockRestore();
  });

  describe("Initialization", () => {
    it("should initialize Sentry successfully", () => {
      const result = sentry.init();

      expect(sentry.isEnabled()).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "✅ Sentry initialized successfully with enhanced monitoring",
      );
    });

    it("should handle custom configuration", () => {
      const customConfig: SentryConfig = {
        dsn: "custom-dsn",
        environment: "test",
        release: "1.0.0",
        debug: true,
        tracesSampleRate: 0.5,
      };

      sentry.init(customConfig);

      expect(sentry.isEnabled()).toBe(true);
    });

    it("should handle missing or empty DSN", () => {
      // The service should still initialize even with empty DSN because there's a default
      sentry.init({ dsn: "" });

      // Since there's a default DSN, it should still be enabled
      expect(sentry.isEnabled()).toBe(true);
    });

    it("should not reinitialize if already initialized", () => {
      sentry.init();
      const firstCallCount = consoleSpy.log.mock.calls.length;

      sentry.init();
      const secondCallCount = consoleSpy.log.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe("Error Capturing", () => {
    beforeEach(() => {
      sentry.init();
    });

    it("should capture exceptions", () => {
      const error = new Error("Test error");
      const context: SentryContext = { customKey: "customValue" };

      const eventId = sentry.captureException(error, context);

      expect(typeof eventId).toBe("string");
    });

    it("should capture messages", () => {
      const message = "Test message";
      const context: SentryContext = { operation: "test" };

      const eventId = sentry.captureMessage(message, "warning", context);

      expect(typeof eventId).toBe("string");
    });

    it("should return undefined when Sentry is disabled", () => {
      (sentry as any).enabled = false;

      const result = sentry.captureException(new Error("Test"));

      expect(result).toBeUndefined();
    });
  });

  describe("Breadcrumbs and Context", () => {
    beforeEach(() => {
      sentry.init();
    });

    it("should add breadcrumbs", () => {
      const message = "Test breadcrumb";
      const category = "test";
      const data: SentryContext = { key: "value" };

      expect(() => {
        sentry.addBreadcrumb(message, category, "info", data);
      }).not.toThrow();
    });

    it("should set tags", () => {
      expect(() => {
        sentry.setTag("environment", "test");
      }).not.toThrow();
    });

    it("should set context", () => {
      const context: SentryContext = { version: "1.0.0" };

      expect(() => {
        sentry.setContext("app", context);
      }).not.toThrow();
    });
  });

  describe("Transactions", () => {
    beforeEach(() => {
      sentry.init();
    });

    it("should start and manage transactions", () => {
      const transaction = sentry.startTransaction("test-operation", "test");

      expect(transaction).toBeDefined();
      expect(typeof transaction.setTag).toBe("function");
      expect(typeof transaction.setData).toBe("function");
      expect(typeof transaction.setContext).toBe("function");
      expect(typeof transaction.addBreadcrumb).toBe("function");
      expect(typeof transaction.finish).toBe("function");

      // Test transaction methods don't throw
      expect(() => {
        transaction.setTag("test", "value");
        transaction.setData("data", "value");
        transaction.setContext("context", { key: "value" });
        transaction.addBreadcrumb("breadcrumb", "info");
        transaction.finish();
      }).not.toThrow();
    });

    it("should return mock transaction when disabled", () => {
      (sentry as any).enabled = false;

      const transaction = sentry.startTransaction("test");

      expect(transaction).toBeDefined();
      expect(typeof transaction.setTag).toBe("function");
      expect(typeof transaction.finish).toBe("function");

      // These should not throw
      expect(() => {
        transaction.setTag("test", "value");
        transaction.setData("test", "value");
        transaction.finish();
      }).not.toThrow();
    });
  });

  describe("Flush and Close", () => {
    beforeEach(() => {
      sentry.init();
    });

    it("should flush events", async () => {
      const result = await sentry.flush(1000);

      expect(typeof result).toBe("boolean");
    });

    it("should close Sentry", async () => {
      const result = await sentry.close(1000);

      expect(typeof result).toBe("boolean");
    });

    it("should handle disabled state", async () => {
      (sentry as any).enabled = false;

      const flushResult = await sentry.flush();
      const closeResult = await sentry.close();

      expect(flushResult).toBe(true);
      expect(closeResult).toBe(true);
    });
  });
});

describe("Logger", () => {
  let consoleSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: spyOn(console, "log").mockImplementation(() => {}),
      warn: spyOn(console, "warn").mockImplementation(() => {}),
      error: spyOn(console, "error").mockImplementation(() => {}),
      debug: spyOn(console, "debug").mockImplementation(() => {}),
    };

    // Initialize sentry for logger tests
    sentry.init();
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.debug.mockRestore();
  });

  describe("debug", () => {
    it("should log debug message", () => {
      const context: SentryContext = { operation: "test" };

      logger.debug("Debug message", context);

      expect(consoleSpy.debug).toHaveBeenCalledWith("🔍 Debug message");
    });
  });

  describe("info", () => {
    it("should log info message", () => {
      logger.info("Info message");

      expect(consoleSpy.log).toHaveBeenCalledWith("ℹ️ Info message");
    });
  });

  describe("warn", () => {
    it("should log warning message", () => {
      const context: SentryContext = { component: "test" };

      logger.warn("Warning message", context);

      expect(consoleSpy.warn).toHaveBeenCalledWith("⚠️ Warning message");
    });
  });

  describe("error", () => {
    it("should log error with Error object", () => {
      const error = new Error("Test error");
      const context: SentryContext = { operation: "test" };

      logger.error("Error message", error, context);

      expect(consoleSpy.error).toHaveBeenCalledWith("❌ Error message", error);
    });

    it("should handle non-Error objects", () => {
      const errorData = { code: "ERR001", details: "Something went wrong" };

      logger.error("Error message", errorData);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        "❌ Error message",
        errorData,
      );
    });

    it("should handle error without error object", () => {
      logger.error("Error message");

      expect(consoleSpy.error).toHaveBeenCalledWith(
        "❌ Error message",
        undefined,
      );
    });
  });

  describe("fatal", () => {
    it("should log fatal error", () => {
      const error = new Error("Fatal error");

      logger.fatal("Fatal message", error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        "💥 FATAL: Fatal message",
        error,
      );
    });
  });

  describe("performance", () => {
    it("should log performance metrics", () => {
      const context: SentryContext = { files: 10 };

      logger.performance("parseFiles", 150, context);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "⚡ Performance: parseFiles took 150ms",
      );
    });
  });

  describe("progress", () => {
    it("should log progress for milestone updates", () => {
      logger.progress("processing", 50, 100);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "📊 Progress: processing 50/100 (50%)",
      );
    });

    it("should only log at milestones", () => {
      consoleSpy.log.mockClear();

      // Should not log for small increments
      logger.progress("processing", 5, 100);
      expect(consoleSpy.log).not.toHaveBeenCalled();

      // Should log at 10% intervals
      logger.progress("processing", 10, 100);
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should always log completion", () => {
      logger.progress("processing", 100, 100);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "📊 Progress: processing 100/100 (100%)",
      );
    });
  });

  describe("All logger methods integration", () => {
    it("should test all logger methods work without throwing", () => {
      const error = new Error("Test error");
      const context = { test: "context" };

      expect(() => {
        logger.debug("Debug test", context);
        logger.info("Info test", context);
        logger.warn("Warn test", context);
        logger.error("Error test", error, context);
        logger.fatal("Fatal test", error, context);
        logger.performance("operation", 100, context);
        logger.progress("task", 50, 100, context);
      }).not.toThrow();

      // Verify all console methods were called
      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });
});
