/**
 * Controller xử lý các chức năng liên quan đến truyện tranh
 */

const StoryService = require("../../services/comic/comic.service");
const logger = require("../../utils/logger");
const ApiResponse = require("../../utils/ApiResponse.utils");

class StoryController {
  /**
   * Lấy danh sách truyện mới cập nhật
   * @route   GET /api/Storys/latest
   * @access  Public
   * Todo: done
   */
  async getLatestStories(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await StoryService.getLatestStories(page, limit);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res, 
        result, 
        "Lấy danh sách truyện mới thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện mới:", error);
      return ApiResponse.serverError(
        res, 
        "Lỗi khi lấy danh sách truyện mới", 
        error.message
      );
    }
  }

  /**
   * Lấy danh sách truyện phổ biến
   * @route   GET /api/Storys/popular
   * @access  Public
   * Todo: done
   * @param {number} limit - Số lượng truyện muốn lấy
   */
  async getPopularStories(req, res) {
    try {
      const { limit = 10 } = req.query;
      const result = await StoryService.getPopularStories(limit);
      if (result.success == false) {
              return ApiResponse.badRequest(res, result.message);
            }
      return ApiResponse.success(
        res, 
        result, 
        "Lấy danh sách truyện phổ biến thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện phổ biến:", error);
      return ApiResponse.serverError(
        res, 
        "Lỗi khi lấy danh sách truyện phổ biến", 
        error.message
      );
    }
  }

  /**
   * Lấy danh sách truyện theo thể loại
   * @route   GET /api/Storys/category/:slug
   * @access  Public
   * todo: done
   */
  async getStoriesByCategory(req, res) {
    try {
      const { slug } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await StoryService.getStoriesByCategory(slug, page, limit);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result,
        `Lấy danh sách truyện theo thể loại ${result.category} thành công`
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách truyện theo thể loại ${req.params.slug}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện theo thể loại",
        error.message
      );
    }
  }

  /**
   * Tìm kiếm truyện
   * @route   GET /api/Storys/search
   * @access  Public
   * todo: done
   */
  async searchStories(req, res) {
    try {
      const { keyword, page = 1, limit = 20 } = req.query;

      if (!keyword) {
        return ApiResponse.badRequest(
          res,
          "Từ khóa tìm kiếm là bắt buộc"
        );
      }

      const result = await StoryService.searchStories(keyword, page, limit);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result,
        `Tìm kiếm truyện với từ khóa "${keyword}" thành công`
      );
    } catch (error) {
      logger.error(
        `Lỗi khi tìm kiếm truyện với từ khóa ${req.query.keyword}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi tìm kiếm truyện",
        error.message
      );
    }
  }

  /**
   * Lấy thông tin chi tiết của một truyện
   * @route   GET /api/comic/:slug
   * @access  Public
   */
  async getStoryDetail(req, res) {
    try {
      const { slug } = req.params;
      const result = await StoryService.getStoryDetail(slug);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }

      return ApiResponse.success(
        res,
        {
          story: result.data.story,
          chapters: result.data.chapters,
        },
        "Lấy thông tin chi tiết truyện thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin chi tiết truyện ${req.params.slug}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin chi tiết truyện",
        error.message
      );
    }
  }

  /**
   * Lấy thông tin chapter và nội dung
   * @route   GET /api/Storys/:slug/:chapterName
   * @access  Public
   */
  async getChapterDetail(req, res) {
    try {
      const { slug, chapterName } = req.params;

      // Lấy userId từ token nếu đã đăng nhập
      const userId = req.user ? req.user._id : null;
      const result = await StoryService.getChapterDetail(
        slug,
        chapterName,
        userId
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        {
          story: result.data.story,
          chapter: result.data.chapter,
          navigation: result.data.navigation,
        },
        "Lấy thông tin chapter thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin chapter ${req.params.chapterName} của truyện ${req.params.slug}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin chapter",
        error.message
      );
    }
  }
  //todo: done
  /**
   * Lấy dữ liệu cho trang chủ
   * @route   GET /api/home
   * @access  Public
   */
  async getHomeData(req, res) {
    try {
      // Lấy truyện mới cập nhật
      const latestStorys = await StoryService.getLatestStories(1, 10);

      // Lấy truyện phổ biến
      const popularStorys = await StoryService.getPopularStories(10);

      // Lấy danh sách thể loại
      const categories = await StoryService.getCategoriesWithStoryCount();

      return ApiResponse.success(
        res,
        {
          latestStorys,
          popularStorys,
          categories,
        },
        "Lấy dữ liệu trang chủ thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy dữ liệu trang chủ:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy dữ liệu trang chủ",
        error.message
      );
    }
  }
  /**
   * @route Get /api/comic/category
   * @access Public
   */
  async getCategory(req, res) {
    try {
      const result = await StoryService.getCategoriesWithStoryCount();
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        result,
        "Lấy danh sách thể loại thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách thể loại:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách thể loại",
        error.message
      );
    }
  }
  /**
   * Lấy danh sách đang phat hành
   * @route   GET /api/Ongoing
   * @access  Public
   */
  async getOngoing(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await StoryService.getOngoingStories(page, limit);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result,
        "Lấy danh sách truyện đang phát hành thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện đang phát hành:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện đang phát hành",
        error.message
      );
    }
  }
   /**
   * Lấy danh sách đã hoàn thành
   * @route   GET /api/Completed
   * @access  Public
   */

  async getCompleted(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await StoryService.getCompletedStories(page, limit);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.paginated(
        res,
        result,
        "Lấy danh sách truyện đã hoàn thành thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách truyện đã hoàn thành:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách truyện đã hoàn thành",
        error.message
      );
    }
  }
    /**
   * Lấy danh sách sắp ra mắt
   * @route   GET /api/sắp ra mắt
   * @access  Public
   */
    async getUpcoming(req, res) {
      try {
        const { page = 1, limit = 20 } = req.query;
        const result = await StoryService.getComingSoonStories(page, limit);
        if (result.success == false) {
          return ApiResponse.badRequest(res, result.message);
        }
        return ApiResponse.paginated(
          res,
          result,
          "Lấy danh sách truyện sắp ra mắt thành công"
        );
      } catch (error) {
        logger.error("Lỗi khi lấy danh sách truyện sắp ra mắt:", error);
        return ApiResponse.serverError(
          res,
          "Lỗi khi lấy danh sách truyện sắp ra mắt",
          error.message
        );
      }
    }

  /**
   * Lấy top 10 truyện có lượt xem cao nhất trong tuần
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async getTopWeeklyStories(req, res) {
    try {
      const result = await StoryService.getTopWeeklyStories();
      
      if (!result.success) {
        return res.status(result.status).json({
          success: false,
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        message: "Lấy top 10 truyện xem nhiều nhất trong tuần thành công",
        data: result.data
      });
    } catch (error) {
      logger.error("Lỗi khi xử lý yêu cầu lấy top truyện tuần:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy top truyện tuần"
      });
    }
  }
}

module.exports = new StoryController();