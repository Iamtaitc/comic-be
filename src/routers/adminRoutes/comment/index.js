/**
 * Router cho quản lý bình luận
 * Kết nối các route với controller
 */

const express = require("express");
const router = express.Router();
const { checkAuth, requireRole } = require("../middlewares/authMiddleware");
const CommentController = require("../controllers/CommentController");

/**
 * @route   GET /api/admin/comments
 * @desc    Lấy danh sách bình luận có phân trang và tìm kiếm
 * @access  Admin, Moderator
 */
router.get(
  "/",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.getComments
);

/**
 * @route   GET /api/admin/comments/pending
 * @desc    Lấy danh sách bình luận đang chờ duyệt
 * @access  Admin, Moderator
 */
router.get(
  "/pending",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.getPendingComments
);

/**
 * @route   GET /api/admin/comments/stats/overview
 * @desc    Lấy thống kê về bình luận
 * @access  Admin, Moderator
 */
router.get(
  "/stats/overview",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.getCommentsStats
);

/**
 * @route   GET /api/admin/comments/stats/top-users
 * @desc    Lấy danh sách người dùng có nhiều bình luận nhất
 * @access  Admin, Moderator
 */
router.get(
  "/stats/top-users",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.getTopCommentUsers
);

/**
 * @route   GET /api/admin/comments/:id
 * @desc    Lấy thông tin chi tiết của một bình luận
 * @access  Admin, Moderator
 */
router.get(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.getCommentById
);

/**
 * @route   PUT /api/admin/comments/:id
 * @desc    Cập nhật trạng thái bình luận
 * @access  Admin, Moderator
 */
router.put(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.updateComment
);

/**
 * @route   DELETE /api/admin/comments/:id
 * @desc    Xóa bình luận
 * @access  Admin, Moderator
 */
router.delete(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.deleteComment
);

/**
 * @route   POST /api/admin/comments/batch-update
 * @desc    Cập nhật hàng loạt bình luận
 * @access  Admin, Moderator
 */
router.post(
  "/batch-update",
  checkAuth,
  requireRole(["admin", "moderator"]),
  CommentController.batchUpdateComments
);

module.exports = router;
