// be/src/services/crawler/CrawlerConfig.js
module.exports = {
  API_BASE_URL: "https://otruyenapi.com/v1/api",
  API_ENDPOINTS: {
    LIST: "/danh-sach",
    CATEGORY: "/the-loai",
    STORY_DETAIL: "/truyen-tranh",
  },
  LIST_TYPES: ["truyen-moi", "sap-ra-mat", "dang-phat-hanh", "hoan-thanh"],
  MAX_CONCURRENT_REQUESTS: 5,
  REQUEST_DELAY: 1000,
  MAX_RETRY: 3,
  REDIS_TTL: 24 * 60 * 60,
  REDIS_KEY_PREFIX: "crawler:stories:",
};