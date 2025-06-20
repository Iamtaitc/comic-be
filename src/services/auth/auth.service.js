/**
 * Service xác thực
 * Xử lý logic nghiệp vụ cho các chức năng đăng ký, đăng nhập, quản lý tài khoản
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User.mongoose");
const config = require("../../../config");

class AuthService {
  /**
   * Đăng ký tài khoản mới
   *
   * @param {Object} userData - Thông tin người dùng
   * @param {string} userData.username - Tên đăng nhập
   * @param {string} userData.email - Địa chỉ email
   * @param {string} userData.password - Mật khẩu
   * @param {string} userData.fullName - Tên đầy đủ (tùy chọn)
   * @returns {Promise<Object>} - Kết quả đăng ký với định dạng API thống nhất
   */
  async register(userData) {
    try {
      const { username, email, password, fullName } = userData;

      // Kiểm tra thông tin bắt buộc
      if (!username || !email || !password) {
        return {
          success: false,
          status: 400,
          message: "Vui lòng cung cấp đầy đủ thông tin",
          data: null,
        };
      }

      // Kiểm tra username và email đã tồn tại chưa
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        return {
          success: false,
          status: 409,
          message: "Username hoặc email đã tồn tại",
          data: null,
        };
      }

      // Kiểm tra độ dài mật khẩu
      if (password.length < 6) {
        return {
          success: false,
          status: 400,
          message: "Mật khẩu phải có ít nhất 6 ký tự",
          data: null,
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
        avatar: "default-avatar.jpg",
        role: "user",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newUser.save();

      // Tạo JWT token
      const token = this.generateToken(newUser);

      // Không trả về mật khẩu
      const userResponse = { ...newUser.toObject() };
      delete userResponse.password;

      return {
        success: true,
        status: 201,
        message: "Đăng ký tài khoản thành công",
        data: {
          token,
          user: userResponse,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Lỗi đăng ký tài khoản: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Đăng nhập
   *
   * @param {string} username - Tên đăng nhập hoặc email
   * @param {string} password - Mật khẩu
   * @returns {Promise<Object>} - Kết quả đăng nhập với định dạng API thống nhất
   */
  async login(username, password) {
    try {
      // Kiểm tra thông tin bắt buộc
      if (!username || !password) {
        return {
          success: false,
          status: 400,
          message: "Vui lòng cung cấp đầy đủ thông tin",
          data: null,
        };
      }

      // Tìm người dùng theo username hoặc email
      const user = await User.findOne({
        $or: [{ username }, { email: username }],
      });

      if (!user) {
        return {
          success: false,
          status: 401,
          message: "Thông tin đăng nhập không chính xác",
          data: null,
        };
      }

      // Kiểm tra mật khẩu
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return {
          success: false,
          status: 401,
          message: "Thông tin đăng nhập không chính xác",
          data: null,
        };
      }

      // Kiểm tra tài khoản có bị vô hiệu hóa không
      if (!user.isActive) {
        return {
          success: false,
          status: 403,
          message: "Tài khoản đã bị vô hiệu hóa",
          data: null,
        };
      }

      // Cập nhật thời gian đăng nhập cuối
      user.lastLogin = new Date();
      await user.save();

      // Tạo JWT token
      const token = this.generateToken(user);

      // Không trả về mật khẩu
      const userResponse = { ...user.toObject() };
      delete userResponse.password;

      return {
        success: true,
        status: 200,
        message: "Đăng nhập thành công",
        data: {
          token,
          user: userResponse,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Lỗi đăng nhập: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Đổi mật khẩu
   *
   * @param {string} userId - ID người dùng
   * @param {string} currentPassword - Mật khẩu hiện tại
   * @param {string} newPassword - Mật khẩu mới
   * @returns {Promise<Object>} - Kết quả đổi mật khẩu với định dạng API thống nhất
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Kiểm tra thông tin bắt buộc
      if (!currentPassword || !newPassword) {
        return {
          success: false,
          status: 400,
          message: "Vui lòng cung cấp đầy đủ thông tin",
          data: null,
        };
      }

      // Kiểm tra độ dài mật khẩu mới
      if (newPassword.length < 6) {
        return {
          success: false,
          status: 400,
          message: "Mật khẩu mới phải có ít nhất 6 ký tự",
          data: null,
        };
      }

      // Lấy người dùng từ database để có mật khẩu hash
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
          data: null,
        };
      }

      // Kiểm tra mật khẩu hiện tại
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return {
          success: false,
          status: 401,
          message: "Mật khẩu hiện tại không chính xác",
          data: null,
        };
      }

      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Cập nhật mật khẩu mới
      user.password = hashedPassword;
      user.updatedAt = new Date();
      await user.save();

      return {
        success: true,
        status: 200,
        message: "Đổi mật khẩu thành công",
        data: null,
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Lỗi đổi mật khẩu: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Cập nhật thông tin cá nhân
   *
   * @param {string} userId - ID người dùng
   * @param {Object} profileData - Thông tin cần cập nhật
   * @param {string} profileData.fullName - Tên đầy đủ (tùy chọn)
   * @param {string} profileData.email - Email (tùy chọn)
   * @returns {Promise<Object>} - Kết quả cập nhật với định dạng API thống nhất
   */
  async updateProfile(userId, profileData) {
    try {
      const { fullName, email } = profileData;

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy người dùng",
          data: null,
        };
      }

      // Kiểm tra email đã tồn tại chưa
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return {
            success: false,
            status: 409,
            message: "Email đã tồn tại",
            data: null,
          };
        }

        user.email = email;
      }

      // Cập nhật thông tin khác
      if (fullName !== undefined) user.fullName = fullName;

      user.updatedAt = new Date();
      await user.save();

      // Không trả về mật khẩu
      const userResponse = { ...user.toObject() };
      delete userResponse.password;

      return {
        success: true,
        status: 200,
        message: "Cập nhật thông tin thành công",
        data: { user: userResponse },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Lỗi cập nhật thông tin: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Tạo JWT token
   *
   * @param {Object} user - Thông tin người dùng
   * @returns {string} - JWT token
   */
  generateToken(user) {
    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiration,
    });
  }
}

module.exports = new AuthService();
