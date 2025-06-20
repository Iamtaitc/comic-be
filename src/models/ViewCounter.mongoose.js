const mongoose = require("mongoose");

const ViewCounterSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["story", "chapter"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    uniqueCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    timeBucket: {
      type: String,
      required: true, // E.g., "2025-05-01" for daily aggregation
    },
    bucketType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: "daily",
    },
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    country: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^[A-Z]{2}$/.test(v); // ISO 3166-1 alpha-2
        },
        message: "Mã quốc gia không hợp lệ",
      },
    },
    region: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    referrer: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return (
            !v || /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/.test(v)
          );
        },
        message: "Referrer không hợp lệ",
      },
    },
    referrerDomain: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^([\w-]+\.)+[\w-]+$/.test(v),
        message: "Tên miền referrer không hợp lệ",
      },
    },
    searchKeyword: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    readTime: {
      type: Number, // In seconds
      default: 0,
      min: 0,
    },
    completionRate: {
      type: Number, // Percentage 0-100
      default: 0,
      min: 0,
      max: 100,
    },
    language: {
      type: String,
      enum: ["vi", "en", "other"],
      default: "vi",
    },
    platform: {
      type: String,
      enum: ["web", "ios", "android", "unknown"],
      default: "unknown",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.userIps;
        delete ret.userFingerprints;
        delete ret.userIds;
        return ret;
      },
    },
  }
);

// Phương thức tạo timeBucket
ViewCounterSchema.statics.createTimeBucket = function (
  date,
  bucketType = "daily"
) {
  const d = date || new Date();
  switch (bucketType) {
    case "daily":
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    case "weekly":
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      return startOfWeek.toISOString().slice(0, 10);
    case "monthly":
      return d.toISOString().slice(0, 7); // YYYY-MM
    case "yearly":
      return d.toISOString().slice(0, 4); // YYYY
    default:
      return d.toISOString().slice(0, 10);
  }
};

// Phương thức tăng view count
ViewCounterSchema.statics.incrementView = async function (options) {
  const {
    targetType,
    targetId,
    deviceType = "unknown",
    browser = null,
    country = null,
    region = null,
    referrer = null,
    userId = null,
    ip = null,
    fingerprint = null,
    readTime = 0,
    completionRate = 0,
    bucketType = "daily",
    language = "vi",
    platform = "unknown",
  } = options;

  const now = new Date();
  const timeBucket = this.createTimeBucket(now, bucketType);

  let referrerDomain = null;
  if (referrer) {
    try {
      const url = new URL(
        referrer.startsWith("http") ? referrer : `http://${referrer}`
      );
      referrerDomain = url.hostname;
    } catch (e) {}
  }

  const query = {
    targetType,
    targetId,
    timeBucket,
    bucketType,
  };

  let isUnique = true;
  if (userId || ip || fingerprint) {
    const UniqueView = mongoose.model("UniqueView");
    const existingView = await UniqueView.findOne({
      viewCounterId: await this.findOne(query).select("_id"),
      $or: [
        ...(userId ? [{ userId }] : []),
        ...(ip ? [{ ip }] : []),
        ...(fingerprint ? [{ fingerprint }] : []),
      ],
    });
    isUnique = !existingView;
  }

  const update = {
    $inc: {
      count: 1,
      ...(isUnique ? { uniqueCount: 1 } : {}),
    },
    $set: {
      deviceType,
      browser,
      country,
      region,
      referrer,
      referrerDomain,
      language,
      platform,
    },
    $max: {
      readTime,
      completionRate,
    },
  };

  const viewCounter = await this.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
  });

  if (isUnique && (userId || ip || fingerprint)) {
    await mongoose.model("UniqueView").create({
      viewCounterId: viewCounter._id,
      userId,
      ip,
      fingerprint,
    });
  }

  return viewCounter;
};

// Phương thức tính tổng lượt xem
ViewCounterSchema.statics.getTotalViews = async function (
  targetType,
  targetId
) {
  const result = await this.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$count" },
        totalUniqueViews: { $sum: "$uniqueCount" },
      },
    },
  ]);

  return result.length > 0
    ? {
        totalViews: result[0].totalViews,
        totalUniqueViews: result[0].totalUniqueViews,
      }
    : { totalViews: 0, totalUniqueViews: 0 };
};

// Phương thức lấy xu hướng lượt xem
ViewCounterSchema.statics.getViewTrend = async function (options) {
  const {
    targetType,
    targetId,
    startDate,
    endDate = new Date(),
    interval = "daily",
  } = options;

  const formatDate = (date, intervalType) =>
    this.createTimeBucket(date, intervalType);
  const start = formatDate(startDate, interval);
  const end = formatDate(endDate, interval);

  return this.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId),
        bucketType: interval,
        timeBucket: { $gte: start, $lte: end },
        deletedAt: null,
      },
    },
    {
      $sort: { timeBucket: 1 },
    },
    {
      $project: {
        _id: 0,
        date: "$timeBucket",
        views: "$count",
        uniqueViews: "$uniqueCount",
        deviceType: 1,
        country: 1,
        language: 1,
        platform: 1,
      },
    },
  ]);
};

