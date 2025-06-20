/**
 * Router xác thực
 * Định nghĩa các routes liên quan đến xác thực người dùng
 */
//Todo: done
const express = require('express');
const router = express.Router();
const { checkAuth } = require('../../../middlewares/auth.middleware');
const authController = require('../../../controllers/auth/auth.controller');

// Route đăng ký tài khoản mới
router.post('/register', authController.register);

// Route đăng nhập
router.post('/login', authController.login);

router.use(checkAuth);
// Route lấy thông tin người dùng hiện tại
router.get('/me', checkAuth, authController.getProfile);

// Route đổi mật khẩu
router.patch('/change-password', checkAuth, authController.changePassword);

// Route cập nhật thông tin cá nhân
router.patch('/update-profile', checkAuth, authController.updateProfile);

module.exports = router;