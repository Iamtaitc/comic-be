/**
 * Controller cho quản lý thể loại (category)
 * Xử lý các request và response cho API quản lý thể loại
 */

const CategoryService = require("../../services/admin/category.service");
const ApiResponse = require("../../utils/ApiResponse.utils");
const logger = require("../../utils/logger");

class CategoryAdminController {
  /**
   * getCategories
   *
   * @desc    Lấy danh sách thể loại
   * @route   GET /api/admin/categories
   * @access  Admin, Moderator, Editor
   */
  async getCategories(req, res) {
    try {
      const { sort = "name", order = "asc", search } = req.query;
      const categories = await CategoryService.getCategories(
        sort,
        order,
        search
      );

      return ApiResponse.success(
        res,
        categories,
        "Lấy danh sách thể loại thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách thể loại:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách thể loại",
        error.message
      );
    }
  }

  /**
   * getCategoryById
   *
   * @desc    Lấy thông tin chi tiết của một thể loại
   * @route   GET /api/admin/categories/:id
   * @access  Admin, Moderator, Editor
   */
  async getCategoryById(req, res) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id);

      if (!category) {
        return ApiResponse.notFound(res, "Không tìm thấy thể loại");
      }

      return ApiResponse.success(
        res,
        category,
        "Lấy thông tin thể loại thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin thể loại ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin thể loại",
        error.message
      );
    }
  }

  /**
   * createCategory
   *
   * @desc    Tạo thể loại mới
   * @route   POST /api/admin/categories
   * @access  Admin
   */
  async createCategory(req, res) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return ApiResponse.badRequest(res, "Tên thể loại là bắt buộc");
      }

      const result = await CategoryService.createCategory(name, description);

      if (result.error) {
        return ApiResponse.conflict(res, result.error);
      }

      return ApiResponse.created(
        res,
        result.category,
        "Tạo thể loại mới thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi tạo thể loại mới:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạo thể loại mới",
        error.message
      );
    }
  }

  /**
   * updateCategory
   *
   * @desc    Cập nhật thông tin thể loại
   * @route   PUT /api/admin/categories/:id
   * @access  Admin
   */
  async updateCategory(req, res) {
    try {
      const { name, description } = req.body;
      const categoryId = req.params.id;

      const result = await CategoryService.updateCategory(
        categoryId,
        name,
        description
      );

      if (result.notFound) {
        return ApiResponse.notFound(res, "Không tìm thấy thể loại");
      }

      if (result.error) {
        return ApiResponse.conflict(res, result.error);
      }

      return ApiResponse.success(
        res,
        result.category,
        "Cập nhật thể loại thành công"
      );
    } catch (error) {
      logger.error(`Lỗi khi cập nhật thể loại ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật thể loại",
        error.message
      );
    }
  }

  /**
   * deleteCategory
   *
   * @desc    Xóa thể loại
   * @route   DELETE /api/admin/categories/:id
   * @access  Admin
   */
  async deleteCategory(req, res) {
    try {
      const result = await CategoryService.deleteCategory(req.params.id);

      if (result.notFound) {
        return ApiResponse.notFound(res, "Không tìm thấy thể loại");
      }

      if (result.inUse) {
        return ApiResponse.badRequest(
          res,
          `Không thể xóa thể loại này vì đang được sử dụng bởi ${result.inUse} truyện`
        );
      }

      return ApiResponse.success(res, null, "Xóa thể loại thành công");
    } catch (error) {
      logger.error(`Lỗi khi xóa thể loại ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa thể loại",
        error.message
      );
    }
  }

  /**
   * getCategoryStory
   *
   * @desc    Lấy danh sách truyện thuộc thể loại
   * @route   GET /api/admin/categories/:id/Story
   * @access  Admin, Moderator
   */
  async getCategoryStory(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const categoryId = req.params.id;

      const result = await CategoryService.getCategoryStory(
        categoryId,
        parseInt(page),
        parseInt(limit)
      );

      if (result.notFound) {
        return ApiResponse.notFound(res, "Không tìm thấy thể loại");
      }

      return ApiResponse.paginated(
        res,
        result.data,
        result.total,
        parseInt(page),
        parseInt(limit),
        "Lấy danh sách truyện thuộc thể loại thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách truyện thuộc thể loại ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện thuộc thể loại",
        error.message
      );
    }
  }
}

module.exports = new CategoryAdminController();
