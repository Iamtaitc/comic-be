/**
 * Middleware xác thực và phân quyền
 * Kiểm tra token JWT và quyền hạn người dùng
 */

const jwt = require("jsonwebtoken");
const { User, Role} = require("../../src/models/index");

const config = require("../../config");
const logger = require("../utils/logger");

/**
 * Middleware kiểm tra xác thực
 * Xác minh JWT token và đính kèm thông tin người dùng vào request
 */
const checkAuth = async (req, res, next) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Không có token xác thực",
      });
    }

    const token = authHeader.split(" ")[1];

    // Xác minh token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Kiểm tra người dùng có tồn tại không
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại",
      });
    }

    // Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    // Đính kèm thông tin người dùng vào request
    req.user = user;

    // Cập nhật thời gian truy cập gần nhất
    user.lastLogin = new Date();
    await user.save();

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token đã hết hạn",
      });
    }

    logger.error("Lỗi xác thực:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi xác thực",
      error: error.message,
    });
  }
};

/**
 * Middleware kiểm tra vai trò người dùng
 * @param {Array} roles Mảng các vai trò được phép truy cập
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    // Middleware này phải được sử dụng sau checkAuth
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Không có thông tin người dùng",
      });
    }

    // Kiểm tra người dùng có vai trò phù hợp không
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    next();
  };
};

/**
 * Middleware kiểm tra quyền cụ thể
 * @param {Array} requiredPermissions Mảng các quyền cần thiết
 */
const requirePermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      // Middleware này phải được sử dụng sau checkAuth
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Không có thông tin người dùng",
        });
      }

      // Admin luôn có tất cả quyền
      if (req.user.role === "admin") {
        return next();
      }

      // Tìm vai trò của người dùng
      const userRole = await Role.findOne({ name: req.user.role });

      if (!userRole) {
        return res.status(403).json({
          success: false,
          message: "Vai trò không hợp lệ",
        });
      }

      // Kiểm tra người dùng có tất cả các quyền cần thiết không
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userRole.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền thực hiện hành động này",
        });
      }

      next();
    } catch (error) {
      logger.error("Lỗi kiểm tra quyền:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi kiểm tra quyền",
        error: error.message,
      });
    }
  };
};

module.exports = {
  checkAuth,
  requireRole,
  requirePermission,
};
