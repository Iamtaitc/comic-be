const http = require("http");
const app = require("./src/app");
const config = require("./config");
const logger = require("./src/utils/logger");
const { connectDatabase } = require("./src/db/connect.mongo.js");
const { Worker } = require("worker_threads");
const path = require("path");
const mongoose = require("mongoose");

// --- Config ---
const PORT = config.port || 3000;
const listTypes = ["dang-phat-hanh", "truyen-moi", "hoan-thanh", "sap-ra-mat"];
const workerPath = path.join(__dirname, "src/crawler/crawler-worker.js");

// --- HTTP Server ---
const server = http.createServer(app);

// --- Worker Cluster ---
const crawlerWorkers = {};
let isShuttingDown = false;

// --- Start all workers, mỗi worker crawl 1 listType ---
function startCrawlerWorkers() {
  for (const listType of listTypes) {
    if (crawlerWorkers[listType] && !crawlerWorkers[listType].destroyed) {
      logger.warn(`[Worker][${listType}] Đã chạy, bỏ qua`);
      continue;
    }

    const workerConfig = {
      ...config.crawler,
      listType, // Giao nhiệm vụ cho worker crawl đúng loại
    };

    const worker = new Worker(workerPath, {
      workerData: { config: workerConfig },
      resourceLimits: { maxOldGenerationSizeMb: 300 },
    });

    // --- Nhận message/log/status từ từng worker ---
    worker.on("message", (msg) => {
      if (msg.type === "log") {
        logger[msg.level || "info"](`[Worker][${listType}] ${msg.content}`);
      } else if (msg.type === "status") {
        logger.info(`[Worker][${listType}] Status: ${msg.status}`);
      } else if (msg.type === "healthcheck") {
        logger.info(
          `[Health][${listType}] status: ${msg.status}, mem: ${(
            msg.memory /
            1024 /
            1024
          ).toFixed(1)}MB`
        );
        // Ghi lại trạng thái vào biến/DB nếu muốn làm dashboard/monitor
      } else if (msg.type === "error") {
        logger.error(`[Worker][${listType}] ERROR: ${msg.error}`);
        restartWorker(listType, 60000); // Restart worker nếu bị lỗi
      } else if (msg.type === "bye") {
        logger.info(`[Worker][${listType}] Worker dừng/thoát`);
      }
    });

    worker.on("error", (err) => {
      logger.error(`[Worker][${listType}] Lỗi: ${err.message}`);
      restartWorker(listType, 60000);
    });

    worker.on("exit", (code) => {
      crawlerWorkers[listType] = null;
      if (code !== 0 && !isShuttingDown) {
        logger.warn(`[Worker][${listType}] Exit code: ${code}`);
        restartWorker(listType, 60000);
      } else {
        logger.info(`[Worker][${listType}] Worker completed successfully`);
      }
    });

    crawlerWorkers[listType] = worker;
    logger.info(`[Worker][${listType}] Đã khởi tạo worker thread`);
  }
}

// --- Restart 1 worker sau delay ---
function restartWorker(listType, delay) {
  if (isShuttingDown) return;
  logger.info(`[Worker][${listType}] Sẽ restart sau ${delay}ms...`);
  setTimeout(() => {
    if (!isShuttingDown) startCrawlerWorkers();
  }, delay);
}

// --- Shutdown tất cả worker ---
async function stopAllWorkers() {
  logger.info("Đang dừng tất cả crawler workers...");
  await Promise.all(
    Object.values(crawlerWorkers).map(
      (worker) =>
        new Promise((resolve) => {
          if (!worker) return resolve();
          worker.once("exit", resolve);
          try {
            worker.postMessage({ command: "stop" });
          } catch (e) {
            worker.terminate().finally(resolve);
          }
          setTimeout(() => {
            if (!worker.destroyed) worker.terminate().finally(resolve);
          }, 10000);
        })
    )
  );
}

// --- Server & database boot logic ---
async function startServer() {
  try {
    logger.info("Đang kết nối database...");
    await connectDatabase();
    logger.info("Kết nối database thành công");

    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) reject(err);
        else {
          logger.info(`Server chạy tại http://localhost:${PORT}`);
          resolve();
        }
      });
    });

    // Khởi động cluster worker nếu bật workerMode
    if (
      config.crawler?.enabled &&
      config.crawler?.workerMode &&
      config.crawler?.runOnStartup
    ) {
      setTimeout(startCrawlerWorkers, 3000);
    } else {
      logger.info("Crawler worker chưa được kích hoạt trong config");
    }
  } catch (error) {
    logger.error("Lỗi khởi động server:", error);
    process.exit(1);
  }
}

// --- Graceful shutdown ---
async function gracefulShutdown(signal) {
  logger.info(`[Shutdown] ${signal} nhận, đang tắt hệ thống...`);
  isShuttingDown = true;
  try {
    await stopAllWorkers();
    await new Promise((resolve) => {
      server.close(resolve);
    });
    await mongoose.connection.close();
    logger.info("[Shutdown] Hoàn tất shutdown an toàn");
    process.exit(0);
  } catch (e) {
    logger.error("[Shutdown] Lỗi khi shutdown:", e);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", async (err) => {
  logger.error("Uncaught Exception:", err);
  await gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", async (reason) => {
  logger.error("Unhandled Rejection:", reason);
  await gracefulShutdown("unhandledRejection");
});

// --- Khởi động server ---
startServer().catch((err) => {
  logger.error("Lỗi nghiêm trọng khi boot server:", err);
  process.exit(1);
});
