// be/src/services/crawler/StoryCrawlerService.js
const cron = require("node-cron");
const logger = require("../../utils/logger");
const { CrawlerLog } = require("../../models/index");
const CategoryProcessor = require("./CategoryProcessor");
const StoryProcessor = require("./StoryProcessor");
const { LIST_TYPES } = require("./CrawlerConfig");

class StoryCrawlerService {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
    };
    this.categoryProcessor = new CategoryProcessor(this);
    this.storyProcessor = new StoryProcessor(this);
  }

  async initialize(runImmediately = true) {
    logger.info("Khởi tạo dịch vụ crawler truyện");

    cron.schedule("0 0 * * *", async () => {
      const now = new Date();
      const day = now.getDate();

      if ((day - 1) % 3 === 0) {
        logger.info("Bắt đầu cào dữ liệu định kỳ (mỗi 3 ngày)");
        await this.startCrawling();
      } else {
        logger.info(
          `Hôm nay (${day}) không phải ngày chạy crawler theo lịch 3 ngày.`
        );
      }
    });

    if (runImmediately) {
      await this.startCrawling();
      logger.info("Hoàn thành cào dữ liệu ban đầu", { stats: this.stats });
    }

    return this;
  }

  async startCrawling({ isManual = false, listType = null } = {}) {
    if (this.isRunning) {
      return { status: "running", message: "Crawler đang chạy" };
    }

    this.isRunning = true;
    this.resetStats();
    const crawlerLog = await CrawlerLog.create({
      status: "running",
      startedAt: new Date(),
      isManual,
    });

    try {
      await this.categoryProcessor.crawlCategories();
      logger.info("Đã cào dữ liệu thể loại");

      const types = listType ? [listType] : LIST_TYPES;
      for (const type of types) {
        await this.storyProcessor.crawlListData(type);
      }

      this.lastRunTime = new Date();
      await CrawlerLog.findByIdAndUpdate(crawlerLog._id, {
        status: "completed",
        finishedAt: this.lastRunTime,
        stats: this.stats,
      });

      return {
        status: "completed",
        stats: this.stats,
        finishedAt: this.lastRunTime,
      };
    } catch (error) {
      this.stats.errors++;
      await CrawlerLog.findByIdAndUpdate(crawlerLog._id, {
        status: "error",
        finishedAt: new Date(),
        error: error.message,
        stats: this.stats,
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  resetStats() {
    this.stats = {
      newStories: 0,
      updatedStories: 0,
      newChapters: 0,
      errors: 0,
    };
  }

  async pauseCrawling() {
    if (!this.isRunning) {
      return { status: "not_running", message: "Không có crawler đang chạy" };
    }
    this.isRunning = false;
    return { status: "paused", message: "Crawler đã tạm dừng" };
  }

  async getCrawlerStatus() {
    const latestLog = await CrawlerLog.findOne().sort({ startedAt: -1 });
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRunTime,
      currentProgress: this.isRunning ? "Đang cào dữ liệu" : "Không hoạt động",
      latestLog: latestLog
        ? {
            status: latestLog.status,
            startedAt: latestLog.startedAt,
            finishedAt: latestLog.finishedAt,
            stats: latestLog.stats,
          }
        : null,
    };
  }
}

module.exports = StoryCrawlerService;
