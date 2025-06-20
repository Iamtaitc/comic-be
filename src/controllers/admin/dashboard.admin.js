/**
 * Controller cho Dashboard Admin
 * Xử lý các logic cho API dashboard
 */

const ApiResponse = require("../../utils/ApiResponse.utils");
const dashboardService = require("../../services/admin/dashboard.service");

class DashboardController {
  /**
   * getStats
   *
   * - Mục đích: Lấy thống kê tổng quan cho dashboard admin
   * - Inputs:
   *   - req.user: { _id, role }
   * - Outputs:
   *   - Success: {
   *       Story: { total, newToday, byStatus },
   *       chapters: { total, newToday },
   *       users: { total, newToday },
   *       comments: { total, pending, newToday },
   *       views: { today, yesterday, lastWeek },
   *       crawler: { lastRun, isRunning, stats }
   *     }
   *   - Error: 500 + error message
   * - Các bước xử lý:
   *   1. Gọi dashboardService để lấy dữ liệu thống kê
   *   2. Trả về response với dữ liệu thống kê
   *
   * - Ví dụ:
   *   - Request: GET /api/admin/dashboard/stats
   *   - Response: {
   *       "success": true,
   *       "message": "Lấy thông tin thống kê thành công",
   *       "data": { ... },
   *       "timestamp": "2025-04-23T10:30:00.000Z"
   *     }
   */
  async getStats(req, res) {
    try {
      const stats = await dashboardService.getStats();
      return ApiResponse.success(
        res,
        stats,
        "Lấy thông tin thống kê thành công"
      );
    } catch (error) {
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin thống kê",
        error.message
      );
    }
  }

  /**
   * getRecentStory
   *
   * - Mục đích: Lấy danh sách truyện mới cập nhật cho dashboard
   * - Inputs:
   *   - req.user: { _id, role }
   *   - req.query: { limit?: number }
   * - Outputs:
   *   - Success: Array của truyện với các trường: name, slug, thumb_url, status, updatedAt
   *   - Error: 500 + error message
   * - Các bước xử lý:
   *   1. Lấy tham số limit từ query (nếu có)
   *   2. Gọi dashboardService để lấy dữ liệu truyện mới
   *   3. Trả về response với dữ liệu truyện
   *
   * - Ví dụ:
   *   - Request: GET /api/admin/dashboard/recent-Story?limit=5
   *   - Response: {
   *       "success": true,
   *       "message": "Lấy danh sách truyện mới thành công",
   *       "data": [ ... ],
   *       "timestamp": "2025-04-23T10:30:00.000Z"
   *     }
   */
  async getRecentStory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const recentStory = await dashboardService.getRecentStory(limit);
      return ApiResponse.success(
        res,
        recentStory,
        "Lấy danh sách truyện mới thành công"
      );
    } catch (error) {
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện mới",
        error.message
      );
    }
  }

  /**
   * getRecentChapters
   *
   * - Mục đích: Lấy danh sách chapter mới cho dashboard
   * - Inputs:
   *   - req.user: { _id, role }
   *   - req.query: { limit?: number }
   * - Outputs:
   *   - Success: Array của chapter với các trường: chapter_name, chapter_title, StoryId (populated), createdAt
   *   - Error: 500 + error message
   * - Các bước xử lý:
   *   1. Lấy tham số limit từ query (nếu có)
   *   2. Gọi dashboardService để lấy dữ liệu chapter mới
   *   3. Trả về response với dữ liệu chapter
   *
   * - Ví dụ:
   *   - Request: GET /api/admin/dashboard/recent-chapters?limit=5
   *   - Response: {
   *       "success": true,
   *       "message": "Lấy danh sách chapter mới thành công",
   *       "data": [ ... ],
   *       "timestamp": "2025-04-23T10:30:00.000Z"
   *     }
   */
  async getRecentChapters(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const recentChapters = await dashboardService.getRecentChapters(limit);
      return ApiResponse.success(
        res,
        recentChapters,
        "Lấy danh sách chapter mới thành công"
      );
    } catch (error) {
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách chapter mới",
        error.message
      );
    }
  }

  /**
   * getSystemLogs
   *
   * - Mục đích: Lấy log hệ thống cho admin
   * - Inputs:
   *   - req.user: { _id, role }
   * - Outputs:
   *   - Success: Array của log
   *   - Error: 500 + error message
   * - Các bước xử lý:
   *   1. Gọi dashboardService để lấy dữ liệu log hệ thống
   *   2. Trả về response với dữ liệu log
   *
   * - Ví dụ:
   *   - Request: GET /api/admin/dashboard/system-logs
   *   - Response: {
   *       "success": true,
   *       "message": "Lấy log hệ thống thành công",
   *       "data": [ ... ],
   *       "timestamp": "2025-04-23T10:30:00.000Z"
   *     }
   */
  async getSystemLogs(req, res) {
    try {
      const logs = await dashboardService.getSystemLogs();
      return ApiResponse.success(res, logs, "Lấy log hệ thống thành công");
    } catch (error) {
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy log hệ thống",
        error.message
      );
    }
  }
}

module.exports = new DashboardController();
