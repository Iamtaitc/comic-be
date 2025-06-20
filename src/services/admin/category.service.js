/**
 * Service xử lý logic quản lý thể loại
 * Cung cấp các phương thức xử lý business logic cho thể loại
 */

const Category = require("../../models/Category.mongoose");
const Story = require("../../models/Story.mongoose");
const slugify = require("slugify");

class CategoryService {
  /**
   * Lấy danh sách thể loại với các tùy chọn sắp xếp và tìm kiếm
   *
   * @param {String} sort Trường sắp xếp
   * @param {String} order Thứ tự sắp xếp (asc/desc)
   * @param {String} search Từ khóa tìm kiếm
   * @returns {Array} Danh sách thể loại
   */
  async getCategories(sort = "name", order = "asc", search) {
    const query = {};

    // Xử lý tìm kiếm
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Sắp xếp
    const sortOptions = {};
    sortOptions[sort] = order === "asc" ? 1 : -1;

    return await Category.find(query).sort(sortOptions);
  }

  /**
   * Lấy thông tin chi tiết của một thể loại theo ID
   *
   * @param {String} categoryId ID của thể loại
   * @returns {Object} Thông tin thể loại
   */
  async getCategoryById(categoryId) {
    return await Category.findById(categoryId);
  }

  /**
   * Tạo thể loại mới
   *
   * @param {String} name Tên thể loại
   * @param {String} description Mô tả thể loại
   * @returns {Object} Kết quả tạo thể loại
   */
  async createCategory(name, description) {
    // Tạo slug từ tên
    const slug = slugify(name, {
      lower: true,
      strict: true,
      locale: "vi",
    });

    // Kiểm tra slug đã tồn tại chưa
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      return { error: "Thể loại này đã tồn tại" };
    }

    // Tạo thể loại mới
    const newCategory = new Category({
      name,
      slug,
      description: description || "",
    });

    await newCategory.save();

    return { category: newCategory };
  }

  /**
   * Cập nhật thông tin thể loại
   *
   * @param {String} categoryId ID của thể loại
   * @param {String} name Tên thể loại mới
   * @param {String} description Mô tả thể loại mới
   * @returns {Object} Kết quả cập nhật thể loại
   */
  async updateCategory(categoryId, name, description) {
    const category = await Category.findById(categoryId);

    if (!category) {
      return { notFound: true };
    }

    // Nếu tên thay đổi, cần cập nhật slug
    if (name && name !== category.name) {
      const newSlug = slugify(name, {
        lower: true,
        strict: true,
        locale: "vi",
      });

      // Kiểm tra slug mới đã tồn tại chưa
      const existingCategory = await Category.findOne({
        slug: newSlug,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        return { error: "Thể loại này đã tồn tại" };
      }

      category.name = name;
      category.slug = newSlug;

      // Cập nhật tất cả truyện có thể loại này
      await Story.updateMany(
        { "category.id": categoryId },
        {
          $set: {
            "category.$.name": name,
            "category.$.slug": newSlug,
          },
        }
      );
    }

    // Cập nhật mô tả
    if (description !== undefined) {
      category.description = description;
    }

    await category.save();

    return { category };
  }

  /**
   * Xóa thể loại
   *
   * @param {String} categoryId ID của thể loại
   * @returns {Object} Kết quả xóa thể loại
   */
  async deleteCategory(categoryId) {
    // Kiểm tra thể loại có tồn tại không
    const category = await Category.findById(categoryId);

    if (!category) {
      return { notFound: true };
    }

    // Kiểm tra xem có truyện nào đang sử dụng thể loại này không
    const StoryUsingCategory = await Story.countDocuments({
      "category.id": categoryId,
    });

    if (StoryUsingCategory > 0) {
      return { inUse: StoryUsingCategory };
    }

    // Xóa thể loại
    await Category.findByIdAndDelete(categoryId);

    return { success: true };
  }

  /**
   * Lấy danh sách truyện thuộc thể loại
   *
   * @param {String} categoryId ID của thể loại
   * @param {Number} page Trang hiện tại
   * @param {Number} limit Số lượng truyện mỗi trang
   * @returns {Object} Kết quả danh sách truyện thuộc thể loại
   */
  async getCategoryStory(categoryId, page = 1, limit = 20) {
    // Kiểm tra thể loại có tồn tại không
    const category = await Category.findById(categoryId);

    if (!category) {
      return { notFound: true };
    }

    // Tìm truyện thuộc thể loại
    const total = await Story.countDocuments({
      "category.id": categoryId,
    });

    const Story = await Story.find({
      "category.id": categoryId,
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name slug thumb_url status updatedAt");

    // Tạo đối tượng dữ liệu phân trang
    const data = {
      category,
      Story,
    };

    return {
      data,
      total,
    };
  }
}

module.exports = new CategoryService();
