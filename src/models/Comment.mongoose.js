const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    replyCount: {
      type: Number,
      default: 0,
    },
    isEdited: {
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

CommentSchema.pre("save", async function (next) {
  if (!this.storyId && !this.chapterId) {
    return next(new Error("Phải cung cấp storyId hoặc chapterId"));
  }
  if (this.parentId) {
    const parentComment = await mongoose
      .model("Comment")
      .findById(this.parentId);
    if (!parentComment) {
      return next(new Error("Bình luận cha không tồn tại"));
    }
    if (
      (this.storyId &&
        parentComment.storyId?.toString() !== this.storyId.toString()) ||
      (this.chapterId &&
        parentComment.chapterId?.toString() !== this.chapterId.toString())
    ) {
      return next(
        new Error("Bình luận cha không thuộc cùng truyện hoặc chương")
      );
    }
  }
  if (this.chapterId && this.storyId) {
    const chapter = await mongoose.model("Chapter").findById(this.chapterId);
    if (!chapter || chapter.story.toString() !== this.storyId.toString()) {
      return next(new Error("Chương không thuộc truyện được chỉ định"));
    }
  }
  next();
});

CommentSchema.post("save", async function (doc) {
  if (doc.parentId) {
    await mongoose
      .model("Comment")
      .updateOne({ _id: doc.parentId }, { $inc: { replyCount: 1 } });
    const parentComment = await mongoose
      .model("Comment")
      .findById(doc.parentId)
      .populate("storyId chapterId");
    const Notification = mongoose.model("Notification");
    await Notification.create({
      userId: parentComment.userId,
      title: "Bình luận của bạn được trả lời",
      content: `Bình luận của bạn trong ${
        parentComment.storyId?.title || parentComment.chapterId?.title
      } đã nhận được phản hồi.`,
      type: "comment",
      referenceType: "Comment",
      referenceId: doc._id,
      priority: "medium",
    });
  }
});

CommentSchema.post("findOneAndDelete", async function (doc) {
  if (doc.parentId) {
    await mongoose
      .model("Comment")
      .updateOne({ _id: doc.parentId }, { $inc: { replyCount: -1 } });
  }
});

CommentSchema.index({ userId: 1 });
CommentSchema.index({ storyId: 1 });
CommentSchema.index({ chapterId: 1 });
CommentSchema.index({ parentId: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
