/**
 * Controller xác thực
 * Xử lý các chức năng đăng ký, đăng nhập, đổi mật khẩu
 */

const AuthService = require("../../services/auth/auth.service");
const logger = require("../../utils/logger");
const ApiResponse = require("../../utils/ApiResponse.utils");

class AuthController {
  /**
   * Đăng ký tài khoản mới
   * @route   POST /api/auth/register
   * @access  Public
   */
  async register(req, res) {
    try {
      const result = await AuthService.register(req.body);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.created(res, result, "Đăng ký thành công");
    } catch (error) {
      logger.error("Lỗi khi đăng ký tài khoản:", error);
      return this._handleError(res, error, "Lỗi khi đăng ký tài khoản");
    }
  }

  /**
   * Đăng nhập
   * @route   POST /api/auth/login
   * @access  Public
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Kiểm tra thông tin bắt buộc
      if (!username || !password) {
        return ApiResponse.badRequest(
          res,
          "Vui lòng cung cấp đầy đủ thông tin"
        );
      }

      const result = await AuthService.login(username, password);
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(res, result, "Đăng nhập thành công");
    } catch (error) {
      logger.error("Lỗi khi đăng nhập:", error);
      return this._handleError(res, error, "Lỗi khi đăng nhập");
    }
  }

  /**
   * Lấy thông tin người dùng hiện tại
   * @route   GET /api/auth/me
   * @access  Private
   */
  async getProfile(req, res) {
    try {
      // Thông tin người dùng đã được đính kèm trong middleware checkAuth
      const user = { ...req.user.toObject() };
      delete user.password;
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        user,
        "Lấy thông tin người dùng thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy thông tin người dùng:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin người dùng",
        error.message
      );
    }
  }

  /**
   * Đổi mật khẩu
   * @route   PUT /api/auth/change-password
   * @access  Private
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Kiểm tra thông tin bắt buộc
      if (!currentPassword || !newPassword) {
        return ApiResponse.badRequest(
          res,
          "Vui lòng cung cấp đầy đủ thông tin"
        );
      }
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      await AuthService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
      );
      return ApiResponse.success(res, null, "Đổi mật khẩu thành công");
    } catch (error) {
      logger.error("Lỗi khi đổi mật khẩu:", error);
      return this._handleError(res, error, "Lỗi khi đổi mật khẩu");
    }
  }

  /**
   * Cập nhật thông tin cá nhân
   * @route   PUT /api/auth/update-profile
   * @access  Private
   */
  async updateProfile(req, res) {
    try {
      const updatedUser = await AuthService.updateProfile(
        req.user._id,
        req.body
      );
      if (result.success == false) {
        return ApiResponse.badRequest(res, result.message);
      }
      return ApiResponse.success(
        res,
        updatedUser,
        "Cập nhật thông tin thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi cập nhật thông tin cá nhân:", error);
      return this._handleError(
        res,
        error,
        "Lỗi khi cập nhật thông tin cá nhân"
      );
    }
  }

  /**
   * Xử lý các lỗi chung
   * @private
   */
  _handleError(res, error, defaultMessage) {
    if (error.statusCode === 400) {
      return ApiResponse.badRequest(res, error.message);
    } else if (error.statusCode === 401) {
      return ApiResponse.unauthorized(res, error.message);
    } else if (error.statusCode === 403) {
      return ApiResponse.forbidden(res, error.message);
    } else if (error.statusCode === 404) {
      return ApiResponse.notFound(res, error.message);
    } else if (error.statusCode === 409) {
      return ApiResponse.conflict(res, error.message);
    } else {
      return ApiResponse.serverError(res, defaultMessage, error.message);
    }
  }
}

module.exports = new AuthController();
