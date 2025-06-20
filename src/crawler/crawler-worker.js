const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const cron = require("node-cron");
const config = require("../../config");
const CrawlerService = require("../services/story.crawler.service");

let isRunning = false;
let scheduledTask = null;
let crawlerInstance = null;

// Cấu hình crawler từ workerData, fallback về config.crawler
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
    "0 0 1-31/3 * *",
  maxConcurrentRequests:
    parseInt(process.env.CRAWLER_MAX_CONCURRENT_REQUESTS) ||
    workerData?.config?.maxConcurrentRequests ||
    5,
  requestDelay:
    parseInt(process.env.CRAWLER_REQUEST_DELAY) ||
    workerData?.config?.requestDelay ||
    1000,
  maxRetry:
    parseInt(process.env.CRAWLER_MAX_RETRY) ||
    workerData?.config?.maxRetry ||
    3,
  timeout:
    parseInt(process.env.CRAWLER_TIMEOUT) ||
    workerData?.config?.timeout ||
    30000,
  userAgent:
    process.env.CRAWLER_USER_AGENT ||
    workerData?.config?.userAgent ||
    "ComicCrawler/1.0",
  maxItemsPerSession:
    parseInt(process.env.CRAWLER_MAX_ITEMS) ||
    workerData?.config?.maxItemsPerSession ||
    1000,
  workerMode:
    process.env.CRAWLER_WORKER_MODE === "true" ||
    workerData?.config?.workerMode ||
    config.crawler?.workerMode ||
    true,
  workerRestartDelay:
    parseInt(process.env.CRAWLER_WORKER_RESTART_DELAY) ||
    workerData?.config?.workerRestartDelay ||
    60000,
  maxCrawlDuration:
    parseInt(process.env.CRAWLER_MAX_DURATION) ||
    workerData?.config?.maxCrawlDuration ||
    3600000,
};

async function connectToDatabase() {
  try {
    
    workerLog("info", "Đang kết nối đến database...");
    await mongoose.connect(workerData.mongoUri || config.mongoUri, {
      maxPoolSize: 5,
      minPoolSize: 1,
      connectTimeoutMS: 30000,
    });
    workerLog("info", "Kết nối database thành công");
    return true;
  } catch (error) {
    workerLog("error", `Lỗi kết nối database: ${error.message}`);
    crawlerErrorCounter.inc();
    return false;
  }
}

function workerLog(level, content) {
  if (parentPort) {
    parentPort.postMessage({ type: "log", level, content });
  } else {
    console.log(`[${level.toUpperCase()}] ${content}`);
  }
}

function updateStatus(status) {
  if (parentPort) {
    parentPort.postMessage({ type: "status", status });
  }
}

async function runCrawlerWithLimits() {
  if (isRunning) {
    workerLog("warn", "Crawler đang chạy, bỏ qua yêu cầu");
    return;
  }

  isRunning = true;
  updateStatus("running");

  try {
    if (!mongoose.connection.readyState) {
      const connected = await connectToDatabase();
      if (!connected) throw new Error("Không thể kết nối database");
    }

    const timeout = setTimeout(() => {
      workerLog(
        "warn",
        `Crawler vượt thời gian tối đa (${crawlerConfig.maxCrawlDuration}ms)`
      );
      if (crawlerInstance) crawlerInstance.pauseCrawling();
    }, crawlerConfig.maxCrawlDuration);

    workerLog("info", "Khởi tạo CrawlerService...");
    crawlerInstance = new CrawlerService({
      baseUrl: crawlerConfig.baseUrl,
      maxConcurrent: crawlerConfig.maxConcurrentRequests,
      requestDelay: crawlerConfig.requestDelay,
      maxRetry: crawlerConfig.maxRetry,
      timeout: crawlerConfig.timeout,
      userAgent: crawlerConfig.userAgent,
      maxItemsPerSession: crawlerConfig.maxItemsPerSession,
    });

    workerLog("info", "Bắt đầu cào dữ liệu...");
    const result = await crawlerInstance.startCrawling();
    workerLog("info", `Crawler hoàn thành: ${JSON.stringify(result.stats)}`);

    clearTimeout(timeout);
    updateStatus("completed");
  } catch (error) {
    workerLog("error", `Lỗi crawler: ${error.message}`);
    workerLog("error", `Stack trace: ${error.stack}`);
    updateStatus("error");
  } finally {
    isRunning = false;
    crawlerInstance = null;
  }
}

