/**
 * Service cho quản lý phân quyền
 * Xử lý logic nghiệp vụ và tương tác với database
 */

const Role = require("../models/Role");
const User = require("../models/User");

class RoleService {
  /**
   * getRoles
   *
   * Lấy danh sách tất cả vai trò
   *
   * @returns {Promise<Array>} - Danh sách vai trò
   */
  async getRoles() {
    return await Role.find();
  }

  /**
   * getRoleById
   *
   * Lấy thông tin chi tiết của một vai trò
   *
   * @param {string} roleId - ID của vai trò
   * @returns {Promise<Object|null>} - Thông tin vai trò hoặc null nếu không tìm thấy
   */
  async getRoleById(roleId) {
    return await Role.findById(roleId);
  }

  /**
   * checkRoleExists
   *
   * Kiểm tra vai trò đã tồn tại chưa
   *
   * @param {string} roleName - Tên vai trò cần kiểm tra
   * @returns {Promise<boolean>} - true nếu vai trò đã tồn tại, false nếu chưa
   */
  async checkRoleExists(roleName) {
    const role = await Role.findOne({ name: roleName });
    return !!role;
  }

  /**
   * checkRoleExistsExcept
   *
   * Kiểm tra vai trò đã tồn tại chưa (trừ vai trò có ID cụ thể)
   *
   * @param {string} roleName - Tên vai trò cần kiểm tra
   * @param {string} exceptRoleId - ID của vai trò cần loại trừ
   * @returns {Promise<boolean>} - true nếu vai trò đã tồn tại, false nếu chưa
   */
  async checkRoleExistsExcept(roleName, exceptRoleId) {
    const role = await Role.findOne({
      name: roleName,
      _id: { $ne: exceptRoleId },
    });
    return !!role;
  }

  /**
   * createRole
   *
   * Tạo vai trò mới
   *
   * @param {Object} roleData - Dữ liệu vai trò mới
   * @param {string} roleData.name - Tên vai trò
   * @param {string} roleData.description - Mô tả vai trò
   * @param {Array} roleData.permissions - Danh sách quyền của vai trò
   * @returns {Promise<Object>} - Thông tin vai trò đã tạo
   */
  async createRole(roleData) {
    const newRole = new Role(roleData);
    return await newRole.save();
  }

  /**
   * updateRole
   *
   * Cập nhật thông tin vai trò
   *
   * @param {string} roleId - ID của vai trò
   * @param {Object} roleData - Dữ liệu cập nhật
   * @param {string} roleData.name - Tên vai trò
   * @param {string} roleData.description - Mô tả vai trò
   * @param {Array} roleData.permissions - Danh sách quyền của vai trò
   * @returns {Promise<Object|null>} - Thông tin vai trò đã cập nhật hoặc null nếu không tìm thấy
   */
  async updateRole(roleId, roleData) {
    const role = await Role.findById(roleId);

    if (!role) {
      return null;
    }

    // Cập nhật các trường
    if (roleData.name !== undefined) role.name = roleData.name;
    if (roleData.description !== undefined)
      role.description = roleData.description;
    if (roleData.permissions !== undefined)
      role.permissions = roleData.permissions;

    return await role.save();
  }

  /**
   * deleteRole
   *
   * Xóa vai trò
   *
   * @param {string} roleId - ID của vai trò
   * @returns {Promise<void>}
   */
  async deleteRole(roleId) {
    await Role.findByIdAndDelete(roleId);
  }

  /**
   * countUsersByRole
   *
   * Đếm số lượng người dùng có vai trò cụ thể
   *
   * @param {string} roleName - Tên vai trò
   * @returns {Promise<number>} - Số lượng người dùng có vai trò
   */
  async countUsersByRole(roleName) {
    return await User.countDocuments({ role: roleName });
  }

  /**
   * getUsersByRole
   *
   * Lấy danh sách người dùng theo vai trò có phân trang
   *
   * @param {string} roleName - Tên vai trò
   * @param {Object} options - Tùy chọn phân trang
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng mục trên mỗi trang
   * @returns {Promise<Object>} - Kết quả bao gồm danh sách người dùng và thông tin phân trang
   */
  async getUsersByRole(roleName, { page, limit }) {
    // Đếm tổng số người dùng có vai trò này
    const total = await User.countDocuments({ role: roleName });

    // Lấy danh sách người dùng có phân trang
    const users = await User.find({ role: roleName })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-password");

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * getSystemPermissions
   *
   * Lấy danh sách tất cả quyền có sẵn trong hệ thống
   *
   * @returns {Array} - Danh sách quyền
   */
  getSystemPermissions() {
    // Danh sách tất cả quyền có sẵn trong hệ thống
    // Các quyền này cần đồng bộ với middleware kiểm tra quyền
    return [
      // Quyền quản lý truyện
      {
        group: "Storys",
        name: "Quản lý truyện",
        permissions: [
          { value: "Storys.view", name: "Xem truyện" },
          { value: "Storys.create", name: "Tạo truyện mới" },
          { value: "Storys.edit", name: "Chỉnh sửa truyện" },
          { value: "Storys.delete", name: "Xóa truyện" },
        ],
      },
      // Quyền quản lý chapter
      {
        group: "chapters",
        name: "Quản lý chapter",
        permissions: [
          { value: "chapters.view", name: "Xem chapter" },
          { value: "chapters.create", name: "Tạo chapter mới" },
          { value: "chapters.edit", name: "Chỉnh sửa chapter" },
          { value: "chapters.delete", name: "Xóa chapter" },
        ],
      },
      // Quyền quản lý thể loại
      {
        group: "categories",
        name: "Quản lý thể loại",
        permissions: [
          { value: "categories.view", name: "Xem thể loại" },
          { value: "categories.create", name: "Tạo thể loại mới" },
          { value: "categories.edit", name: "Chỉnh sửa thể loại" },
          { value: "categories.delete", name: "Xóa thể loại" },
        ],
      },
      // Quyền quản lý người dùng
      {
        group: "users",
        name: "Quản lý người dùng",
        permissions: [
          { value: "users.view", name: "Xem người dùng" },
          { value: "users.create", name: "Tạo người dùng mới" },
          { value: "users.edit", name: "Chỉnh sửa người dùng" },
          { value: "users.delete", name: "Xóa người dùng" },
        ],
      },
      // Quyền quản lý bình luận
      {
        group: "comments",
        name: "Quản lý bình luận",
        permissions: [
          { value: "comments.view", name: "Xem bình luận" },
          { value: "comments.approve", name: "Duyệt bình luận" },
          { value: "comments.edit", name: "Chỉnh sửa bình luận" },
          { value: "comments.delete", name: "Xóa bình luận" },
        ],
      },
      // Quyền quản lý cấu hình
      {
        group: "settings",
        name: "Quản lý cấu hình",
        permissions: [
          { value: "settings.view", name: "Xem cấu hình" },
          { value: "settings.edit", name: "Chỉnh sửa cấu hình" },
        ],
      },
      // Quyền quản lý crawler
      {
        group: "crawler",
        name: "Quản lý crawler",
        permissions: [
          { value: "crawler.view", name: "Xem trạng thái crawler" },
          { value: "crawler.start", name: "Khởi động crawler" },
          { value: "crawler.stop", name: "Dừng crawler" },
        ],
      },
    ];
  }
}

module.exports = new RoleService();
