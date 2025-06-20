/**
 * Router cho các chức năng liên quan đến truyện tranh
 */

const express = require("express");
const router = express.Router();
const CommentController = require("../../../controllers/comment/comment.controller");

// Lấy bình luận của truyện
router.get("/comic/:comicId/comments", CommentController.getStoryComments);

// Lấy bình luận của chapter
router.get(
  "/comic/:comicId/chapters/:chapterId/comments",
  CommentController.getChapterComments
);

// Thêm bình luận cho truyện - yêu cầu đăng nhập
router.post(
  "/comic/:comicId/comments",
  CommentController.addStoryComment
);

// Thêm bình luận cho chapter - yêu cầu đăng nhập
router.post(
  "/comic/:comicId/chapters/:chapterId/comments",
  CommentController.addChapterComment
);

module.exports = router;
