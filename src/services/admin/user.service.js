/**
 * Service cho quản lý người dùng
 * Xử lý logic nghiệp vụ và tương tác với database
 */

const User = require("../../models/User.mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

class UserService {
  /**
   * getUsers
   *
   * Lấy danh sách người dùng có phân trang và tìm kiếm
   *
   * @param {Object} options - Các tùy chọn để lấy danh sách người dùng
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng mục trên mỗi trang
   * @param {string} options.search - Từ khóa tìm kiếm
   * @param {string} options.role - Lọc theo vai trò
   * @param {boolean|string} options.isActive - Lọc theo trạng thái
   * @param {string} options.sort - Trường để sắp xếp
   * @param {string} options.order - Thứ tự sắp xếp (asc/desc)
   * @returns {Promise<Object>} - Kết quả với danh sách người dùng và thông tin phân trang
   */
  async getUsers({ page, limit, search, role, isActive, sort, order }) {
    try {
      const query = {};

      // Xử lý tìm kiếm
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
        ];
      }

      // Lọc theo vai trò
      if (role) {
        query.role = role;
      }

      // Lọc theo trạng thái
      if (isActive !== undefined) {
        query.isActive = isActive === "true" || isActive === true;
      }

      // Tính toán số lượng document để phân trang
      const total = await User.countDocuments(query);

      // Sắp xếp
      const sortOptions = {};
      sortOptions[sort] = order === "asc" ? 1 : -1;

      // Lấy dữ liệu với phân trang
      const users = await User.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-password"); // Không trả về mật khẩu

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách người dùng thành công",
        data: {
          users,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy danh sách người dùng",
      };
    }
  }

  /**
   * getUserById
   *
   * Lấy thông tin chi tiết của một người dùng
   *
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Object>} - Thông tin người dùng hoặc thông báo lỗi
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).select("-password");

      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      return {
        success: true,
        status: 200,
        message: "Lấy thông tin người dùng thành công",
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi lấy thông tin người dùng",
      };
    }
  }

  /**
   * createUser
   *
   * Tạo người dùng mới
   *
   * @param {Object} userData - Dữ liệu người dùng mới
   * @param {string} userData.username - Tên đăng nhập
   * @param {string} userData.email - Email
   * @param {string} userData.password - Mật khẩu
   * @param {string} userData.fullName - Họ tên đầy đủ
   * @param {string} userData.avatar - Tên file ảnh đại diện
   * @param {string} userData.role - Vai trò
   * @returns {Promise<Object>} - Thông tin người dùng đã tạo hoặc thông báo lỗi
   */
  async createUser({ username, email, password, fullName, avatar, role }) {
    try {
      // Kiểm tra username và email đã tồn tại chưa
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        return {
          success: false,
          status: 400,
          message: "Username hoặc email đã tồn tại",
        };
      }

      // Kiểm tra vai trò có hợp lệ không
      const validRoles = ["user", "moderator", "editor", "admin"];
      if (role && !validRoles.includes(role)) {
        return {
          success: false,
          status: 400,
          message: "Vai trò không hợp lệ",
        };
      }

      // Hash mật khẩu
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Tạo người dùng mới
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        fullName: fullName || "",
        avatar: avatar || "default-avatar.jpg",
        role: role || "user",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newUser.save();

      // Không trả về mật khẩu
      const userResponse = { ...newUser.toObject() };
      delete userResponse.password;

      return {
        success: true,
        status: 201,
        message: "Tạo người dùng thành công",
        data: userResponse,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi tạo người dùng",
      };
    }
  }

  /**
   * updateUser
   *
   * Cập nhật thông tin người dùng
   *
   * @param {string} userId - ID của người dùng
   * @param {Object} userData - Dữ liệu cập nhật
   * @param {string} userData.fullName - Họ tên đầy đủ
   * @param {string} userData.email - Email
   * @param {string} userData.role - Vai trò
   * @param {boolean|string} userData.isActive - Trạng thái
   * @param {string} userData.avatar - Tên file ảnh đại diện mới
   * @returns {Promise<Object>} - Thông tin người dùng đã cập nhật hoặc thông báo lỗi
   */
  async updateUser(userId, { fullName, email, role, isActive, avatar }) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      // Kiểm tra email đã tồn tại chưa
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return {
            success: false,
            status: 400,
            message: "Email đã tồn tại",
          };
        }

        user.email = email;
      }

      // Cập nhật các trường khác
      if (fullName !== undefined) user.fullName = fullName;
      if (role !== undefined) {
        // Kiểm tra vai trò có hợp lệ không
        const validRoles = ["user", "moderator", "editor", "admin"];
        if (!validRoles.includes(role)) {
          return {
            success: false,
            status: 400,
            message: "Vai trò không hợp lệ",
          };
        }

        user.role = role;
      }
      if (isActive !== undefined)
        user.isActive = isActive === "true" || isActive === true;

      // Cập nhật avatar nếu có
      if (avatar) {
        // Xóa avatar cũ nếu không phải avatar mặc định
        if (user.avatar && user.avatar !== "default-avatar.jpg") {
          const oldAvatarPath = path.join("./uploads/avatars", user.avatar);
          if (fs.existsSync(oldAvatarPath)) {
            fs.unlinkSync(oldAvatarPath);
          }
        }

        user.avatar = avatar;
      }

      user.updatedAt = new Date();
      await user.save();

      // Không trả về mật khẩu
      const userResponse = { ...user.toObject() };
      delete userResponse.password;

      return {
        success: true,
        status: 200,
        message: "Cập nhật người dùng thành công",
        data: userResponse,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi cập nhật người dùng",
      };
    }
  }

  /**
   * resetPassword
   *
   * Đặt lại mật khẩu cho người dùng
   *
   * @param {string} userId - ID của người dùng
   * @param {string} newPassword - Mật khẩu mới
   * @returns {Promise<Object>} - Kết quả đặt lại mật khẩu
   */
  async resetPassword(userId, newPassword) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.updatedAt = new Date();
      await user.save();

      return {
        success: true,
        status: 200,
        message: "Đặt lại mật khẩu thành công",
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi đặt lại mật khẩu",
      };
    }
  }

  /**
   * deleteUser
   *
   * Xóa người dùng
   *
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Object>} - Kết quả xóa người dùng
   */
  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      // Không cho phép xóa tài khoản admin cuối cùng
      if (user.role === "admin") {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
          return {
            success: false,
            status: 400,
            message: "Không thể xóa tài khoản admin cuối cùng",
          };
        }
      }

      // Xóa avatar nếu không phải avatar mặc định
      if (user.avatar && user.avatar !== "default-avatar.jpg") {
        const avatarPath = path.join("./uploads/avatars", user.avatar);
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      await User.findByIdAndDelete(userId);

      return {
        success: true,
        status: 200,
        message: "Xóa người dùng thành công",
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi xóa người dùng",
      };
    }
  }

  /**
   * batchDeleteUsers
   *
   * Xóa hàng loạt người dùng
   *
   * @param {Array<string>} userIds - Danh sách ID người dùng cần xóa
   * @returns {Promise<Object>} - Kết quả với số lượng đã xóa
   */
  async batchDeleteUsers(userIds) {
    try {
      // Kiểm tra có đang xóa admin cuối cùng không
      if (userIds.length > 0) {
        const adminIds = await User.find({
          _id: { $in: userIds },
          role: "admin",
        }).select("_id");

        if (adminIds.length > 0) {
          const totalAdmins = await User.countDocuments({ role: "admin" });
          if (totalAdmins <= adminIds.length) {
            return {
              success: false,
              status: 400,
              message: "Không thể xóa tất cả tài khoản admin",
            };
          }
        }
      }

      // Xóa avatar của các user bị xóa
      const usersToDelete = await User.find({ _id: { $in: userIds } }).select(
        "avatar"
      );
      for (const user of usersToDelete) {
        if (user.avatar && user.avatar !== "default-avatar.jpg") {
          const avatarPath = path.join("./uploads/avatars", user.avatar);
          if (fs.existsSync(avatarPath)) {
            fs.unlinkSync(avatarPath);
          }
        }
      }

      // Xóa hàng loạt user
      const result = await User.deleteMany({ _id: { $in: userIds } });

      return {
        success: true,
        status: 200,
        message: "Xóa hàng loạt người dùng thành công",
        data: { deletedCount: result.deletedCount },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi xóa hàng loạt người dùng",
      };
    }
  }

  /**
   * batchUpdateUserRole
   *
   * Cập nhật hàng loạt vai trò người dùng
   *
   * @param {Array<string>} userIds - Danh sách ID người dùng cần cập nhật
   * @param {string} role - Vai trò mới
   * @returns {Promise<Object>} - Kết quả với số lượng đã cập nhật
   */
  async batchUpdateUserRole(userIds, role) {
    try {
      // Kiểm tra vai trò có hợp lệ không
      const validRoles = ["user", "moderator", "editor", "admin"];
      if (!validRoles.includes(role)) {
        return {
          success: false,
          status: 400,
          message: "Vai trò không hợp lệ",
        };
      }

      // Cập nhật hàng loạt vai trò
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { role, updatedAt: new Date() } }
      );

      return {
        success: true,
        status: 200,
        message: "Cập nhật vai trò hàng loạt thành công",
        data: { modifiedCount: result.modifiedCount },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi cập nhật vai trò hàng loạt",
      };
    }
  }

  /**
   * batchUpdateUserStatus
   *
   * Cập nhật hàng loạt trạng thái người dùng
   *
   * @param {Array<string>} userIds - Danh sách ID người dùng cần cập nhật
   * @param {boolean|string} isActive - Trạng thái mới
   * @returns {Promise<Object>} - Kết quả với số lượng đã cập nhật
   */
  async batchUpdateUserStatus(userIds, isActive) {
    try {
      // Cập nhật hàng loạt trạng thái
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        {
          $set: {
            isActive: isActive === "true" || isActive === true,
            updatedAt: new Date(),
          },
        }
      );

      return {
        success: true,
        status: 200,
        message: "Cập nhật trạng thái hàng loạt thành công",
        data: { modifiedCount: result.modifiedCount },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: error.message || "Lỗi khi cập nhật trạng thái hàng loạt",
      };
    }
  }
}

module.exports = new UserService();
