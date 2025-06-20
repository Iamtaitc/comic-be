/**
 * Router cho quản lý phân quyền
 * Định nghĩa các routes liên quan đến quản lý vai trò và quyền
 */

const express = require('express');
const router = express.Router();
const { checkAuth, requireRole } = require('../middlewares/authMiddleware');
const roleController = require('../controllers/role.controller');

// Middleware kiểm tra quyền admin cho tất cả các routes
router.use(checkAuth, requireRole(['admin']));

// Route lấy danh sách tất cả quyền có sẵn trong hệ thống
router.get('/permissions/list', roleController.getPermissionsList);

// Route lấy danh sách vai trò
router.get('/', roleController.getRoles);

// Route lấy thông tin chi tiết của một vai trò
router.get('/:id', roleController.getRoleById);

// Route tạo vai trò mới
router.post('/', roleController.createRole);

// Route cập nhật thông tin vai trò
router.put('/:id', roleController.updateRole);

// Route xóa vai trò
router.delete('/:id', roleController.deleteRole);

// Route lấy danh sách người dùng theo vai trò
router.get('/:id/users', roleController.getUsersByRole);

module.exports = router;