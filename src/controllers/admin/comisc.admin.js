/**
 * Controller cho quản lý truyện tranh
 * Cung cấp các phương thức xử lý logic cho các API quản lý truyện
 */

const StoryService = require("../../services/admin/story.service");
const ApiResponse = require("../../utils/ApiResponse.utils");
const logger = require("../../utils/logger");

class StoryAdminController {
  /**
   * getStory
   *
   * @desc    Lấy danh sách truyện tranh có phân trang và tìm kiếm
   * @route   GET /api/admin/Story
   * @access  Admin, Moderator
   */
  async getStory(req, res) {
    try {
      const result = await StoryService.getStory(req.query);
      return ApiResponse.success(
        res,
        result,
        "Lấy danh sách truyện thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện",
        error.message
      );
    }
  }

  /**
   * getStoryById
   *
   * @desc    Lấy thông tin chi tiết của một truyện
   * @route   GET /api/admin/Story/:id
   * @access  Admin, Moderator
   */
  async getStoryById(req, res) {
    try {
      const Story = await StoryService.getStoryById(req.params.id);

      if (!Story) {
        return ApiResponse.notFound(res, "Không tìm thấy truyện");
      }

      return ApiResponse.success(res, Story, "Lấy thông tin truyện thành công");
    } catch (error) {
      logger.error(`Lỗi khi lấy thông tin truyện ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin truyện",
        error.message
      );
    }
  }

  /**
   * createStory
   *
   * @desc    Tạo truyện mới
   * @route   POST /api/admin/Story
   * @access  Admin, Editor
   */
  async createStory(req, res) {
    try {
      // Validate input cơ bản
      if (!req.body.name) {
        return ApiResponse.badRequest(res, "Tên truyện không được để trống");
      }

      const newStory = await StoryService.createStory(req.body, req.file);
      return ApiResponse.created(res, newStory, "Tạo truyện mới thành công");
    } catch (error) {
      logger.error("Lỗi khi tạo truyện mới:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạo truyện mới",
        error.message
      );
    }
  }

  /**
   * updateStory
   *
   * @desc    Cập nhật thông tin truyện
   * @route   PUT /api/admin/Story/:id
   * @access  Admin, Editor
   */
  async updateStory(req, res) {
    try {
      const updatedStory = await StoryService.updateStory(
        req.params.id,
        req.body,
        req.file
      );

      if (!updatedStory) {
        return ApiResponse.notFound(res, "Không tìm thấy truyện");
      }

      return ApiResponse.success(
        res,
        updatedStory,
        "Cập nhật truyện thành công"
      );
    } catch (error) {
      logger.error(`Lỗi khi cập nhật truyện ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật truyện",
        error.message
      );
    }
  }

  /**
   * deleteStory
   *
   * @desc    Xóa truyện và các chapter liên quan
   * @route   DELETE /api/admin/Story/:id
   * @access  Admin
   */
  async deleteStory(req, res) {
    try {
      const result = await StoryService.deleteStory(req.params.id);

      if (!result) {
        return ApiResponse.notFound(res, "Không tìm thấy truyện");
      }

      return ApiResponse.success(res, null, "Xóa truyện thành công");
    } catch (error) {
      logger.error(`Lỗi khi xóa truyện ID ${req.params.id}:`, error);
      return ApiResponse.serverError(res, "Lỗi khi xóa truyện", error.message);
    }
  }

  /**
   * getStoryChapters
   *
   * @desc    Lấy danh sách chapter của một truyện
   * @route   GET /api/admin/Story/:id/chapters
   * @access  Admin, Moderator
   */
  async getStoryChapters(req, res) {
    try {
      const chapters = await StoryService.getStoryChapters(req.params.id);
      return ApiResponse.success(
        res,
        chapters,
        "Lấy danh sách chapter thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách chapter của truyện ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách chapter",
        error.message
      );
    }
  }

  /**
   * batchUpdateStory
   *
   * @desc    Cập nhật hàng loạt trạng thái truyện
   * @route   POST /api/admin/Story/batch-update
   * @access  Admin
   */
  async batchUpdateStory(req, res) {
    try {
      const { ids, status } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return ApiResponse.badRequest(res, "Danh sách ID truyện không hợp lệ");
      }

      if (!status) {
        return ApiResponse.badRequest(res, "Trạng thái không được để trống");
      }

      const result = await StoryService.batchUpdateStatus(ids, status);
      return ApiResponse.success(
        res,
        result,
        `Đã cập nhật ${result.modifiedCount} truyện`
      );
    } catch (error) {
      logger.error("Lỗi khi cập nhật hàng loạt truyện:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật hàng loạt truyện",
        error.message
      );
    }
  }
}

module.exports = new StoryAdminController();
