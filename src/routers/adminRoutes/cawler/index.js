const express = require("express");
const router = express.Router();
const StoryCrawlerController = require("../controllers/story.crawler.controller");
// const authMiddleware = require("../middleware/auth");

// Khởi tạo controller
const storyCrawlerController = new StoryCrawlerController();

// Chạy crawler thủ công với cấu hình tùy chỉnh
router.post(
  "/run",
  // authMiddleware,
  storyCrawlerController.runCrawler.bind(storyCrawlerController)
);

// Tạm dừng crawler
router.post(
  "/pause",
  // authMiddleware,
  storyCrawlerController.pauseCrawler.bind(storyCrawlerController)
);

// Cào lại dữ liệu cho một truyện cụ thể
router.post(
  "/story/:slug",
  // authMiddleware,
  storyCrawlerController.crawlSingleStory.bind(storyCrawlerController)
);

// Lấy thống kê crawler
router.get(
  "/stats",
  // authMiddleware,
  storyCrawlerController.getStats.bind(storyCrawlerController)
);

// Lấy trạng thái chi tiết của crawler
router.get(
  "/status",
  // authMiddleware,
  storyCrawlerController.getCrawlerStatus.bind(storyCrawlerController)
);

// Lấy lịch sử chạy crawler
router.get(
  "/logs",
  // authMiddleware,
  storyCrawlerController.getCrawlerLogs.bind(storyCrawlerController)
);

// Xử lý lại chapter cho một truyện
router.post(
  "/reprocess-chapters/:storyId",
  // authMiddleware,
  storyCrawlerController.reprocessChapters.bind(storyCrawlerController)
);

module.exports = router;
