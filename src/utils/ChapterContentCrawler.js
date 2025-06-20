/**
 * Tiện ích cào dữ liệu chi tiết chapter
 * Được gọi khi người dùng đọc chapter mà chưa có dữ liệu
 */

const axios = require("axios");
const logger = require("../utils/logger");
const config = require("../../config");
const Chapter = require("../../src/models/Chapter.mongoose");

class ChapterContentCrawler {
  /**
   * Lấy nội dung chi tiết của chapter
   * @param {string} chapterId ID của chapter cần lấy nội dung
   * @returns {Promise<Array>} Mảng các URL hình ảnh của chapter
   */
  static async getChapterContent(chapterId) {
    try {
      // Tìm thông tin chapter trong database
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        throw new Error(`Không tìm thấy chapter với ID: ${chapterId}`);
      }

      // Kiểm tra nếu đã có nội dung
      if (chapter.content && chapter.content.length > 0) {
        logger.info(`Sử dụng nội dung chapter đã có sẵn cho: ${chapterId}`);
        return chapter.content;
      }

      // Lấy nội dung từ API nếu chưa có
      logger.info(`Cào nội dung cho chapter ID: ${chapterId}`);

      // Kiểm tra nếu có chapter_api_data
      if (!chapter.chapter_api_data) {
        throw new Error(`Chapter ID ${chapterId} không có chapter_api_data`);
      }

      // Gửi request tới API để lấy nội dung chapter
      const response = await axios.get(chapter.chapter_api_data, {
        headers: {
          "User-Agent": config.crawler.userAgent,
        },
      });

      if (
        !response.data ||
        !response.data.status ||
        response.data.status !== "success"
      ) {
        throw new Error(`Không thể lấy nội dung chapter: ${chapterId}`);
      }

      // Lấy mảng URL hình ảnh từ response
      let imageUrls = [];
      if (response.data.data && response.data.data.images) {
        imageUrls = response.data.data.images;
      }

      // Cập nhật chapter với nội dung mới
      chapter.content = imageUrls;
      chapter.updatedAt = new Date();
      await chapter.save();

      logger.info(
        `Đã cập nhật nội dung cho chapter ID: ${chapterId} với ${imageUrls.length} hình ảnh`
      );
      return imageUrls;
    } catch (error) {
      logger.error(`Lỗi khi lấy nội dung chapter ID: ${chapterId}`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cập nhật lượt xem của chapter
   * @param {string} chapterId ID của chapter
   * @param {string} userId ID của người dùng (nếu có)
   */
  static async updateViewCount(chapterId, userId = null) {
    try {
      // Cập nhật lượt xem chapter
      await Chapter.findByIdAndUpdate(chapterId, {
        $inc: { views: 1 },
        $set: { lastViewedAt: new Date() },
      });

      // Ghi lại lượt xem trong ViewCounter nếu cần
      if (config.enableDetailedViewTracking) {
        // Code xử lý ViewCounter model nếu cần
      }

      // Lưu lịch sử đọc nếu có userId
      if (userId) {
        const History = require("../models/History");
        const chapter = await Chapter.findById(chapterId);

        if (chapter) {
          await History.findOneAndUpdate(
            { userId, StoryId: chapter.StoryId, chapterId },
            {
              userId,
              StoryId: chapter.StoryId,
              chapterId,
              readAt: new Date(),
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (error) {
      logger.error(`Lỗi khi cập nhật lượt xem chapter ID: ${chapterId}`, {
        error: error.message,
      });
      // Không throw lỗi ở đây để không ảnh hưởng đến trải nghiệm người dùng
    }
  }
}

module.exports = ChapterContentCrawler;
