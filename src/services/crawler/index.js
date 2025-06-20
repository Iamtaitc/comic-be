// src/services/crawler/index.js - Main Entry Point
const HourlyCrawlerOrchestrator = require("./HourlyCrawlerOrchestrator");
const logger = require("../../utils/logger");

// Singleton instance
let crawlerInstance = null;

/**
 * 🎯 Enhanced Production Crawler Service
 * Optimized for hourly runs, 8GB RAM, duplicate handling
 */
class EnhancedCrawlerService {
  static getInstance(options = {}) {
    if (!crawlerInstance) {
      crawlerInstance = new HourlyCrawlerOrchestrator({
        enabled: process.env.CRAWLER_ENABLED === "true",
        maxSessionDuration:
          parseInt(process.env.CRAWLER_MAX_DURATION) || 2 * 60 * 60 * 1000, // 2 hours
        cleanupOldData: true,
        retryFailedPages: true,
        autoRestart: true,
        ...options,
      });
    }
    return crawlerInstance;
  }

  /**
   * 🚀 Initialize crawler service
   */
  static async initialize(runImmediately = false) {
    try {
      const crawler = this.getInstance();
      await crawler.initialize(runImmediately);

      logger.info("🎯 Enhanced Crawler Service initialized successfully");
      return crawler;
    } catch (error) {
      logger.error(
        "❌ Failed to initialize Enhanced Crawler Service:",
        error.message
      );
      throw error;
    }
  }

  /**
   * 🏁 Start crawling with comprehensive options
   */
  static async startCrawling(options = {}) {
    try {
      const crawler = this.getInstance();

      // Validate options
      const validatedOptions = this.validateCrawlingOptions(options);

      const result = await crawler.startCrawling(validatedOptions);

      if (result.status === "completed") {
        logger.info("✅ Crawling completed successfully:", {
          sessionId: result.sessionId,
          duration: result.duration,
          stats: result.stats,
        });
      }

      return result;
    } catch (error) {
      logger.error("❌ Crawling failed:", error.message);
      throw error;
    }
  }

  /**
   * ⏹️ Stop crawler gracefully
   */
  static async stopCrawling(reason = "Manual stop") {
    try {
      const crawler = this.getInstance();
      const result = await crawler.stopCrawling(reason);

      logger.info("⏹️ Crawler stopped:", { reason, stats: result.stats });
      return result;
    } catch (error) {
      logger.error("❌ Failed to stop crawler:", error.message);
      throw error;
    }
  }

  /**
   * 📊 Get comprehensive crawler status
   */
  static async getStatus() {
    try {
      const crawler = this.getInstance();
      const status = await crawler.getStatus();

      return {
        ...status,
        serviceVersion: "2.0.0",
        optimizations: [
          "Stories-first processing",
          "Intelligent rate limiting",
          "State persistence",
          "Batch operations",
          "Memory optimization",
        ],
      };
    } catch (error) {
      logger.error("❌ Failed to get crawler status:", error.message);
      return {
        error: error.message,
        healthy: false,
      };
    }
  }