// Phương thức phân tích nguồn lưu lượng truy cập
ViewCounterSchema.statics.getReferrerAnalytics = async function (
  targetType,
  targetId,
  limit = 10
) {
  return this.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId),
        referrerDomain: { $ne: null },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$referrerDomain",
        totalViews: { $sum: "$count" },
        uniqueViews: { $sum: "$uniqueCount" },
      },
    },
    {
      $sort: { totalViews: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 0,
        domain: "$_id",
        totalViews: 1,
        uniqueViews: 1,
      },
    },
  ]);
};

// Phương thức tổng hợp dữ liệu
ViewCounterSchema.statics.aggregateViewStats = async function (options) {
  const {
    targetType,
    targetId,
    fromBucket = "daily",
    toBucket = "monthly",
    date = new Date(),
  } = options;

  let startDate, endDate;
  if (toBucket === "weekly") {
    startDate = new Date(date);
    startDate.setDate(date.getDate() - date.getDay());
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (toBucket === "monthly") {
    startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  } else if (toBucket === "yearly") {
    startDate = new Date(date.getFullYear(), 0, 1);
    endDate = new Date(date.getFullYear(), 11, 31);
  }

  const formatStartDate = this.createTimeBucket(startDate, fromBucket);
  const formatEndDate = this.createTimeBucket(endDate, fromBucket);
  const targetTimeBucket = this.createTimeBucket(date, toBucket);

  const records = await this.find({
    targetType,
    targetId,
    bucketType: fromBucket,
    timeBucket: { $gte: formatStartDate, $lte: formatEndDate },
    deletedAt: null,
  });

  if (records.length === 0) return null;

  const uniqueViews = await mongoose.model("UniqueView").aggregate([
    {
      $match: {
        viewCounterId: { $in: records.map((r) => r._id) },
      },
    },
    {
      $group: {
        _id: null,
        uniqueCount: { $addToSet: "$userId" },
      },
    },
  ]);

  const aggregatedData = {
    targetType,
    targetId,
    timeBucket: targetTimeBucket,
    bucketType: toBucket,
    count: records.reduce((sum, record) => sum + record.count, 0),
    uniqueCount: uniqueViews.length > 0 ? uniqueViews[0].uniqueCount.length : 0,
    deviceType: this.getMostCommonValue(records, "deviceType"),
    country: this.getMostCommonValue(records, "country"),
    readTime: Math.round(
      records.reduce((sum, record) => sum + record.readTime, 0) / records.length
    ),
    completionRate: Math.round(
      records.reduce((sum, record) => sum + record.completionRate, 0) /
        records.length
    ),
    language: this.getMostCommonValue(records, "language"),
    platform: this.getMostCommonValue(records, "platform"),
  };

  return this.findOneAndUpdate(
    {
      targetType,
      targetId,
      timeBucket: targetTimeBucket,
      bucketType: toBucket,
    },
    aggregatedData,
    { new: true, upsert: true }
  );
};

// Phương thức làm sạch dữ liệu cũ
ViewCounterSchema.statics.cleanupOldRecords = async function (
  olderThanDays = 365
) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - olderThanDays);
  const thresholdBucket = this.createTimeBucket(threshold, "daily");
  return this.deleteMany({
    timeBucket: { $lt: thresholdBucket },
    bucketType: "daily",
  });
};

// Helper method để tìm giá trị phổ biến nhất
ViewCounterSchema.statics.getMostCommonValue = function (records, field) {
  const counts = {};
  records.forEach((record) => {
    const value = record[field];
    if (value) {
      counts[value] = (counts[value] || 0) + record.count;
    }
  });

  let maxCount = 0;
  let mostCommon = null;

  for (const [value, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }

  return mostCommon;
};

// Phương thức soft delete
ViewCounterSchema.methods.softDelete = async function () {
  this.deletedAt = new Date();
  return this.save();
};

ViewCounterSchema.index(
  { targetType: 1, targetId: 1, timeBucket: 1, bucketType: 1 },
  { unique: true }
);
ViewCounterSchema.index({ targetType: 1, targetId: 1 });
ViewCounterSchema.index({ timeBucket: 1 });
ViewCounterSchema.index({ bucketType: 1 });
ViewCounterSchema.index({ deletedAt: 1 });

module.exports = mongoose.model("ViewCounter", ViewCounterSchema);
