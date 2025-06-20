/**
 * Service xử lý các chức năng liên quan đến truyện
 * Cung cấp các phương thức để lấy thông tin truyện
 */

const {
  Story,
  Chapter,
  Category,
  ViewCounter,
  History,
} = require("../../models/index");
const logger = require("../../utils/logger");
const chapterCrawler = require("../../utils/ChapterContentCrawler");

class StoryService {
  /**
   * Lấy danh sách truyện mới cập nhật
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async getLatestStories(page = 1, limit = 20) {
    try {
      const total = await Story.countDocuments({ deletedAt: null });
      const totalStories = total; // Tổng số truyện

      const stories = await Story.find({ deletedAt: null })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện mới thành công",
        data: {
          stories,
          totalStories, // Thêm tổng số truyện
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện mới:", error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện mới",
      };
    }
  }

  /**
   * Lấy danh sách truyện phổ biến
   * @param {number} limit Số lượng truyện cần lấy
   * @returns {Promise<Object>} Danh sách truyện
   */
  static async getPopularStories(limit = 10) {
    try {
      const totalStories = await Story.countDocuments({ deletedAt: null });
      const stories = await Story.find({ deletedAt: null })
        .sort({ views: -1 })
        .limit(parseInt(limit))
        .select("name slug thumb_url views status ratingValue ratingCount")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện phổ biến thành công",
        data: { stories, totalStories }, // Thêm tổng số truyện
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện phổ biến:", error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện phổ biến",
      };
    }
  }

  /**
   * Lấy danh sách truyện theo thể loại
   * @param {string} categorySlug Slug của thể loại
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async getStoriesByCategory(categorySlug, page = 1, limit = 20) {
    try {
      // Tìm thể loại theo slug
      const category = await Category.findOne({
        slug: categorySlug,
        deletedAt: null,
        isActive: true,
      });

      if (!category) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy thể loại",
        };
      }

      const total = await Story.countDocuments({
        category: category._id,
        deletedAt: null,
      });

      const stories = await Story.find({
        category: category._id,
        deletedAt: null,
      })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện theo thể loại thành công",
        data: {
          category: {
            id: category._id,
            name: category.name,
            slug: category.slug,
          },
          stories,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách truyện theo thể loại ${categorySlug}:`,
        error
      );
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện theo thể loại",
      };
    }
  }

  /**
   * Tìm kiếm truyện
   * @param {string} keyword Từ khóa tìm kiếm
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async searchStories(keyword, page = 1, limit = 20) {
    try {
      if (!keyword) {
        return {
          success: false,
          status: 400,
          message: "Từ khóa tìm kiếm là bắt buộc",
        };
      }

      const query = {
        $or: [
          { name: { $regex: keyword, $options: "i" } },
          { origin_name: { $regex: keyword, $options: "i" } },
          { author: { $regex: keyword, $options: "i" } },
        ],
        deletedAt: null,
      };

      const total = await Story.countDocuments(query);

      const stories = await Story.find(query)
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Tìm kiếm truyện thành công",
        data: {
          keyword,
          stories,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error(`Lỗi khi tìm kiếm truyện với từ khóa ${keyword}:`, error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi tìm kiếm truyện",
      };
    }
  }

  /**
   * Lấy thông tin chi tiết của một truyện
   * @param {string} slug Slug của truyện
   * @param {string} userId ID của người dùng (nếu đã đăng nhập)
   * @returns {Promise<Object>} Thông tin chi tiết truyện
   */
  static async getStoryDetail(slug, userId = null) {
    try {
      // Tìm truyện theo slug
      const story = await Story.findOne({ slug: slug, deletedAt: null })
        .populate("category", "name slug")
        .populate("authorId", "username");

      if (!story) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy truyện",
        };
      }

      // Lấy danh sách chương
      const chapters = await Chapter.find({
        storyId: story._id,
        deletedAt: null,
      })
        .sort({ chapterNumber: 1 })
        .select(
          "chapterNumber chapter_name chapter_title createdAt views likeCount"
        );

      // Tăng lượt xem
      await ViewCounter.incrementView({
        targetType: "story",
        targetId: story._id,
        userId,
        deviceType: "unknown", // Có thể lấy từ req.headers
        bucketType: "daily",
      });

      // Cập nhật views trong Story
      const { totalViews } = await ViewCounter.getTotalViews(
        "story",
        story._id
      );
      story.views = totalViews;
      await story.save();

      return {
        success: true,
        status: 200,
        message: "Lấy thông tin chi tiết truyện thành công",
        data: {
          story,
          chapters,
        },
      };
    } catch (error) {
      logger.error(`Lỗi khi lấy thông tin chi tiết truyện ${slug}:`, error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy thông tin chi tiết truyện",
      };
    }
  }

  /**
   * Lấy thông tin chapter và nội dung
   * @param {string} storySlug Slug của truyện
   * @param {number} chapterNumber Số thứ tự chương
   * @param {string} userId ID của người dùng (nếu đã đăng nhập)
   * @returns {Promise<Object>} Thông tin chi tiết chapter
   */
  static async getChapterDetail(storySlug, chapterNumber, userId = null) {
    try {
      // Tìm truyện theo slug
      const story = await Story.findOne({ slug: storySlug, deletedAt: null });
      if (!story) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy truyện",
        };
      }

      // Chuyển đổi chapterNumber sang số nguyên
      const chapterNum = parseInt(chapterNumber);

      // Kiểm tra chapterNumber hợp lệ (>= 0)
      if (chapterNum < 0) {
        return {
          success: false,
          status: 400,
          message: "Số chương không hợp lệ",
        };
      }

      // Tìm chapter
      const chapter = await Chapter.findOne({
        storyId: story._id,
        chapterNumber: chapterNum,
        deletedAt: null,
        isPublished: true,
      });

      if (!chapter) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy chương hoặc chương chưa được phát hành",
        };
      }

      // Lấy nội dung chapter nếu chưa có
      if (!chapter.content || chapter.content.length === 0) {
        try {
          const content = await chapterCrawler.getChapterContent(chapter._id);
          chapter.content = content;
          await chapter.save();
        } catch (crawlError) {
          logger.error(
            `Lỗi khi lấy nội dung chương ${chapter._id}:`,
            crawlError
          );
          // Tiếp tục trả về chapter mà không có content
        }
      }

      // Tăng lượt xem
      await ViewCounter.incrementView({
        targetType: "chapter",
        targetId: chapter._id,
        userId,
        deviceType: "unknown", // Có thể lấy từ req.headers
        bucketType: "daily",
      });

      // Cập nhật views trong Chapter
      const { totalViews } = await ViewCounter.getTotalViews(
        "chapter",
        chapter._id
      );
      chapter.views = totalViews;
      await chapter.save();

      // Lấy chapter trước và sau
      let prevChapter = null;
      let nextChapter = null;

      // Chỉ tìm chapter trước nếu chapterNumber > 0
      if (chapterNum > 0) {
        prevChapter = await Chapter.findOne({
          storyId: story._id,
          chapterNumber: { $lt: chapterNum },
          deletedAt: null,
          isPublished: true,
        })
          .sort({ chapterNumber: -1 })
          .select("chapterNumber chapter_name");
      }

      // Luôn tìm chapter sau
      nextChapter = await Chapter.findOne({
        storyId: story._id,
        chapterNumber: { $gt: chapterNum },
        deletedAt: null,
        isPublished: true,
      })
        .sort({ chapterNumber: 1 })
        .select("chapterNumber chapter_name");

      // Lưu lịch sử đọc nếu có userId
      if (userId) {
        await History.updateOne(
          { userId, storyId: story._id, chapterId: chapter._id },
          {
            $set: {
              readAt: new Date(),
              progress: 0, // Có thể cập nhật từ client
              isCompleted: false,
              deletedAt: null,
            },
          },
          { upsert: true }
        );
      }

      return {
        success: true,
        status: 200,
        message: "Lấy thông tin chi tiết chương thành công",
        data: {
          story: {
            id: story._id,
            name: story.name,
            slug: story.slug,
            thumb_url: story.thumb_url,
          },
          chapter,
          navigation: {
            prev: prevChapter,
            next: nextChapter,
          },
        },
      };
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin chương ${chapterNumber} của truyện ${storySlug}:`,
        error
      );
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy thông tin chi tiết chương",
      };
    }
  }
  /**
   * Lấy danh sách truyện đang phát hành
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async getOngoingStories(page = 1, limit = 20) {
    try {
      const total = await Story.countDocuments({
        status: "ongoing",
        deletedAt: null,
      });
      const totalStories = await Story.countDocuments({ deletedAt: null });

      const stories = await Story.find({
        status: "ongoing",
        deletedAt: null,
      })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện đang tiến hành thành công",
        data: {
          stories,
          totalStories, // Thêm tổng số truyện
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện đang phats hành:", error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện đang phát hành",
      };
    }
  }

  /**
   * Lấy danh sách truyện đã hoàn thành
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async getCompletedStories(page = 1, limit = 20) {
    try {
      const total = await Story.countDocuments({
        status: "completed",
        deletedAt: null,
      });
      const totalStories = await Story.countDocuments({ deletedAt: null });

      const stories = await Story.find({
        status: "completed",
        deletedAt: null,
      })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện đã hoàn thành thành công",
        data: {
          stories,
          totalStories, // Thêm tổng số truyện
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện đã hoàn thành:", error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện đã hoàn thành",
      };
    }
  }

  /**
   * Lấy danh sách truyện sắp ra mắt
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng truyện mỗi trang
   * @returns {Promise<Object>} Danh sách truyện và thông tin phân trang
   */
  static async getComingSoonStories(page = 1, limit = 20) {
    try {
      const total = await Story.countDocuments({
        status: "coming_soon",
        deletedAt: null,
      });

      const stories = await Story.find({
        status: "coming_soon",
        deletedAt: null,
      })
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select("name slug thumb_url status ratingValue ratingCount updatedAt")
        .populate("category", "name slug");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách truyện sắp ra mắt thành công",
        data: {
          stories,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện sắp ra mắt:", error);
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách truyện sắp ra mắt",
      };
    }
  }
  /**
   * Cập nhật số lượng truyện cho mỗi thể loại
   * @returns {Promise<void>}
   */
  static async updateStoryCount() {
    try {
      // Lấy tất cả các thể loại
      const categories = await Category.find({
        isActive: true,
        deletedAt: null,
      });

      // Duyệt qua từng thể loại và tính số lượng truyện
      for (const category of categories) {
        const storyCount = await Story.countDocuments({
          category: category._id,
          deletedAt: null,
        });

        // Cập nhật storyCount cho thể loại
        await Category.updateOne(
          { _id: category._id },
          { $set: { storyCount } }
        );
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật số lượng truyện cho thể loại:", error);
      throw error;
    }
  }
  /**
   * Lấy tất cả thể loại kèm số lượng truyện
   * @param {number} limit - Số lượng thể loại tối đa muốn lấy
   * @returns {Promise<Array>}
   */
  static async getCategoriesWithStoryCount(limit = 0) {
    try {
      let query = Category.find({ isActive: true, deletedAt: null })
        .select("name slug storyCount description")
        .sort({ storyCount: -1 });

      if (limit > 0) {
        query = query.limit(limit);
      }

      return await query;
    } catch (error) {
      console.error("Lỗi khi lấy danh sách thể loại:", error);
      throw error;
    }
  }

  /**
   * Lấy top 10 truyện có lượt xem cao nhất trong tuần
   * @returns {Promise<Object>} Danh sách truyện và thông tin
   */
  static async getTopWeeklyStories() {
    try {
      // Tính thời điểm 7 ngày trước
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Lấy top 10 truyện có lượt xem cao nhất trong tuần
      const stories = await Story.aggregate([
        // Match các truyện không bị xóa
        { $match: { deletedAt: null } },
        // Lookup để lấy thông tin lượt xem từ ViewCounter
        {
          $lookup: {
            from: "viewcounters",
            let: { storyId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$targetType", "story"] },
                      { $eq: ["$targetId", "$$storyId"] },
                      { $gte: ["$createdAt", oneWeekAgo] },
                    ],
                  },
                },
              },
            ],
            as: "weeklyViews",
          },
        },
        // Thêm trường weeklyViewCount
        {
          $addFields: {
            weeklyViewCount: { $size: "$weeklyViews" },
          },
        },
        // Sắp xếp theo weeklyViewCount giảm dần
        { $sort: { weeklyViewCount: -1 } },
        // Giới hạn 10 truyện
        { $limit: 10 },
        // Project các trường cần thiết
        {
          $project: {
            _id: 1,
            name: 1,
            slug: 1,
            thumb_url: 1,
            status: 1,
            ratingValue: 1,
            ratingCount: 1,
            weeklyViewCount: 1,
            category: 1,
          },
        },
      ]);

      // Populate thông tin category
      await Story.populate(stories, {
        path: "category",
        select: "name slug",
      });

      return {
        success: true,
        status: 200,
        message: "Lấy top 10 truyện xem nhiều nhất trong tuần thành công",
        data: {
          stories,
          period: {
            start: oneWeekAgo,
            end: new Date(),
          },
        },
      };
    } catch (error) {
      logger.error(
        "Lỗi khi lấy top 10 truyện xem nhiều nhất trong tuần:",
        error
      );
      return {
        success: false,
        status: 500,
        message:
          error.message ||
          "Lỗi khi lấy top 10 truyện xem nhiều nhất trong tuần",
      };
    }
  }
}

module.exports = StoryService;
