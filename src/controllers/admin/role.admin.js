/**
 * Controller cho quản lý phân quyền
 * Xử lý các logic cho API quản lý vai trò và quyền
 */

const logger = require("../utils/logger");
const roleService = require("../services/role.service");
const ApiResponse = require("../utils/ApiResponse"); // Import ApiResponse

class RoleController {
  /**
   * getRoles
   *
   * @desc    Lấy danh sách vai trò
   * @route   GET /api/admin/roles
   * @access  Admin
   */
  async getRoles(req, res) {
    try {
      const roles = await roleService.getRoles();

      return ApiResponse.success(
        res,
        roles,
        "Lấy danh sách vai trò thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách vai trò:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách vai trò",
        error.message
      );
    }
  }

  /**
   * getRoleById
   *
   * @desc    Lấy thông tin chi tiết của một vai trò
   * @route   GET /api/admin/roles/:id
   * @access  Admin
   */
  async getRoleById(req, res) {
    try {
      const role = await roleService.getRoleById(req.params.id);

      if (!role) {
        return ApiResponse.notFound(res, "Không tìm thấy vai trò");
      }

      return ApiResponse.success(res, role, "Lấy thông tin vai trò thành công");
    } catch (error) {
      logger.error(`Lỗi khi lấy thông tin vai trò ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy thông tin vai trò",
        error.message
      );
    }
  }

  /**
   * createRole
   *
   * @desc    Tạo vai trò mới
   * @route   POST /api/admin/roles
   * @access  Admin
   */
  async createRole(req, res) {
    try {
      const { name, description, permissions } = req.body;

      if (!name) {
        return ApiResponse.badRequest(res, "Tên vai trò là bắt buộc");
      }

      // Kiểm tra vai trò đã tồn tại chưa
      const roleExists = await roleService.checkRoleExists(name);
      if (roleExists) {
        return ApiResponse.conflict(res, "Vai trò này đã tồn tại");
      }

      // Tạo vai trò mới
      const newRole = await roleService.createRole({
        name,
        description: description || "",
        permissions: permissions || [],
      });

      return ApiResponse.created(res, newRole, "Tạo vai trò mới thành công");
    } catch (error) {
      logger.error("Lỗi khi tạo vai trò mới:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi tạo vai trò mới",
        error.message
      );
    }
  }

  /**
   * updateRole
   *
   * @desc    Cập nhật thông tin vai trò
   * @route   PUT /api/admin/roles/:id
   * @access  Admin
   */
  async updateRole(req, res) {
    try {
      const { name, description, permissions } = req.body;

      // Kiểm tra vai trò tồn tại
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        return ApiResponse.notFound(res, "Không tìm thấy vai trò");
      }

      // Kiểm tra nếu tên thay đổi, vai trò có trùng không
      if (name && name !== role.name) {
        const roleExists = await roleService.checkRoleExistsExcept(
          name,
          req.params.id
        );
        if (roleExists) {
          return ApiResponse.conflict(res, "Vai trò này đã tồn tại");
        }
      }

      // Cập nhật vai trò
      const updatedRole = await roleService.updateRole(req.params.id, {
        name,
        description,
        permissions,
      });

      return ApiResponse.success(
        res,
        updatedRole,
        "Cập nhật vai trò thành công"
      );
    } catch (error) {
      logger.error(`Lỗi khi cập nhật vai trò ID ${req.params.id}:`, error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi cập nhật vai trò",
        error.message
      );
    }
  }

  /**
   * deleteRole
   *
   * @desc    Xóa vai trò
   * @route   DELETE /api/admin/roles/:id
   * @access  Admin
   */
  async deleteRole(req, res) {
    try {
      // Kiểm tra vai trò tồn tại
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        return ApiResponse.notFound(res, "Không tìm thấy vai trò");
      }

      // Kiểm tra xem có người dùng nào đang sử dụng vai trò này không
      const usersCount = await roleService.countUsersByRole(role.name);
      if (usersCount > 0) {
        return ApiResponse.badRequest(
          res,
          `Không thể xóa vai trò này vì đang được sử dụng bởi ${usersCount} người dùng`
        );
      }

      // Xóa vai trò
      await roleService.deleteRole(req.params.id);

      return ApiResponse.success(res, null, "Xóa vai trò thành công");
    } catch (error) {
      logger.error(`Lỗi khi xóa vai trò ID ${req.params.id}:`, error);
      return ApiResponse.serverError(res, "Lỗi khi xóa vai trò", error.message);
    }
  }

  /**
   * getUsersByRole
   *
   * @desc    Lấy danh sách người dùng theo vai trò
   * @route   GET /api/admin/roles/:id/users
   * @access  Admin
   */
  async getUsersByRole(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      // Tìm vai trò
      const role = await roleService.getRoleById(req.params.id);
      if (!role) {
        return ApiResponse.notFound(res, "Không tìm thấy vai trò");
      }

      // Lấy danh sách người dùng theo vai trò
      const result = await roleService.getUsersByRole(role.name, {
        page: parseInt(page),
        limit: parseInt(limit),
      });

      // Sử dụng cấu trúc phù hợp cho dữ liệu phân trang
      return ApiResponse.paginated(
        res,
        result.users,
        result.pagination.totalItems,
        result.pagination.currentPage,
        result.pagination.pageSize,
        "Lấy danh sách người dùng theo vai trò thành công"
      );
    } catch (error) {
      logger.error(
        `Lỗi khi lấy danh sách người dùng theo vai trò ID ${req.params.id}:`,
        error
      );
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách người dùng theo vai trò",
        error.message
      );
    }
  }

  /**
   * getPermissionsList
   *
   * @desc    Lấy danh sách tất cả quyền có sẵn trong hệ thống
   * @route   GET /api/admin/roles/permissions/list
   * @access  Admin
   */
  async getPermissionsList(req, res) {
    try {
      const permissions = roleService.getSystemPermissions();

      return ApiResponse.success(
        res,
        permissions,
        "Lấy danh sách quyền thành công"
      );
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách quyền:", error);
      return ApiResponse.serverError(
        res,
        "Lỗi khi lấy danh sách quyền",
        error.message
      );
    }
  }
}

module.exports = new RoleController();
