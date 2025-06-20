/**
 * Controller xử lý các chức năng liên quan đến thể loại
 */

const Category = require("../../models/Category.mongoose");
const logger = require("../../utils/logger");

class CategoryController {
  /**
   * Lấy danh sách tất cả thể loại
   * @route   GET /api/categories
   * @access  Public
   */
  async getAllCategories(req, res) {
    try {
      const categories = await Category.find().sort({ name: 1 });

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách thể loại:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách thể loại",
        error: error.message,
      });
    }
  }
}

module.exports = new CategoryController();
