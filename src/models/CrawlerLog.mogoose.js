const mongoose = require("mongoose");

const CrawlerLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["running", "completed", "error"],
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    stats: {
      newStories: { type: Number, default: 0 },
      updatedStories: { type: Number, default: 0 },
      newChapters: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    error: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CrawlerLog", CrawlerLogSchema);
