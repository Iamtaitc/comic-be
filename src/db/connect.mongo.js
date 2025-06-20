const mongoose = require("mongoose");
const config = require("../../config");
const logger = require("../utils/logger");

async function connectDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://comic_mongo:27017/comic_database",
      {
        maxPoolSize: 10,
        minPoolSize: 2,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 60000,
        useNewUrlParser: true, // Đảm bảo tương thích với driver mới
        useUnifiedTopology: true, // Quản lý kết nối tự động
      }
    );
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection failed", { error: error.message });
    process.exit(1);
  }
}

module.exports = { connectDatabase };