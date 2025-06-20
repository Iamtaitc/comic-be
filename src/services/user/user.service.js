/**
 * Service xử lý các tương tác của người dùng với truyện
 * Bookmark, lịch sử đọc, đánh giá
 */

const { Story, Bookmark, History, Rating } = require("../../models/index");
const logger = require("../../utils/logger");

class UserInteractionService {
  /**
   * Lưu truyện vào danh sách yêu thích
   * @param {string} userId ID người dùng
   * @param {string} storyId ID truyện
   * @param {string} note Ghi chú (tùy chọn)
   * @param {string} lastReadChapter ID chương cuối cùng đã đọc (tùy chọn)
   * @returns {Promise<Object>} Thông tin bookmark
   */
  static async bookmarkStory(
    userId,
    storyId,
    note = "",
    lastReadChapter = null
  ) {
    try {
      // Kiểm tra truyện có tồn tại và chưa bị xóa mềm
      const story = await Story.findOne({ _id: storyId, deletedAt: null });
      if (!story) {
        throw new Error("Không tìm thấy truyện");
      }

      // Kiểm tra bookmark đã tồn tại
      const existingBookmark = await Bookmark.findOne({
        userId,
        storyId,
        deletedAt: null,
      });

      if (existingBookmark) {
        // Cập nhật ghi chú và chương cuối nếu đã tồn tại
        existingBookmark.note = note;
        existingBookmark.lastReadChapter = lastReadChapter;
        existingBookmark.isActive = true;
        existingBookmark.updatedAt = new Date();
        await existingBookmark.save();

        return {
          message: "Cập nhật bookmark thành công",
          bookmark: existingBookmark,
        };
      }

      // Tạo bookmark mới
      const newBookmark = new Bookmark({
        userId,
        storyId,
        note,
        lastReadChapter,
        isActive: true,
      });

      await newBookmark.save();

      return {
        message: "Đã thêm vào danh sách yêu thích",
        bookmark: newBookmark,
      };
    } catch (error) {
      logger.error(
        `Lỗi khi bookmark truyện ${storyId} của người dùng ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Xóa truyện khỏi danh sách yêu thích
   * @param {string} userId ID người dùng
   * @param {string} storyId ID truyện
   * @returns {Promise<Object>} Thông báo kết quả
   */
  static async removeBookmark(userId, storyId) {
    try {
      const result = await Bookmark.findOneAndDelete({
        userId,
        storyId,
        deletedAt: null,
      });

      if (!result) {
        throw new Error("Không tìm thấy bookmark");
      }

      return {
        message: "Đã xóa khỏi danh sách yêu thích",
      };
    } catch (error) {
      logger.error(
        `Lỗi khi xóa bookmark truyện ${storyId} của người dùng ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Lấy danh sách truyện yêu thích của người dùng
   * @param {string} userId ID người dùng
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng mỗi trang
   * @returns {Promise<Object>} Danh sách truyện yêu thích và thông tin phân trang
   */
  static async getUserBookmarks(userId, page = 1, limit = 20) {
    try {
      const total = await Bookmark.countDocuments({
        userId,
        isActive: true,
        deletedAt: null,
      });

      // Lấy danh sách bookmark với thông tin truyện và chương
      const bookmarks = await Bookmark.find({
        userId,
        isActive: true,
        deletedAt: null,
      })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate(
          "storyId",
          "name slug thumb_url status ratingValue ratingCount"
        )
        .populate("lastReadChapter", "chapterNumber chapter_name");

      return {
        bookmarks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách bookmark của người dùng ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Lấy lịch sử đọc truyện của người dùng
   * @param {string} userId ID người dùng
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng mỗi trang
   * @returns {Promise<Object>} Lịch sử đọc và thông tin phân trang
   */
  static async getUserHistory(userId, page = 1, limit = 20) {
    try {
      const total = await History.countDocuments({ userId, deletedAt: null });

      // Lấy lịch sử đọc truyện
      const history = await History.find({ userId, deletedAt: null })
        .sort({ readAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("storyId", "name slug thumb_url")
        .populate("chapterId", "chapterNumber chapter_name chapter_title");

      return {
        history,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error(`Lỗi khi lấy lịch sử đọc của người dùng ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Xóa lịch sử đọc truyện
   * @param {string} userId ID người dùng
   * @param {string} historyId ID lịch sử (nếu null thì xóa tất cả)
   * @returns {Promise<Object>} Thông báo kết quả
   */
  static async clearHistory(userId, historyId = null) {
    try {
      let result;

      if (historyId) {
        // Xóa một lịch sử cụ thể
        result = await History.findOneAndUpdate(
          { _id: historyId, userId, deletedAt: null },
          { deletedAt: new Date() }
        );

        if (!result) {
          throw new Error("Không tìm thấy lịch sử đọc");
        }

        return {
          message: "Đã xóa lịch sử đọc",
        };
      } else {
        // Xóa tất cả lịch sử
        result = await History.updateMany(
          { userId, deletedAt: null },
          { deletedAt: new Date() }
        );

        return {
          message: `Đã xóa ${result.modifiedCount} lịch sử đọc`,
        };
      }
    } catch (error) {
      logger.error(`Lỗi khi xóa lịch sử đọc của người dùng ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Đánh giá truyện
   * @param {string} userId ID người dùng
   * @param {string} storyId ID truyện
   * @param {number} value Giá trị đánh giá (1-5)
   * @param {string} comment Bình luận đánh giá (tùy chọn)
   * @returns {Promise<Object>} Thông tin đánh giá
   */
  static async rateStory(userId, storyId, value, comment = "") {
    try {
      // Kiểm tra truyện có tồn tại và chưa bị xóa mềm
      const story = await Story.findOne({ _id: storyId, deletedAt: null });
      if (!story) {
        throw new Error("Không tìm thấy truyện");
      }

      // Kiểm tra giá trị đánh giá
      if (value < 1 || value > 5) {
        throw new Error("Giá trị đánh giá phải từ 1 đến 5");
      }

      // Kiểm tra đã đánh giá chưa
      const existingRating = await Rating.findOne({
        userId,
        storyId,
        deletedAt: null,
      });

      if (existingRating) {
        // Cập nhật đánh giá nếu đã tồn tại
        existingRating.value = value;
        existingRating.comment = comment;
        existingRating.isEdited = true;
        await existingRating.save();

        return {
          message: "Cập nhật đánh giá thành công",
          rating: existingRating,
        };
      }

      // Tạo đánh giá mới
      const newRating = new Rating({
        userId,
        storyId,
        value,
        comment,
      });

      await newRating.save();

      return {
        message: "Đánh giá thành công",
        rating: newRating,
      };
    } catch (error) {
      logger.error(
        `Lỗi khi đánh giá truyện ${storyId} của người dùng ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Cập nhật điểm đánh giá trung bình của truyện
   * @param {string} storyId ID truyện
   * @returns {Promise<void>}
   */
  static async updateStoryRating(storyId) {
    try {
      // Lấy tất cả đánh giá của truyện chưa bị xóa mềm
      const ratings = await Rating.find({ storyId, deletedAt: null });

      if (ratings.length === 0) {
        // Nếu không có đánh giá nào, đặt mặc định về 0
        await Story.findByIdAndUpdate(storyId, {
          ratingValue: 0,
          ratingCount: 0,
        });
        return;
      }

      // Tính điểm trung bình
      const totalValue = ratings.reduce((acc, curr) => acc + curr.value, 0);
      const averageValue = totalValue / ratings.length;

      // Cập nhật điểm trung bình và số lượng đánh giá vào truyện
      await Story.findByIdAndUpdate(storyId, {
        ratingValue: averageValue,
        ratingCount: ratings.length,
      });
    } catch (error) {
      logger.error(`Lỗi khi cập nhật điểm đánh giá truyện ${storyId}:`, error);
      throw error;
    }
  }
}

module.exports = new UserInteractionService();
