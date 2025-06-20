/**
 * Controller cho cấu hình hệ thống
 * Xử lý các logic cho API quản lý cấu hình
 */

const logger = require("../utils/logger");
const settingService = require("../services/setting.service");
const ApiResponse = require("../utils/ApiResponse"); // Import ApiResponse

class SettingController {
  /**
   * getAllSettings
   *
   * @desc    Lấy tất cả cấu hình
   * @route   GET /api/admin/settings
   * @access  Admin
   */
  async getAllSettings(req, res) {
    try {
      const settings = await settingService.getAllSettings();

      return ApiResponse.success(
        res,
        settings,
        "Lấy tất cả cấu hình thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy cấu hình:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy cấu hình",
        error.message
      );
    }
  }

  /**
   * getSettingByKey
   *
   * @desc    Lấy một cấu hình cụ thể theo key
   * @route   GET /api/admin/settings/:key
   * @access  Admin
   */
  async getSettingByKey(req, res) {
    try {
      const setting = await settingService.getSettingByKey(req.params.key);

      if (!setting) {
        return ApiResponse.notFound(res, "Không tìm thấy cấu hình");
      }

      return ApiResponse.success(res, setting, "Lấy cấu hình thành công");
    } catch (error) {
      logger.error(`Lỗi khi lấy cấu hình key ${req.params.key}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy cấu hình",
        error.message
      );
    }
  }

  /**
   * updateMultipleSettings
   *
   * @desc    Cập nhật nhiều cấu hình cùng lúc
   * @route   POST /api/admin/settings
   * @access  Admin
   */
  async updateMultipleSettings(req, res) {
    try {
      const settings = req.body;

      if (!settings || typeof settings !== "object") {
        return ApiResponse.badRequest(res, "Dữ liệu cấu hình không hợp lệ");
      }

      const updatedSettings = await settingService.updateMultipleSettings(
        settings
      );

      return ApiResponse.success(
        res,
        updatedSettings,
        "Cập nhật cấu hình thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi cập nhật cấu hình:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật cấu hình",
        error.message
      );
    }
  }

  /**
   * updateSetting
   *
   * @desc    Cập nhật một cấu hình
   * @route   PUT /api/admin/settings/:key
   * @access  Admin
   */
  async updateSetting(req, res) {
    try {
      const { value } = req.body;

      if (value === undefined) {
        return ApiResponse.badRequest(res, "Giá trị cấu hình là bắt buộc");
      }

      const setting = await settingService.updateSetting(req.params.key, value);

      if (!setting) {
        return ApiResponse.notFound(res, "Không tìm thấy cấu hình để cập nhật");
      }

      return ApiResponse.success(res, setting, "Cập nhật cấu hình thành công");
    } catch (error) {
      logger.error(`Lỗi khi cập nhật cấu hình key ${req.params.key}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật cấu hình",
        error.message
      );
    }
  }

  /**
   * uploadSettingFile
   *
   * @desc    Upload file cấu hình (logo, favicon)
   * @route   POST /api/admin/settings/upload
   * @access  Admin
   */
  async uploadSettingFile(req, res) {
    try {
      if (!req.file) {
        return ApiResponse.badRequest(res, "Không có file nào được tải lên");
      }

      const { type } = req.body;

      if (!type) {
        return ApiResponse.badRequest(res, "Loại file là bắt buộc");
      }

      const result = await settingService.uploadSettingFile(
        type,
        req.file.filename
      );

      return ApiResponse.success(res, result, "Upload file thành công");
    } catch (error) {
      logger.error("Lỗi khi upload file cấu hình:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi upload file cấu hình",
        error.message
      );
    }
  }

  /**
   * getSiteInfo
   *
   * @desc    Lấy thông tin cấu hình website
   * @route   GET /api/admin/settings/site-info
   * @access  Admin, Moderator, Editor
   */
  async getSiteInfo(req, res) {
    try {
      const siteInfo = await settingService.getSiteInfo();

      return ApiResponse.success(
        res,
        siteInfo,
        "Lấy thông tin cấu hình website thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thông tin cấu hình website:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin cấu hình website",
        error.message
      );
    }
  }

  /**
   * updateSiteInfo
   *
   * @desc    Cập nhật thông tin cấu hình website
   * @route   PUT /api/admin/settings/site-info
   * @access  Admin
   */
  async updateSiteInfo(req, res) {
    try {
      const {
        site_name,
        site_description,
        site_keywords,
        site_email,
        site_phone,
        site_address,
        site_copyright,
      } = req.body;

      const updatedInfo = await settingService.updateSiteInfo({
        site_name,
        site_description,
        site_keywords,
        site_email,
        site_phone,
        site_address,
        site_copyright,
      });

      return ApiResponse.success(
        res,
        updatedInfo,
        "Cập nhật thông tin website thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi cập nhật thông tin website:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật thông tin website",
        error.message
      );
    }
  }

  /**
   * getSocialSettings
   *
   * @desc    Lấy cấu hình mạng xã hội
   * @route   GET /api/admin/settings/social
   * @access  Admin
   */
  async getSocialSettings(req, res) {
    try {
      const socialSettings = await settingService.getSocialSettings();

      return ApiResponse.success(
        res,
        socialSettings,
        "Lấy cấu hình mạng xã hội thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy cấu hình mạng xã hội:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy cấu hình mạng xã hội",
        error.message
      );
    }
  }

  /**
   * updateSocialSettings
   *
   * @desc    Cập nhật cấu hình mạng xã hội
   * @route   PUT /api/admin/settings/social
   * @access  Admin
   */
  async updateSocialSettings(req, res) {
    try {
      const {
        social_facebook,
        social_twitter,
        social_instagram,
        social_youtube,
        social_tiktok,
        social_discord,
      } = req.body;

      const updatedSettings = await settingService.updateSocialSettings({
        social_facebook,
        social_twitter,
        social_instagram,
        social_youtube,
        social_tiktok,
        social_discord,
      });

      return ApiResponse.success(
        res,
        updatedSettings,
        "Cập nhật cấu hình mạng xã hội thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi cập nhật cấu hình mạng xã hội:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật cấu hình mạng xã hội",
        error.message
      );
    }
  }
}

module.exports = new SettingController();