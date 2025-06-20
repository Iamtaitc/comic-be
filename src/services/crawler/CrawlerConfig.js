// src/services/crawler/CrawlerConfig.js
module.exports = {
  // API Configuration
  API_BASE_URL: "https://otruyenapi.com/v1/api",
  API_ENDPOINTS: {
    LIST: "/danh-sach",
    CATEGORY: "/the-loai",
    STORY_DETAIL: "/truyen-tranh",
  },

  // List types to crawl
  LIST_TYPES: ["truyen-moi", "dang-phat-hanh", "hoan-thanh", "sap-ra-mat"],

  // Performance settings optimized for 8GB RAM
  MAX_CONCURRENT_REQUESTS: 2, // Conservative for API stability
  STORY_BATCH_SIZE: 15, // Stories per batch
  CHAPTER_BATCH_SIZE: 50, // Chapters per batch

  // Rate limiting settings
  REQUEST_DELAY: 1200, // Base delay in ms
  MAX_DELAY: 45000, // Maximum delay in ms
  MAX_RETRY: 3, // Max retry attempts

  // Redis configuration
  REDIS_TTL: 24 * 60 * 60, // 24 hours in seconds
  REDIS_KEY_PREFIX: "crawler:stories:",
  REDIS_STATE_PREFIX: "crawler:state:",
  REDIS_PROGRESS_PREFIX: "crawler:progress:",

  // Session limits
  MAX_SESSION_DURATION: 2 * 60 * 60 * 1000, // 2 hours in ms
  HEALTH_CHECK_INTERVAL: 60 * 1000, // 1 minute in ms

  // Error handling
  MAX_CONSECUTIVE_ERRORS: 5,
  MAX_CONSECUTIVE_EMPTY_PAGES: 3,

  // Rate detection thresholds
  SLOW_RESPONSE_THRESHOLD: 5000, // 5 seconds
  VERY_SLOW_RESPONSE_THRESHOLD: 15000, // 15 seconds

  // User agent
  USER_AGENT: "ComicCrawler/2.0-Production (Enhanced)",

  // Schedules
  HOURLY_SCHEDULE: "0 * * * *", // Every hour
  CLEANUP_SCHEDULE: "0 2 * * 0", // Sunday 2 AM
};
