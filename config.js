/**
 * File cấu hình hệ thống
 * Chứa các tham số và thiết lập cho toàn bộ ứng dụng
 * be\config.js
 */
const path = require("path");
const dotenv = require("dotenv");

// Nạp biến môi trường từ file .env tại đường dẫn cụ thể
dotenv.config({ path: path.resolve(__dirname, "./.env") });

const getEnv = (key, defaultValue) => {
  return process.env[key] || defaultValue;
};

module.exports = {
  // Cấu hình server
  port: parseInt(getEnv("PORT", 3000)),
  env: getEnv("NODE_ENV", "development"),

  // Cấu hình database
  mongoUri: getEnv("MONGO_URI", "mongodb://localhost:27017/comic_database"),

  // Cấu hình JWT
  jwtSecret: getEnv("JWT_SECRET"),
  jwtExpiration: getEnv("JWT_EXPIRATION", "1d"),

  // Cấu hình crawler
  crawler: {
    enabled: getEnv("CRAWLER_ENABLED", "false") === "true",
    baseUrl: getEnv("CRAWLER_BASE_URL", "https://otruyenapi.com/v1/api"),
    runOnStartup: getEnv("CRAWLER_RUN_ON_STARTUP", "false") === "true",
    schedule: getEnv("CRAWLER_SCHEDULE", "0 */12 * * *"),

    // Cấu hình giới hạn tài nguyên cho worker thread
    maxConcurrentRequests: parseInt(
      getEnv("CRAWLER_MAX_CONCURRENT_REQUESTS", "5")
    ),
    requestDelay: parseInt(getEnv("CRAWLER_REQUEST_DELAY", "1000")),
    maxRetry: parseInt(getEnv("CRAWLER_MAX_RETRY", "3")),
    userAgent: getEnv("CRAWLER_USER_AGENT", "ComicCrawler/1.0"),

    // Cấu hình mới cho worker thread
    workerMode: getEnv("CRAWLER_WORKER_MODE", "true") === "true",
    workerRestartDelay: parseInt(
      getEnv("CRAWLER_WORKER_RESTART_DELAY", "60000")
    ),

    // Thêm giới hạn tài nguyên
    maxCrawlDuration: parseInt(getEnv("CRAWLER_MAX_DURATION", "1800000")), // 30 phút
    maxItemsPerSession: parseInt(getEnv("CRAWLER_MAX_ITEMS", "1000")),
    timeout: parseInt(getEnv("CRAWLER_TIMEOUT", "30000")),
  },

  // Cấu hình logging
  logging: {
    level: getEnv("LOG_LEVEL", "info"),
    file: {
      enabled: getEnv("LOG_FILE_ENABLED", "false") === "true",
      path: getEnv("LOG_FILE_PATH", "./logs/app.log"),
      maxSize: getEnv("LOG_FILE_MAX_SIZE", "10m"),
      maxFiles: parseInt(getEnv("LOG_FILE_MAX_FILES", "5")),
    },
  },
};
