/**
 * Service xử lý logic cho Dashboard Admin
 * Cung cấp các hàm để lấy dữ liệu thống kê, truyện và chapter mới nhất
 */

const {
  Story,
  Chapter,
  User,
  Comment,
  ViewCounter,
  crawlerService,
} = require("../../models/index");
const moment = require("moment");

class DashboardService {
  /**
   * Lấy thống kê tổng quan cho dashboard
   * @returns {Object} Thống kê tổng quan
   */
  async getStats() {
    // Lấy ngày hiện tại và ngày hôm qua
    const today = moment().startOf("day");
    const yesterday = moment().subtract(1, "days").startOf("day");
    const lastWeek = moment().subtract(7, "days").startOf("day");

    // Thống kê truyện
    const totalStory = await Story.countDocuments();
    const newStoryToday = await Story.countDocuments({
      createdAt: { $gte: today.toDate() },
    });
    const StoryByStatus = await Story.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Thống kê chapter
    const totalChapters = await Chapter.countDocuments();
    const newChaptersToday = await Chapter.countDocuments({
      createdAt: { $gte: today.toDate() },
    });

    // Thống kê người dùng
    const totalUsers = await User.countDocuments();
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today.toDate() },
    });

    // Thống kê bình luận
    const totalComments = await Comment.countDocuments();
    const pendingComments = await Comment.countDocuments({ status: "pending" });
    const newCommentsToday = await Comment.countDocuments({
      createdAt: { $gte: today.toDate() },
    });

    // Thống kê lượt xem
    let viewsToday = 0;
    let viewsYesterday = 0;
    let viewsLastWeek = 0;

    if (ViewCounter) {
      viewsToday = await ViewCounter.aggregate([
        { $match: { date: { $gte: today.toDate() } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]);

      viewsYesterday = await ViewCounter.aggregate([
        {
          $match: {
            date: {
              $gte: yesterday.toDate(),
              $lt: today.toDate(),
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]);

      viewsLastWeek = await ViewCounter.aggregate([
        { $match: { date: { $gte: lastWeek.toDate() } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]);
    }

    // Trạng thái crawler
    const crawlerStatus = crawlerService.getStats();

    // Tổng hợp dữ liệu
    return {
      Story: {
        total: totalStory,
        newToday: newStoryToday,
        byStatus: StoryByStatus.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
      chapters: {
        total: totalChapters,
        newToday: newChaptersToday,
      },
      users: {
        total: totalUsers,
        newToday: newUsersToday,
      },
      comments: {
        total: totalComments,
        pending: pendingComments,
        newToday: newCommentsToday,
      },
      views: {
        today: viewsToday.length > 0 ? viewsToday[0].total : 0,
        yesterday: viewsYesterday.length > 0 ? viewsYesterday[0].total : 0,
        lastWeek: viewsLastWeek.length > 0 ? viewsLastWeek[0].total : 0,
      },
      crawler: {
        lastRun: crawlerStatus.lastRun,
        isRunning: crawlerStatus.isRunning,
        stats: crawlerStatus.stats,
      },
    };
  }

  /**
   * Lấy danh sách truyện mới cập nhật
   * @param {Number} limit Số lượng bản ghi cần lấy
   * @returns {Array} Danh sách truyện mới
   */
  async getRecentStory(limit = 10) {
    return await Story.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("name slug thumb_url status updatedAt");
  }

  /**
   * Lấy danh sách chapter mới
   * @param {Number} limit Số lượng bản ghi cần lấy
   * @returns {Array} Danh sách chapter mới
   */
  async getRecentChapters(limit = 10) {
    return await Chapter.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("StoryId", "name slug")
      .select("chapter_name chapter_title StoryId createdAt");
  }

  /**
   * Lấy log hệ thống
   * @returns {Array} Danh sách log
   */
  async getSystemLogs() {
    // Thực hiện đọc file log hoặc lấy từ database nếu có
    // Đây là phần giả định, cần triển khai theo hệ thống logging cụ thể
    return [];
  }
}

module.exports = new DashboardService();
