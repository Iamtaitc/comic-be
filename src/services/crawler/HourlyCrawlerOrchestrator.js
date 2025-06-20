// src/services/crawler/HourlyCrawlerOrchestrator.js
const Redis = require("ioredis");
const cron = require("node-cron");
const logger = require("../../utils/logger");
const { CrawlerLog } = require("../../models/index");

const StateManager = require("./StateManager");
const OptimizedStoryProcessor = require("./OptimizedStoryProcessor");
const CategoryProcessor = require("./CategoryProcessor");
const CrawlerUtils = require("./CrawlerUtils");
const {
  LIST_TYPES,
  MAX_SESSION_DURATION,
  HEALTH_CHECK_INTERVAL,
  HOURLY_SCHEDULE,
  CLEANUP_SCHEDULE,
} = require("./CrawlerConfig");

class HourlyCrawlerOrchestrator {
  constructor(options = {}) {
    this.isRunning = false;
    this.lastRunTime = null;
    this.currentSession = null;
    this.startTime = null;

    // Enhanced stats tracking để monitor performance
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
      pagesProcessed: 0,
      apiCallsMade: 0,
      duplicatesSkipped: 0,
      sessionDuration: 0,
    };

    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Initialize components
    this.stateManager = new StateManager(this.redis);
    this.categoryProcessor = new CategoryProcessor(this);
    this.storyProcessor = new OptimizedStoryProcessor(this, this.stateManager);

    // Configuration optimized cho hourly runs
    this.config = {
      enabled:
        process.env.CRAWLER_ENABLED === "true" || options.enabled || false,
      maxSessionDuration: options.maxSessionDuration || MAX_SESSION_DURATION,
      healthCheckInterval: options.healthCheckInterval || HEALTH_CHECK_INTERVAL,
      retryFailedPages: options.retryFailedPages !== false,
      cleanupOldData: options.cleanupOldData !== false,
      hourlySchedule: options.hourlySchedule || HOURLY_SCHEDULE,
      autoRestart: options.autoRestart !== false,
      ...options,
    };

