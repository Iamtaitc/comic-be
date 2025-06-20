const mongoose = require("mongoose");
const slugify = require("slugify");

const StorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match:
        /^[a-z0-9-[\u0020-\u007E\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/i,
    },
    origin_name: {
      type: [String],
      default: [],
    },
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["ongoing", "completed", "coming_soon"],
      default: "ongoing",
    },
    thumb_url: {
      type: String,
      trim: true,
    },
    sub_docquyen: {
      type: Boolean,
      default: false,
    },
    authorId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    author: {
      type: [String],
      default: [],
    },
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    ratingValue: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

StorySchema.pre("save", async function (next) {
  if (!this.slug && this.name) {
    let baseSlug = slugify(this.name, {
      lower: true,
      strict: false,
      remove: /[*+~.()'"!:@]/g,
    });
    let slug = baseSlug;
    let counter = 1;

    while (await mongoose.model("Story").findOne({ slug, deletedAt: null })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    this.slug = slug;
  }

  if (this.thumb_url && !this.thumb_url.startsWith("http")) {
    this.thumb_url = `https://img.otruyenapi.com/uploads/comics/${this.thumb_url}`;
  }

  next();
});

StorySchema.pre("save", async function (next) {
  if (this.isModified("ratingValue") || this.isModified("ratingCount")) {
    const ratings = await mongoose.model("Rating").find({ storyId: this._id });
    const avgRating =
      ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length || 0;
    this.ratingValue = avgRating;
    this.ratingCount = ratings.length;
  }
  if (this.isModified("likeCount")) {
    const likeCount = await mongoose.model("Like").countDocuments({
      targetType: "story",
      targetId: this._id,
    });
    this.likeCount = likeCount;
  }
  next();
});

// Chỉ giữ lại các index cần thiết
StorySchema.index({ name: 1 }); // Index cho search
StorySchema.index({ status: 1 });
StorySchema.index({ category: 1 });
StorySchema.index({ authorId: 1 });
StorySchema.index({ deletedAt: 1 });
// slug đã có unique: true nên không cần thêm index riêng

module.exports = mongoose.model("Story", StorySchema);
