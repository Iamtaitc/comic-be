// src/services/crawler/StateManager.js
const Redis = require("ioredis");
const logger = require("../../utils/logger");
const {
  REDIS_STATE_PREFIX,
  REDIS_PROGRESS_PREFIX,
} = require("./CrawlerConfig");

class StateManager {
  constructor(redisClient) {
    this.redis =
      redisClient ||
      new Redis(process.env.REDIS_URL || "redis://comic_redis:6379", {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

    this.STATE_KEY_PREFIX = REDIS_STATE_PREFIX;
    this.PROGRESS_KEY_PREFIX = REDIS_PROGRESS_PREFIX;

    // Connect to Redis
    this.initializeRedis();
  }

  /**
   * 🔌 Initialize Redis connection
   */
  async initializeRedis() {
    try {
      await this.redis.ping();
      logger.info("✅ Redis connected for StateManager");
    } catch (error) {
      logger.error("❌ Redis connection failed:", error.message);
      // Continue without Redis (degraded mode)
    }
  }

  /**
   * 💾 Lưu trạng thái crawler cho từng listType
   */
  async saveListProgress(
    listType,
    page,
    totalProcessed = 0,
    additionalData = {}
  ) {
    try {
      const key = `${this.PROGRESS_KEY_PREFIX}${listType}`;
      const state = {
        currentPage: page,
        totalProcessed,
        lastUpdated: new Date().toISOString(),
        status: "running",
        ...additionalData,
      };

      await this.redis.setex(key, 7 * 24 * 3600, JSON.stringify(state)); // 7 days TTL
      logger.debug(
        `💾 Saved progress for ${listType}: page ${page}, processed ${totalProcessed}`
      );

      return true;
    } catch (error) {
      logger.error(
        `❌ Failed to save progress for ${listType}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * 📂 Khôi phục trạng thái crawler
   */
  async getListProgress(listType) {
    try {
      const key = `${this.PROGRESS_KEY_PREFIX}${listType}`;
      const stateJson = await this.redis.get(key);

      if (stateJson) {
        const state = JSON.parse(stateJson);
        logger.info(`📂 Resumed ${listType} from page ${state.currentPage}`);
        return state;
      }

      // Default state nếu chưa có
      const defaultState = {
        currentPage: 1,
        totalProcessed: 0,
        lastUpdated: new Date().toISOString(),
        status: "new",
      };

      logger.info(`🆕 Starting fresh for ${listType}`);
      return defaultState;
    } catch (error) {
      logger.error(`❌ Failed to get progress for ${listType}:`, error.message);

      // Return default state on error
      return {
        currentPage: 1,
        totalProcessed: 0,
        lastUpdated: new Date().toISOString(),
        status: "error",
      };
    }
  }

  /**
   * 🏁 Đánh dấu hoàn thành listType
   */
  async markListCompleted(listType, stats) {
    try {
      const key = `${this.PROGRESS_KEY_PREFIX}${listType}`;
      const state = {
        status: "completed",
        completedAt: new Date().toISOString(),
        finalStats: stats,
        lastUpdated: new Date().toISOString(),
      };

      await this.redis.setex(key, 24 * 3600, JSON.stringify(state)); // 1 day TTL
      logger.info(`🏁 Marked ${listType} as completed`);

      return true;
    } catch (error) {
      logger.error(`❌ Failed to mark ${listType} completed:`, error.message);
      return false;
    }
  }

  /**
   * ⚠️ Lưu thông tin lỗi để phân tích
   */
  async logError(listType, page, error, context = {}) {
    try {
      const errorKey = `crawler:errors:${listType}:${Date.now()}`;
      const errorData = {
        listType,
        page,
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        errorType: this.classifyError(error),
      };

      await this.redis.setex(
        errorKey,
        7 * 24 * 3600,
        JSON.stringify(errorData)
      ); // 7 days TTL
      logger.warn(
        `⚠️ Logged error for ${listType} page ${page}: ${error.message}`
      );

      return true;
    } catch (redisError) {
      logger.error(`❌ Failed to log error:`, redisError.message);
      return false;
    }
  }

  /**
   * 🔄 Lấy danh sách trang bị lỗi để retry
   */
  async getFailedPages(listType) {
    try {
      const pattern = `crawler:errors:${listType}:*`;
      const keys = await this.redis.keys(pattern);

      const failedPages = new Set();
      const errors = [];

      for (const key of keys) {
        const errorDataJson = await this.redis.get(key);
        if (errorDataJson) {
          const errorData = JSON.parse(errorDataJson);
          failedPages.add(errorData.page);
          errors.push(errorData);
        }
      }

      logger.info(`🔄 Found ${failedPages.size} failed pages for ${listType}`);

      return {
        pages: Array.from(failedPages),
        errors,
        count: failedPages.size,
      };
    } catch (error) {
      logger.error(
        `❌ Failed to get failed pages for ${listType}:`,
        error.message
      );
      return { pages: [], errors: [], count: 0 };
    }
  }

  /**
   * 📊 Lưu session statistics
   */
  async saveSessionStats(sessionId, stats) {
    try {
      const key = `crawler:session:${sessionId}`;
      const sessionData = {
        sessionId,
        stats,
        savedAt: new Date().toISOString(),
      };

      await this.redis.setex(key, 3 * 24 * 3600, JSON.stringify(sessionData)); // 3 days TTL
      logger.debug(`📊 Saved session stats for ${sessionId}`);

      return true;
    } catch (error) {
      logger.error(`❌ Failed to save session stats:`, error.message);
      return false;
    }
  }

  /**
   * 📈 Lấy session statistics
   */
  async getSessionStats(sessionId) {
    try {
      const key = `crawler:session:${sessionId}`;
      const sessionDataJson = await this.redis.get(key);

      if (sessionDataJson) {
        return JSON.parse(sessionDataJson);
      }

      return null;
    } catch (error) {
      logger.error(`❌ Failed to get session stats:`, error.message);
      return null;
    }
  }

  /**
   * 🔄 Reset progress cho một listType
   */
  async resetListProgress(listType) {
    try {
      const progressKey = `${this.PROGRESS_KEY_PREFIX}${listType}`;
      const errorPattern = `crawler:errors:${listType}:*`;

      // Delete progress
      await this.redis.del(progressKey);

      // Delete errors
      const errorKeys = await this.redis.keys(errorPattern);
      if (errorKeys.length > 0) {
        await this.redis.del(...errorKeys);
      }

      logger.info(`🔄 Reset progress for ${listType}`);
      return true;
    } catch (error) {
      logger.error(
        `❌ Failed to reset progress for ${listType}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * 📊 Lấy tổng quan trạng thái tất cả lists
   */
  async getAllListsStatus() {
    try {
      const pattern = `${this.PROGRESS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      const status = {};

      for (const key of keys) {
        const listType = key.replace(this.PROGRESS_KEY_PREFIX, "");
        const stateJson = await this.redis.get(key);

        if (stateJson) {
          status[listType] = JSON.parse(stateJson);
        }
      }

      return status;
    } catch (error) {
      logger.error(`❌ Failed to get all lists status:`, error.message);
      return {};
    }
  }

  /**
   * 🧹 Cleanup old states và errors
   */
  async cleanup() {
    try {
      const patterns = [
        "crawler:errors:*",
        "crawler:session:*",
        `${this.PROGRESS_KEY_PREFIX}*`,
      ];

      let totalCleaned = 0;

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);

        // Filter keys older than retention period
        const expiredKeys = [];
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          // If TTL is -1 (no expiry) or very old, mark for cleanup
          if (ttl === -1 || ttl > 30 * 24 * 3600) {
            // Older than 30 days
            expiredKeys.push(key);
          }
        }

        if (expiredKeys.length > 0) {
          await this.redis.del(...expiredKeys);
          totalCleaned += expiredKeys.length;
        }
      }

      logger.info(`🧹 Cleaned up ${totalCleaned} old state keys`);
      return totalCleaned;
    } catch (error) {
      logger.error(`❌ Cleanup failed:`, error.message);
      return 0;
    }
  }

  /**
   * 🏥 Health check cho Redis connection
   */
  async healthCheck() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;

      return {
        healthy: true,
        responseTime,
        connected: true,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        connected: false,
      };
    }
  }

  /**
   * 🔍 Classify error type
   */
  classifyError(error) {
    if (error.response?.status === 429) return "RATE_LIMIT";
    if (error.code === "ECONNABORTED") return "TIMEOUT";
    if (error.code === "ENOTFOUND") return "DNS_ERROR";
    if (error.code === "ECONNREFUSED") return "CONNECTION_REFUSED";
    if (error.message?.includes("duplicate")) return "DUPLICATE_KEY";
    if (error.message?.includes("timeout")) return "TIMEOUT";
    return "UNKNOWN";
  }

  /**
   * 📊 Lấy error statistics
   */
  async getErrorStats(listType = null, timeWindowHours = 24) {
    try {
      const pattern = listType
        ? `crawler:errors:${listType}:*`
        : "crawler:errors:*";
      const keys = await this.redis.keys(pattern);

      const cutoffTime = new Date(
        Date.now() - timeWindowHours * 60 * 60 * 1000
      );
      const errorStats = {
        total: 0,
        byType: {},
        byListType: {},
        recent: [],
      };

      for (const key of keys) {
        const errorDataJson = await this.redis.get(key);
        if (errorDataJson) {
          const errorData = JSON.parse(errorDataJson);
          const errorTime = new Date(errorData.timestamp);

          if (errorTime > cutoffTime) {
            errorStats.total++;

            // Count by error type
            const errorType = errorData.errorType || "UNKNOWN";
            errorStats.byType[errorType] =
              (errorStats.byType[errorType] || 0) + 1;

            // Count by list type
            errorStats.byListType[errorData.listType] =
              (errorStats.byListType[errorData.listType] || 0) + 1;

            // Add to recent errors
            errorStats.recent.push({
              listType: errorData.listType,
              page: errorData.page,
              errorType,
              message: errorData.error,
              timestamp: errorData.timestamp,
            });
          }
        }
      }

      // Sort recent errors by timestamp
      errorStats.recent.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      errorStats.recent = errorStats.recent.slice(0, 50); // Keep last 50

      return errorStats;
    } catch (error) {
      logger.error(`❌ Failed to get error stats:`, error.message);
      return { total: 0, byType: {}, byListType: {}, recent: [] };
    }
  }

  /**
   * 🚪 Close Redis connection
   */
  async close() {
    try {
      await this.redis.quit();
      logger.info("🚪 Redis connection closed");
    } catch (error) {
      logger.error("❌ Error closing Redis connection:", error.message);
    }
  }
}

module.exports = StateManager;
