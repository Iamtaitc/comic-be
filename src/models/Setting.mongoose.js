const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["string", "number", "boolean", "object", "array"],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    group: {
      type: String,
      enum: ["ui", "payment", "content", "system", "other"],
      default: "other",
    },
    description: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

SettingSchema.pre("save", function (next) {
  const { type, value } = this;
  if (
    (type === "string" && typeof value !== "string") ||
    (type === "number" && typeof value !== "number") ||
    (type === "boolean" && typeof value !== "boolean") ||
    (type === "object" &&
      (value === null || Array.isArray(value) || typeof value !== "object")) ||
    (type === "array" && !Array.isArray(value))
  ) {
    return next(new Error(`Giá trị không khớp với kiểu ${type}`));
  }
  next();
});

SettingSchema.index({ key: 1 });
SettingSchema.index({ group: 1 });

module.exports = mongoose.model("Setting", SettingSchema);
