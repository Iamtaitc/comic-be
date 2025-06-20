const Queue = require("bull");
const StoryCrawlerService = require("../services/crawler/StoryCrawlerService");
const ApiResponse = require("../utils/ApiResponse.utils");
const logger = require("../utils/logger");

const crawlQueue = new Queue(
  "story-crawling",
  process.env.REDIS_URL || "redis://comic_redis:6379"
);

class StoryCrawlerController {
  async runCrawler(req, res) {
    try {
      const { listType, maxPages } = req.body;
      const LIST_TYPES = [
        "truyen-moi",
        "dang-phat-hanh",
        "hoan-thanh",
        "sap-ra-mat",
      ];
      if (listType && !LIST_TYPES.includes(listType)) {
        return ApiResponse.badRequest(res, "Loại danh sách không hợp lệ");
      }

      const job = await crawlQueue.add({
        listType,
        maxPages: parseInt(maxPages) || undefined,
        isManual: true,
      });
      logger.info(`Đã thêm job cào dữ liệu: ${job.id}`);
      return ApiResponse.success(
        res,
        { jobId: job.id },
        "Đã thêm job cào dữ liệu vào hàng đợi"
      );
    } catch (error) {
      logger.error("Lỗi khi chạy crawler tùy chỉnh:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi chạy crawler tùy chỉnh",
        error.message
      );
    }
  }

  async getStats(req, res) {
    try {
      const stats = await StoryCrawlerService.getStats();
      return ApiResponse.success(res, stats, "Lấy thống kê crawler thành công");
    } catch (error) {
      logger.error("Lỗi khi lấy thống kê crawler:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thống kê crawler",
        error.message
      );
    }
  }

  async getCrawlerLogs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const logs = await StoryCrawlerService.getCrawlerLogs({
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return ApiResponse.paginated(
        res,
        logs.logs,
        logs.pagination.total,
        logs.pagination.page,
        logs.pagination.limit,
        "Lấy lịch sử crawler thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy lịch sử crawler:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy lịch sử crawler",
        error.message
      );
    }
  }

  async getCrawlerStatus(req, res) {
    try {
      const status = await StoryCrawlerService.getCrawlerStatus();
      return ApiResponse.success(
        res,
        status,
        "Lấy trạng thái crawler thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy trạng thái crawler:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy trạng thái crawler",
        error.message
      );
    }
  }

  async pauseCrawler(req, res) {
    try {
      const result = await StoryCrawlerService.pauseCrawling();
      if (result.status === "not_running") {
        return ApiResponse.badRequest(res, "Không có crawler nào đang chạy");
      }
      return ApiResponse.success(res, result, "Tạm dừng crawler thành công");
    } catch (error) {
      logger.error("Lỗi khi tạm dừng crawler:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạm dừng crawler",
        error.message
      );
    }
  }

  async crawlSingleStory(req, res) {
    try {
      const { slug } = req.params;
      const result = await StoryCrawlerService.crawlSingleStory(slug);
      if (result.status === "error") {
        return ApiResponse.serverError(res, result.message, result.stats);
      }
      return ApiResponse.success(
        res,
        result,
        `Cào dữ liệu truyện ${slug} thành công`
      );
    } catch (error) {
      logger.error(`Lỗi khi cào truyện ${req.params.slug}:`, error);
      return ApiResponse.serverError(res, "Lỗi khi cào truyện", error.message);
    }
  }

  async reprocessChapters(req, res) {
    try {
      const { storyId } = req.params;
      const result = await StoryCrawlerService.reprocessChapters(storyId);
      if (result.status === "error") {
        return ApiResponse.serverError(res, result.message, result.stats);
      }
      return ApiResponse.success(
        res,
        result,
        `Xử lý lại chapter cho truyện ${storyId} thành công`
      );
    } catch (error) {
      logger.error(
        `Lỗi khi xử lý lại chapter cho truyện ${req.params.storyId}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi xử lý lại chapter",
        error.message
      );
    }
  }
}

// Xử lý job trong hàng đợi
crawlQueue.process(async (job) => {
  const { listType, maxPages, isManual } = job.data;
  await StoryCrawlerService.startCrawling({ listType, maxPages, isManual });
});

module.exports = StoryCrawlerController;
