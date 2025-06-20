/**
 * Model Notification
 * Lưu trữ các thông báo cho người dùng
 */

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["system", "comment", "like", "chapter", "follow"],
    default: "system",
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    // Có thể là ID của truyện, chapter, comment, v.v. tùy thuộc vào loại thông báo
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Tạo index cho các truy vấn phổ biến
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
