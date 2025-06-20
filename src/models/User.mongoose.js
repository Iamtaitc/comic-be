const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9_]+$/.test(v);
        },
        message: "Username chỉ được chứa chữ cái, số và dấu gạch dưới",
      },
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9_]+$/.test(v);
        },
        message: "Username chỉ được chứa chữ cái, số và dấu gạch dưới",
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Mặc định không lấy mật khẩu khi query
    },
    fullName: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || validator.isMobilePhone(v);
        },
        message: "Số điện thoại không hợp lệ",
      },
    },
    avatar: {
      type: String,
      default: "https://your-cdn.com/default-avatar.jpg",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["user", "moderator", "admin"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginHistory: [
      {
        timestamp: Date,
        ip: String,
        device: String,
      },
    ],
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      },
    ],
    // Giới hạn mảng readingHistory chỉ lưu 20 phần tử gần nhất
    readingHistory: {
      type: [
        {
          story: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Story",
            required: true,
          },
          lastChapter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chapter",
          },
          progress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
          },
          lastReadAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      validate: [
        function (val) {
          return val.length <= 20;
        },
        "Lịch sử đọc chỉ lưu tối đa 20 truyện gần nhất",
      ],
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      fontSize: {
        type: Number,
        min: 12,
        max: 24,
        default: 16,
      },
      notifications: {
        newChapter: {
          type: Boolean,
          default: true,
        },
        updates: {
          type: Boolean,
          default: true,
        },
        email: {
          type: Boolean,
          default: true,
        },
      },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

// Middleware để hash mật khẩu trước khi lưu
UserSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Phương thức so sánh mật khẩu
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Phương thức soft delete
UserSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.status = "inactive";
  this.deletedAt = new Date();
  return this.save();
};

// Phương thức khôi phục tài khoản
UserSchema.methods.restore = async function () {
  this.isActive = true;
  this.status = "active";
  this.deletedAt = null;
  return this.save();
};

// Phương thức thêm vào lịch sử đọc
UserSchema.methods.addToReadingHistory = async function (
  storyId,
  chapterId,
  progress = 0
) {
  // Tìm entry hiện tại trong lịch sử
  const existingEntryIndex = this.readingHistory.findIndex(
    (entry) => entry.story.toString() === storyId.toString()
  );

  const historyEntry = {
    story: storyId,
    lastChapter: chapterId,
    progress: progress,
    lastReadAt: new Date(),
  };

  if (existingEntryIndex !== -1) {
    // Cập nhật entry hiện tại
    this.readingHistory.splice(existingEntryIndex, 1);
  }

  // Thêm vào đầu mảng
  this.readingHistory.unshift(historyEntry);

  // Giữ số lượng trong mảng không quá 20
  if (this.readingHistory.length > 20) {
    this.readingHistory = this.readingHistory.slice(0, 20);
  }

  return this.save();
};

// Phương thức thêm vào favorites
UserSchema.methods.addToFavorites = async function (storyId) {
  if (!this.favorites.includes(storyId)) {
    this.favorites.push(storyId);
    return this.save();
  }
  return this;
};

// Phương thức xóa khỏi favorites
UserSchema.methods.removeFromFavorites = async function (storyId) {
  this.favorites = this.favorites.filter(
    (id) => id.toString() !== storyId.toString()
  );
  return this.save();
};

// Phương thức tạo token đặt lại mật khẩu
UserSchema.methods.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpires = Date.now() + 3600000; // Hết hạn sau 1 giờ

  await this.save();

  return resetToken;
};

// Tạo static method để tìm người dùng theo username hoặc email
UserSchema.statics.findByLogin = function (login) {
  return this.findOne({
    $or: [{ username: login }, { email: login.toLowerCase() }],
    isActive: true,
  });
};

// Thêm middleware để chỉ lấy người dùng active
UserSchema.pre(/^find/, function (next) {
  // Nếu không chỉ định isActive, mặc định chỉ lấy active users
  if (this._conditions.isActive === undefined) {
    this._conditions.isActive = true;
  }
  next();
});

// Thiết lập indexes
UserSchema.index({ isActive: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ "readingHistory.story": 1 });
UserSchema.index({ deletedAt: 1 });

module.exports = mongoose.model("User", UserSchema);
