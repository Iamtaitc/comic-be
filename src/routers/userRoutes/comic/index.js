/**
 * Router cho các chức năng liên quan đến truyện tranh
 */

const express = require('express');
const router = express.Router();
const StoryController = require('../../../controllers/comic/story.controller');

// Lấy dữ liệu trang chủ
router.get('/home', StoryController.getHomeData);

// Routes cho truyện
router.get('/comics/latest', StoryController.getLatestStories);
router.get('/comics/popular', StoryController.getPopularStories);
router.get('/comics/category/:slug', StoryController.getStoriesByCategory);
router.get('/comics/categorise', StoryController.getCategory);
router.get('/comics/search', StoryController.searchStories);
router.get('/comics/top-weekly', StoryController.getTopWeeklyStories);
// Chi tiết truyện
router.get('/comics/:slug', StoryController.getStoryDetail);

// Chi tiết chapter - sử dụng optionalAuth để đánh dấu đã đọc nếu user đã đăng nhập
router.get('/comics/:slug/chapter/:chapterName', StoryController.getChapterDetail);

router.get('/comics/danh-sach/dang-phat-hanh', StoryController.getOngoing);
router.get('/comics/danh-sach/da-hoan-thanh', StoryController.getCompleted);
router.get('/comics/danh-sach/sap-ra-mat', StoryController.getUpcoming);

module.exports = router;