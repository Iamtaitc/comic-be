// be/src/services/crawler/CategoryProcessor.js
const logger = require("../../utils/logger");
const { Category } = require("../../models/index");
const CrawlerUtils = require("./CrawlerUtils");
const { API_BASE_URL } = require("./CrawlerConfig");

class CategoryProcessor {
  constructor(crawlerService) {
    this.crawlerService = crawlerService;
  }

  async crawlCategories() {
    try {
      logger.info("Cào dữ liệu thể loại");
      const response = await CrawlerUtils.fetchWithRetry(`${API_BASE_URL}/the-loai`);

      if (response.status === "success" && response.data?.items) {
        const categories = response.data.items;
        const bulkOps = categories.map((category) => ({
          updateOne: {
            filter: { _id: category._id },
            update: {
              $set: {
                name: category.name,
                slug: category.slug,
                isActive: true,
                deletedAt: null,
              },
            },
            upsert: true,
          },
        }));

        await Category.bulkWrite(bulkOps);
        logger.info(`Đã cập nhật ${categories.length} thể loại`);
      }
    } catch (error) {
      this.crawlerService.stats.errors++;
      logger.error("Lỗi khi cào dữ liệu thể loại", { error: error.message });
    }
  }
}

module.exports = CategoryProcessor;