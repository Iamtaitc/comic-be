const http = require("http");
const app = require("./src/app");
const config = require("./config");
const logger = require("./src/utils/logger");
const { connectDatabase } = require("./src/db/connect.mongo.js");
const { Worker } = require("worker_threads");
const path = require("path");
const mongoose = require("mongoose");
require('dotenv').config();
// --- Enhanced Crawler Config ---
const PORT = config.port || 3000;
const listTypes = ["dang-phat-hanh", "truyen-moi", "hoan-thanh", "sap-ra-mat"];

// ✅ FIX: Updated path to correct worker file
const workerPath = path.join(
  __dirname,
  "src/services/crawler/Enhanced-crawler-worker.js"
);

// --- HTTP Server ---
const server = http.createServer(app);

// --- Enhanced Worker Cluster ---
const crawlerWorkers = {};
let isShuttingDown = false;
let workerStats = {}; // Track worker performance

// --- Start all workers with enhanced configuration ---
function startCrawlerWorkers() {
  logger.info("🚀 Starting Enhanced Crawler Workers...");

  for (const listType of listTypes) {
    if (crawlerWorkers[listType] && !crawlerWorkers[listType].destroyed) {
      logger.warn(`[Worker][${listType}] Already running, skipping`);
      continue;
    }

    // Enhanced worker configuration
    const workerConfig = {
      ...config.crawler,
      listType, // Assign specific list type to worker
      optimizedForProduction: true,
      memoryLimit: 1.5 * 1024 * 1024 * 1024, // 1.5GB per worker (total ~6GB for 4 workers)
      maxSessionDuration: 2 * 60 * 60 * 1000, // 2 hours
      healthCheckInterval: 60 * 1000, // 1 minute
    };

    const worker = new Worker(workerPath, {
      workerData: { config: workerConfig },
      resourceLimits: {
        maxOldGenerationSizeMb: 1024, // 1GB memory limit per worker
        maxYoungGenerationSizeMb: 256,
        codeRangeSizeMb: 128,
      },
    });

    // Initialize worker stats
    workerStats[listType] = {
      startTime: Date.now(),
      lastHealthCheck: null,
      status: "starting",
      memoryUsage: 0,
      errors: 0,
      restarts: 0,
      lastActivity: Date.now(),
    };

    // --- Enhanced message handling ---
    worker.on("message", (msg) => {
      workerStats[listType].lastActivity = Date.now();

      switch (msg.type) {
        case "log":
          logger[msg.level || "info"](
            `[Worker][${listType}] ${msg.message}`,
            msg.metadata || {}
          );
          break;

        case "status":
          workerStats[listType].status = msg.data.status;
          workerStats[listType].memoryUsage =
            msg.data.memoryUsage?.heapUsed || 0;
          logger.info(`[Worker][${listType}] Status: ${msg.data.status}`, {
            memory: `${Math.round(
              workerStats[listType].memoryUsage / 1024 / 1024
            )}MB`,
            uptime: `${Math.round(
              (Date.now() - workerStats[listType].startTime) / 1000
            )}s`,
          });
          break;

        case "health":
          workerStats[listType].lastHealthCheck = Date.now();
          logger.debug(`[Health][${listType}]`, msg.data);
          break;

        case "error":
          workerStats[listType].errors++;
          logger.error(
            `[Worker][${listType}] ERROR: ${msg.error}`,
            msg.metadata || {}
          );

          // Auto-restart on critical errors
          if (msg.critical || workerStats[listType].errors > 5) {
            logger.warn(`[Worker][${listType}] Too many errors, restarting...`);
            restartWorker(listType, 30000);
          }
          break;

        case "performance":
          logger.info(`[Performance][${listType}]`, msg.data);
          break;

        case "shutdown":
          logger.info(`[Worker][${listType}] Graceful shutdown completed`);
          break;

        default:
          logger.debug(
            `[Worker][${listType}] Unknown message type: ${msg.type}`
          );
      }
    });

    worker.on("error", (err) => {
      workerStats[listType].errors++;
      logger.error(`[Worker][${listType}] Worker Error: ${err.message}`, {
        stack: err.stack,
        restarts: workerStats[listType].restarts,
      });
      restartWorker(listType, 60000);
    });

    worker.on("exit", (code) => {
      const stats = workerStats[listType];
      const uptime = Date.now() - stats.startTime;

      logger.info(`[Worker][${listType}] Exited`, {
        code,
        uptime: `${Math.round(uptime / 1000)}s`,
        errors: stats.errors,
        restarts: stats.restarts,
      });

      crawlerWorkers[listType] = null;

      if (code !== 0 && !isShuttingDown) {
        logger.warn(`[Worker][${listType}] Unexpected exit with code: ${code}`);
        restartWorker(listType, 60000);
      }
    });

    crawlerWorkers[listType] = worker;
    logger.info(`[Worker][${listType}] ✅ Enhanced worker thread initialized`);
  }

  // Setup periodic health monitoring
  setupWorkerHealthMonitoring();
}

