// app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const config = require("../config");
const logger = require("./utils/logger");
const { ensureJwtEnvVars } = require("./utils/jwtsetup");
const userRoutes = require("./routers/userRoutes");
const adminRoutes = require("./routers/adminRoutes");

// Khởi tạo Express app
const app = express();

// Đảm bảo các biến JWT được thiết lập
logger.info("Kiểm tra cấu hình JWT...");
ensureJwtEnvVars();

// Middleware cơ bản
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: logger.stream }));

// Thiết lập static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));
app.get('/health', (req, res) => res.status(200).send('OK'));
// Routes
app.use("/api", userRoutes);
app.use("/api/admin", adminRoutes);

// Route mặc định
app.get("/", (req, res) => {
  res.json({
    name: config.appName || "Story Website API",
    version: config.appVersion || "1.0.0",
    status: "online",
    time: new Date(),
  });
});

// Xử lý lỗi 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Không tìm thấy tài nguyên yêu cầu",
  });
});

// Middleware xử lý lỗi chung
app.use((err, req, res, next) => {
  logger.error("Lỗi server:", { error: err.message, stack: err.stack });

  res.status(err.status || 500).json({
    success: false,
    message: "Lỗi server",
    error: config.env === "development" ? err.message : "Internal Server Error",
  });
});

module.exports = app;