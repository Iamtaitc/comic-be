const mongoose = require("mongoose");

const HistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

HistorySchema.index({ userId: 1, storyId: 1, chapterId: 1 }, { unique: true });
HistorySchema.index({ userId: 1 });
HistorySchema.index({ storyId: 1 });

HistorySchema.post("save", async function (doc) {
  const User = mongoose.model("User");
  await User.updateOne(
    { _id: doc.userId },
    {
      $pull: {
        readingHistory: { story: doc.storyId, lastChapter: doc.chapterId },
      },
      $push: {
        readingHistory: {
          story: doc.storyId,
          lastChapter: doc.chapterId,
          lastReadAt: doc.readAt,
        },
      },
    }
  );
});

module.exports = mongoose.model("History", HistorySchema);
