/**
 * Router tương tác người dùng
 * Định nghĩa các routes liên quan đến bookmark, lịch sử đọc truyện, đánh giá truyện
 */
const express = require('express');
const router = express.Router();
const userController = require('../../../controllers/user/users.controller');

/**
 * Bookmark truyện
 */
router.post('/comic/:cid/bookmark', userController.bookmarkCStory);
router.delete('/comic/:cid/bookmark', userController.removeBookmark);

/**
 * Lịch sử đọc truyện
 */
router.get('/user/history', userController.getUserHistory);
// router.push('/user/history/', userController.updateHistory);
router.delete('/user/history', userController.clearAllHistory);
router.delete('/user/history/:historyId', userController.clearHistoryById);

/**
 * Danh sách truyện yêu thích
 */
router.get('/user/bookmarks', userController.getUserBookmarks);

/**
 * Đánh giá truyện
 */
router.post('/comic/:cid/rate', userController.rateCStory);

module.exports = router;
