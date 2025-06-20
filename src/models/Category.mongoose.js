const mongoose = require("mongoose");
const slugify = require("slugify");

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    storyCount: {
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

CategorySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

CategorySchema.pre("save", async function (next) {
  if (this.isModified("slug")) {
    let slug = this.slug;
    let count = 1;
    while (
      await mongoose.model("Category").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${this.slug}-${count++}`;
    }
    this.slug = slug;
  }
  next();
});

// Giữ các index cần thiết
CategorySchema.index({ name: 1 });
CategorySchema.index({ isActive: 1 });

module.exports = mongoose.model("Category", CategorySchema);