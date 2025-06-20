/**
 * Service xử lý logic thống kê và báo cáo
 * Cung cấp các phương thức xử lý business logic cho thống kê hệ thống
 */

const {
  Story,
  Chapter,
  User,
  Comment,
  ViewCounter,
} = require("../../models/index");
const moment = require("moment");

class StatsService {
  /**
   * Lấy thống kê tổng quan hệ thống
   * @returns {Object} Dữ liệu thống kê tổng quan
   */
  async getOverviewStats() {
    // Thống kê truyện
    const totalStory = await Story.countDocuments();
    const StoryByStatus = await Story.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Thống kê chapter
    const totalChapters = await Chapter.countDocuments();

    // Thống kê người dùng
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Thống kê bình luận
    const totalComments = await Comment.countDocuments();
    const commentsByStatus = await Comment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Thống kê lượt xem tổng
    let totalViews = 0;
    if (ViewCounter) {
      const viewsResult = await ViewCounter.aggregate([
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]);

      if (viewsResult.length > 0) {
        totalViews = viewsResult[0].total;
      }
    }

    return {
      Story: {
        total: totalStory,
        byStatus: StoryByStatus.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
      chapters: {
        total: totalChapters,
      },
      users: {
        total: totalUsers,
        byRole: usersByRole.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
      comments: {
        total: totalComments,
        byStatus: commentsByStatus.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
      views: {
        total: totalViews,
      },
    };
  }

  /**
   * Lấy thống kê theo ngày
   * @param {Number} days Số ngày cần lấy thống kê
   * @returns {Object} Dữ liệu thống kê theo ngày
   */
  async getDailyStats(days) {
    const startDate = moment().subtract(days, "days").startOf("day");

    // Thống kê truyện mới theo ngày
    const newStoryByDay = await Story.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate() },
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

    // Thống kê chapter mới theo ngày
    const newChaptersByDay = await Chapter.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate() },
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

    // Thống kê người dùng mới theo ngày
    const newUsersByDay = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate() },
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

    // Thống kê lượt xem theo ngày
    let viewsByDay = [];
    if (ViewCounter) {
      viewsByDay = await ViewCounter.aggregate([
        {
          $match: {
            date: { $gte: startDate.toDate() },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              day: { $dayOfMonth: "$date" },
            },
            count: { $sum: "$count" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]);
    }

    // Tạo mảng ngày để đảm bảo đủ số ngày yêu cầu
    const formattedDays = [];
    for (let i = 0; i < days; i++) {
      const date = moment().subtract(i, "days").format("YYYY-MM-DD");
      formattedDays.unshift(date);
    }

    // Chuyển đổi kết quả thành định dạng dễ sử dụng
    const formatAggregationResult = (data, days) => {
      const result = {};
      days.forEach((day) => {
        result[day] = 0;
      });

      data.forEach((item) => {
        const date = new Date(item._id.year, item._id.month - 1, item._id.day);
        const formattedDate = moment(date).format("YYYY-MM-DD");
        if (result[formattedDate] !== undefined) {
          result[formattedDate] = item.count;
        }
      });

      return result;
    };

    return {
      dates: formattedDays,
      Story: formatAggregationResult(newStoryByDay, formattedDays),
      chapters: formatAggregationResult(newChaptersByDay, formattedDays),
      users: formatAggregationResult(newUsersByDay, formattedDays),
      views: formatAggregationResult(viewsByDay, formattedDays),
    };
  }

  /**
   * Lấy danh sách truyện hàng đầu
   * @param {String} type Loại thống kê (views, comments, latest)
   * @param {Number} limit Số lượng truyện cần lấy
   * @returns {Array} Danh sách truyện
   */
  async getTopStory(type, limit) {
    let topStory = [];

    switch (type) {
      case "views":
        // Truyện có nhiều lượt xem nhất
        topStory = await Story.find()
          .sort({ views: -1 })
          .limit(limit)
          .select("name slug thumb_url views status");
        break;

      case "comments":
        // Truyện có nhiều bình luận nhất
        const commentStats = await Comment.aggregate([
          { $group: { _id: "$StoryId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limit },
        ]);

        // Lấy thông tin chi tiết của truyện
        const StoryIds = commentStats.map((item) => item._id);
        const Story = await Story.find({ _id: { $in: StoryIds } }).select(
          "name slug thumb_url views status"
        );

        // Kết hợp kết quả
        topStory = commentStats
          .map((item) => {
            const Story = Story.find(
              (c) => c._id.toString() === item._id.toString()
            );
            if (Story) {
              return {
                ...Story.toObject(),
                commentCount: item.count,
              };
            }
            return null;
          })
          .filter(Boolean);
        break;

      case "latest":
        // Truyện mới cập nhật
        topStory = await Story.find()
          .sort({ updatedAt: -1 })
          .limit(limit)
          .select("name slug thumb_url views status updatedAt");
        break;
    }

    return topStory;
  }

  /**
   * Xuất báo cáo dạng CSV
   * @param {String} type Loại báo cáo
   * @param {String} startDate Ngày bắt đầu
   * @param {String} endDate Ngày kết thúc
   * @returns {Object} Nội dung CSV và tên file
   */
  async exportReport(type, startDate, endDate) {
    // Chuyển đổi ngày nếu có
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;

    // Nếu không có ngày, mặc định là 30 ngày gần nhất
    if (!start) {
      start = new Date();
      start.setDate(start.getDate() - 30);
    }

    if (!end) {
      end = new Date();
    }

    let data = [];
    let csvContent = "";
    let filename = "";

    switch (type) {
      case "Story":
        // Báo cáo truyện
        data = await Story.find({
          createdAt: { $gte: start, $lte: end },
        }).select("name status views createdAt updatedAt");

        // Tạo nội dung CSV
        csvContent = "ID,Name,Status,Views,Created At,Updated At\n";
        data.forEach((Story) => {
          csvContent += `${Story._id},${Story.name},${Story.status},${Story.views},${Story.createdAt},${Story.updatedAt}\n`;
        });

        filename = `Story_report_${moment().format("YYYY-MM-DD")}.csv`;
        break;

      case "users":
        // Báo cáo người dùng
        data = await User.find({
          createdAt: { $gte: start, $lte: end },
        }).select("username email role isActive createdAt lastLogin");

        // Tạo nội dung CSV
        csvContent = "ID,Username,Email,Role,Status,Created At,Last Login\n";
        data.forEach((user) => {
          csvContent += `${user._id},${user.username},${user.email},${
            user.role
          },${user.isActive ? "Active" : "Inactive"},${user.createdAt},${
            user.lastLogin || ""
          }\n`;
        });

        filename = `users_report_${moment().format("YYYY-MM-DD")}.csv`;
        break;

      case "views":
        // Báo cáo lượt xem
        if (ViewCounter) {
          data = await ViewCounter.aggregate([
            {
              $match: {
                date: { $gte: start, $lte: end },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$date" },
                  month: { $month: "$date" },
                  day: { $dayOfMonth: "$date" },
                },
                count: { $sum: "$count" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
          ]);

          // Tạo nội dung CSV
          csvContent = "Date,View Count\n";
          data.forEach((item) => {
            const date = new Date(
              item._id.year,
              item._id.month - 1,
              item._id.day
            );
            csvContent += `${moment(date).format("YYYY-MM-DD")},${
              item.count
            }\n`;
          });
        } else {
          csvContent = "Date,View Count\n";
        }

        filename = `views_report_${moment().format("YYYY-MM-DD")}.csv`;
        break;
    }

    return {
      csvContent,
      filename,
    };
  }
}

module.exports = new StatsService();
