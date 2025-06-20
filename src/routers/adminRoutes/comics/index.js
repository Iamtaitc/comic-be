/**
 * Router cho quản lý truyện tranh
 * Định nghĩa các routes và middleware liên quan
 */

const express = require("express");
const router = express.Router();
const { checkAuth, requireRole } = require("../../middlewares/authMiddleware");
const { StoryUpload } = require("../../middlewares/upload.middleware");
const StorysController = require("../../controllers/admin/StorysController");

/**
 * @route   GET /api/admin/Storys
 * @desc    Lấy danh sách truyện tranh có phân trang và tìm kiếm
 * @access  Admin, Moderator
 */
router.get(
  "/",
  checkAuth,
  requireRole(["admin", "moderator"]),
  StorysController.getStorys
);

/**
 * @route   GET /api/admin/Storys/:id
 * @desc    Lấy thông tin chi tiết của một truyện
 * @access  Admin, Moderator
 */
router.get(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator"]),
  StorysController.getStoryById
);

/**
 * @route   POST /api/admin/Storys
 * @desc    Tạo truyện mới
 * @access  Admin, Editor
 */
router.post(
  "/",
  checkAuth,
  requireRole(["admin", "editor"]),
  StoryUpload.single("thumb"),
  StorysController.createStory
);

/**
 * @route   PUT /api/admin/Storys/:id
 * @desc    Cập nhật thông tin truyện
 * @access  Admin, Editor
 */
router.put(
  "/:id",
  checkAuth,
  requireRole(["admin", "editor"]),
  StoryUpload.single("thumb"),
  StorysController.updateStory
);

/**
 * @route   DELETE /api/admin/Storys/:id
 * @desc    Xóa truyện và các chapter liên quan
 * @access  Admin
 */
router.delete(
  "/:id",
  checkAuth,
  requireRole(["admin"]),
  StorysController.deleteStory
);

/**
 * @route   GET /api/admin/Storys/:id/chapters
 * @desc    Lấy danh sách chapter của một truyện
 * @access  Admin, Moderator
 */
router.get(
  "/:id/chapters",
  checkAuth,
  requireRole(["admin", "moderator"]),
  StorysController.getStoryChapters
);

/**
 * @route   POST /api/admin/Storys/batch-update
 * @desc    Cập nhật hàng loạt trạng thái truyện
 * @access  Admin
 */
router.post(
  "/batch-update",
  checkAuth,
  requireRole(["admin"]),
  StorysController.batchUpdateStorys
);

module.exports = router;
