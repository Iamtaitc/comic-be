/**
 * Controller cho quản lý bình luận
 * Xử lý request và response, gọi service để thực hiện logic nghiệp vụ
 */

const commentService = require("../../services/admin/comment.service");
const ApiResponse = require("../../utils/ApiResponse.utils");
const logger = require("../../utils/logger");

class CommentAdminController {
  /**
   * getComments
   *
   * @desc    Lấy danh sách bình luận có phân trang và tìm kiếm
   * @route   GET /api/admin/comments
   * @access  Admin, Moderator
   */
  async getComments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status = "all",
        StoryId,
        userId,
        sort = "createdAt",
        order = "desc",
      } = req.query;

      const result = await commentService.getComments({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        StoryId,
        userId,
        sort,
        order,
      });

      return ApiResponse.paginated(
        res,
        result.comments,
        result.total,
        result.page,
        result.limit,
        "Lấy danh sách bình luận thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách bình luận:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách bình luận",
        error.message
      );
    }
  }

  /**
   * getPendingComments
   *
   * @desc    Lấy danh sách bình luận đang chờ duyệt
   * @route   GET /api/admin/comments/pending
   * @access  Admin, Moderator
   */
  async getPendingComments(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await commentService.getPendingComments({
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return ApiResponse.paginated(
        res,
        result.comments,
        result.total,
        result.page,
        result.limit,
        "Lấy danh sách bình luận chờ duyệt thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách bình luận chờ duyệt:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách bình luận chờ duyệt",
        error.message
      );
    }
  }

  /**
   * getCommentById
   *
   * @desc    Lấy thông tin chi tiết của một bình luận
   * @route   GET /api/admin/comments/:id
   * @access  Admin, Moderator
   */
  async getCommentById(req, res) {
    try {
      const commentId = req.params.id;
      const comment = await commentService.getCommentById(commentId);

      if (!comment) {
        return ApiResponse.notFound(res, "Không tìm thấy bình luận");
      }

      return ApiResponse.success(
        res,
        comment,
        "Lấy thông tin bình luận thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin bình luận ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin bình luận",
        error.message
      );
    }
  }

  /**
   * updateComment
   *
   * @desc    Cập nhật trạng thái bình luận
   * @route   PUT /api/admin/comments/:id
   * @access  Admin, Moderator
   */
  async updateComment(req, res) {
    try {
      const commentId = req.params.id;
      const { status, content } = req.body;

      const updatedComment = await commentService.updateComment(commentId, {
        status,
        content,
      });

      return ApiResponse.success(
        res,
        updatedComment,
        "Cập nhật bình luận thành công"
      );
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return ApiResponse.notFound(res, error.message);
      } else if (error.code === "BAD_REQUEST") {
        return ApiResponse.badRequest(res, error.message);
      }

      logger.error(`Lỗi khi cập nhật bình luận ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật bình luận",
        error.message
      );
    }
  }

  /**
   * deleteComment
   *
   * @desc    Xóa bình luận
   * @route   DELETE /api/admin/comments/:id
   * @access  Admin, Moderator
   */
  async deleteComment(req, res) {
    try {
      const commentId = req.params.id;
      await commentService.deleteComment(commentId);

      return ApiResponse.success(res, null, "Xóa bình luận thành công");
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return ApiResponse.notFound(res, error.message);
      }

      logger.error(`Lỗi khi xóa bình luận ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa bình luận",
        error.message
      );
    }
  }

  /**
   * batchUpdateComments
   *
   * @desc    Cập nhật hàng loạt bình luận
   * @route   POST /api/admin/comments/batch-update
   * @access  Admin, Moderator
   */
  async batchUpdateComments(req, res) {
    try {
      const { ids, action } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return ApiResponse.badRequest(
          res,
          "Danh sách ID bình luận không hợp lệ"
        );
      }

      if (!action) {
        return ApiResponse.badRequest(res, "Hành động cập nhật là bắt buộc");
      }

      const result = await commentService.batchUpdateComments(ids, action);

      if (action === "delete") {
        return ApiResponse.success(
          res,
          { deletedCount: result.deletedCount },
          `Đã xóa ${result.deletedCount} bình luận`
        );
      } else {
        return ApiResponse.success(
          res,
          { modifiedCount: result.modifiedCount },
          `Đã ${getBatchActionDescription(action)} ${
            result.modifiedCount
          } bình luận`
        );
      }
    } catch (error) {
      if (error.code === "BAD_REQUEST") {
        return ApiResponse.badRequest(res, error.message);
      }

      logger.error("Lỗi khi cập nhật hàng loạt bình luận:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật hàng loạt bình luận",
        error.message
      );
    }
  }

  /**
   * getCommentsStats
   *
   * @desc    Lấy thống kê về bình luận
   * @route   GET /api/admin/comments/stats/overview
   * @access  Admin, Moderator
   */
  async getCommentsStats(req, res) {
    try {
      const statsData = await commentService.getCommentsStats();

      return ApiResponse.success(
        res,
        statsData,
        "Lấy thống kê bình luận thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thống kê bình luận:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thống kê bình luận",
        error.message
      );
    }
  }

  /**
   * getTopCommentUsers
   *
   * @desc    Lấy danh sách người dùng có nhiều bình luận nhất
   * @route   GET /api/admin/comments/stats/top-users
   * @access  Admin, Moderator
   */
  async getTopCommentUsers(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await commentService.getTopCommentUsers(parseInt(limit));

      return ApiResponse.success(
        res,
        result,
        "Lấy danh sách người dùng bình luận nhiều nhất thành công"
      );
    } catch (error) {
      logger.error(
        "Lỗi khi lấy danh sách người dùng bình luận nhiều nhất:",
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách người dùng bình luận nhiều nhất",
        error.message
      );
    }
  }
}

// Helper function to get description for batch actions
function getBatchActionDescription(action) {
  switch (action) {
    case "approve":
      return "duyệt";
    case "reject":
      return "từ chối";
    case "mark-as-spam":
      return "đánh dấu là spam";
    default:
      return "cập nhật";
  }
}

module.exports = new CommentAdminController();
