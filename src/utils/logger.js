/**
 * Cấu hình Logger
 * Sử dụng winston để log thông tin hệ thống
 */

const winston = require("winston");
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
const path = require("path");
const fs = require("fs");
const config = require("../../config");

// Đảm bảo thư mục logs tồn tại
const logDir = path.dirname(config.logging.file.path);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format cho console log
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta) : ""
  }`;
});

// Khởi tạo logger
const logger = createLogger({
  level: config.logging.level,
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), json()),
  defaultMeta: { service: "Story-crawler" },
  transports: [],
});

// Thêm file transport nếu được kích hoạt
if (config.logging.file.enabled) {
  logger.add(
    new transports.File({
      filename: config.logging.file.path,
      maxsize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      tailable: true,
    })
  );
}

// Nếu không phải môi trường production, log ra console
if (config.env !== "production") {
  logger.add(
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat
      ),
    })
  );
}

// Tạo stream để sử dụng với Morgan HTTP logger nếu cần
logger.stream = {
  write: function (message) {
    logger.info(message.trim());
  },
};

module.exports = logger;
