const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["story", "chapter", "comment", "rating"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

LikeSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
LikeSchema.index({ targetType: 1, targetId: 1 });

LikeSchema.post("save", async function (doc) {
  const Model = mongoose.model(
    doc.targetType.charAt(0).toUpperCase() + doc.targetType.slice(1)
  );
  await Model.updateOne({ _id: doc.targetId }, { $inc: { likeCount: 1 } });

  const Notification = mongoose.model("Notification");
  let userId, title, content, referenceType;

  if (doc.targetType === "story") {
    const story = await mongoose.model("Story").findById(doc.targetId);
    userId = story.author;
    title = "Truyện của bạn được thích";
    content = `Truyện ${story.title} đã nhận được lượt thích mới!`;
    referenceType = "Story";
  } else if (doc.targetType === "chapter") {
    const chapter = await mongoose
      .model("Chapter")
      .findById(doc.targetId)
      .populate("story");
    userId = chapter.story.author;
    title = "Chương của bạn được thích";
    content = `Chương ${chapter.title} của truyện ${chapter.story.title} đã nhận được lượt thích mới!`;
    referenceType = "Chapter";
  } else if (doc.targetType === "comment") {
    const comment = await mongoose.model("Comment").findById(doc.targetId);
    userId = comment.user;
    title = "Bình luận của bạn được thích";
    content = `Bình luận của bạn đã nhận được lượt thích mới!`;
    referenceType = "Comment";
  } else if (doc.targetType === "rating") {
    const rating = await mongoose.model("Rating").findById(doc.targetId);
    userId = rating.userId;
    title = "Đánh giá của bạn được thích";
    content = `Đánh giá của bạn đã nhận được lượt thích mới!`;
    referenceType = "Rating";
  }

  if (userId && userId.toString() !== doc.userId.toString()) {
    await Notification.create({
      userId,
      title,
      content,
      type: "like",
      referenceType,
      referenceId: doc.targetId,
      priority: "medium",
    });
  }
});

LikeSchema.post("findOneAndDelete", async function (doc) {
  const Model = mongoose.model(
    doc.targetType.charAt(0).toUpperCase() + doc.targetType.slice(1)
  );
  await Model.updateOne({ _id: doc.targetId }, { $inc: { likeCount: -1 } });
});

module.exports = mongoose.model("Like", LikeSchema);
