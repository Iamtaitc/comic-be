/**
 * Router cho quản lý chapter truyện tranh
 * Kết nối các route với controller
 */

const express = require("express");
const router = express.Router();
const { checkAuth, requireRole } = require("../middlewares/authMiddleware");
const ChapterController = require("../controllers/ChapterController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer để upload ảnh chapter
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const StoryId = req.body.StoryId;
    const chapterName = req.body.chapter_name || "temp";
    const uploadDir = `./uploads/chapters/${StoryId}/${chapterName}`;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Đặt tên file theo số thứ tự để dễ sắp xếp
    // Giả sử file.originalname có định dạng như "001.jpg", "002.png", ...
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // giới hạn 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Chỉ chấp nhận file ảnh định dạng: jpeg, jpg, png, webp"));
  },
});

/**
 * @route   GET /api/admin/chapters
 * @desc    Lấy danh sách chapter có phân trang và tìm kiếm
 * @access  Admin, Moderator
 */
router.get(
  "/",
  checkAuth,
  requireRole(["admin", "moderator"]),
  ChapterController.getChapters
);

/**
 * @route   GET /api/admin/chapters/:id
 * @desc    Lấy thông tin chi tiết của một chapter
 * @access  Admin, Moderator
 */
router.get(
  "/:id",
  checkAuth,
  requireRole(["admin", "moderator"]),
  ChapterController.getChapterById
);

/**
 * @route   POST /api/admin/chapters
 * @desc    Tạo chapter mới
 * @access  Admin, Editor
 */
router.post(
  "/",
  checkAuth,
  requireRole(["admin", "editor"]),
  ChapterController.createChapter
);

/**
 * @route   POST /api/admin/chapters/:id/images
 * @desc    Upload hình ảnh cho chapter
 * @access  Admin, Editor
 */
router.post(
  "/:id/images",
  checkAuth,
  requireRole(["admin", "editor"]),
  upload.array("images", 100),
  ChapterController.uploadChapterImages
);

/**
 * @route   PUT /api/admin/chapters/:id
 * @desc    Cập nhật thông tin chapter
 * @access  Admin, Editor
 */
router.put(
  "/:id",
  checkAuth,
  requireRole(["admin", "editor"]),
  ChapterController.updateChapter
);

/**
 * @route   DELETE /api/admin/chapters/:id
 * @desc    Xóa chapter
 * @access  Admin
 */
router.delete(
  "/:id",
  checkAuth,
  requireRole(["admin"]),
  ChapterController.deleteChapter
);

/**
 * @route   POST /api/admin/chapters/crawl
 * @desc    Cào dữ liệu chapter từ API
 * @access  Admin
 */
router.post(
  "/crawl",
  checkAuth,
  requireRole(["admin"]),
  ChapterController.crawlChapter
);

/**
 * @route   POST /api/admin/chapters/batch-update
 * @desc    Cập nhật hàng loạt chapter
 * @access  Admin
 */
router.post(
  "/batch-update",
  checkAuth,
  requireRole(["admin"]),
  ChapterController.batchUpdateChapters
);

/**
 * @route   POST /api/admin/chapters/reorder
 * @desc    Sắp xếp lại thứ tự chapter
 * @access  Admin, Editor
 */
router.post(
  "/reorder",
  checkAuth,
  requireRole(["admin", "editor"]),
  ChapterController.reorderChapters
);

module.exports = router;
