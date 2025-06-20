// be/src/services/crawler/StoryProcessor.js
const Redis = require("ioredis");
const pLimit = require("p-limit");
const logger = require("../../utils/logger");
const { Story } = require("../../models/index");
const CrawlerUtils = require("./CrawlerUtils");
const ChapterProcessor = require("./ChapterProcessor");
const updateStoryCountJob = require("../../utils/updateStoryCount");
const {
  API_BASE_URL,
  API_ENDPOINTS,
  MAX_CONCURRENT_REQUESTS,
  REQUEST_DELAY,
  REDIS_KEY_PREFIX,
  REDIS_TTL,
} = require("./CrawlerConfig");

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

class StoryProcessor {
  constructor(crawlerService) {
    this.crawlerService = crawlerService;
    this.limit = pLimit(MAX_CONCURRENT_REQUESTS);
    this.chapterProcessor = new ChapterProcessor(crawlerService);
  }

  async crawlListData(listType) {
    let currentPage = 1;
    let hasMoreData = true;

    while (hasMoreData && this.crawlerService.isRunning) {
      logger.info(`Đang cào trang ${currentPage} của danh sách ${listType}`);
      try {
        const pageResponse = await CrawlerUtils.fetchWithRetry(
          `${API_BASE_URL}${API_ENDPOINTS.LIST}/${listType}?page=${currentPage}`
        );

        if (
          pageResponse.status === "success" &&
          Array.isArray(pageResponse.data?.items)
        ) {
          const items = pageResponse.data.items;
          if (items.length === 0) {
            hasMoreData = false;
            logger.info(
              `Không còn dữ liệu tại trang ${currentPage} của danh sách ${listType}`
            );
          } else {
            await Promise.all(
              items.map((storyData) =>
                this.limit(async () => {
                  if (!storyData._id || !storyData.slug) {
                    logger.warn("Bỏ qua truyện do thiếu _id hoặc slug", {
                      storyData,
                    });
                    return;
                  }

                  const cacheKey = `${REDIS_KEY_PREFIX}${storyData._id}`;
                  const cachedStory = await redis.get(cacheKey);
                  if (cachedStory) {
                    const cachedData = JSON.parse(cachedStory);
                    if (
                      new Date(cachedData.updatedAt).getTime() >=
                      new Date(storyData.updatedAt || new Date()).getTime()
                    ) {
                      logger.debug(
                        `Bỏ qua truyện ${storyData._id} do không có cập nhật`
                      );
                      return;
                    }
                  }

                  const existingStory = await Story.findOne({
                    _id: storyData._id,
                    deletedAt: null,
                  });
                  if (!existingStory) {
                    const newStoryData = await this.prepareNewStory(storyData);
                    await Story.create(newStoryData);
                    this.crawlerService.stats.newStories++;
                    logger.info(
                      `Đã tạo truyện mới: ${storyData.name} (${storyData._id})`
                    );
                  } else {
                    const updatedStory = await this.prepareUpdatedStory(
                      existingStory,
                      storyData
                    );
                    if (updatedStory) {
                      await Story.findByIdAndUpdate(storyData._id, {
                        $set: updatedStory,
                      });
                      this.crawlerService.stats.updatedStories++;
                      logger.info(
                        `Đã cập nhật truyện: ${storyData.name} (${storyData._id})`
                      );
                    }
                  }

                  await redis.setex(
                    cacheKey,
                    REDIS_TTL,
                    JSON.stringify({
                      _id: storyData._id,
                      updatedAt: storyData.updatedAt || new Date(),
                    })
                  );
                  updateStoryCountJob();
                  await CrawlerUtils.delay(REQUEST_DELAY / 2);
                })
              )
            );
            currentPage++;
            await CrawlerUtils.delay(REQUEST_DELAY);
          }
        } else {
          hasMoreData = false;
          logger.warn(
            `Phản hồi không hợp lệ tại trang ${currentPage} của danh sách ${listType}`
          );
        }
      } catch (error) {
        this.crawlerService.stats.errors++;
        hasMoreData = false;
        logger.error(
          `Lỗi khi cào trang ${currentPage} của danh sách ${listType}`,
          {
            error: error.message,
          }
        );
      }
    }
  }

  async prepareNewStory(storyData) {
    // Logic tương tự code gốc, nhưng sử dụng CrawlerUtils và ChapterProcessor
    // (Đã được tối ưu trong code gốc, không cần thay đổi nhiều)
  }

  async prepareUpdatedStory(existingStory, storyData) {
    // Logic tương tự code gốc
  }

  async crawlSingleStory(slug) {
    // Logic tương tự code gốc
  }
}

module.exports = StoryProcessor;
