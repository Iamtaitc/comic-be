// src/crawler/Enhanced-crawler-worker.js
const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const config = require("../../config");
const EnhancedCrawlerService = require("../services/crawler");

let isRunning = false;
let scheduledTask = null;
let crawlerInstance = null;
let shutdownInProgress = false;

// Enhanced crawler configuration
const crawlerConfig = {
  enabled:
    process.env.CRAWLER_ENABLED === "true" ||
    workerData?.config?.enabled ||
    config.crawler?.enabled ||
    false,
  baseUrl:
    process.env.CRAWLER_BASE_URL ||
    workerData?.config?.baseUrl ||
    config.crawler?.baseUrl ||
    "https://otruyenapi.com/v1/api",
  runOnStartup:
    process.env.CRAWLER_RUN_ON_STARTUP === "true" ||
    workerData?.config?.runOnStartup ||
    config.crawler?.runOnStartup ||
    false,
  schedule:
    process.env.CRAWLER_SCHEDULE ||
    workerData?.config?.schedule ||
    config.crawler?.schedule ||
    "0 * * * *", // Hourly
  maxCrawlDuration:
    parseInt(process.env.CRAWLER_MAX_DURATION) ||
    workerData?.config?.maxCrawlDuration ||
    2 * 60 * 60 * 1000, // 2 hours
  autoRestart:
    process.env.CRAWLER_AUTO_RESTART === "true" ||
    workerData?.config?.autoRestart ||
    true,
  healthCheckInterval:
    parseInt(process.env.CRAWLER_HEALTH_CHECK_INTERVAL) || 60 * 1000, // 1 minute
  memoryLimit:
    parseInt(process.env.CRAWLER_MEMORY_LIMIT) || 6 * 1024 * 1024 * 1024, // 6GB
};

/**
 * 📝 Enhanced logging function
 */
function workerLog(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    service: "Enhanced-Crawler-Worker",
    message,
    ...metadata,
  };

  console.log(JSON.stringify(logEntry));

  // Send to parent if available
  if (parentPort) {
    parentPort.postMessage({
      type: "log",
      level,
      message,
      metadata,
      timestamp,
    });
  }
}

/**
 * 📊 Update worker status
 */
function updateStatus(status, metadata = {}) {
  const statusData = {
    status,
    timestamp: new Date().toISOString(),
    isRunning,
    memoryUsage: process.memoryUsage(),
    ...metadata,
  };

  workerLog("info", `Status: ${status}`, statusData);

  if (parentPort) {
    parentPort.postMessage({
      type: "status",
      data: statusData,
    });
  }
}

/**
 * 💾 Check memory usage
 */
function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memLimitMB = Math.round(crawlerConfig.memoryLimit / 1024 / 1024);

  if (memUsage.heapUsed > crawlerConfig.memoryLimit) {
    workerLog(
      "warn",
      `High memory usage: ${memUsedMB}MB (limit: ${memLimitMB}MB)`,
      {
        heapUsed: memUsedMB,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      }
    );
    return false;
  }

  return true;
}

/**
 * 🚀 Main crawler execution function
 */
