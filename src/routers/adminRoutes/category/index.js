/**
 * Router cho quản lý thể loại (category)
 * Kết nối các route với controller
 */

const express = require("express");
const router = express.Router();
const { checkAuth, requireRole } = require("../middlewares/authMiddleware");
const CategoryController = require("../controllers/CategoryController");

/**
 * @route   GET /api/admin/categories
 * @desc    Lấy danh sách thể loại
 * @access  Admin, Moderator, Editor
 */
router.get(
  "/",
  checkAuth,
  requireRole(["admin", "moderator", "editor"]),
  CategoryController.getCategories
);

/**
 * @route   GET /api/admin/categories/:id
 * @desc    Lấy thông tin chi tiết của một thể loại
 * @access  Admin, Moderator, Editor
 */
router.get(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator", "editor"]),
  CategoryController.getCategoryById
);

/**
 * @route   POST /api/admin/categories
 * @desc    Tạo thể loại mới
 * @access  Admin
 */
router.post(
  "/",
  checkAuth,
  requireRole(["admin"]),
  CategoryController.createCategory
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Cập nhật thông tin thể loại
 * @access  Admin
 */
router.put(
  "/:id",
  checkAuth,
  requireRole(["admin"]),
  CategoryController.updateCategory
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Xóa thể loại
 * @access  Admin
 */
router.delete(
  "/:id",
  checkAuth,
  requireRole(["admin"]),
  CategoryController.deleteCategory
);

/**
 * @route   GET /api/admin/categories/:id/Storys
 * @desc    Lấy danh sách truyện thuộc thể loại
 * @access  Admin, Moderator
 */
router.get(
  "/:id/Storys",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CategoryController.getCategoryStorys
);

module.exports = router;
