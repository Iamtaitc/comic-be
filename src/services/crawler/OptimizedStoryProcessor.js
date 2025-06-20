// src/services/crawler/OptimizedStoryProcessor.js
const Redis = require("ioredis");
const pLimit = require("p-limit");
const logger = require("../../utils/logger");
const { Story, Chapter } = require("../../models/index");
const CrawlerUtils = require("./CrawlerUtils");
const ApiRateDetector = require("./ApiRateDetector");
const {
  API_BASE_URL,
  API_ENDPOINTS,
  STORY_BATCH_SIZE,
  CHAPTER_BATCH_SIZE,
  REDIS_KEY_PREFIX,
  REDIS_TTL,
} = require("./CrawlerConfig");

class OptimizedStoryProcessor {
  constructor(crawlerService, stateManager) {
    this.crawlerService = crawlerService;
    this.stateManager = stateManager;

    // Optimized cho 8GB RAM
    this.concurrencyLimit = pLimit(2); // Conservative cho API stability
    this.STORY_BATCH_SIZE = STORY_BATCH_SIZE;
    this.CHAPTER_BATCH_SIZE = CHAPTER_BATCH_SIZE;

    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Rate detection và processing components
    this.rateDetector = new ApiRateDetector({
      baseDelay: 1200,
      maxDelay: 45000,
      backoffMultiplier: 1.6,
    });

    // Processing queues để batch operations
    this.storyQueue = [];
    this.storyProcessQueue = [];
    this.chapterQueue = [];

    // Cache để tránh duplicate checks
    this.existingStoryIds = new Set();
    this.processedStoryIds = new Set();

    // Performance tracking
    this.performance = {
      storiesProcessed: 0,
      chaptersProcessed: 0,
      duplicatesSkipped: 0,
      errorsHandled: 0,
    };
  }

  /**
   * 🚀 Main crawling process: Stories first, then chapters
   */
  async crawlListData(listType) {
    logger.info(`🎯 Bắt đầu crawl ${listType} - Stories First Strategy`);

    try {
      // Phase 1: Crawl story list và collect IDs
      await this.crawlStoryListPhase(listType);

      // Phase 2: Process stories in batches
      await this.processStoriesBatchPhase();

      // Phase 3: Process chapters for new/updated stories
      await this.processChaptersBatchPhase();

      logger.info(
        `✅ Hoàn thành ${listType}: ${this.processedStoryIds.size} stories processed`
      );
    } catch (error) {
      logger.error(`❌ Lỗi crawl ${listType}:`, error.message);
      throw error;
    } finally {
      // Cleanup memory
      this.cleanup();
    }
  }