// --- Enhanced worker restart with backoff ---
function restartWorker(listType, delay) {
  if (isShuttingDown) return;

  const stats = workerStats[listType];
  stats.restarts++;

  // Exponential backoff for frequent restarts
  const backoffDelay =
    stats.restarts > 3 ? delay * Math.pow(2, stats.restarts - 3) : delay;
  const maxDelay = 10 * 60 * 1000; // 10 minutes max
  const finalDelay = Math.min(backoffDelay, maxDelay);

  logger.info(
    `[Worker][${listType}] Scheduling restart in ${finalDelay}ms (attempt ${stats.restarts})`
  );

  // Cleanup old worker
  if (crawlerWorkers[listType]) {
    try {
      crawlerWorkers[listType].terminate();
    } catch (e) {
      logger.warn(
        `[Worker][${listType}] Error terminating old worker:`,
        e.message
      );
    }
    crawlerWorkers[listType] = null;
  }

  setTimeout(() => {
    if (!isShuttingDown) {
      logger.info(`[Worker][${listType}] Restarting worker...`);
      startSingleWorker(listType);
    }
  }, finalDelay);
}

// --- Start single worker (for restarts) ---
function startSingleWorker(listType) {
  // Reset stats for restart
  workerStats[listType] = {
    startTime: Date.now(),
    lastHealthCheck: null,
    status: "restarting",
    memoryUsage: 0,
    errors: 0,
    restarts: workerStats[listType]?.restarts || 0,
    lastActivity: Date.now(),
  };

  // Re-run startup logic for single worker
  const originalListTypes = listTypes.slice();
  listTypes.length = 0;
  listTypes.push(listType);

  startCrawlerWorkers();

  // Restore original list types
  listTypes.length = 0;
  listTypes.push(...originalListTypes);
}

// --- Worker health monitoring ---
function setupWorkerHealthMonitoring() {
  setInterval(() => {
    if (isShuttingDown) return;

    const now = Date.now();
    const healthThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [listType, stats] of Object.entries(workerStats)) {
      const worker = crawlerWorkers[listType];

      if (!worker || worker.destroyed) {
        continue;
      }

      // Check for inactive workers
      const timeSinceActivity = now - stats.lastActivity;
      if (timeSinceActivity > healthThreshold) {
        logger.warn(
          `[Health][${listType}] Worker inactive for ${Math.round(
            timeSinceActivity / 1000
          )}s, checking...`
        );

        // Send health check
        try {
          worker.postMessage({ type: "health_check" });
        } catch (e) {
          logger.error(
            `[Health][${listType}] Failed to send health check:`,
            e.message
          );
          restartWorker(listType, 30000);
        }
      }

      // Log current status
      logger.debug(`[Health][${listType}]`, {
        status: stats.status,
        memory: `${Math.round(stats.memoryUsage / 1024 / 1024)}MB`,
        errors: stats.errors,
        restarts: stats.restarts,
        uptime: `${Math.round((now - stats.startTime) / 1000)}s`,
      });
    }
  }, 2 * 60 * 1000); // Every 2 minutes
}

