/**
 * Service cho cấu hình hệ thống
 * Xử lý logic nghiệp vụ và tương tác với database
 */

const Setting = require("../models/Setting");

class SettingService {
  /**
   * getAllSettings
   *
   * Lấy tất cả cấu hình từ database và chuyển đổi thành object
   *
   * @returns {Promise<Object>} - Object chứa tất cả cấu hình
   */
  async getAllSettings() {
    const settings = await Setting.find();

    // Chuyển đổi mảng thành object để dễ sử dụng
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
  }

  /**
   * getSettingByKey
   *
   * Lấy một cấu hình cụ thể theo key
   *
   * @param {string} key - Key của cấu hình
   * @returns {Promise<Object|null>} - Cấu hình hoặc null nếu không tìm thấy
   */
  async getSettingByKey(key) {
    return await Setting.findOne({ key });
  }

  /**
   * updateMultipleSettings
   *
   * Cập nhật nhiều cấu hình cùng lúc
   *
   * @param {Object} settings - Object chứa các cấu hình cần cập nhật
   * @returns {Promise<void>}
   */
  async updateMultipleSettings(settings) {
    const updatePromises = Object.entries(settings).map(
      async ([key, value]) => {
        return Setting.findOneAndUpdate(
          { key },
          { key, value },
          { upsert: true, new: true }
        );
      }
    );

    await Promise.all(updatePromises);
  }

  /**
   * updateSetting
   *
   * Cập nhật một cấu hình
   *
   * @param {string} key - Key của cấu hình
   * @param {*} value - Giá trị mới của cấu hình
   * @returns {Promise<Object>} - Cấu hình đã cập nhật
   */
  async updateSetting(key, value) {
    return await Setting.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    );
  }

  /**
   * uploadSettingFile
   *
   * Upload file cấu hình (logo, favicon) và cập nhật đường dẫn vào database
   *
   * @param {string} type - Loại file (logo, favicon, banner)
   * @param {string} filename - Tên file đã upload
   * @returns {Promise<Object>} - Thông tin về file đã upload
   */
  async uploadSettingFile(type, filename) {
    let key;
    switch (type) {
      case "logo":
        key = "site_logo";
        break;
      case "favicon":
        key = "site_favicon";
        break;
      case "banner":
        key = "site_banner";
        break;
      default:
        key = type;
    }

    // Lưu đường dẫn file vào cấu hình
    const fileUrl = `/uploads/settings/${filename}`;
    await Setting.findOneAndUpdate(
      { key },
      { key, value: fileUrl },
      { upsert: true, new: true }
    );

    return {
      key,
      file: fileUrl,
    };
  }

  /**
   * getSiteInfo
   *
   * Lấy thông tin cấu hình website
   *
   * @returns {Promise<Object>} - Object chứa thông tin cấu hình website
   */
  async getSiteInfo() {
    // Lấy các cấu hình cơ bản của website
    const siteInfoKeys = [
      "site_name",
      "site_description",
      "site_logo",
      "site_favicon",
      "site_keywords",
      "site_email",
      "site_phone",
      "site_address",
      "site_copyright",
    ];

    const settings = await Setting.find({
      key: { $in: siteInfoKeys },
    });

    // Chuyển đổi mảng thành object
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
  }

  /**
   * updateSiteInfo
   *
   * Cập nhật thông tin cấu hình website
   *
   * @param {Object} siteInfo - Thông tin cấu hình website cần cập nhật
   * @param {string} siteInfo.site_name - Tên website
   * @param {string} siteInfo.site_description - Mô tả website
   * @param {string} siteInfo.site_keywords - Từ khóa website
   * @param {string} siteInfo.site_email - Email liên hệ
   * @param {string} siteInfo.site_phone - Số điện thoại liên hệ
   * @param {string} siteInfo.site_address - Địa chỉ
   * @param {string} siteInfo.site_copyright - Thông tin bản quyền
   * @returns {Promise<void>}
   */
  async updateSiteInfo({
    site_name,
    site_description,
    site_keywords,
    site_email,
    site_phone,
    site_address,
    site_copyright,
  }) {
    const updatePromises = [];

    if (site_name !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_name" },
          { key: "site_name", value: site_name },
          { upsert: true, new: true }
        )
      );
    }

    if (site_description !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_description" },
          { key: "site_description", value: site_description },
          { upsert: true, new: true }
        )
      );
    }

    if (site_keywords !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_keywords" },
          { key: "site_keywords", value: site_keywords },
          { upsert: true, new: true }
        )
      );
    }

    if (site_email !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_email" },
          { key: "site_email", value: site_email },
          { upsert: true, new: true }
        )
      );
    }

    if (site_phone !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_phone" },
          { key: "site_phone", value: site_phone },
          { upsert: true, new: true }
        )
      );
    }

    if (site_address !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_address" },
          { key: "site_address", value: site_address },
          { upsert: true, new: true }
        )
      );
    }

    if (site_copyright !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "site_copyright" },
          { key: "site_copyright", value: site_copyright },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(updatePromises);
  }

  /**
   * getSocialSettings
   *
   * Lấy cấu hình mạng xã hội
   *
   * @returns {Promise<Object>} - Object chứa cấu hình mạng xã hội
   */
  async getSocialSettings() {
    const socialKeys = [
      "social_facebook",
      "social_twitter",
      "social_instagram",
      "social_youtube",
      "social_tiktok",
      "social_discord",
    ];

    const settings = await Setting.find({
      key: { $in: socialKeys },
    });

    // Chuyển đổi mảng thành object
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
  }

  /**
   * updateSocialSettings
   *
   * Cập nhật cấu hình mạng xã hội
   *
   * @param {Object} socialSettings - Cấu hình mạng xã hội cần cập nhật
   * @param {string} socialSettings.social_facebook - Link Facebook
   * @param {string} socialSettings.social_twitter - Link Twitter
   * @param {string} socialSettings.social_instagram - Link Instagram
   * @param {string} socialSettings.social_youtube - Link YouTube
   * @param {string} socialSettings.social_tiktok - Link TikTok
   * @param {string} socialSettings.social_discord - Link Discord
   * @returns {Promise<void>}
   */
  async updateSocialSettings({
    social_facebook,
    social_twitter,
    social_instagram,
    social_youtube,
    social_tiktok,
    social_discord,
  }) {
    const updatePromises = [];

    if (social_facebook !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_facebook" },
          { key: "social_facebook", value: social_facebook },
          { upsert: true, new: true }
        )
      );
    }

    if (social_twitter !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_twitter" },
          { key: "social_twitter", value: social_twitter },
          { upsert: true, new: true }
        )
      );
    }

    if (social_instagram !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_instagram" },
          { key: "social_instagram", value: social_instagram },
          { upsert: true, new: true }
        )
      );
    }

    if (social_youtube !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_youtube" },
          { key: "social_youtube", value: social_youtube },
          { upsert: true, new: true }
        )
      );
    }

    if (social_tiktok !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_tiktok" },
          { key: "social_tiktok", value: social_tiktok },
          { upsert: true, new: true }
        )
      );
    }

    if (social_discord !== undefined) {
      updatePromises.push(
        Setting.findOneAndUpdate(
          { key: "social_discord" },
          { key: "social_discord", value: social_discord },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(updatePromises);
  }
}

module.exports = new SettingService();