  /**
   * 📚 Phase 1: Crawl story list để lấy danh sách IDs
   */
  async crawlStoryListPhase(listType) {
    logger.info(`📚 Phase 1: Crawling story list for ${listType}`);

    // Restore state từ Redis
    const progress = await this.stateManager.getListProgress(listType);
    let currentPage = progress.currentPage || 1;
    let hasMoreData = true;
    let consecutiveEmptyPages = 0;
    let totalItemsFound = 0;

    // Load existing story IDs để memory cho fast lookup
    await this.loadExistingStoryIds();

    while (hasMoreData && this.crawlerService.isRunning) {
      const startTime = Date.now();

      try {
        logger.info(`📄 Crawling page ${currentPage} of ${listType}`);

        const url = `${API_BASE_URL}${API_ENDPOINTS.LIST}/${listType}?page=${currentPage}`;
        const response = await this.fetchWithRateDetection(url);
        const responseTime = Date.now() - startTime;

        // Analyze response với rate detector
        const analysis = this.rateDetector.analyzeResponse(
          response,
          responseTime,
          url
        );

        if (this.isValidResponse(response)) {
          const items = response.data.items || [];
          totalItemsFound += items.length;

          if (items.length === 0) {
            consecutiveEmptyPages++;
            logger.warn(
              `📭 Empty page ${currentPage} (${consecutiveEmptyPages}/3)`
            );

            if (consecutiveEmptyPages >= 3) {
              logger.info(`🏁 Stopping after 3 consecutive empty pages`);
              hasMoreData = false;
            }
          } else {
            consecutiveEmptyPages = 0;

            // Filter duplicates TRƯỚC khi add to queue
            let newItemsCount = 0;
            for (const storyData of items) {
              if (!this.existingStoryIds.has(storyData._id)) {
                this.storyQueue.push(storyData);
                newItemsCount++;
                logger.debug(
                  `➕ Added new story: ${storyData.name} (${storyData._id})`
                );
              } else {
                this.performance.duplicatesSkipped++;
                this.crawlerService.stats.duplicatesSkipped++;
              }
            }

            logger.info(
              `✅ Page ${currentPage}: ${items.length} items, ${newItemsCount} new stories queued`
            );
          }

          // Save progress sau mỗi page
          await this.stateManager.saveListProgress(
            listType,
            currentPage + 1,
            this.storyQueue.length
          );
          this.crawlerService.stats.pagesProcessed++;
        } else {
          logger.warn(`⚠️ Invalid response at page ${currentPage}`);
          consecutiveEmptyPages++;

          if (analysis.recommendedAction === "check_api_health") {
            await this.performHealthCheck();
          }
        }

        currentPage++;

        // Apply intelligent delay từ rate detector
        const delay = this.rateDetector.getCurrentDelay();
        logger.debug(
          `⏱️ Applying delay: ${delay}ms (based on ${analysis.recommendedAction})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const analysis = this.rateDetector.analyzeError(
          error,
          responseTime,
          url
        );

        await this.stateManager.logError(listType, currentPage, error);
        this.performance.errorsHandled++;

        logger.error(`❌ Error at page ${currentPage}:`, error.message);

        // Decide whether to continue dựa trên error analysis
        if (analysis.recommendedAction === "pause_and_retry") {
          logger.warn(`⏸️ Pausing crawl due to API issues`);
          hasMoreData = false;
        } else {
          currentPage++;
          consecutiveEmptyPages++;

          // Apply error recovery delay
          const errorDelay = this.rateDetector.getCurrentDelay();
          await new Promise((resolve) => setTimeout(resolve, errorDelay));
        }
      }
    }

    logger.info(
      `📚 Phase 1 complete: ${this.storyQueue.length} new stories to process (${totalItemsFound} total found)`
    );
  }

  /**
   * 🏭 Phase 2: Process stories in optimized batches
   */
  async processStoriesBatchPhase() {
    logger.info(
      `🏭 Phase 2: Processing ${this.storyQueue.length} stories in batches`
    );

    while (this.storyQueue.length > 0 && this.crawlerService.isRunning) {
      const batch = this.storyQueue.splice(0, this.STORY_BATCH_SIZE);

      try {
        // Fetch full story details for batch
        const storyDetails = await this.fetchStoryDetailsBatch(batch);

        // Process stories batch với optimized operations
        await this.processStoryBatch(storyDetails);

        this.performance.storiesProcessed += batch.length;
        logger.info(`✅ Processed story batch: ${batch.length} stories`);

        // Small delay between batches để không overwhelm API
        const batchDelay = this.rateDetector.getCurrentDelay() * 0.5;
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      } catch (error) {
        logger.error(`❌ Error processing story batch:`, error.message);
        this.crawlerService.stats.errors += batch.length;
        this.performance.errorsHandled += batch.length;
      }
    }
  }

  /**
   * 📄 Phase 3: Process chapters for processed stories
   */
  async processChaptersBatchPhase() {
    logger.info(
      `📄 Phase 3: Processing chapters for ${this.storyProcessQueue.length} stories`
    );

    while (this.storyProcessQueue.length > 0 && this.crawlerService.isRunning) {
      const storiesForChapters = this.storyProcessQueue.splice(0, 5); // Smaller batches for chapters

      try {
        await Promise.all(
          storiesForChapters.map((storyData) =>
            this.concurrencyLimit(() => this.processStoryChapters(storyData))
          )
        );

        logger.info(
          `✅ Processed chapters for ${storiesForChapters.length} stories`
        );
      } catch (error) {
        logger.error(`❌ Error processing chapters batch:`, error.message);
        this.crawlerService.stats.errors++;
        this.performance.errorsHandled++;
      }
    }
  }

  /**
   * 🔍 Load existing story IDs để cache trong memory
   */
  async loadExistingStoryIds() {
    logger.info("🔍 Loading existing story IDs for duplicate check...");

    try {
      // Load tất cả story IDs có trong DB (projection để tiết kiệm memory)
      const existingStories = await Story.find(
        { deletedAt: null },
        { _id: 1 }
      ).lean();

      this.existingStoryIds = new Set(
        existingStories.map((s) => s._id.toString())
      );

      logger.info(
        `✅ Loaded ${this.existingStoryIds.size} existing story IDs into memory`
      );
    } catch (error) {
      logger.error("❌ Error loading existing story IDs:", error.message);
      this.existingStoryIds = new Set(); // Continue with empty set
    }
  }

  /**
   * 📖 Fetch story details in optimized batch
   */
  async fetchStoryDetailsBatch(storyBatch) {
    const results = [];

    for (const storyData of storyBatch) {
      try {
        const details = await this.fetchStoryDetails(storyData);
        if (details) {
          results.push({ ...storyData, details });
        }
      } catch (error) {
        logger.error(
          `❌ Error fetching details for ${storyData.name}:`,
          error.message
        );
        this.crawlerService.stats.errors++;
        this.performance.errorsHandled++;
      }

      // Conservative delay between detail requests
      const delay = Math.max(800, this.rateDetector.getCurrentDelay() * 0.7);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return results;
  }

  /**
   * 📖 Fetch single story details với error handling
   */
  async fetchStoryDetails(storyData) {
    const url = `${API_BASE_URL}${API_ENDPOINTS.STORY_DETAIL}/${storyData.slug}`;
    const startTime = Date.now();

    try {
      const response = await this.fetchWithRateDetection(url);
      const responseTime = Date.now() - startTime;

      this.rateDetector.analyzeResponse(response, responseTime, url);

      if (response && response.data && response.data.item) {
        return response.data.item;
      }

      logger.warn(`⚠️ No story details found for ${storyData.slug}`);
      return null;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.rateDetector.analyzeError(error, responseTime, url);
      throw error;
    }
  }

  /**
   * 💾 Process story batch với proper upsert và duplicate handling
   */
  async processStoryBatch(storyDetailsBatch) {
    const bulkOps = [];

    for (const storyItem of storyDetailsBatch) {
      try {
        const validation = CrawlerUtils.validateStoryData(storyItem);
        if (!validation.isValid) {
          logger.warn(
            `⚠️ Invalid story data for ${storyItem.name}:`,
            validation.errors
          );
          continue;
        }

        const storyDoc = this.prepareStoryDocument(storyItem);

        // ⚠️ CRITICAL: Sử dụng slug instead của _id để tránh duplicate error
        bulkOps.push({
          updateOne: {
            filter: { slug: storyDoc.slug },
            update: { $set: storyDoc },
            upsert: true,
          },
        });

        // Add to chapter processing queue nếu có chapters
        if (storyItem.details && storyItem.details.chapters) {
          this.storyProcessQueue.push({
            ...storyItem,
            computedSlug: storyDoc.slug, // Will need this để find story later
          });
        }
      } catch (error) {
        logger.error(
          `❌ Error preparing story ${storyItem.name}:`,
          error.message
        );
        this.crawlerService.stats.errors++;
        this.performance.errorsHandled++;
      }
    }

    if (bulkOps.length === 0) return;

    try {
      const result = await Story.bulkWrite(bulkOps, {
        ordered: false, // Continue on errors để handle duplicates gracefully
      });

      this.crawlerService.stats.newStories += result.upsertedCount || 0;
      this.crawlerService.stats.updatedStories += result.modifiedCount || 0;

      // Track processed IDs
      for (const storyItem of storyDetailsBatch) {
        this.processedStoryIds.add(storyItem._id);
      }

      logger.info(
        `💾 Story batch: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      logger.error(`❌ Story batch write error:`, error.message);

      // Handle duplicate key errors gracefully
      if (error.writeErrors) {
        const duplicates = error.writeErrors.filter((e) => e.code === 11000);
        const successful = bulkOps.length - error.writeErrors.length;

        this.crawlerService.stats.newStories += successful;
        this.crawlerService.stats.duplicatesSkipped += duplicates.length;
        this.performance.duplicatesSkipped += duplicates.length;

        logger.warn(
          `⚠️ ${duplicates.length} duplicate stories skipped, ${successful} processed`
        );
      }

      this.crawlerService.stats.errors++;
      this.performance.errorsHandled++;
    }
  }

  /**
   * 📄 Process chapters for a single story với optimization
   */
  async processStoryChapters(storyData) {
    if (!storyData.details || !storyData.details.chapters) {
      return;
    }

    try {
      // Find story trong DB để get actual _id
      const story = await Story.findOne({
        slug: storyData.computedSlug,
      }).select("_id views");
      if (!story) {
        logger.warn(
          `⚠️ Story not found for chapters: ${storyData.computedSlug}`
        );
        return;
      }

      const chapters = this.flattenChapters(storyData.details.chapters);
      const chapterDocs = this.prepareChapterDocuments(
        story._id,
        chapters,
        story.views
      );

      if (chapterDocs.length === 0) return;

      // Process trong smaller batches để tránh memory issues
      const chapterBatches = CrawlerUtils.chunkArray(
        chapterDocs,
        this.CHAPTER_BATCH_SIZE
      );

      for (const batch of chapterBatches) {
        await this.processChapterBatch(batch);

        // Small delay between chapter batches
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      this.performance.chaptersProcessed += chapterDocs.length;
      logger.info(
        `✅ Processed ${chapterDocs.length} chapters for story: ${storyData.name}`
      );
    } catch (error) {
      logger.error(
        `❌ Error processing chapters for ${storyData.name}:`,
        error.message
      );
      this.crawlerService.stats.errors++;
      this.performance.errorsHandled++;
    }
  }

  /**
   * 💾 Process chapter batch với advanced duplicate handling
   */
  async processChapterBatch(chapterBatch) {
    const bulkOps = chapterBatch
      .map((chapterDoc) => {
        // Validate chapter data trước khi process
        const validation = CrawlerUtils.validateChapterData(chapterDoc);
        if (!validation.isValid) {
          logger.debug(`⚠️ Invalid chapter data:`, validation.errors);
          return null;
        }

        return {
          updateOne: {
            filter: {
              storyId: chapterDoc.storyId,
              chapterNumber: chapterDoc.chapterNumber,
            },
            update: { $set: chapterDoc },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (bulkOps.length === 0) return;

    try {
      const result = await Chapter.bulkWrite(bulkOps, {
        ordered: false, // Continue on duplicate errors
      });

      this.crawlerService.stats.newChapters += result.upsertedCount || 0;

      logger.debug(
        `📄 Chapter batch: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      // Gracefully handle duplicate key errors
      if (error.writeErrors) {
        const duplicates = error.writeErrors.filter((e) => e.code === 11000);
        const successful = bulkOps.length - error.writeErrors.length;

        this.crawlerService.stats.newChapters += successful;
        this.crawlerService.stats.duplicatesSkipped += duplicates.length;
        this.performance.duplicatesSkipped += duplicates.length;

        logger.debug(
          `📄 Chapter batch: ${successful} processed, ${duplicates.length} duplicates skipped`
        );
      } else {
        logger.error(`❌ Chapter batch error:`, error.message);
        this.crawlerService.stats.errors++;
        this.performance.errorsHandled++;
      }
    }
  }

  /**
   * 📋 Prepare story document từ API data
   */
  prepareStoryDocument(storyItem) {
    const { details } = storyItem;

    // Generate story stats
    const views = CrawlerUtils.generateRandomViews();
    const engagementStats = CrawlerUtils.generateEngagementStats(views);

    const storyDoc = CrawlerUtils.cleanObject({
      name: storyItem.name || details.name,
      slug: storyItem.slug,
      origin_name: details.origin_name || [],
      content: CrawlerUtils.sanitizeContent(details.content || ""),
      status: CrawlerUtils.mapStoryStatus(details.status),
      thumb_url: CrawlerUtils.normalizeImageUrl(
        storyItem.thumb_url || details.thumb_url
      ),
      sub_docquyen: details.sub_docquyen || false,
      author: details.author || [],
      category: CrawlerUtils.extractCategoryIds(details.category || []),
      views,
      ratingValue: engagementStats.ratingValue,
      ratingCount: engagementStats.ratingCount,
      likeCount: engagementStats.likeCount,
      deletedAt: null,
    });

    return storyDoc;
  }

  /**
   * 📄 Prepare chapter documents với validation
   */
  prepareChapterDocuments(storyId, chapters, storyViews = 10000) {
    const chapterDocs = [];

    for (const chapter of chapters) {
      const chapterNumber = CrawlerUtils.parseChapterNumber(chapter);

      if (isNaN(chapterNumber)) {
        logger.warn(`⚠️ Invalid chapter number: ${chapter.chapter_name}`);
        continue;
      }

      const chapterStats = CrawlerUtils.generateRandomChapterStats(storyViews);

      const chapterDoc = CrawlerUtils.cleanObject({
        storyId,
        chapterNumber,
        chapter_name: chapter.chapter_name || `Chapter ${chapterNumber}`,
        chapter_title: chapter.chapter_title || "",
        content: [], // Will be populated later if needed
        chapter_image: [],
        chapter_path: chapter.chapter_path || "",
        filename: chapter.filename || "",
        comic_name: chapter.comic_name || "",
        chapter_api_data: chapter.chapter_api_data || null,
        server_name: chapter.server_name || "Server #1",
        domain_cdn: chapter.domain_cdn || "",
        views: chapterStats.views,
        likeCount: chapterStats.likeCount,
        isPublished: true,
        deletedAt: null,
      });

      chapterDocs.push(chapterDoc);
    }

    return chapterDocs;
  }

  /**
   * 🔧 Helper: Flatten chapters từ server_data structure
   */
  flattenChapters(chaptersData) {
    return CrawlerUtils.flattenServerChapters(chaptersData);
  }

  /**
   * 🌐 Fetch với rate detection và intelligent retry
   */
  async fetchWithRateDetection(url) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        const response = await CrawlerUtils.fetchWithRetry(url);
        this.crawlerService.stats.apiCallsMade++;
        return response;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const analysis = this.rateDetector.analyzeError(
          error,
          responseTime,
          url
        );

        if (attempt === maxRetries) {
          throw error;
        }

        // Intelligent backoff dựa trên error type
        let backoffDelay;
        switch (analysis.recommendedAction) {
          case "backoff":
            backoffDelay = Math.min(5000 * Math.pow(2, attempt), 30000);
            break;
          case "pause_and_retry":
            backoffDelay = Math.min(10000 * Math.pow(1.5, attempt), 45000);
            break;
          default:
            backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
        }

        logger.warn(
          `🔄 Retry ${attempt}/${maxRetries} for ${url} in ${backoffDelay}ms (${analysis.errorType})`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  /**
   * 🏥 Perform API health check
   */
  async performHealthCheck() {
    logger.info("🏥 Performing API health check...");

    try {
      const healthResult = await this.rateDetector.checkApiHealth(API_BASE_URL);

      if (!healthResult.healthy) {
        logger.warn(`⚠️ API health check failed - adjusting crawler behavior`);
        // Increase delays temporarily
        this.rateDetector.currentState.currentDelay = Math.min(
          this.rateDetector.currentState.currentDelay * 2,
          this.rateDetector.maxDelay
        );
      }

      return healthResult;
    } catch (error) {
      logger.error("❌ Health check failed:", error.message);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * ✅ Helper: Check valid response
   */
  isValidResponse(response) {
    return response && response.status === "success" && response.data;
  }

  /**
   * 🧹 Cleanup memory và reset states
   */
  cleanup() {
    this.storyQueue = [];
    this.storyProcessQueue = [];
    this.chapterQueue = [];
    this.existingStoryIds.clear();
    this.processedStoryIds.clear();

    // Reset performance counters
    this.performance = {
      storiesProcessed: 0,
      chaptersProcessed: 0,
      duplicatesSkipped: 0,
      errorsHandled: 0,
    };

    logger.debug("🧹 Memory cleanup completed");
  }

  /**
   * 📊 Get comprehensive stats
   */
  getStats() {
    return {
      queues: {
        storyQueue: this.storyQueue.length,
        storyProcessQueue: this.storyProcessQueue.length,
        chapterQueue: this.chapterQueue.length,
      },
      processed: {
        existingStoryIds: this.existingStoryIds.size,
        processedStoryIds: this.processedStoryIds.size,
      },
      performance: this.performance,
      rateDetector: this.rateDetector.getStats(),
      memoryUsage: CrawlerUtils.getMemoryUsage(),
    };
  }

  /**
   * 🚪 Close connections
   */
  async close() {
    try {
      await this.redis.quit();
      logger.info("🚪 OptimizedStoryProcessor connections closed");
    } catch (error) {
      logger.error("❌ Error closing connections:", error.message);
    }
  }
}

module.exports = OptimizedStoryProcessor;