// --- Get worker cluster status ---
function getWorkerClusterStatus() {
  const status = {
    totalWorkers: listTypes.length,
    activeWorkers: 0,
    workers: {},
  };

  for (const listType of listTypes) {
    const worker = crawlerWorkers[listType];
    const stats = workerStats[listType];
    const isActive = worker && !worker.destroyed;

    if (isActive) status.activeWorkers++;

    status.workers[listType] = {
      active: isActive,
      stats: stats
        ? {
            ...stats,
            uptime: Date.now() - stats.startTime,
            memoryMB: Math.round(stats.memoryUsage / 1024 / 1024),
          }
        : null,
    };
  }

  return status;
}

// --- Enhanced shutdown with timeout ---
async function stopAllWorkers() {
  logger.info("🛑 Stopping all Enhanced Crawler workers...");

  const shutdownPromises = Object.entries(crawlerWorkers).map(
    ([listType, worker]) => {
      return new Promise((resolve) => {
        if (!worker || worker.destroyed) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          logger.warn(
            `[Worker][${listType}] Shutdown timeout, force terminating...`
          );
          worker.terminate().finally(resolve);
        }, 15000); // 15 seconds timeout

        worker.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });

        try {
          worker.postMessage({ type: "shutdown" });
        } catch (e) {
          logger.warn(
            `[Worker][${listType}] Error sending shutdown message:`,
            e.message
          );
          worker.terminate().finally(resolve);
        }
      });
    }
  );

  await Promise.all(shutdownPromises);
  logger.info("✅ All workers stopped");
}

// --- Server & database boot logic ---
async function startServer() {
  try {
    logger.info("🔌 Connecting to database...");
    await connectDatabase();
    logger.info("✅ Database connected successfully");

    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) reject(err);
        else {
          logger.info(`🚀 Server running at http://localhost:${PORT}`);
          resolve();
        }
      });
    });

    // Start Enhanced Crawler Workers if enabled
    if (
      config.crawler?.enabled &&
      config.crawler?.workerMode &&
      config.crawler?.runOnStartup
    ) {
      logger.info("🎯 Enhanced Crawler enabled, starting workers...");
      setTimeout(startCrawlerWorkers, 5000); // 5 second delay for full initialization
    } else {
      logger.info("⏸️ Enhanced Crawler workers not enabled in config");
      logger.info(
        "Enable with: CRAWLER_ENABLED=true, CRAWLER_WORKER_MODE=true, CRAWLER_RUN_ON_STARTUP=true"
      );
    }

    // API endpoint to get worker status
    app.get("/admin/crawler/workers/status", (req, res) => {
      res.json({
        success: true,
        data: getWorkerClusterStatus(),
      });
    });
  } catch (error) {
    logger.error("❌ Server startup error:", error);
    process.exit(1);
  }
}

// --- Enhanced graceful shutdown ---
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`[Shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }

  logger.info(`[Shutdown] ${signal} received, starting graceful shutdown...`);
  isShuttingDown = true;

  const shutdownTimeout = setTimeout(() => {
    logger.error("[Shutdown] Timeout reached, force exiting...");
    process.exit(1);
  }, 30000); // 30 seconds total timeout

  try {
    // Stop workers first
    await stopAllWorkers();

    // Stop HTTP server
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) logger.error("[Shutdown] Error closing server:", err);
        resolve();
      });
    });

    // Close database connection
    await mongoose.connection.close();

    clearTimeout(shutdownTimeout);
    logger.info("[Shutdown] ✅ Graceful shutdown completed");
    process.exit(0);
  } catch (e) {
    logger.error("[Shutdown] ❌ Error during shutdown:", e);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", async (err) => {
  logger.error("💥 Uncaught Exception:", err);
  await gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", async (reason) => {
  logger.error("💥 Unhandled Rejection:", reason);
  await gracefulShutdown("unhandledRejection");
});

// --- Start server ---
startServer().catch((err) => {
  logger.error("💥 Critical startup error:", err);
  process.exit(1);
});

// Export for testing
module.exports = {
  server,
  getWorkerClusterStatus,
  startCrawlerWorkers,
  stopAllWorkers,
};