function setupCrawlerSchedule() {
  const schedule = crawlerConfig.schedule;
  if (!schedule) {
    workerLog("warn", "Không có cấu hình lịch");
    return false;
  }

  try {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }

    workerLog("info", `Thiết lập lịch: ${schedule}`);
    scheduledTask = cron.schedule(schedule, runCrawlerWithLimits);
    return true;
  } catch (error) {
    workerLog("error", `Lỗi thiết lập lịch: ${error.message}`);
    return false;
  }
}

async function initializeWorker() {
  workerLog("info", "Khởi động worker...");
  workerLog(
    "info",
    `Cấu hình crawler: ${JSON.stringify(crawlerConfig, null, 2)}`
  );

  try {
    const connected = await connectToDatabase();
    if (!connected) throw new Error("Không thể khởi động do lỗi database");

    if (crawlerConfig.schedule) {
      setupCrawlerSchedule();
    }

    if (crawlerConfig.runOnStartup) {
      workerLog("info", "Chạy crawler ngay khi khởi động...");
      setTimeout(runCrawlerWithLimits, 1000);
    }

    updateStatus("initialized");
    workerLog("info", "Worker sẵn sàng");
  } catch (error) {
    workerLog("error", `Lỗi khởi động: ${error.message}`);
    updateStatus("error");
    process.exit(1);
  }
}

// Xử lý messages từ main thread
if (parentPort) {
  parentPort.on("message", async (message) => {
    try {
      switch (message.command) {
        case "start":
          workerLog("info", "Nhận lệnh khởi động crawler");
          await runCrawlerWithLimits();
          break;

        case "stop":
          workerLog("info", "Nhận lệnh dừng crawler");
          if (scheduledTask) {
            scheduledTask.stop();
            scheduledTask = null;
          }
          if (crawlerInstance) {
            await crawlerInstance.pauseCrawling();
          }
          await mongoose.connection.close();
          workerLog("info", "Worker đã dừng");
          process.exit(0);

        case "status":
          updateStatus(isRunning ? "running" : "idle");
          break;

        case "restart":
          workerLog("info", "Nhận lệnh khởi động lại crawler");
          if (isRunning && crawlerInstance) {
            await crawlerInstance.pauseCrawling();
          }
          setTimeout(runCrawlerWithLimits, 1000);
          break;

        default:
          workerLog("warn", `Lệnh không hợp lệ: ${message.command}`);
      }
    } catch (error) {
      workerLog("error", `Lỗi xử lý lệnh: ${error.message}`);
    }
  });
}

// Xử lý lỗi không bắt được
process.on("uncaughtException", async (error) => {
  workerLog("error", `Lỗi không bắt được: ${error.message}`);
  workerLog("error", `Stack trace: ${error.stack}`);
  crawlerErrorCounter.inc();
  updateStatus("error");
  if (crawlerInstance) {
    try {
      await crawlerInstance.saveCheckpoint(); // Lưu checkpoint
      workerLog(
        "info",
        "Đã lưu checkpoint trước khi xử lý lỗi uncaughtException"
      );
    } catch (checkpointError) {
      workerLog("error", `Lỗi khi lưu checkpoint: ${checkpointError.message}`);
    }
  }
  // Gửi tín hiệu lỗi về main thread thay vì khởi động lại trực tiếp
  if (parentPort) {
    parentPort.postMessage({ type: "error", error: error.message });
  }

  // Thoát worker để main thread xử lý khởi động lại
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  workerLog("error", `Promise lỗi: ${reason}`);
  updateStatus("error");
});

// Xử lý tín hiệu dừng từ hệ thống
process.on("SIGTERM", async () => {
  workerLog("info", "Nhận tín hiệu SIGTERM, đang dừng worker...");
  if (scheduledTask) {
    scheduledTask.stop();
  }
  if (crawlerInstance) {
    await crawlerInstance.pauseCrawling();
  }
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  workerLog("info", "Nhận tín hiệu SIGINT, đang dừng worker...");
  if (scheduledTask) {
    scheduledTask.stop();
  }
  if (crawlerInstance) {
    await crawlerInstance.pauseCrawling();
  }
  await mongoose.connection.close();
  process.exit(0);
});

// Khởi động worker
initializeWorker();
