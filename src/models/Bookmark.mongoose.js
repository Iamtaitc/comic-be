const mongoose = require("mongoose");

const BookmarkSchema = new mongoose.Schema(
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
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: function (v) {
          // Thêm validate nếu cần, ví dụ: không chứa từ khóa nhạy cảm
          return true;
        },
        message: "Nội dung ghi chú không hợp lệ",
      },
    },
    lastReadChapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
    },
    readProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Middleware trước khi lưu để kiểm tra các tham chiếu
BookmarkSchema.pre("save", async function (next) {
  try {
    const User = mongoose.model("User");
    const Story = mongoose.model("Story");

    const [userExists, storyExists] = await Promise.all([
      User.exists({ _id: this.userId }),
      Story.exists({ _id: this.storyId }),
    ]);

    if (!userExists) {
      return next(new Error("Người dùng không tồn tại"));
    }

    if (!storyExists) {
      return next(new Error("Truyện không tồn tại"));
    }

    if (this.lastReadChapter) {
      const Chapter = mongoose.model("Chapter");
      const chapterExists = await Chapter.exists({
        _id: this.lastReadChapter,
        storyId: this.storyId,
      });

      if (!chapterExists) {
        return next(
          new Error("Chương không tồn tại hoặc không thuộc truyện này")
        );
      }
    }

    next();
  } catch (error) {
    return next(error);
  }
});

// Middleware sau khi lưu để cập nhật favorites của User
BookmarkSchema.post("save", async function (doc, next) {
  try {
    const User = mongoose.model("User");
    await User.updateOne(
      { _id: doc.userId },
      { $addToSet: { favorites: doc.storyId } }
    );
    next();
  } catch (error) {
    console.error("Lỗi khi cập nhật favorites của User:", error);
    // Không ném lỗi để không ảnh hưởng đến flow chính, nhưng log lại lỗi
    next();
  }
});

// Middleware sau khi xóa để cập nhật favorites của User
BookmarkSchema.post("findOneAndDelete", async function (doc, next) {
  if (!doc) return next();

  try {
    const User = mongoose.model("User");
    const Bookmark = mongoose.model("Bookmark");

    // Kiểm tra xem người dùng còn bookmark nào khác cho story này không
    const hasOtherBookmarks = await Bookmark.exists({
      userId: doc.userId,
      storyId: doc.storyId,
      _id: { $ne: doc._id },
      isActive: true,
    });

    // Chỉ xóa khỏi favorites nếu không còn bookmark nào khác
    if (!hasOtherBookmarks) {
      await User.updateOne(
        { _id: doc.userId },
        { $pull: { favorites: doc.storyId } }
      );
    }

    next();
  } catch (error) {
    console.error("Lỗi khi xóa story khỏi favorites của User:", error);
    next();
  }
});

// Thêm method để soft delete
BookmarkSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.deletedAt = new Date();
  return this.save();
};

// Thêm method để restore bookmark đã xóa
BookmarkSchema.methods.restore = async function () {
  this.isActive = true;
  this.deletedAt = null;
  return this.save();
};

// Thêm static method để tìm bookmarks theo userId
BookmarkSchema.statics.findByUser = function (userId) {
  return this.find({ userId, isActive: true })
    .populate("storyId", "title author coverImage")
    .populate("lastReadChapter", "title chapterNumber");
};

// Thêm static method để tìm bookmark theo userId và storyId
BookmarkSchema.statics.findByUserAndStory = function (userId, storyId) {
  return this.findOne({ userId, storyId, isActive: true })
    .populate("storyId")
    .populate("lastReadChapter");
};

// Thêm static method để cập nhật chương đọc cuối cùng
BookmarkSchema.statics.updateLastReadChapter = async function (
  userId,
  storyId,
  chapterId,
  progress = null
) {
  const update = { lastReadChapter: chapterId };
  if (progress !== null) {
    update.readProgress = progress;
  }

  return this.findOneAndUpdate({ userId, storyId, isActive: true }, update, {
    new: true,
    upsert: true,
  });
};

// Thiết lập indexes
BookmarkSchema.index({ userId: 1, storyId: 1 }, { unique: true });
BookmarkSchema.index({ userId: 1 });
BookmarkSchema.index({ storyId: 1 });
BookmarkSchema.index({ isActive: 1 });
BookmarkSchema.index({ deletedAt: 1 });

// Tạo query middleware để tự động chỉ lấy dữ liệu active
BookmarkSchema.pre(/^find/, function (next) {
  // Nếu người gọi không chỉ định isActive, mặc định sẽ lấy các bookmarks active
  if (this._conditions.isActive === undefined) {
    this._conditions.isActive = true;
  }
  next();
});

module.exports = mongoose.model("Bookmark", BookmarkSchema);
