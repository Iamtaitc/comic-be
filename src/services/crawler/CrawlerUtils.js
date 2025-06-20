// be/src/services/crawler/CrawlerUtils.js
const axios = require("axios");
const logger = require("../../utils/logger");
const { MAX_RETRY, REQUEST_DELAY } = require("./CrawlerConfig");

const CrawlerUtils = {
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
        logger.warn(`Lỗi khi fetch ${url}, thử lại lần ${retryCount + 1}`, { error: error.message });
        await this.delay(REQUEST_DELAY * Math.pow(2, retryCount));
        return this.fetchWithRetry(url, retryCount + 1);
      }
      logger.error(`Không thể fetch ${url} sau ${MAX_RETRY} lần thử`, { error: error.message });
      throw error;
    }
  },

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  generateRandomStoryStats() {
    const views = this.getRandomViews();
    const stats = this.generateEngagementStats(views);
    return { views, ratingValue: stats.ratingValue, ratingCount: stats.ratingCount, likeCount: stats.likeCount };
  },

  getRandomViews() {
    const random = Math.random();
    if (random < 0.4) return Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
    if (random < 0.7) return Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000;
    if (random < 0.9) return Math.floor(Math.random() * (200000 - 50000 + 1)) + 50000;
    return Math.floor(Math.random() * (1000000 - 200000 + 1)) + 200000;
  },

  generateEngagementStats(views) {
    const ratingRate = 0.005 + Math.random() * 0.025;
    const ratingCount = Math.floor(views * ratingRate);
    const ratingValue = this.generateRealisticRating();
    const likeRate = 0.01 + Math.random() * 0.07;
    const likeCount = Math.floor(views * likeRate);
    return { ratingValue, ratingCount: Math.max(ratingCount, 0), likeCount: Math.max(likeCount, 0) };
  },

  generateRealisticRating() {
    const random = Math.random();
    if (random < 0.1) return parseFloat((3.0 + Math.random() * 0.9).toFixed(1));
    if (random < 0.3) return parseFloat((4.0 + Math.random() * 0.4).toFixed(1));
    return parseFloat((4.5 + Math.random() * 0.5).toFixed(1));
  },

  generateRandomChapterStats(storyViews) {
    const viewRate = 0.05 + Math.random() * 0.25;
    const chapterViews = Math.floor(storyViews * viewRate);
    return {
      views: Math.max(chapterViews, 10),
      likeCount: Math.floor(chapterViews * (0.005 + Math.random() * 0.02)),
    };
  },
};

module.exports = CrawlerUtils;