  /**
   * 💗 Health check with detailed diagnostics
   */
  static async healthCheck() {
    try {
      const crawler = this.getInstance();
      const healthResult = await crawler.performHealthCheck();

      return {
        healthy: healthResult.healthy,
        service: "Enhanced Crawler Service v2.0",
        timestamp: new Date().toISOString(),
        checks: healthResult.checks,
        isRunning: crawler.isRunning,
        lastRun: crawler.lastRunTime,
        consecutiveFailures: healthResult.consecutiveFailures,
      };
    } catch (error) {
      logger.error("❌ Health check failed:", error.message);
      return {
        healthy: false,
        error: error.message,
        service: "Enhanced Crawler Service v2.0",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📈 Get performance metrics
   */
  static async getPerformanceMetrics() {
    try {
      const crawler = this.getInstance();
      const status = await crawler.getStatus();

      return {
        current: status.performance,
        processor: status.processorStats,
        health: status.healthMonitor,
        latestSession: status.latestLog,
      };
    } catch (error) {
      logger.error("❌ Failed to get performance metrics:", error.message);
      return { error: error.message };
    }
  }

  /**
   * 🔧 Validate crawling options
   */
  static validateCrawlingOptions(options) {
    const validatedOptions = {
      isManual: options.isManual !== false, // Default to true
      isScheduled: options.isScheduled || false,
      listType: options.listType || null,
      forceRestart: options.forceRestart || false,
      reason: options.reason || "API request",
    };

    // Validate listType if provided
    if (validatedOptions.listType) {
      const validListTypes = [
        "truyen-moi",
        "dang-phat-hanh",
        "hoan-thanh",
        "sap-ra-mat",
      ];
      if (!validListTypes.includes(validatedOptions.listType)) {
        throw new Error(
          `Invalid listType: ${
            validatedOptions.listType
          }. Valid types: ${validListTypes.join(", ")}`
        );
      }
    }

    return validatedOptions;
  }

  /**
   * 🧹 Cleanup old data and reset state
   */
  static async cleanup(options = {}) {
    try {
      const crawler = this.getInstance();

      if (options.logs) {
        await crawler.performWeeklyCleanup();
        logger.info("🧹 Logs cleanup completed");
      }

      if (options.state) {
        await crawler.stateManager.cleanup();
        logger.info("🔄 State cleanup completed");
      }

      if (options.all) {
        await crawler.performWeeklyCleanup();
        await crawler.stateManager.cleanup();
        logger.info("🧹 Full cleanup completed");
      }

      return { success: true, message: "Cleanup completed" };
    } catch (error) {
      logger.error("❌ Cleanup failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔄 Reset crawler state
   */
  static async reset() {
    try {
      if (crawlerInstance) {
        await crawlerInstance.close();
        crawlerInstance = null;
      }

      logger.info("🔄 Crawler service reset");
      return { success: true, message: "Crawler service reset successfully" };
    } catch (error) {
      logger.error("❌ Reset failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚪 Graceful shutdown
   */
  static async shutdown() {
    try {
      if (crawlerInstance) {
        if (crawlerInstance.isRunning) {
          await crawlerInstance.stopCrawling("Service shutdown");
        }
        await crawlerInstance.close();
        crawlerInstance = null;
      }

      logger.info("🚪 Enhanced Crawler Service shutdown completed");
      return { success: true, message: "Service shutdown completed" };
    } catch (error) {
      logger.error("❌ Shutdown failed:", error.message);
      return { success: false, error: error.message };
    }
  }
}

// Helper functions for backward compatibility
/**
 * 🔄 Legacy compatibility wrapper
 */
class LegacyCompatibilityWrapper {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
    };
  }

  async initialize(runImmediately = true) {
    logger.warn(
      "⚠️ Using legacy wrapper - please migrate to EnhancedCrawlerService"
    );
    await EnhancedCrawlerService.initialize(runImmediately);
    return this;
  }

  async startCrawling(options = {}) {
    const result = await EnhancedCrawlerService.startCrawling(options);

    // Update legacy properties
    this.isRunning = result.status === "running";
    this.lastRunTime = result.status === "completed" ? new Date() : null;
    this.stats = result.stats || this.stats;

    return result;
  }

  async pauseCrawling() {
    return await EnhancedCrawlerService.stopCrawling(
      "Paused via legacy method"
    );
  }

  async getCrawlerStatus() {
    const status = await EnhancedCrawlerService.getStatus();
    return {
      isRunning: status.isRunning,
      lastRun: status.lastRun,
      currentProgress: status.isRunning
        ? "Đang cào dữ liệu"
        : "Không hoạt động",
      latestLog: status.latestLog,
    };
  }

  resetStats() {
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
    };
  }

  getStats() {
    return {
      lastRun: this.lastRunTime,
      isRunning: this.isRunning,
      stats: this.stats,
    };
  }
}

// Export both new and legacy interfaces
module.exports = EnhancedCrawlerService;

// Legacy export for backward compatibility
module.exports.StoryCrawlerService = LegacyCompatibilityWrapper;

// Direct access to components for advanced usage
module.exports.components = {
  HourlyCrawlerOrchestrator,
  StateManager: require("./StateManager"),
  ApiRateDetector: require("./ApiRateDetector"),
  OptimizedStoryProcessor: require("./OptimizedStoryProcessor"),
  CategoryProcessor: require("./CategoryProcessor"),
  CrawlerUtils: require("./CrawlerUtils"),
};

// Configuration export
module.exports.config = require("./CrawlerConfig");

// Error handling for uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception in Crawler Service:", error.message);
  logger.error("Stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Unhandled Rejection in Crawler Service:", reason);
});

// Graceful shutdown handling
process.on("SIGINT", async () => {
  logger.info("🛑 SIGINT received - shutting down crawler gracefully");
  await EnhancedCrawlerService.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("🛑 SIGTERM received - shutting down crawler gracefully");
  await EnhancedCrawlerService.shutdown();
  process.exit(0);
});
