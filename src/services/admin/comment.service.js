/**
 * Service cho quản lý bình luận
 * Chứa tất cả logic nghiệp vụ liên quan đến bình luận
 */

const Comment = require("../models/Comment");
const User = require("../models/User");

class CommentService {
  /**
   * Lấy danh sách bình luận có phân trang và tìm kiếm
   * @param {Object} options Các tùy chọn lọc và phân trang
   * @returns {Object} Kết quả danh sách bình luận và thông tin phân trang
   */
  async getComments({
    page,
    limit,
    search,
    status,
    StoryId,
    userId,
    sort,
    order,
  }) {
    const query = {};

    // Xử lý tìm kiếm
    if (search) {
      query.content = { $regex: search, $options: "i" };
    }

    // Lọc theo trạng thái
    if (status && status !== "all") {
      query.status = status;
    }

    // Lọc theo truyện
    if (StoryId) {
      query.StoryId = StoryId;
    }

    // Lọc theo người dùng
    if (userId) {
      query.userId = userId;
    }

    // Tính toán số lượng document để phân trang
    const total = await Comment.countDocuments(query);

    // Sắp xếp
    const sortOptions = {};
    sortOptions[sort] = order === "asc" ? 1 : -1;

    // Lấy dữ liệu với phân trang
    const comments = await Comment.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username avatar")
      .populate("StoryId", "name slug")
      .populate("chapterId", "chapter_name")
      .populate("parentId", "content");

    return {
      comments,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy danh sách bình luận đang chờ duyệt
   * @param {Object} options Các tùy chọn phân trang
   * @returns {Object} Kết quả danh sách bình luận và thông tin phân trang
   */
  async getPendingComments({ page, limit }) {
    // Tính toán số lượng document để phân trang
    const total = await Comment.countDocuments({ status: "pending" });

    // Lấy dữ liệu với phân trang
    const comments = await Comment.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "username avatar")
      .populate("StoryId", "name slug")
      .populate("chapterId", "chapter_name")
      .populate("parentId", "content");

    return {
      comments,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy thông tin chi tiết của một bình luận
   * @param {string} commentId ID của bình luận
   * @returns {Object} Thông tin bình luận
   */
  async getCommentById(commentId) {
    return await Comment.findById(commentId)
      .populate("userId", "username avatar")
      .populate("StoryId", "name slug")
      .populate("chapterId", "chapter_name")
      .populate("parentId", "content");
  }

  /**
   * Cập nhật thông tin bình luận
   * @param {string} commentId ID của bình luận
   * @param {Object} updateData Dữ liệu cập nhật
   * @returns {Object} Bình luận đã cập nhật
   */
  async updateComment(commentId, { status, content }) {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      const error = new Error("Không tìm thấy bình luận");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Cập nhật trạng thái
    if (status) {
      const validStatuses = ["pending", "approved", "rejected", "spam"];
      if (!validStatuses.includes(status)) {
        const error = new Error("Trạng thái không hợp lệ");
        error.code = "BAD_REQUEST";
        throw error;
      }

      comment.status = status;
    }

    // Cập nhật nội dung (nếu cần kiểm duyệt)
    if (content !== undefined) {
      comment.content = content;
    }

    comment.updatedAt = new Date();
    await comment.save();

    return comment;
  }

  /**
   * Xóa bình luận
   * @param {string} commentId ID của bình luận
   */
  async deleteComment(commentId) {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      const error = new Error("Không tìm thấy bình luận");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Xóa tất cả các bình luận con
    await Comment.deleteMany({ parentId: commentId });

    // Xóa bình luận chính
    await Comment.findByIdAndDelete(commentId);
  }

  /**
   * Cập nhật hàng loạt bình luận
   * @param {Array} ids Danh sách ID bình luận
   * @param {string} action Hành động cập nhật
   * @returns {Object} Kết quả cập nhật
   */
  async batchUpdateComments(ids, action) {
    let result;

    switch (action) {
      case "approve":
        // Duyệt hàng loạt
        result = await Comment.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "approved", updatedAt: new Date() } }
        );
        return result;

      case "reject":
        // Từ chối hàng loạt
        result = await Comment.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "rejected", updatedAt: new Date() } }
        );
        return result;

      case "mark-as-spam":
        // Đánh dấu là spam
        result = await Comment.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "spam", updatedAt: new Date() } }
        );
        return result;

      case "delete":
        // Xóa hàng loạt
        // Trước tiên xóa tất cả các bình luận con
        await Comment.deleteMany({ parentId: { $in: ids } });

        // Sau đó xóa các bình luận chính
        result = await Comment.deleteMany({ _id: { $in: ids } });
        return result;

      default:
        const error = new Error("Hành động không hợp lệ");
        error.code = "BAD_REQUEST";
        throw error;
    }
  }

  /**
   * Lấy thống kê về bình luận
   * @returns {Object} Dữ liệu thống kê
   */
  async getCommentsStats() {
    // Thống kê theo trạng thái
    const statusStats = await Comment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Thống kê bình luận trong 7 ngày qua
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const dailyStats = await Comment.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Chuyển đổi định dạng cho dễ dùng
    const formattedDailyStats = dailyStats.map((item) => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      return {
        date: date.toISOString().split("T")[0],
        count: item.count,
      };
    });

    return {
      byStatus: statusStats.reduce((acc, curr) => {
        acc[curr._id || "pending"] = curr.count;
        return acc;
      }, {}),
      daily: formattedDailyStats,
    };
  }

  /**
   * Lấy danh sách người dùng có nhiều bình luận nhất
   * @param {number} limit Số lượng người dùng cần lấy
   * @returns {Array} Danh sách người dùng
   */
  async getTopCommentUsers(limit) {
    const topUsers = await Comment.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    // Lấy thông tin chi tiết của người dùng
    const userIds = topUsers.map((item) => item._id);
    const users = await User.find({ _id: { $in: userIds } }).select(
      "username avatar"
    );

    // Kết hợp kết quả
    return topUsers.map((item) => {
      const user = users.find(
        (user) => user._id.toString() === item._id.toString()
      );
      return {
        userId: item._id,
        username: user ? user.username : "Unknown",
        avatar: user ? user.avatar : null,
        commentCount: item.count,
      };
    });
  }
}

module.exports = new CommentService();
