const mongoose = require("mongoose");

const ChapterImageSchema = new mongoose.Schema({
  image_page: {
    type: Number,
    required: true,
  },
  image_file: {
    type: String,
    required: true,
    trim: true,
  },
});

const ChapterSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
    chapterNumber: {
      type: Number,
      required: true,
      min: 0,
    },
    chapter_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 0,
      maxlength: 200,
    },
    chapter_title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    // Đường dẫn đầy đủ để hiển thị các hình ảnh
    content: {
      type: [String],
      validate: {
        validator: (urls) => urls.every((url) => /^https?:\/\/.+/.test(url)),
        message:
          "Mỗi URL trong content phải bắt đầu bằng http:// hoặc https://",
      },
    },
    // Thông tin chi tiết về hình ảnh trong chapter
    chapter_image: {
      type: [ChapterImageSchema],
      default: [],
    },
    // Đường dẫn thư mục chứa ảnh của chapter
    chapter_path: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Tên file của chapter (từ API nguồn)
    filename: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    // Tên truyện mà chapter thuộc về (từ API nguồn)
    comic_name: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    // Đường dẫn API để lấy chi tiết chapter
    chapter_api_data: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Tên server chứa dữ liệu chapter
    server_name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    // Domain CDN để xây dựng đường dẫn hình ảnh đầy đủ
    domain_cdn: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    views: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    isPublished: {
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

ChapterSchema.pre("save", async function (next) {
  const Story = mongoose.model("Story");
  const storyExists = await Story.exists({ _id: this.storyId });
  if (!storyExists) {
    return next(new Error("Truyện không tồn tại"));
  }
  next();
});

ChapterSchema.post("save", async function (doc) {
  const Story = mongoose.model("Story");
  const Notification = mongoose.model("Notification");
  const User = mongoose.model("User");
  // Cập nhật updatedAt của Story
  await Story.updateOne({ _id: doc.storyId }, { updatedAt: new Date() });
  // Gửi thông báo cho người dùng theo dõi truyện
  if (doc.isPublished) {
    const story = await Story.findById(doc.storyId);
    const users = await User.find({ favorites: doc.storyId });
    await Notification.insertMany(
      users.map((user) => ({
        userId: user._id,
        title: "Chương mới!",
        content: `Chương ${doc.chapter_name} của truyện ${story.name} đã được đăng.`,
        type: "chapter",
        referenceType: "Chapter",
        referenceId: doc._id,
        priority: "high",
      }))
    );
  }
});

ChapterSchema.index({ storyId: 1, chapterNumber: 1 }, { unique: true });
ChapterSchema.index({ chapter_name: 1 });
ChapterSchema.index({ isPublished: 1 });

module.exports = mongoose.model("Chapter", ChapterSchema);