async function runEnhancedCrawler() {
  if (isRunning) {
    workerLog("warn", "Crawler already running, skipping this execution");
    return;
  }

  if (shutdownInProgress) {
    workerLog("warn", "Shutdown in progress, skipping crawler execution");
    return;
  }

  isRunning = true;
  updateStatus("starting");

  let sessionResult = null;

  try {
    // Check memory before starting
    if (!checkMemoryUsage()) {
      throw new Error("Memory usage too high to start crawler");
    }

    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://comic_mongo:27017/comic_database",
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        }
      );
      workerLog("info", "MongoDB connected successfully");
    }

    updateStatus("running");

    // Initialize enhanced crawler service
    workerLog("info", "Initializing Enhanced Crawler Service...");
    await EnhancedCrawlerService.initialize(false);

    // Setup timeout for maximum crawl duration
    const timeout = setTimeout(async () => {
      workerLog(
        "warn",
        `Crawler exceeded maximum duration (${crawlerConfig.maxCrawlDuration}ms)`
      );
      try {
        await EnhancedCrawlerService.stopCrawling("Maximum duration exceeded");
      } catch (error) {
        workerLog("error", "Failed to stop crawler on timeout:", {
          error: error.message,
        });
      }
    }, crawlerConfig.maxCrawlDuration);

    // Start crawling
    workerLog("info", "Starting enhanced crawler execution...");
    sessionResult = await EnhancedCrawlerService.startCrawling({
      isScheduled: true,
      reason: "Worker scheduled execution",
    });

    clearTimeout(timeout);

    // Log results
    if (sessionResult.status === "completed") {
      workerLog("info", `Crawler completed successfully`, {
        sessionId: sessionResult.sessionId,
        duration: sessionResult.duration,
        stats: sessionResult.stats,
        performance: sessionResult.performance,
      });
      updateStatus("completed", {
        sessionResult,
        memoryUsage: process.memoryUsage(),
      });
    } else {
      workerLog(
        "warn",
        `Crawler finished with status: ${sessionResult.status}`,
        sessionResult
      );
      updateStatus(sessionResult.status, sessionResult);
    }
  } catch (error) {
    workerLog("error", `Enhanced crawler execution failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      memoryUsage: process.memoryUsage(),
    });
    updateStatus("error", {
      error: error.message,
      sessionResult,
    });

    // Auto-restart on certain errors if enabled
    if (crawlerConfig.autoRestart && !shutdownInProgress) {
      const restartableErrors = ["ENOTFOUND", "ECONNREFUSED", "TIMEOUT"];
      const shouldRestart = restartableErrors.some(
        (errType) => error.message.includes(errType) || error.code === errType
      );

      if (shouldRestart) {
        workerLog("info", "Scheduling auto-restart due to recoverable error");
        setTimeout(() => {
          if (!shutdownInProgress) {
            runEnhancedCrawler();
          }
        }, 5 * 60 * 1000); // 5 minutes delay
      }
    }
  } finally {
    isRunning = false;

    // Cleanup if not shutting down
    if (!shutdownInProgress) {
      try {
        // Perform memory cleanup
        if (global.gc) {
          global.gc();
          workerLog("debug", "Garbage collection triggered");
        }

        // Check final memory usage
        checkMemoryUsage();
      } catch (cleanupError) {
        workerLog("warn", "Cleanup error:", { error: cleanupError.message });
      }
    }
  }
}

/**
 * 📅 Setup crawler schedule
 */
function setupCrawlerSchedule() {
  const schedule = crawlerConfig.schedule;
  if (!schedule) {
    workerLog("warn", "No schedule configured for crawler");
    return false;
  }

  try {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }

    const cron = require("node-cron");
    workerLog("info", `Setting up crawler schedule: ${schedule}`);

    scheduledTask = cron.schedule(
      schedule,
      async () => {
        if (!shutdownInProgress) {
          workerLog("info", "Executing scheduled crawler run");
          await runEnhancedCrawler();
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh",
      }
    );

    workerLog("info", "Crawler schedule configured successfully");
    return true;
  } catch (error) {
    workerLog("error", `Failed to setup crawler schedule: ${error.message}`);
    return false;
  }
}

/**
 * 🏥 Health monitoring
 */
function setupHealthMonitoring() {
  setInterval(async () => {
    if (shutdownInProgress) return;

    try {
      const healthResult = await EnhancedCrawlerService.healthCheck();

      if (!healthResult.healthy) {
        workerLog("warn", "Health check failed", healthResult);

        // Take corrective action if needed
        if (healthResult.consecutiveFailures > 5) {
          workerLog(
            "error",
            "Too many consecutive health check failures - considering restart"
          );
        }
      } else {
        workerLog("debug", "Health check passed", {
          healthy: healthResult.healthy,
          consecutiveFailures: healthResult.consecutiveFailures,
        });
      }
    } catch (error) {
      workerLog("warn", "Health monitoring error:", { error: error.message });
    }
  }, crawlerConfig.healthCheckInterval);
}

/**
 * 🚪 Graceful shutdown
 */
async function gracefulShutdown(reason = "Unknown") {
  if (shutdownInProgress) {
    workerLog("warn", "Shutdown already in progress");
    return;
  }

  shutdownInProgress = true;
  workerLog("info", `Starting graceful shutdown: ${reason}`);

  try {
    // Stop scheduled task
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
      workerLog("info", "Scheduled task stopped");
    }

    // Stop crawler if running
    if (isRunning) {
      workerLog("info", "Stopping running crawler...");
      await EnhancedCrawlerService.stopCrawling("Worker shutdown");
    }

    // Shutdown crawler service
    await EnhancedCrawlerService.shutdown();

    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      workerLog("info", "MongoDB connection closed");
    }

    workerLog("info", "Graceful shutdown completed");
    updateStatus("shutdown", { reason });
  } catch (error) {
    workerLog("error", `Error during shutdown: ${error.message}`);
  }
}

/**
 * 🎯 Main worker initialization
 */
async function initializeWorker() {
  workerLog("info", "Initializing Enhanced Crawler Worker", {
    enabled: crawlerConfig.enabled,
    runOnStartup: crawlerConfig.runOnStartup,
    schedule: crawlerConfig.schedule,
    maxDuration: crawlerConfig.maxCrawlDuration,
    nodeVersion: process.version,
    platform: process.platform,
  });

  if (!crawlerConfig.enabled) {
    workerLog("warn", "Crawler is disabled in configuration");
    updateStatus("disabled");
    return;
  }

  try {
    // Setup schedule
    const scheduleSetup = setupCrawlerSchedule();
    if (!scheduleSetup) {
      throw new Error("Failed to setup crawler schedule");
    }

    // Setup health monitoring
    setupHealthMonitoring();

    // Run immediately if configured
    if (crawlerConfig.runOnStartup && !shutdownInProgress) {
      workerLog("info", "Running crawler on startup as configured");
      setTimeout(() => {
        if (!shutdownInProgress) {
          runEnhancedCrawler();
        }
      }, 10000); // 10 second delay to allow full initialization
    }

    updateStatus("initialized");
    workerLog("info", "Enhanced Crawler Worker initialized successfully");
  } catch (error) {
    workerLog("error", `Worker initialization failed: ${error.message}`);
    updateStatus("error", { error: error.message });
    throw error;
  }
}

// Handle messages from parent process
if (parentPort) {
  parentPort.on("message", async (message) => {
    try {
      switch (message.type) {
        case "start":
          workerLog("info", "Received start command from parent");
          await runEnhancedCrawler();
          break;

        case "stop":
          workerLog("info", "Received stop command from parent");
          if (isRunning) {
            await EnhancedCrawlerService.stopCrawling("Parent stop command");
          }
          break;

        case "status":
          const status = await EnhancedCrawlerService.getStatus();
          parentPort.postMessage({
            type: "status_response",
            data: status,
          });
          break;

        case "health":
          const health = await EnhancedCrawlerService.healthCheck();
          parentPort.postMessage({
            type: "health_response",
            data: health,
          });
          break;

        case "shutdown":
          await gracefulShutdown("Parent shutdown command");
          process.exit(0);
          break;

        default:
          workerLog("warn", `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      workerLog("error", `Error handling message: ${error.message}`);
      parentPort.postMessage({
        type: "error",
        error: error.message,
      });
    }
  });
}

// Handle process signals
process.on("SIGINT", () => {
  workerLog("info", "SIGINT received");
  gracefulShutdown("SIGINT").then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  workerLog("info", "SIGTERM received");
  gracefulShutdown("SIGTERM").then(() => process.exit(0));
});

process.on("uncaughtException", (error) => {
  workerLog("error", `Uncaught Exception: ${error.message}`, {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown("Uncaught Exception").then(() => process.exit(1));
});

process.on("unhandledRejection", (reason, promise) => {
  workerLog("error", `Unhandled Rejection: ${reason}`, {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  gracefulShutdown("Unhandled Rejection").then(() => process.exit(1));
});

// Start worker initialization
initializeWorker().catch((error) => {
  workerLog("error", `Critical initialization error: ${error.message}`);
  process.exit(1);
});
