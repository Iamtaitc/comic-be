/**
 * Service cho quản lý chapter truyện tranh
 * Chứa tất cả logic nghiệp vụ liên quan đến chapter
 */

const Chapter = require("../../models/Chapter.mongoose");
const Story = require("../../models/Story.mongoose");
const fs = require("fs");
const logger = require("../../utils/logger");
const chapterCrawler = require("../../utils/ChapterContentCrawler");

class ChapterService {
  /**
   * Lấy danh sách chapter có phân trang và tìm kiếm
   * @param {Object} options Các tùy chọn lọc và phân trang
   * @returns {Object} Kết quả danh sách chapter và thông tin phân trang
   */
  async getChapters({ page, limit, search, StoryId, sort, order }) {
    const query = {};

    // Lọc theo truyện
    if (StoryId) {
      query.StoryId = StoryId;
    }

    // Xử lý tìm kiếm
    if (search) {
      query.$or = [
        { chapter_name: { $regex: search, $options: "i" } },
        { chapter_title: { $regex: search, $options: "i" } },
      ];
    }

    // Tính toán số lượng document để phân trang
    const total = await Chapter.countDocuments(query);

    // Sắp xếp
    const sortOptions = {};
    sortOptions[sort] = order === "asc" ? 1 : -1;

    // Lấy dữ liệu với phân trang
    const chapters = await Chapter.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("StoryId", "name slug")
      .select("chapter_name chapter_title StoryId createdAt updatedAt views");

    return {
      chapters,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy thông tin chi tiết của một chapter
   * @param {string} chapterId ID của chapter
   * @returns {Object} Thông tin chapter
   */
  async getChapterById(chapterId) {
    const chapter = await Chapter.findById(chapterId).populate(
      "StoryId",
      "name slug"
    );

    if (!chapter) {
      return null;
    }

    // Lấy nội dung chi tiết của chapter nếu chưa có
    if (!chapter.content || chapter.content.length === 0) {
      try {
        // Sử dụng chapterCrawler để lấy nội dung
        const content = await chapterCrawler.getChapterContent(chapterId);
        chapter.content = content;
      } catch (crawlError) {
        logger.error(
          `Lỗi khi cào nội dung chapter ID ${chapterId}:`,
          crawlError
        );
        // Không throw lỗi, vẫn tiếp tục trả về chapter mà không có content
      }
    }

    return chapter;
  }

  /**
   * Tạo chapter mới
   * @param {Object} chapterData Dữ liệu chapter mới
   * @returns {Object} Chapter đã được tạo
   */
  async createChapter({
    StoryId,
    chapter_name,
    chapter_title,
    chapter_api_data,
  }) {
    // Kiểm tra truyện có tồn tại không
    const Story = await Story.findById(StoryId);
    if (!Story) {
      const error = new Error("Không tìm thấy truyện");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Kiểm tra chapter_name đã tồn tại chưa
    const existingChapter = await Chapter.findOne({
      StoryId,
      chapter_name,
    });

    if (existingChapter) {
      const error = new Error("Chapter này đã tồn tại");
      error.code = "CONFLICT";
      throw error;
    }

    // Tạo chapter mới
    const newChapter = new Chapter({
      StoryId,
      chapter_name,
      chapter_title,
      chapter_api_data,
      content: [], // Mảng trống, sẽ được cập nhật sau
      server_name: "Server #1",
    });

    await newChapter.save();

    // Cập nhật thời gian cập nhật của truyện
    Story.updatedAt = new Date();
    await Story.save();

    return newChapter;
  }

  /**
   * Upload hình ảnh cho chapter
   * @param {string} chapterId ID của chapter
   * @param {Array} files Danh sách file đã upload
   * @returns {Object} Kết quả upload
   */
  async uploadChapterImages(chapterId, files) {
    const chapter = await Chapter.findById(chapterId);

    if (!chapter) {
      const error = new Error("Không tìm thấy chapter");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Lấy danh sách đường dẫn ảnh đã upload
    const imagePaths = files.map((file) => {
      // Tạo URL tương đối cho ảnh, ví dụ: /uploads/chapters/123/1/001.jpg
      return `/uploads/chapters/${chapter.StoryId}/${chapter.chapter_name}/${file.filename}`;
    });

    // Cập nhật danh sách ảnh của chapter
    chapter.content = imagePaths;
    chapter.updatedAt = new Date();
    await chapter.save();

    // Cập nhật thời gian cập nhật của truyện
    await Story.findByIdAndUpdate(chapter.StoryId, {
      updatedAt: new Date(),
    });

    return {
      chapter: chapter._id,
      imageCount: imagePaths.length,
      images: imagePaths,
    };
  }

  /**
   * Cập nhật thông tin chapter
   * @param {string} chapterId ID của chapter
   * @param {Object} updateData Dữ liệu cập nhật
   * @returns {Object} Chapter đã cập nhật
   */
  async updateChapter(chapterId, { chapter_name, chapter_title, content }) {
    const chapter = await Chapter.findById(chapterId);

    if (!chapter) {
      const error = new Error("Không tìm thấy chapter");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Kiểm tra nếu chapter_name thay đổi, cần đảm bảo không trùng
    if (chapter_name && chapter_name !== chapter.chapter_name) {
      const existingChapter = await Chapter.findOne({
        StoryId: chapter.StoryId,
        chapter_name,
        _id: { $ne: chapterId },
      });

      if (existingChapter) {
        const error = new Error("Tên chapter này đã tồn tại trong truyện");
        error.code = "CONFLICT";
        throw error;
      }

      chapter.chapter_name = chapter_name;
    }

    // Cập nhật các trường khác
    if (chapter_title !== undefined) chapter.chapter_title = chapter_title;
    if (content !== undefined) chapter.content = content;

    chapter.updatedAt = new Date();
    await chapter.save();

    // Cập nhật thời gian cập nhật của truyện
    await Story.findByIdAndUpdate(chapter.StoryId, {
      updatedAt: new Date(),
    });

    return chapter;
  }

  /**
   * Xóa chapter
   * @param {string} chapterId ID của chapter
   */
  async deleteChapter(chapterId) {
    const chapter = await Chapter.findById(chapterId);

    if (!chapter) {
      const error = new Error("Không tìm thấy chapter");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Xóa thư mục chứa ảnh của chapter nếu có
    const chapterDir = `./uploads/chapters/${chapter.StoryId}/${chapter.chapter_name}`;
    if (fs.existsSync(chapterDir)) {
      fs.rmdirSync(chapterDir, { recursive: true });
    }

    // Xóa chapter khỏi database
    await Chapter.findByIdAndDelete(chapterId);

    // Cập nhật thời gian cập nhật của truyện
    await Story.findByIdAndUpdate(chapter.StoryId, {
      updatedAt: new Date(),
    });
  }

  /**
   * Cào dữ liệu chapter từ API
   * @param {string} chapterId ID của chapter
   * @param {string} chapterApiUrl URL API mới (nếu có)
   * @returns {Object} Kết quả cào dữ liệu
   */
  async crawlChapter(chapterId, chapterApiUrl) {
    const chapter = await Chapter.findById(chapterId);

    if (!chapter) {
      const error = new Error("Không tìm thấy chapter");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Nếu có URL API mới, cập nhật vào chapter
    if (chapterApiUrl) {
      chapter.chapter_api_data = chapterApiUrl;
      await chapter.save();
    }

    // Kiểm tra nếu không có chapter_api_data
    if (!chapter.chapter_api_data) {
      const error = new Error("Không có URL API cho chapter này");
      error.code = "BAD_REQUEST";
      throw error;
    }

    // Sử dụng chapterCrawler để lấy nội dung
    const content = await chapterCrawler.getChapterContent(chapterId);

    return {
      chapterId,
      imageCount: content.length,
      images: content,
    };
  }

  /**
   * Cập nhật hàng loạt chapter
   * @param {Array} ids Danh sách ID chapter
   * @param {string} action Hành động cập nhật
   * @returns {Object} Kết quả cập nhật
   */
  async batchUpdateChapters(ids, action) {
    switch (action) {
      case "delete":
        // Xóa hàng loạt chapter
        const result = await Chapter.deleteMany({ _id: { $in: ids } });

        // Lấy danh sách StoryId bị ảnh hưởng
        const chapters = await Chapter.find({ _id: { $in: ids } }).select(
          "StoryId"
        );
        const StoryIds = [
          ...new Set(chapters.map((chapter) => chapter.StoryId)),
        ];

        // Cập nhật thời gian cập nhật cho các truyện bị ảnh hưởng
        if (StoryIds.length > 0) {
          await Story.updateMany(
            { _id: { $in: StoryIds } },
            { $set: { updatedAt: new Date() } }
          );
        }

        return { deletedCount: result.deletedCount };

      case "crawl":
        // Cào dữ liệu hàng loạt
        const crawlResults = {
          success: 0,
          failed: 0,
          errors: [],
        };

        for (const id of ids) {
          try {
            const chapter = await Chapter.findById(id);
            if (chapter && chapter.chapter_api_data) {
              await chapterCrawler.getChapterContent(id);
              crawlResults.success++;
            } else {
              crawlResults.failed++;
              crawlResults.errors.push({
                id,
                error: "Không có URL API hoặc chapter không tồn tại",
              });
            }
          } catch (error) {
            crawlResults.failed++;
            crawlResults.errors.push({
              id,
              error: error.message,
            });
          }
        }

        return crawlResults;

      default:
        const error = new Error("Hành động không hợp lệ");
        error.code = "BAD_REQUEST";
        throw error;
    }
  }

  /**
   * Sắp xếp lại thứ tự chapter
   * @param {string} StoryId ID của truyện
   * @param {Array} chapterOrder Thứ tự mới của các chapter
   */
  async reorderChapters(StoryId, chapterOrder) {
    // Kiểm tra truyện có tồn tại không
    const Story = await Story.findById(StoryId);
    if (!Story) {
      const error = new Error("Không tìm thấy truyện");
      error.code = "NOT_FOUND";
      throw error;
    }

    // Cập nhật thứ tự hiển thị cho từng chapter
    for (let i = 0; i < chapterOrder.length; i++) {
      await Chapter.findByIdAndUpdate(chapterOrder[i], {
        $set: { displayOrder: i },
      });
    }
  }
}

module.exports = new ChapterService();
