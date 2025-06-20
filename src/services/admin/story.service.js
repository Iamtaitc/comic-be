/**
 * Service xử lý logic cho quản lý truyện tranh
 * Cung cấp các hàm cho CRUD truyện và quản lý chapters
 */

const Story = require("../models/Story");
const Category = require("../models/Category");
const Chapter = require("../models/Chapter");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const logger = require("../utils/logger");

class StoryService {
  /**
   * Lấy danh sách truyện có phân trang và tìm kiếm
   * @param {Object} options - Các tùy chọn tìm kiếm và phân trang
   * @returns {Object} Danh sách truyện và thông tin phân trang
   */
  async getStory(options) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      category,
      sort = "updatedAt",
      order = "desc",
    } = options;

    const query = {};

    // Xử lý tìm kiếm
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { origin_name: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }

    // Lọc theo trạng thái
    if (status) {
      query.status = status;
    }

    // Lọc theo thể loại
    if (category) {
      query["category.id"] = category;
    }

    // Tính toán số lượng document để phân trang
    const total = await Story.countDocuments(query);

    // Sắp xếp
    const sortOptions = {};
    sortOptions[sort] = order === "asc" ? 1 : -1;

    // Lấy dữ liệu với phân trang
    const Story = await Story.find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select(
        "name slug origin_name thumb_url status updatedAt author category"
      );

    return {
      Story,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  /**
   * Lấy thông tin chi tiết của một truyện
   * @param {String} id - ID của truyện
   * @returns {Object} Thông tin chi tiết truyện
   */
  async getStoryById(id) {
    const Story = await Story.findById(id);
    if (!Story) {
      return null;
    }
    return Story;
  }

  /**
   * Tạo truyện mới
   * @param {Object} StoryData - Thông tin truyện cần tạo
   * @param {Object} thumbFile - File ảnh thumbnail
   * @returns {Object} Truyện mới được tạo
   */
  async createStory(StoryData, thumbFile) {
    const { name, origin_name, content, status, author, categories } =
      StoryData;

    // Tạo slug từ tên truyện
    let slug = slugify(name, {
      lower: true,
      strict: true,
      locale: "vi",
    });

    // Kiểm tra slug đã tồn tại chưa
    const existingStory = await Story.findOne({ slug });
    if (existingStory) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Xử lý thể loại
    let categoryArray = [];
    if (categories) {
      const categoryIds =
        typeof categories === "string" ? JSON.parse(categories) : categories;

      for (const categoryId of categoryIds) {
        const category = await Category.findById(categoryId);
        if (category) {
          categoryArray.push({
            id: category._id,
            name: category.name,
            slug: category.slug,
          });
        }
      }
    }

    // Xử lý author từ string thành array
    let authorArray = [];
    if (author) {
      authorArray = author.split(",").map((a) => a.trim());
    }

    // Tạo đối tượng truyện mới
    const newStory = new Story({
      name,
      slug,
      origin_name: origin_name ? [origin_name] : [],
      content: content || "",
      status: status || "ongoing",
      thumb_url: thumbFile ? thumbFile.filename : "default-thumb.jpg",
      author: authorArray,
      category: categoryArray,
    });

    await newStory.save();
    return newStory;
  }

  /**
   * Cập nhật thông tin truyện
   * @param {String} id - ID của truyện
   * @param {Object} StoryData - Thông tin cần cập nhật
   * @param {Object} thumbFile - File ảnh thumbnail mới (nếu có)
   * @returns {Object} Truyện sau khi cập nhật
   */
  async updateStory(id, StoryData, thumbFile) {
    const Story = await Story.findById(id);

    if (!Story) {
      return null;
    }

    const { name, origin_name, content, status, author, categories } =
      StoryData;

    // Cập nhật slug nếu tên thay đổi
    if (name && name !== Story.name) {
      let newSlug = slugify(name, {
        lower: true,
        strict: true,
        locale: "vi",
      });

      // Kiểm tra slug đã tồn tại chưa
      const existingStory = await Story.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });
      if (existingStory) {
        newSlug = `${newSlug}-${Date.now().toString().slice(-4)}`;
      }

      Story.slug = newSlug;
    }

    // Cập nhật các trường khác
    if (name) Story.name = name;
    if (content) Story.content = content;
    if (status) Story.status = status;

    // Cập nhật origin_name
    if (origin_name) {
      Story.origin_name = [origin_name];
    }

    // Cập nhật author
    if (author) {
      Story.author = author.split(",").map((a) => a.trim());
    }

    // Cập nhật ảnh thumbnail nếu có
    if (thumbFile) {
      // Xóa ảnh cũ nếu không phải ảnh mặc định
      if (Story.thumb_url && Story.thumb_url !== "default-thumb.jpg") {
        const oldImagePath = path.join("./uploads/Story", Story.thumb_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      Story.thumb_url = thumbFile.filename;
    }

    // Cập nhật thể loại
    if (categories) {
      const categoryIds =
        typeof categories === "string" ? JSON.parse(categories) : categories;
      const categoryArray = [];

      for (const categoryId of categoryIds) {
        const category = await Category.findById(categoryId);
        if (category) {
          categoryArray.push({
            id: category._id,
            name: category.name,
            slug: category.slug,
          });
        }
      }

      Story.category = categoryArray;
    }

    // Cập nhật thời gian
    Story.updatedAt = new Date();

    await Story.save();
    return Story;
  }

  /**
   * Xóa truyện và các chapter liên quan
   * @param {String} id - ID của truyện
   * @returns {Boolean} Kết quả xóa
   */
  async deleteStory(id) {
    const Story = await Story.findById(id);

    if (!Story) {
      return false;
    }

    // Xóa ảnh thumbnail
    if (Story.thumb_url && Story.thumb_url !== "default-thumb.jpg") {
      const imagePath = path.join("./uploads/Story", Story.thumb_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Xóa tất cả các chapter liên quan
    await Chapter.deleteMany({ StoryId: id });

    // Xóa truyện
    await Story.findByIdAndDelete(id);

    return true;
  }

  /**
   * Lấy danh sách chapter của một truyện
   * @param {String} StoryId - ID của truyện
   * @returns {Array} Danh sách chapter
   */
  async getStoryChapters(StoryId) {
    return await Chapter.find({ StoryId })
      .sort({ chapter_name: 1 })
      .select("chapter_name chapter_title createdAt updatedAt views");
  }

  /**
   * Cập nhật hàng loạt trạng thái truyện
   * @param {Array} ids - Danh sách ID truyện
   * @param {String} status - Trạng thái mới
   * @returns {Object} Kết quả cập nhật
   */
  async batchUpdateStatus(ids, status) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error("Danh sách ID truyện không hợp lệ");
    }

    // Cập nhật hàng loạt
    const result = await Story.updateMany(
      { _id: { $in: ids } },
      { $set: { status, updatedAt: new Date() } }
    );

    return {
      modifiedCount: result.modifiedCount,
    };
  }
}

module.exports = new StoryService();
