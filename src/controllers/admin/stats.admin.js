/**
 * Controller cho thống kê và báo cáo
 * Xử lý các request và response cho API thống kê hệ thống
 */

const StatsService = require("../../services/admin/start.service");
const ApiResponse = require("../../utils/ApiResponse.utils");
const logger = require("../../utils/logger");

class StatsAdminController {
  /**
   * getOverviewStats
   *
   * @desc    Lấy thống kê tổng quan hệ thống
   * @route   GET /api/admin/stats/overview
   * @access  Admin
   */
  async getOverviewStats(req, res) {
    try {
      const statsData = await StatsService.getOverviewStats();
      return ApiResponse.success(
        res,
        statsData,
        "Lấy thống kê tổng quan thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thống kê tổng quan:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thống kê tổng quan",
        error.message
      );
    }
  }

  /**
   * getDailyStats
   *
   * @desc    Lấy thống kê theo ngày
   * @route   GET /api/admin/stats/daily
   * @access  Admin
   */
  async getDailyStats(req, res) {
    try {
      const { days = 7 } = req.query;
      const dailyData = await StatsService.getDailyStats(parseInt(days));

      return ApiResponse.success(
        res,
        dailyData,
        "Lấy thống kê theo ngày thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thống kê theo ngày:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thống kê theo ngày",
        error.message
      );
    }
  }

  /**
   * getTopStory
   *
   * @desc    Lấy danh sách truyện hàng đầu
   * @route   GET /api/admin/stats/top-Story
   * @access  Admin, Moderator
   */
  async getTopStory(req, res) {
    try {
      const { limit = 10, type = "views" } = req.query;

      if (!["views", "comments", "latest"].includes(type)) {
        return ApiResponse.badRequest(res, "Loại thống kê không hợp lệ");
      }

      const topStory = await StatsService.getTopStory(type, parseInt(limit));

      return ApiResponse.success(
        res,
        topStory,
        `Lấy danh sách truyện hàng đầu theo ${type} thành công`
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện hàng đầu:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện hàng đầu",
        error.message
      );
    }
  }

  /**
   * exportReport
   *
   * @desc    Xuất báo cáo dạng CSV
   * @route   GET /api/admin/stats/export
   * @access  Admin
   */
  async exportReport(req, res) {
    try {
      const { type, startDate, endDate } = req.query;

      if (!type) {
        return ApiResponse.badRequest(res, "Loại báo cáo là bắt buộc");
      }

      if (!["Story", "users", "views"].includes(type)) {
        return ApiResponse.badRequest(res, "Loại báo cáo không hợp lệ");
      }

      const reportResult = await StatsService.exportReport(
        type,
        startDate,
        endDate
      );

      // Thiết lập header
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${reportResult.filename}`
      );

      // Gửi nội dung CSV trực tiếp
      res.send(reportResult.csvContent);
    } catch (error) {
      logger.error("Lỗi khi xuất báo cáo:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xuất báo cáo",
        error.message
      );
    }
  }
}

module.exports = new StatsAdminController();
