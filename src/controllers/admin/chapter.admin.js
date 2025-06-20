/**
 * Controller cho quản lý chapter truyện tranh
 * Xử lý request và response, gọi service để thực hiện logic nghiệp vụ
 */

const chapterService = require("../../services/admin/chapter.service");
const ApiResponse = require("../../utils/ApiResponse.utils");
const logger = require("../../utils/logger");

class ChapterAdminController {
  /**
   * getChapters
   *
   * @desc    Lấy danh sách chapter có phân trang và tìm kiếm
   * @route   GET /api/admin/chapters
   * @access  Admin, Moderator
   */
  async getChapters(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        StoryId,
        sort = "createdAt",
        order = "desc",
      } = req.query;

      const result = await chapterService.getChapters({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        StoryId,
        sort,
        order
      });

      return ApiResponse.paginated(
        res,
        result.chapters,
        result.total,
        result.page,
        result.limit,
        "Lấy danh sách chapter thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách chapter:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách chapter",
        error.message
      );
    }
  }

  /**
   * getChapterById
   *
   * @desc    Lấy thông tin chi tiết của một chapter
   * @route   GET /api/admin/chapters/:id
   * @access  Admin, Moderator
   */
  async getChapterById(req, res) {
    try {
      const chapterId = req.params.id;
      const chapter = await chapterService.getChapterById(chapterId);

      if (!chapter) {
        return ApiResponse.notFound(res, "Không tìm thấy chapter");
      }

      return ApiResponse.success(
        res,
        chapter,
        "Lấy thông tin chapter thành công"
      );
    } catch (error) {
      logger.error(`Lỗi khi lấy thông tin chapter ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin chapter",
        error.message
      );
    }
  }

  /**
   * createChapter
   *
   * @desc    Tạo chapter mới
   * @route   POST /api/admin/chapters
   * @access  Admin, Editor
   */
  async createChapter(req, res) {
    try {
      const { StoryId, chapter_name, chapter_title, chapter_api_data } = req.body;
      
      const newChapter = await chapterService.createChapter({
        StoryId,
        chapter_name,
        chapter_title: chapter_title || "",
        chapter_api_data: chapter_api_data || null
      });

      return ApiResponse.created(res, newChapter, "Tạo chapter mới thành công");
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      } else if (error.code === 'CONFLICT') {
        return ApiResponse.conflict(res, error.message);
      }
      
      logger.error("Lỗi khi tạo chapter mới:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạo chapter mới",
        error.message
      );
    }
  }

  /**
   * uploadChapterImages
   *
   * @desc    Upload hình ảnh cho chapter
   * @route   POST /api/admin/chapters/:id/images
   * @access  Admin, Editor
   */
  async uploadChapterImages(req, res) {
    try {
      const chapterId = req.params.id;
      const files = req.files;
      
      const result = await chapterService.uploadChapterImages(chapterId, files);

      return ApiResponse.success(
        res,
        result,
        "Upload ảnh thành công"
      );
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      }
      
      logger.error(`Lỗi khi upload ảnh cho chapter ID ${req.params.id}:`, error);
      return ApiResponse.serverError(res, "Lỗi khi upload ảnh", error.message);
    }
  }

  /**
   * updateChapter
   *
   * @desc    Cập nhật thông tin chapter
   * @route   PUT /api/admin/chapters/:id
   * @access  Admin, Editor
   */
  async updateChapter(req, res) {
    try {
      const chapterId = req.params.id;
      const { chapter_name, chapter_title, content } = req.body;
      
      const updatedChapter = await chapterService.updateChapter(chapterId, {
        chapter_name,
        chapter_title,
        content
      });

      return ApiResponse.success(res, updatedChapter, "Cập nhật chapter thành công");
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      } else if (error.code === 'CONFLICT') {
        return ApiResponse.conflict(res, error.message);
      }
      
      logger.error(`Lỗi khi cập nhật chapter ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật chapter",
        error.message
      );
    }
  }

  /**
   * deleteChapter
   *
   * @desc    Xóa chapter
   * @route   DELETE /api/admin/chapters/:id
   * @access  Admin
   */
  async deleteChapter(req, res) {
    try {
      const chapterId = req.params.id;
      await chapterService.deleteChapter(chapterId);

      return ApiResponse.success(res, null, "Xóa chapter thành công");
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      }
      
      logger.error(`Lỗi khi xóa chapter ID ${req.params.id}:`, error);
      return ApiResponse.serverError(res, "Lỗi khi xóa chapter", error.message);
    }
  }

  /**
   * crawlChapter
   *
   * @desc    Cào dữ liệu chapter từ API
   * @route   POST /api/admin/chapters/crawl
   * @access  Admin
   */
  async crawlChapter(req, res) {
    try {
      const { chapterId, chapterApiUrl } = req.body;

      if (!chapterId) {
        return ApiResponse.badRequest(res, "ID chapter là bắt buộc");
      }

      const result = await chapterService.crawlChapter(chapterId, chapterApiUrl);

      return ApiResponse.success(
        res,
        result,
        "Cào dữ liệu chapter thành công"
      );
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      } else if (error.code === 'BAD_REQUEST') {
        return ApiResponse.badRequest(res, error.message);
      }
      
      logger.error("Lỗi khi cào dữ liệu chapter:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cào dữ liệu chapter",
        error.message
      );
    }
  }

  /**
   * batchUpdateChapters
   *
   * @desc    Cập nhật hàng loạt chapter
   * @route   POST /api/admin/chapters/batch-update
   * @access  Admin
   */
  async batchUpdateChapters(req, res) {
    try {
      const { ids, action } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return ApiResponse.badRequest(res, "Danh sách ID chapter không hợp lệ");
      }

      if (!action) {
        return ApiResponse.badRequest(res, "Hành động cập nhật là bắt buộc");
      }

      const result = await chapterService.batchUpdateChapters(ids, action);

      if (action === 'delete') {
        return ApiResponse.success(
          res,
          { deletedCount: result.deletedCount },
          `Đã xóa ${result.deletedCount} chapter`
        );
      } else if (action === 'crawl') {
        return ApiResponse.success(
          res,
          result,
          `Đã cào dữ liệu ${result.success} chapter thành công, ${result.failed} thất bại`
        );
      }
    } catch (error) {
      if (error.code === 'BAD_REQUEST') {
        return ApiResponse.badRequest(res, error.message);
      }
      
      logger.error("Lỗi khi cập nhật hàng loạt chapter:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật hàng loạt chapter",
        error.message
      );
    }
  }

  /**
   * reorderChapters
   *
   * @desc    Sắp xếp lại thứ tự chapter
   * @route   POST /api/admin/chapters/reorder
   * @access  Admin, Editor
   */
  async reorderChapters(req, res) {
    try {
      const { StoryId, chapterOrder } = req.body;

      if (!StoryId || !chapterOrder || !Array.isArray(chapterOrder)) {
        return ApiResponse.badRequest(res, "Dữ liệu sắp xếp không hợp lệ");
      }

      await chapterService.reorderChapters(StoryId, chapterOrder);

      return ApiResponse.success(res, null, "Sắp xếp lại chapter thành công");
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return ApiResponse.notFound(res, error.message);
      } else if (error.code === 'BAD_REQUEST') {
        return ApiResponse.badRequest(res, error.message);
      }
      
      logger.error("Lỗi khi sắp xếp lại chapter:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi sắp xếp lại chapter",
        error.message
      );
    }
  }
}

module.exports = new ChapterAdminController();