    // Health monitoring
    this.healthMonitor = {
      lastHealthCheck: null,
      consecutiveFailures: 0,
      isHealthy: true,
    };
  }

  /**
   * 🚀 Initialize crawler service
   */
  async initialize(runImmediately = false) {
    logger.info("🎯 Initializing Enhanced Hourly Crawler Service");

    if (!this.config.enabled) {
      logger.warn("⚠️ Crawler disabled in configuration");
      return this;
    }

    try {
      // Test Redis connection
      await this.redis.ping();
      logger.info("✅ Redis connection established");
    } catch (error) {
      logger.error("❌ Redis connection failed:", error.message);
      throw new Error("Redis connection required for crawler operation");
    }

    // Setup hourly scheduling
    this.setupHourlySchedule();

    // Setup health monitoring
    this.setupHealthMonitoring();

    // Startup cleanup
    if (this.config.cleanupOldData) {
      await this.performStartupCleanup();
    }

    // Run immediately nếu requested
    if (runImmediately) {
      setTimeout(() => {
        this.startCrawling({
          isManual: true,
          reason: "Initial run on startup",
        }).catch((error) => {
          logger.error("❌ Initial run failed:", error.message);
        });
      }, 5000); // 5 second delay để tránh race condition
    }

    logger.info("✅ Enhanced Hourly Crawler Service ready");
    return this;
  }

  /**
   * ⏰ Setup hourly crawling schedule
   */
  setupHourlySchedule() {
    logger.info(`⏰ Setting up hourly schedule: ${this.config.hourlySchedule}`);

    cron.schedule(this.config.hourlySchedule, async () => {
      try {
        // Kiểm tra nếu đang chạy
        if (this.isRunning) {
          logger.warn("⏭️ Skipping scheduled run - crawler already running");
          return;
        }

        // Kiểm tra health trước khi chạy
        if (
          !this.healthMonitor.isHealthy &&
          this.healthMonitor.consecutiveFailures > 3
        ) {
          logger.warn("⚠️ Skipping scheduled run - system unhealthy");
          return;
        }

        logger.info("📅 Starting hourly scheduled crawl");
        await this.startCrawling({
          isScheduled: true,
          reason: "Hourly schedule",
        });
      } catch (error) {
        logger.error("❌ Scheduled crawl failed:", error.message);
        this.healthMonitor.consecutiveFailures++;
      }
    });

    // Weekly cleanup schedule
    cron.schedule(CLEANUP_SCHEDULE, async () => {
      logger.info("🧹 Starting weekly cleanup");
      await this.performWeeklyCleanup();
    });

    logger.info("✅ Cron schedules configured");
  }

  /**
   * 💗 Setup health monitoring
   */
  setupHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.performHealthCheck();

        if (this.isRunning && this.currentSession) {
          await this.checkSessionHealth();
        }
      } catch (error) {
        logger.error("❌ Health monitoring error:", error.message);
        this.healthMonitor.consecutiveFailures++;
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 🏁 Start crawling process với comprehensive error handling
   */
  async startCrawling(options = {}) {
    const {
      isManual = false,
      isScheduled = false,
      listType = null,
      forceRestart = false,
      reason = "Manual start",
    } = options;

    if (this.isRunning && !forceRestart) {
      return {
        status: "running",
        message: "Crawler already running",
        sessionId: this.currentSession?._id,
        currentStats: this.stats,
      };
    }

    if (this.isRunning && forceRestart) {
      logger.warn("🔄 Force restarting crawler");
      await this.stopCrawling("Force restart requested");
    }

    this.startTime = Date.now();

    try {
      this.isRunning = true;
      this.resetStats();

      // Create comprehensive session log
      this.currentSession = await CrawlerLog.create({
        status: "running",
        startedAt: new Date(),
        isManual,
        isScheduled,
        configuration: {
          listType,
          reason,
          optimizedForHourly: true,
          processorVersion: "2.0",
          memoryLimit: "8GB",
        },
      });

      logger.info(
        `🚀 Starting crawler session: ${this.currentSession._id} (${reason})`
      );

      // Phase 1: Pre-flight checks
      await this.performPreflightChecks();

      // Phase 2: Crawl categories (quick operation)
      await this.crawlCategoriesPhase();

      // Phase 3: Crawl stories with intelligent strategy
      await this.crawlStoriesPhase(listType);

      // Phase 4: Retry failed pages nếu enabled
      if (this.config.retryFailedPages) {
        await this.retryFailedPagesPhase();
      }

      // Phase 5: Complete session
      await this.completeSession();

      return {
        status: "completed",
        stats: this.stats,
        sessionId: this.currentSession._id,
        duration: this.stats.sessionDuration,
        performance: this.getPerformanceMetrics(),
      };
    } catch (error) {
      await this.handleSessionError(error);
      throw error;
    }
  }

  /**
   * 🔍 Pre-flight checks trước khi crawl
   */
  async performPreflightChecks() {
    logger.info("🔍 Performing pre-flight checks...");

    // Check API health
    const apiHealth = await this.storyProcessor.performHealthCheck();
    if (!apiHealth.healthy) {
      logger.warn(`⚠️ API health check failed - proceeding with caution`);
      // Continue but với conservative settings
    }

    // Check memory usage
    const memUsage = CrawlerUtils.getMemoryUsage();
    if (memUsage.heapUsed > 6000) {
      // 6GB
      logger.warn(`⚠️ High memory usage detected: ${memUsage.heapUsed}MB`);
    }

    // Check Redis health
    const redisHealth = await this.stateManager.healthCheck();
    if (!redisHealth.healthy) {
      throw new Error(`Redis health check failed: ${redisHealth.error}`);
    }

    logger.info("✅ Pre-flight checks completed");
  }

  /**
   * 📂 Phase 1: Categories crawling (quick operation)
   */
  async crawlCategoriesPhase() {
    logger.info("📂 Phase 1: Crawling categories");

    try {
      await this.categoryProcessor.crawlCategories();
      logger.info("✅ Categories crawling completed");
    } catch (error) {
      logger.error("❌ Categories crawling failed:", error.message);
      this.stats.errors++;
      // Continue with stories even if categories fail
    }
  }

  /**
   * 📚 Phase 2: Stories crawling với intelligent strategy
   */
  async crawlStoriesPhase(specificListType = null) {
    logger.info("📚 Phase 2: Crawling stories with optimized strategy");

    const listsToProcess = specificListType
      ? [specificListType]
      : this.getOptimalListOrder();

    for (const listType of listsToProcess) {
      if (!this.isRunning) {
        logger.warn("⏹️ Stopping crawl - service stopped");
        break;
      }

      // Check session timeout
      if (this.isSessionTimeoutApproaching()) {
        logger.warn(`⏰ Session timeout approaching - stopping at ${listType}`);
        break;
      }

      try {
        logger.info(`📖 Processing list: ${listType}`);

        const startTime = Date.now();
        await this.storyProcessor.crawlListData(listType);
        const duration = Date.now() - startTime;

        logger.info(
          `✅ Completed ${listType} in ${CrawlerUtils.formatDuration(duration)}`
        );

        // Update progress
        await this.updateSessionProgress();

        // Log current stats
        this.logCurrentProgress();
      } catch (error) {
        logger.error(`❌ Failed to process ${listType}:`, error.message);
        await this.stateManager.logError(listType, 0, error, {
          phase: "stories",
        });
        this.stats.errors++;

        // Continue với list khác nếu không phải critical error
        if (!this.isCriticalError(error)) {
          continue;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 🔄 Phase 3: Retry failed pages nếu enabled
   */
  async retryFailedPagesPhase() {
    logger.info("🔄 Phase 3: Retrying failed pages");

    if (this.isSessionTimeoutApproaching()) {
      logger.warn("⏰ Skipping retry phase - session timeout approaching");
      return;
    }

    for (const listType of LIST_TYPES) {
      if (!this.isRunning) break;

      try {
        const failedPages = await this.stateManager.getFailedPages(listType);

        if (failedPages.count > 0) {
          logger.info(
            `🔄 Retrying ${failedPages.count} failed pages for ${listType}`
          );

          // Limit retries để không spend too much time
          const pagesToRetry = failedPages.pages.slice(0, 5);

          for (const page of pagesToRetry) {
            if (!this.isRunning || this.isSessionTimeoutApproaching()) break;

            try {
              await this.retrySpecificPage(listType, page);
              await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
            } catch (retryError) {
              logger.warn(
                `⚠️ Retry failed for ${listType} page ${page}: ${retryError.message}`
              );
            }
          }
        }
      } catch (error) {
        logger.error(
          `❌ Error during retry phase for ${listType}:`,
          error.message
        );
      }
    }
  }

  /**
   * 🎯 Get optimal list processing order
   */
  getOptimalListOrder() {
    // Prioritize lists based on update frequency và importance
    return [
      "truyen-moi", // New stories - highest priority for fresh content
      "dang-phat-hanh", // Ongoing stories - regular updates
      "sap-ra-mat", // Coming soon - less frequent but important
      "hoan-thanh", // Completed - lowest priority, mostly static
    ];
  }

  /**
   * ⏰ Check if session timeout is approaching
   */
  isSessionTimeoutApproaching() {
    if (!this.currentSession || !this.startTime) return false;

    const sessionDuration = Date.now() - this.startTime;
    const timeRemaining = this.config.maxSessionDuration - sessionDuration;

    // Stop if less than 20 minutes remaining
    return timeRemaining < 20 * 60 * 1000;
  }

  /**
   * 🚨 Check if error is critical
   */
  isCriticalError(error) {
    const criticalErrorCodes = ["ENOTFOUND", "ECONNREFUSED"];
    return (
      criticalErrorCodes.includes(error.code) ||
      error.message.includes("Redis") ||
      error.message.includes("MongoDB")
    );
  }

  /**
   * ✅ Complete session với comprehensive stats
   */
  async completeSession() {
    this.lastRunTime = new Date();
    this.stats.sessionDuration = Date.now() - this.startTime;
    this.isRunning = false;

    if (this.currentSession) {
      // Get final detailed stats
      const processorStats = this.storyProcessor.getStats();
      const errorStats = await this.stateManager.getErrorStats();

      await CrawlerLog.findByIdAndUpdate(this.currentSession._id, {
        status: "completed",
        finishedAt: this.lastRunTime,
        stats: this.stats,
        performance: {
          sessionDuration: this.stats.sessionDuration,
          processorStats,
          errorStats,
          memoryUsage: CrawlerUtils.getMemoryUsage(),
          healthStatus: this.healthMonitor,
        },
      });
    }

    // Cleanup memory
    this.storyProcessor.cleanup();

    // Update health monitor
    this.healthMonitor.consecutiveFailures = 0;
    this.healthMonitor.isHealthy = true;
    this.healthMonitor.lastHealthCheck = new Date();

    logger.info("🎉 Crawler session completed successfully", {
      stats: this.stats,
      sessionId: this.currentSession._id,
      duration: CrawlerUtils.formatDuration(this.stats.sessionDuration),
    });
  }

  /**
   * ❌ Handle session error với detailed logging
   */
  async handleSessionError(error) {
    this.isRunning = false;
    this.stats.errors++;
    this.stats.sessionDuration = this.startTime
      ? Date.now() - this.startTime
      : 0;

    if (this.currentSession) {
      await CrawlerLog.findByIdAndUpdate(this.currentSession._id, {
        status: "error",
        finishedAt: new Date(),
        error: error.message,
        stack: error.stack,
        stats: this.stats,
        performance: {
          sessionDuration: this.stats.sessionDuration,
          memoryUsage: CrawlerUtils.getMemoryUsage(),
          healthStatus: this.healthMonitor,
        },
      });
    }

    // Cleanup on error
    this.storyProcessor.cleanup();

    // Update health monitor
    this.healthMonitor.consecutiveFailures++;
    this.healthMonitor.isHealthy = this.healthMonitor.consecutiveFailures < 3;

    logger.error("💥 Crawler session failed:", {
      error: error.message,
      sessionId: this.currentSession?._id,
      stats: this.stats,
      consecutiveFailures: this.healthMonitor.consecutiveFailures,
    });
  }

  /**
   * ⏹️ Stop crawler với graceful shutdown
   */
  async stopCrawling(reason = "Manual stop") {
    if (!this.isRunning) {
      return {
        status: "not_running",
        message: "Crawler not running",
      };
    }

    logger.info(`⏹️ Stopping crawler: ${reason}`);
    this.isRunning = false;

    if (this.currentSession) {
      this.stats.sessionDuration = this.startTime
        ? Date.now() - this.startTime
        : 0;

      await CrawlerLog.findByIdAndUpdate(this.currentSession._id, {
        status: "stopped",
        finishedAt: new Date(),
        stopReason: reason,
        stats: this.stats,
        performance: {
          sessionDuration: this.stats.sessionDuration,
          processorStats: this.storyProcessor.getStats(),
          memoryUsage: CrawlerUtils.getMemoryUsage(),
        },
      });
    }

    // Cleanup resources
    this.storyProcessor.cleanup();

    logger.info(`✅ Crawler stopped successfully: ${reason}`);
    return {
      status: "stopped",
      reason,
      stats: this.stats,
      duration: this.stats.sessionDuration,
    };
  }

  /**
   * 💗 Comprehensive health check
   */
  async performHealthCheck() {
    try {
      const checks = {
        redis: await this.stateManager.healthCheck(),
        memory: this.checkMemoryUsage(),
        api: this.storyProcessor.rateDetector.isHealthy(),
        errors: this.checkErrorRate(),
      };

      const overallHealthy = Object.values(checks).every((check) =>
        typeof check === "boolean" ? check : check.healthy
      );

      this.healthMonitor.isHealthy = overallHealthy;
      this.healthMonitor.lastHealthCheck = new Date();

      if (!overallHealthy) {
        this.healthMonitor.consecutiveFailures++;
        logger.warn("⚠️ Health check failed:", checks);
      } else {
        this.healthMonitor.consecutiveFailures = 0;
      }

      return {
        healthy: overallHealthy,
        checks,
        consecutiveFailures: this.healthMonitor.consecutiveFailures,
      };
    } catch (error) {
      this.healthMonitor.consecutiveFailures++;
      logger.error("❌ Health check error:", error.message);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * 💾 Check memory usage
   */
  checkMemoryUsage() {
    const memUsage = CrawlerUtils.getMemoryUsage();
    return {
      healthy: memUsage.heapUsed < 6000, // Less than 6GB
      usage: memUsage,
    };
  }

  /**
   * 📊 Check error rate
   */
  checkErrorRate() {
    const totalOperations = this.stats.apiCallsMade || 1;
    const errorRate = this.stats.errors / totalOperations;

    return errorRate < 0.3; // Less than 30% error rate
  }

  /**
   * 📊 Update session progress
   */
  async updateSessionProgress() {
    if (this.currentSession) {
      await CrawlerLog.findByIdAndUpdate(this.currentSession._id, {
        stats: this.stats,
        lastProgressUpdate: new Date(),
        performance: {
          processorStats: this.storyProcessor.getStats(),
          memoryUsage: CrawlerUtils.getMemoryUsage(),
        },
      });
    }
  }

  /**
   * 📝 Log current progress
   */
  logCurrentProgress() {
    const memUsage = CrawlerUtils.getMemoryUsage();
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    logger.info(`📊 Progress Update:`, {
      newStories: this.stats.newStories,
      newChapters: this.stats.newChapters,
      errors: this.stats.errors,
      duplicatesSkipped: this.stats.duplicatesSkipped,
      memoryUsed: `${memUsage.heapUsed}MB`,
      duration: CrawlerUtils.formatDuration(duration),
    });
  }

  /**
   * 📈 Get performance metrics
   */
  getPerformanceMetrics() {
    const duration = this.stats.sessionDuration || 1;

    return {
      storiesPerMinute: Math.round(
        (this.stats.newStories + this.stats.updatedStories) / (duration / 60000)
      ),
      chaptersPerMinute: Math.round(
        this.stats.newChapters / (duration / 60000)
      ),
      apiCallsPerMinute: Math.round(
        this.stats.apiCallsMade / (duration / 60000)
      ),
      errorRate:
        this.stats.apiCallsMade > 0
          ? this.stats.errors / this.stats.apiCallsMade
          : 0,
      duplicateRate:
        this.stats.apiCallsMade > 0
          ? this.stats.duplicatesSkipped / this.stats.apiCallsMade
          : 0,
      memoryEfficiency: CrawlerUtils.getMemoryUsage(),
    };
  }

  /**
   * 🔄 Reset stats
   */
  resetStats() {
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
      pagesProcessed: 0,
      apiCallsMade: 0,
      duplicatesSkipped: 0,
      sessionDuration: 0,
    };
  }

  /**
   * 📊 Get comprehensive status
   */
  async getStatus() {
    const latestLog = await CrawlerLog.findOne().sort({ startedAt: -1 }).lean();

    return {
      isRunning: this.isRunning,
      currentSession: this.currentSession?._id,
      lastRun: this.lastRunTime,
      currentStats: this.stats,
      processorStats: this.isRunning ? this.storyProcessor.getStats() : null,
      healthMonitor: this.healthMonitor,
      configuration: this.config,
      performance: this.isRunning ? this.getPerformanceMetrics() : null,
      latestLog: latestLog
        ? {
            status: latestLog.status,
            startedAt: latestLog.startedAt,
            finishedAt: latestLog.finishedAt,
            stats: latestLog.stats,
            isManual: latestLog.isManual,
            isScheduled: latestLog.isScheduled,
            performance: latestLog.performance,
          }
        : null,
    };
  }

  /**
   * 🧹 Startup cleanup
   */
  async performStartupCleanup() {
    try {
      logger.info("🧹 Performing startup cleanup...");

      // Reset any stuck "running" sessions
      const stuckSessions = await CrawlerLog.updateMany(
        { status: "running" },
        {
          status: "interrupted",
          finishedAt: new Date(),
          error: "Service restarted - session interrupted",
        }
      );

      if (stuckSessions.modifiedCount > 0) {
        logger.info(`🔄 Reset ${stuckSessions.modifiedCount} stuck sessions`);
      }

      // Clear old Redis state
      await this.stateManager.cleanup();

      logger.info("✅ Startup cleanup completed");
    } catch (error) {
      logger.error("❌ Startup cleanup failed:", error.message);
    }
  }

  /**
   * 🧹 Weekly cleanup
   */
  async performWeeklyCleanup() {
    try {
      // Cleanup old logs (keep last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedLogs = await CrawlerLog.deleteMany({
        startedAt: { $lt: ninetyDaysAgo },
      });

      // Clear old Redis keys
      const cleanedKeys = await this.stateManager.cleanup();

      logger.info(
        `🧹 Weekly cleanup completed: ${deletedLogs.deletedCount} old logs removed, ${cleanedKeys} Redis keys cleaned`
      );
    } catch (error) {
      logger.error("❌ Weekly cleanup failed:", error.message);
    }
  }

  /**
   * 🔄 Retry specific page
   */
  async retrySpecificPage(listType, page) {
    // Implementation cho retry logic - basic version
    logger.info(`🔄 Retrying ${listType} page ${page}`);
    // TODO: Implement specific page retry logic
  }

  /**
   * 🚪 Close all connections
   */
  async close() {
    try {
      if (this.isRunning) {
        await this.stopCrawling("Service shutdown");
      }

      await this.storyProcessor.close();
      await this.stateManager.close();
      await this.redis.quit();

      logger.info("🚪 HourlyCrawlerOrchestrator closed successfully");
    } catch (error) {
      logger.error(
        "❌ Error closing HourlyCrawlerOrchestrator:",
        error.message
      );
    }
  }
}

module.exports = HourlyCrawlerOrchestrator;
