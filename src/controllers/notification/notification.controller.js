/**
 * Controller thông báo cho người dùng
 * Xử lý các logic cho API quản lý thông báo
 */

const notificationService = require("../../services/notification/notification");
const logger = require("../../utils/logger");
const ApiResponse = require("../../utils/ApiResponse.utils");

class NotificationController {
  /**
   * Lấy danh sách thông báo của người dùng
   * @route   GET /api/notifications
   * @access  Private
   */
  async getNotifications(req, res) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = req.query;
      const userId = req.user._id;

      const result = await notificationService.getNotifications({
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === "true",
      });
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result.notifications,
        result.pagination.totalItems,
        result.pagination.currentPage,
        result.pagination.pageSize,
        "Lấy danh sách thông báo thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách thông báo:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách thông báo",
        error.message
      );
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   * @route   PUT /api/notifications/:id
   * @access  Private
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const notification = await notificationService.markAsRead(id, userId);

      if (!notification) {
        return ApiResponse.notFound(res, "Không tìm thấy thông báo");
      }
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        notification,
        "Đã đánh dấu thông báo là đã đọc"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi đánh dấu thông báo đã đọc ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi đánh dấu thông báo đã đọc",
        error.message
      );
    }
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   * @route   PUT /api/notifications
   * @access  Private
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user._id;

      const modifiedCount = await notificationService.markAllAsRead(userId);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        { modifiedCount },
        `Đã đánh dấu ${modifiedCount} thông báo là đã đọc`
      );
    } catch (error) {
      logger.error("Lỗi khi đánh dấu tất cả thông báo đã đọc:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi đánh dấu tất cả thông báo đã đọc",
        error.message
      );
    }
  }

  /**
   * Xóa một thông báo
   * @route   DELETE /api/notifications/:id
   * @access  Private
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const deleted = await notificationService.deleteNotification(id, userId);

      if (!deleted) {
        return ApiResponse.notFound(res, "Không tìm thấy thông báo");
      }
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(res, null, "Đã xóa thông báo");
    } catch (error) {
      logger.error(`Lỗi khi xóa thông báo ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa thông báo",
        error.message
      );
    }
  }

  /**
   * Xóa tất cả thông báo
   * @route   DELETE /api/notifications
   * @access  Private
   */
  async deleteAllNotifications(req, res) {
    try {
      const userId = req.user._id;

      const deletedCount = await notificationService.deleteAllNotifications(
        userId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        { deletedCount },
        `Đã xóa ${deletedCount} thông báo`
      );
    } catch (error) {
      logger.error("Lỗi khi xóa tất cả thông báo:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa tất cả thông báo",
        error.message
      );
    }
  }
}

module.exports = new NotificationController();
