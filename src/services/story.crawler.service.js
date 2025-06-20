const axios = require("axios");
const cron = require("node-cron");
const pLimit = require("p-limit");
const Redis = require("ioredis");
const sanitizeHtml = require("sanitize-html");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const updateStoryCountJob = require("../utils/updateStoryCount");

// Import các model cần thiết
const { Story, CrawlerLog, Chapter, Category } = require("../models/index");

// Cấu hình API
const API_BASE_URL = "https://otruyenapi.com/v1/api";
const API_ENDPOINTS = {
  LIST: "/danh-sach",
  CATEGORY: "/the-loai",
  STORY_DETAIL: "/truyen-tranh",
};

const LIST_TYPES = ["truyen-moi", "dang-phat-hanh", "hoan-thanh", "sap-ra-mat"];

// Cấu hình crawler
const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_DELAY = 1000;
const MAX_RETRY = 3;
const REDIS_TTL = 24 * 60 * 60;
const REDIS_KEY_PREFIX = "crawler:stories:";
const ITEMS_PER_PAGE = 20;

// Redis client
const redis = new Redis(process.env.REDIS_URL || "redis://comic_redis:6379");

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
    this.limit = pLimit(MAX_CONCURRENT_REQUESTS);
  }

  async initialize(runImmediately = true) {
    logger.info("Khởi tạo dịch vụ crawler truyện");

    cron.schedule("0 0 * * *", async () => {
      logger.info("Bắt đầu quá trình cào dữ liệu định kỳ");
      await this.startCrawling();
    });

    if (runImmediately) {
      logger.info("Bắt đầu quá trình cào dữ liệu ban đầu");
      try {
        await this.startCrawling();
        logger.info("Hoàn thành quá trình cào dữ liệu ban đầu", {
          stats: this.stats,
        });
      } catch (error) {
        logger.error("Lỗi trong quá trình cào dữ liệu ban đầu", {
          error: error.message,
        });
      }
    }

    return this;
  }

  async startCrawling({ isManual = false, listType = null } = {}) {
    if (this.isRunning) {
      return {
        status: "running",
        message: "Đang có quá trình cào dữ liệu khác đang chạy",
      };
    }

    try {
      this.isRunning = true;
      this.resetStats();

      const crawlerLog = await CrawlerLog.create({
        status: "running",
        startedAt: new Date(),
        isManual,
      });

      await this.crawlCategories();
      logger.info("Đã cào dữ liệu thể loại");

      if (listType) {
        await this.crawlListData(listType);
      } else {
        for (const type of LIST_TYPES) {
          await this.crawlListData(type);
        }
      }

      this.lastRunTime = new Date();
      this.isRunning = false;

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
      this.isRunning = false;
      this.stats.errors++;
      await CrawlerLog.findByIdAndUpdate(crawlerLog._id, {
        status: "error",
        finishedAt: new Date(),
        error: error.message,
        stats: this.stats,
      });
      throw error;
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

  async crawlCategories() {
    try {
      logger.info("Cào dữ liệu thể loại");
      const response = await this.fetchWithRetry(`${API_BASE_URL}/the-loai`);

      if (
        response.status === "success" &&
        response.data &&
        response.data.items
      ) {
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
      logger.error("Lỗi khi cào dữ liệu thể loại", { error: error.message });
      this.stats.errors++;
    }
  }

  async crawlListData(listType) {
    try {
      logger.info(`Cào dữ liệu danh sách: ${listType}`);
      let currentPage = 1;
      let hasMoreData = true;

      while (hasMoreData && this.isRunning) {
        logger.info(`Đang cào trang ${currentPage} của danh sách ${listType}`);
        try {
          const pageResponse = await this.fetchWithRetry(
            `${API_BASE_URL}${API_ENDPOINTS.LIST}/${listType}?page=${currentPage}`
          );

          // Kiểm tra phản hồi API có hợp lệ và chứa items không
          if (
            pageResponse.status === "success" &&
            pageResponse.data &&
            Array.isArray(pageResponse.data.items)
          ) {
            const items = pageResponse.data.items;
            logger.debug(
              `Số lượng truyện tại trang ${currentPage}: ${items.length}`
            );

            // Nếu không có item hoặc items rỗng, dừng cào
            if (items.length === 0) {
              logger.info(
                `Không còn dữ liệu tại trang ${currentPage} của danh sách ${listType}`
              );
              hasMoreData = false;
              break;
            }

            for (const storyData of items) {
              try {
                if (!storyData._id || !storyData.slug) {
                  logger.warn("Bỏ qua truyện do thiếu _id hoặc slug", {
                    storyData,
                  });
                  continue;
                }

                logger.debug(`Xử lý truyện: ${storyData._id}`);
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
                    continue;
                  }
                }

                const existingStory = await Story.findOne({
                  _id: storyData._id,
                  deletedAt: null,
                });

                if (!existingStory) {
                  const newStoryData = await this.prepareNewStory(storyData);
                  await Story.create(newStoryData);
                  this.stats.newStories++;
                  logger.info(
                    `Đã tạo truyện mới: ${storyData.name} (${storyData._id})`
                  );
                } else {
                  const detailResponse = await this.fetchWithRetry(
                    `${API_BASE_URL}${API_ENDPOINTS.STORY_DETAIL}/${storyData.slug}`
                  );
                  if (
                    detailResponse.status === "success" &&
                    detailResponse.data &&
                    detailResponse.data.item &&
                    detailResponse.data.item.chapters
                  ) {
                    await this.processChapters(
                      existingStory._id,
                      detailResponse.data.item.chapters,
                      existingStory.views
                    );
                    this.stats.updatedStories++;
                    logger.info(
                      `Đã cập nhật chapters cho truyện: ${storyData.name} (${storyData._id})`
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
                await this.delay(REQUEST_DELAY / 2);
              } catch (error) {
                logger.error(
                  `Lỗi khi xử lý truyện: ${
                    storyData?.name || storyData?._id || "unknown"
                  }`,
                  {
                    error: error.message,
                    stack: error.stack,
                  }
                );
                this.stats.errors++;
              }
            }
            currentPage++;
            await this.delay(REQUEST_DELAY);
          } else {
            logger.warn(
              `Phản hồi API không hợp lệ tại trang ${currentPage} của danh sách ${listType}`,
              {
                response: pageResponse,
              }
            );
            hasMoreData = false;
            break;
          }
        } catch (error) {
          logger.error(
            `Lỗi khi cào trang ${currentPage} của danh sách ${listType}`,
            {
              error: error.message,
              stack: error.stack,
            }
          );
          this.stats.errors++;
          hasMoreData = false;
          break;
        }
      }
      logger.info(
        `Hoàn thành cào danh sách ${listType} tại trang ${currentPage - 1}`
      );
    } catch (error) {
      logger.error(`Lỗi khi cào danh sách ${listType}`, {
        error: error.message,
        stack: error.stack,
      });
      this.stats.errors++;
    }
  }

  generateRandomStoryStats() {
    const views = this.getRandomViews();
    const stats = this.generateEngagementStats(views);

    return {
      views: views,
      ratingValue: stats.ratingValue,
      ratingCount: stats.ratingCount,
      likeCount: stats.likeCount,
    };
  }

  getRandomViews() {
    const random = Math.random();
    if (random < 0.4) {
      return Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
    } else if (random < 0.7) {
      return Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000;
    } else if (random < 0.9) {
      return Math.floor(Math.random() * (200000 - 50000 + 1)) + 50000;
    } else {
      return Math.floor(Math.random() * (1000000 - 200000 + 1)) + 200000;
    }
  }

  generateEngagementStats(views) {
    const ratingRate = 0.005 + Math.random() * 0.025;
    const ratingCount = Math.floor(views * ratingRate);
    const ratingValue = this.generateRealisticRating();
    const likeRate = 0.01 + Math.random() * 0.07;
    const likeCount = Math.floor(views * likeRate);

    return {
      ratingValue: ratingValue,
      ratingCount: Math.max(ratingCount, 0),
      likeCount: Math.max(likeCount, 0),
    };
  }

  generateRealisticRating() {
    const random = Math.random();
    if (random < 0.1) {
      return parseFloat((3.0 + Math.random() * 0.9).toFixed(1));
    } else if (random < 0.3) {
      return parseFloat((4.0 + Math.random() * 0.4).toFixed(1));
    } else {
      return parseFloat((4.5 + Math.random() * 0.5).toFixed(1));
    }
  }

  generateRandomChapterStats(storyViews) {
    const viewRate = 0.05 + Math.random() * 0.25;
    const chapterViews = Math.floor(storyViews * viewRate);

    return {
      views: Math.max(chapterViews, 10),
      likeCount: Math.floor(chapterViews * (0.005 + Math.random() * 0.02)),
    };
  }

  async prepareNewStory(storyData) {
    const detailResponse = await this.fetchWithRetry(
      `${API_BASE_URL}${API_ENDPOINTS.STORY_DETAIL}/${storyData.slug}`
    );

    if (
      detailResponse.status === "success" &&
      detailResponse.data &&
      detailResponse.data.item
    ) {
      const detailData = detailResponse.data.item;
      let thumb_url = storyData.thumb_url || "";

      if (thumb_url && !thumb_url.startsWith("http")) {
        thumb_url = `https://img.otruyenapi.com/uploads/comics/${thumb_url}`;
      }

      const categories = (storyData.category || detailData.category || [])
        .filter((cat) => cat && (cat.id || cat._id))
        .map((cat) => {
          try {
            return new mongoose.Types.ObjectId(cat.id || cat._id);
          } catch (error) {
            logger.warn(`ID thể loại không hợp lệ: ${cat.id || cat._id}`);
            return null;
          }
        })
        .filter((id) => id !== null);

      const randomStats = this.generateRandomStoryStats();

      const story = {
        _id: storyData._id,
        name: storyData.name || "Unknown",
        slug: storyData.slug || "",
        origin_name: storyData.origin_name || detailData.origin_name || [],
        content: sanitizeHtml(detailData.content || "", {
          allowedTags: ["p", "b", "i", "em", "strong"],
        }),
        status: storyData.status || detailData.status || "ongoing",
        thumb_url:
          detailResponse.data.seoOnPage?.seoSchema?.image || thumb_url || "",
        sub_docquyen: storyData.sub_docquyen || false,
        author: detailData.author || [],
        authorId: [],
        category: categories,
        views: randomStats.views,
        ratingValue: randomStats.ratingValue,
        ratingCount: randomStats.ratingCount,
        likeCount: randomStats.likeCount,
        createdAt: new Date(),
        updatedAt: storyData.updatedAt || new Date(),
      };

      const savedStory = await Story.create(story);
      logger.info(`Đã lưu truyện mới: ${story.name} (${story._id})`);

      if (detailData.chapters && detailData.chapters.length > 0) {
        await this.processChapters(
          savedStory._id,
          detailData.chapters,
          randomStats.views
        );
      }

      return story;
    }

    throw new Error(
      `Không thể lấy chi tiết truyện ${
        storyData.name || storyData.slug || "unknown"
      }`
    );
  }

  async processChapters(storyId, chaptersData, storyViews = null) {
    try {
      const story = await Story.findById(storyId);
      if (!story) {
        logger.error(`Truyện ID: ${storyId} không tồn tại`);
        throw new Error("Truyện không tồn tại");
      }

      let flatChapters = [];

      if (!storyViews) {
        storyViews = story.views || 10000;
      }

      for (const item of chaptersData) {
        if (item.server_data) {
          flatChapters = flatChapters.concat(
            item.server_data.map((chapter) => ({
              ...chapter,
              server_name: item.server_name,
            }))
          );
        } else {
          flatChapters.push(item);
        }
      }

      for (const chapterData of flatChapters) {
        const chapterNumber =
          chapterData.chapter_number ||
          parseFloat(chapterData.chapter_name) ||
          0;

        if (isNaN(chapterNumber)) {
          logger.warn(
            `Bỏ qua chương với số không hợp lệ: ${chapterData.chapter_name}`
          );
          continue;
        }

        try {
          const existingChapter = await Chapter.findOne({
            storyId,
            chapterNumber: chapterNumber,
          });

          if (existingChapter) {
            logger.debug(
              `Bỏ qua chương ${chapterNumber} của truyện ${storyId} vì đã tồn tại`
            );
            continue;
          }

          const chapterStats = this.generateRandomChapterStats(storyViews);

          const chapterDoc = await Chapter.create({
            storyId,
            chapterNumber: chapterNumber,
            chapter_name:
              chapterData.chapter_name || `Chapter ${chapterNumber}`,
            chapter_title: chapterData.chapter_title || "",
            filename: chapterData.filename || "",
            server_name: chapterData.server_name || "Server #1",
            views: chapterStats.views,
            likeCount: chapterStats.likeCount,
            isPublished: true,
            deletedAt: null,
            chapter_api_data: chapterData.chapter_api_data || null,
          });

          if (chapterData.chapter_api_data) {
            await this.updateChapterContent(
              chapterDoc._id,
              chapterData.chapter_api_data
            );
          }

          this.stats.newChapters++;
          logger.info(`Đã tạo chương ${chapterNumber} cho truyện ${storyId}`);
        } catch (chapterError) {
          logger.error(
            `Lỗi khi lưu chương ${chapterData.chapter_name} cho truyện ID: ${storyId}`,
            { error: chapterError.message }
          );
          this.stats.errors++;
        }
      }

      logger.info(
        `Đã xử lý ${flatChapters.length} chương cho truyện ID: ${storyId}`
      );
    } catch (error) {
      logger.error(`Lỗi khi xử lý chương cho truyện ID: ${storyId}`, {
        error: error.message,
      });
      this.stats.errors++;
    }
  }

  async updateChapterContent(chapterId, apiUrl) {
    try {
      logger.info(`Đang cập nhật nội dung chi tiết cho chương ${chapterId}`);
      const chapterDetailResponse = await this.fetchWithRetry(apiUrl);

      if (
        chapterDetailResponse.status === "success" &&
        chapterDetailResponse.data &&
        chapterDetailResponse.data.item
      ) {
        const chapterDetail = chapterDetailResponse.data.item;
        const domain_cdn = chapterDetailResponse.data.domain_cdn || "";

        if (
          chapterDetail.chapter_image &&
          Array.isArray(chapterDetail.chapter_image)
        ) {
          const imageUrls = chapterDetail.chapter_image.map((img) => {
            return `${domain_cdn}/${chapterDetail.chapter_path}/${img.image_file}`;
          });

          await Chapter.findByIdAndUpdate(chapterId, {
            $set: {
              content: imageUrls,
              chapter_path: chapterDetail.chapter_path || "",
              comic_name: chapterDetail.comic_name || "",
              chapter_image: chapterDetail.chapter_image || [],
              domain_cdn: domain_cdn,
            },
          });

          logger.info(
            `Đã cập nhật nội dung chi tiết cho chương ${chapterId} với ${imageUrls.length} hình ảnh`
          );
        } else {
          logger.warn(
            `Không tìm thấy dữ liệu hình ảnh cho chương ${chapterId}`
          );
        }
      } else {
        logger.warn(
          `Phản hồi API không hợp lệ khi lấy chi tiết chương ${chapterId}`
        );
      }
    } catch (error) {
      logger.error(
        `Lỗi khi cập nhật nội dung chi tiết cho chương ${chapterId}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );
      throw error;
    }
  }

  async fetchWithRetry(url, retryCount = 0) {
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "StoryCrawler/1.0" },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && retryCount < MAX_RETRY) {
        const delay = REQUEST_DELAY * Math.pow(2, retryCount) * 2;
        logger.warn(`Quá nhiều yêu cầu tại ${url}, thử lại sau ${delay}ms`);
        await this.delay(delay);
        return this.fetchWithRetry(url, retryCount + 1);
      }
      if (retryCount < MAX_RETRY) {
        logger.warn(`Lỗi khi fetch ${url}, thử lại lần ${retryCount + 1}`, {
          error: error.message,
        });
        await this.delay(REQUEST_DELAY * Math.pow(2, retryCount));
        return this.fetchWithRetry(url, retryCount + 1);
      }
      logger.error(`Không thể fetch ${url} sau ${MAX_RETRY} lần thử`, {
        error: error.message,
      });
      throw error;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      lastRun: this.lastRunTime,
      isRunning: this.isRunning,
      stats: this.stats,
    };
  }

  async pauseCrawling() {
    if (!this.isRunning) {
      return {
        status: "not_running",
        message: "Không có crawler nào đang chạy",
      };
    }

    this.isRunning = false;
    return {
      status: "paused",
      message: "Crawler đã được tạm dừng",
    };
  }

  async crawlSingleStory(slug) {
    try {
      this.resetStats();
      const response = await this.fetchWithRetry(
        `${API_BASE_URL}${API_ENDPOINTS.STORY_DETAIL}/${slug}`
      );

      if (
        response.status === "success" &&
        response.data &&
        response.data.item
      ) {
        const storyData = response.data.item;
        const existingStory = await Story.findOne({ slug, deletedAt: null });

        if (!existingStory) {
          const newStory = await this.prepareNewStory(storyData);
          await Story.create(newStory);
          this.stats.newStories++;
        } else {
          if (storyData.chapters && storyData.chapters.length > 0) {
            await this.processChapters(
              existingStory._id,
              storyData.chapters,
              existingStory.views
            );
            this.stats.updatedStories++;
          }
        }

        return {
          status: "completed",
          stats: this.stats,
          finishedAt: new Date(),
        };
      }

      throw new Error("Không thể lấy dữ liệu truyện");
    } catch (error) {
      this.stats.errors++;
      logger.error(`Lỗi khi cào truyện ${slug}:`, error);
      return {
        status: "error",
        message: error.message,
        stats: this.stats,
      };
    }
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

  async reprocessChapters(storyId) {
    try {
      logger.info(`Bắt đầu xử lý lại các chương của truyện ${storyId}`);
      const story = await Story.findById(storyId);
      if (!story) {
        throw new Error(`Không tìm thấy truyện với ID: ${storyId}`);
      }

      const detailResponse = await this.fetchWithRetry(
        `${API_BASE_URL}${API_ENDPOINTS.STORY_DETAIL}/${story.slug}`
      );

      if (
        detailResponse.status === "success" &&
        detailResponse.data &&
        detailResponse.data.item
      ) {
        const detailData = detailResponse.data.item;

        if (detailData.chapters && detailData.chapters.length > 0) {
          await this.processChapters(storyId, detailData.chapters, story.views);
          logger.info(`Đã xử lý lại xong các chương của truyện ${story.name}`);
          return {
            status: "completed",
            message: `Đã xử lý lại thành công các chương của truyện ${story.name}`,
            stats: this.stats,
          };
        } else {
          logger.warn(
            `Không tìm thấy dữ liệu chương nào của truyện ${story.name}`
          );
          return {
            status: "warning",
            message: `Không tìm thấy dữ liệu chương nào của truyện ${story.name}`,
          };
        }
      }

      throw new Error(`Không thể lấy dữ liệu chi tiết truyện ${story.name}`);
    } catch (error) {
      logger.error(`Lỗi khi xử lý lại các chương của truyện ${storyId}`, {
        error: error.message,
        stack: error.stack,
      });

      return {
        status: "error",
        message: error.message,
        stats: this.stats,
      };
    }
  }
}

module.exports = StoryCrawlerService;
