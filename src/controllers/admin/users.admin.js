/**
 * Controller cho quản lý người dùng
 * Xử lý các logic cho API quản lý người dùng
 */

const logger = require("../../utils/logger");
const userService = require("../../services/admin/user.service");
const fs = require("fs");
const path = require("path");
const ApiResponse = require("../../utils/ApiResponse.utils");

class UserAdminController {
  /**
   * getUsers
   *
   * @desc    Lấy danh sách người dùng có phân trang và tìm kiếm
   * @route   GET /api/admin/users
   * @access  Admin
   */
  async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        isActive,
        sort = "createdAt",
        order = "desc",
      } = req.query;

      const result = await userService.getUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        role,
        isActive,
        sort,
        order,
      });

      return ApiResponse.paginated(
        res,
        result.users,
        result.pagination.totalItems,
        result.pagination.currentPage,
        result.pagination.pageSize,
        "Lấy danh sách người dùng thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách người dùng:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách người dùng",
        error.message
      );
    }
  }

  /**
   * getUserById
   *
   * @desc    Lấy thông tin chi tiết của một người dùng
   * @route   GET /api/admin/users/:id
   * @access  Admin
   */
  async getUserById(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);

      if (!user) {
        return ApiResponse.notFound(res, "Không tìm thấy người dùng");
      }

      return ApiResponse.success(
        res,
        user,
        "Lấy thông tin người dùng thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy thông tin người dùng ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin người dùng",
        error.message
      );
    }
  }

  /**
   * createUser
   *
   * @desc    Tạo người dùng mới
   * @route   POST /api/admin/users
   * @access  Admin
   */
  async createUser(req, res) {
    try {
      const { username, email, password, fullName, role } = req.body;
      const avatar = req.file ? req.file.filename : "default-avatar.jpg";

      const newUser = await userService.createUser({
        username,
        email,
        password,
        fullName,
        avatar,
        role,
      });

      return ApiResponse.created(res, newUser, "Tạo người dùng mới thành công");
    } catch (error) {
      // Nếu có lỗi và đã upload file, xóa file đã upload
      if (req.file) {
        const filePath = path.join("./uploads/avatars", req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Xử lý lỗi cụ thể
      if (error.code === "USER_EXISTS") {
        return ApiResponse.conflict(res, error.message);
      }

      if (error.code === "INVALID_ROLE") {
        return ApiResponse.badRequest(res, error.message);
      }

      // Lỗi server khác
      logger.error("Lỗi khi tạo người dùng mới:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạo người dùng mới",
        error.message
      );
    }
  }

  /**
   * updateUser
   *
   * @desc    Cập nhật thông tin người dùng
   * @route   PUT /api/admin/users/:id
   * @access  Admin
   */
  async updateUser(req, res) {
    try {
      const { fullName, email, role, isActive } = req.body;
      const avatar = req.file ? req.file.filename : undefined;

      const updatedUser = await userService.updateUser(req.params.id, {
        fullName,
        email,
        role,
        isActive,
        avatar,
      });

      return ApiResponse.success(
        res,
        updatedUser,
        "Cập nhật người dùng thành công"
      );
    } catch (error) {
      // Nếu có lỗi và đã upload file, xóa file đã upload
      if (req.file) {
        const filePath = path.join("./uploads/avatars", req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Xử lý lỗi cụ thể
      if (error.code === "USER_NOT_FOUND") {
        return ApiResponse.notFound(res, error.message);
      }

      if (error.code === "EMAIL_EXISTS") {
        return ApiResponse.conflict(res, error.message);
      }

      if (error.code === "INVALID_ROLE") {
        return ApiResponse.badRequest(res, error.message);
      }

      // Lỗi server khác
      logger.error(`Lỗi khi cập nhật người dùng ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật người dùng",
        error.message
      );
    }
  }

  /**
   * resetPassword
   *
   * @desc    Đặt lại mật khẩu cho người dùng
   * @route   PUT /api/admin/users/:id/password
   * @access  Admin
   */
  async resetPassword(req, res) {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return ApiResponse.badRequest(
          res,
          "Mật khẩu mới phải có ít nhất 6 ký tự"
        );
      }

      await userService.resetPassword(req.params.id, newPassword);

      return ApiResponse.success(res, null, "Đặt lại mật khẩu thành công");
    } catch (error) {
      // Xử lý lỗi cụ thể
      if (error.code === "USER_NOT_FOUND") {
        return ApiResponse.notFound(res, error.message);
      }

      // Lỗi server khác
      logger.error(
        `Lỗi khi đặt lại mật khẩu cho người dùng ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi đặt lại mật khẩu",
        error.message
      );
    }
  }

  /**
   * deleteUser
   *
   * @desc    Xóa người dùng
   * @route   DELETE /api/admin/users/:id
   * @access  Admin
   */
  async deleteUser(req, res) {
    try {
      await userService.deleteUser(req.params.id);

      return ApiResponse.success(res, null, "Xóa người dùng thành công");
    } catch (error) {
      // Xử lý lỗi cụ thể
      if (error.code === "USER_NOT_FOUND") {
        return ApiResponse.notFound(res, error.message);
      }

      if (error.code === "LAST_ADMIN") {
        return ApiResponse.badRequest(res, error.message);
      }

      // Lỗi server khác
      logger.error(`Lỗi khi xóa người dùng ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi xóa người dùng",
        error.message
      );
    }
  }

  /**
   * batchUpdateUsers
   *
   * @desc    Cập nhật hàng loạt người dùng
   * @route   POST /api/admin/users/batch-update
   * @access  Admin
   */
  async batchUpdateUsers(req, res) {
    try {
      const { ids, action, role, isActive } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return ApiResponse.badRequest(
          res,
          "Danh sách ID người dùng không hợp lệ"
        );
      }

      if (!action) {
        return ApiResponse.badRequest(res, "Hành động cập nhật là bắt buộc");
      }

      let result;

      switch (action) {
        case "delete":
          result = await userService.batchDeleteUsers(ids);
          return ApiResponse.success(
            res,
            { deletedCount: result.deletedCount },
            `Đã xóa ${result.deletedCount} người dùng`
          );

        case "update-role":
          if (!role) {
            return ApiResponse.badRequest(
              res,
              "Vai trò cần cập nhật là bắt buộc"
            );
          }

          result = await userService.batchUpdateUserRole(ids, role);
          return ApiResponse.success(
            res,
            { modifiedCount: result.modifiedCount },
            `Đã cập nhật vai trò cho ${result.modifiedCount} người dùng`
          );

        case "update-status":
          if (isActive === undefined) {
            return ApiResponse.badRequest(
              res,
              "Trạng thái cần cập nhật là bắt buộc"
            );
          }

          result = await userService.batchUpdateUserStatus(ids, isActive);
          return ApiResponse.success(
            res,
            { modifiedCount: result.modifiedCount },
            `Đã cập nhật trạng thái cho ${result.modifiedCount} người dùng`
          );

        default:
          return ApiResponse.badRequest(res, "Hành động không hợp lệ");
      }
    } catch (error) {
      // Xử lý lỗi cụ thể
      if (error.code === "INVALID_ROLE") {
        return ApiResponse.badRequest(res, error.message);
      }

      if (error.code === "ALL_ADMINS") {
        return ApiResponse.badRequest(res, error.message);
      }

      // Lỗi server khác
      logger.error("Lỗi khi cập nhật hàng loạt người dùng:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật hàng loạt người dùng",
        error.message
      );
    }
  }
}

module.exports = new UserAdminController();
