// be/src/services/crawler/ChapterProcessor.js
const logger = require("../../utils/logger");
const { Chapter, Story } = require("../../models/index");
const CrawlerUtils = require("./CrawlerUtils");
const { API_BASE_URL, API_ENDPOINTS } = require("./CrawlerConfig");

class ChapterProcessor {
  constructor(crawlerService) {
    this.crawlerService = crawlerService;
  }

  async processChapters(storyId, chaptersData, storyViews = null) {
    try {
      if (!storyViews) {
        const story = await Story.findById(storyId);
        storyViews = story ? story.views : 10000;
      }

      let flatChapters = [];
      for (const item of chaptersData) {
        if (item.server_data) {
          flatChapters = flatChapters.concat(
            item.server_data.map((chapter) => ({ ...chapter, server_name: item.server_name }))
          );
        } else {
          flatChapters.push(item);
        }
      }

      for (const chapterData of flatChapters) {
        const chapterNumber =
          chapterData.chapter_number || parseFloat(chapterData.chapter_name) || 0;

        if (isNaN(chapterNumber)) {
          logger.warn(`Bỏ qua chương với số không hợp lệ: ${chapterData.chapter_name}`);
          continue;
        }

        const chapterStats = CrawlerUtils.generateRandomChapterStats(storyViews);
        const chapterDoc = await Chapter.findOneAndUpdate(
          { storyId, chapterNumber },
          {
            $set: {
              storyId,
              chapterNumber,
              chapter_name: chapterData.chapter_name || `Chapter ${chapterNumber}`,
              chapter_title: chapterData.chapter_title || "",
              filename: chapterData.filename || "",
              server_name: chapterData.server_name || "Server #1",
              views: chapterStats.views,
              likeCount: chapterStats.likeCount,
              isPublished: true,
              deletedAt: null,
              chapter_api_data: chapterData.chapter_api_data || null,
            },
          },
          { upsert: true, new: true }
        );

        if (chapterData.chapter_api_data) {
          await this.updateChapterContent(chapterDoc._id, chapterData.chapter_api_data);
        }

        this.crawlerService.stats.newChapters++;
      }

      logger.info(`Đã xử lý ${flatChapters.length} chương cho truyện ID: ${storyId}`);
    } catch (error) {
      this.crawlerService.stats.errors++;
      logger.error(`Lỗi khi xử lý chương cho truyện ID: ${storyId}`, { error: error.message });
    }
  }

  async updateChapterContent(chapterId, apiUrl) {
    // Logic tương tự code gốc
  }

  async reprocessChapters(storyId) {
    // Logic tương tự code gốc
  }
}

module.exports = ChapterProcessor;