/**
 * Controller xử lý các chức năng liên quan đến tương tác của người dùng
 */
//TOdo: done
const UserService = require("../../services/user/user.service");
const logger = require("../../utils/ApiResponse.utils");
const ApiResponse = require("../../utils/ApiResponse.utils"); // Import ApiResponse

class UserController {
  /**
   * Lưu truyện vào danh sách yêu thích
   * @route   POST /api/cStorys/:cStoryId/bookmark
   * @access  Private
   */
  async bookmarkCStory(req, res) {
    try {
      const { cStoryId } = req.params;
      const { note } = req.body;
      const userId = req.user._id;

      const result = await UserInteractionService.bookmarkCStory(
        userId,
        cStoryId,
        note
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.created(res, result.bookmark, result.message);
    } catch (error) {
      logger.error(`Lỗi khi bookmark truyện ${req.params.cStoryId}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi bookmark truyện",
        error.message
      );
    }
  }

  /**
   * Xóa truyện khỏi danh sách yêu thích
   * @route   DELETE /api/cStorys/:cStoryId/bookmark
   * @access  Private
   */
  async removeBookmark(req, res) {
    try {
      const { cStoryId } = req.params;
      const userId = req.user._id;

      const result = await UserInteractionService.removeBookmark(
        userId,
        cStoryId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(res, null, result.message);
    } catch (error) {
      logger.error(
        `Lỗi khi xóa bookmark truyện ${req.params.cStoryId}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa bookmark truyện",
        error.message
      );
    }
  }

  /**
   * Lấy danh sách truyện yêu thích của người dùng
   * @route   GET /api/user/bookmarks
   * @access  Private
   */
  async getUserBookmarks(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user._id;

      const result = await UserInteractionService.getUserBookmarks(
        userId,
        page,
        limit
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result.bookmarks,
        result.pagination.totalItems,
        result.pagination.currentPage,
        result.pagination.pageSize,
        "Lấy danh sách truyện yêu thích thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện yêu thích:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện yêu thích",
        error.message
      );
    }
  }

  /**
   * Lấy lịch sử đọc truyện của người dùng
   * @route   GET /api/user/history
   * @access  Private
   */
  async getUserHistory(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user._id;

      const result = await UserInteractionService.getUserHistory(
        userId,
        page,
        limit
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result.history,
        result.pagination.totalItems,
        result.pagination.currentPage,
        result.pagination.pageSize,
        "Lấy lịch sử đọc truyện thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy lịch sử đọc truyện:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy lịch sử đọc truyện",
        error.message
      );
    }
  }

  /**
   * Xóa tất cả lịch sử đọc truyện
   * @route   DELETE /api/user/history
   * @access  Private
   */
  async clearAllHistory(req, res) {
    try {
      const userId = req.user._id;

      const result = await UserInteractionService.clearHistory(userId);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(res, null, result.message);
    } catch (error) {
      logger.error("Lỗi khi xóa lịch sử đọc truyện:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa lịch sử đọc truyện",
        error.message
      );
    }
  }

  /**
   * Xóa một lịch sử đọc truyện cụ thể
   * @route   DELETE /api/user/history/:historyId
   * @access  Private
   */
  async clearHistoryById(req, res) {
    try {
      const { historyId } = req.params;
      const userId = req.user._id;

      const result = await UserInteractionService.clearHistory(
        userId,
        historyId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(res, null, result.message);
    } catch (error) {
      logger.error(
        `Lỗi khi xóa lịch sử đọc truyện ${req.params.historyId}:`,
        error
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa lịch sử đọc truyện",
        error.message
      );
    }
  }

  /**
   * Đánh giá truyện
   * @route   POST /api/cStorys/:cStoryId/rate
   * @access  Private
   */
  async rateCStory(req, res) {
    try {
      const { cStoryId } = req.params;
      const { value, comment } = req.body;
      const userId = req.user._id;

      if (!value) {
        return ApiResponse.badRequest(res, "Giá trị đánh giá là bắt buộc");
      }

      const result = await UserInteractionService.rateCStory(
        userId,
        cStoryId,
        value,
        comment
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.created(res, result.rating, result.message);
    } catch (error) {
      logger.error(`Lỗi khi đánh giá truyện ${req.params.cStoryId}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi đánh giá truyện",
        error.message
      );
    }
  }
}

module.exports = new UserController();
