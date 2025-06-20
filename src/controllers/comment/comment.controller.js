/**
 * Controller xử lý các chức năng liên quan đến bình luận
 */

const CommentService = require("../../services/comment/comment.service");
const logger = require("../../utils/logger");
const ApiResponse = require("../../utils/ApiResponse.utils");

class CommentController {
  /**
   * Lấy danh sách bình luận của truyện
   * @route   GET /api/Storys/:StoryId/comments
   * @access  Public
   */
  async getStoryComments(req, res) {
    try {
      const { StoryId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await CommentService.getComments(
        StoryId,
        null,
        page,
        limit
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result.comments,
        result.pagination.totalItems,
        parseInt(page),
        parseInt(limit),
        "Lấy danh sách bình luận truyện thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy bình luận truyện ${req.params.StoryId}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy bình luận truyện",
        error.message
      );
    }
  }

  /**
   * Lấy danh sách bình luận của chapter
   * @route   GET /api/Storys/:StoryId/chapters/:chapterId/comments
   * @access  Public
   */
  async getChapterComments(req, res) {
    try {
      const { StoryId, chapterId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await CommentService.getComments(
        StoryId,
        chapterId,
        page,
        limit
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result.comments,
        result.pagination.totalItems,
        parseInt(page),
        parseInt(limit),
        "Lấy danh sách bình luận chapter thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy bình luận chapter ${req.params.chapterId}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy bình luận chapter",
        error.message
      );
    }
  }

  /**
   * Thêm bình luận cho truyện
   * @route   POST /api/Storys/:StoryId/comments
   * @access  Private
   */
  async addStoryComment(req, res) {
    try {
      const { StoryId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user._id;

      if (!content) {
        return ApiResponse.badRequest(res, "Nội dung bình luận là bắt buộc");
      }

      const result = await CommentService.commentStory(
        userId,
        StoryId,
        content,
        null,
        parentId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.created(res, result.comment, result.message);
    } catch (error) {
      logger.error(`Lỗi khi bình luận truyện ${req.params.StoryId}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi bình luận truyện",
        error.message
      );
    }
  }

  /**
   * Thêm bình luận cho chapter
   * @route   POST /api/Storys/:StoryId/chapters/:chapterId/comments
   * @access  Private
   */
  async addChapterComment(req, res) {
    try {
      const { StoryId, chapterId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user._id;

      if (!content) {
        return ApiResponse.badRequest(res, "Nội dung bình luận là bắt buộc");
      }

      const result = await CommentService.commentStory(
        userId,
        StoryId,
        content,
        chapterId,
        parentId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.created(res, result.comment, result.message);
    } catch (error) {
      logger.error(`Lỗi khi bình luận chapter ${req.params.chapterId}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi bình luận chapter",
        error.message
      );
    }
  }
}

module.exports = new CommentController();
