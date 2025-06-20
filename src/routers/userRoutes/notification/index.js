/**
 * Router thông báo cho người dùng
 * Định nghĩa các routes liên quan đến quản lý thông báo
 */
//Todo: Done
const express = require('express');
const router = express.Router();
const notificationController = require('../../../controllers/notification/notification.controller');

// Route lấy danh sách thông báo của người dùng
router.get('/notification', notificationController.getNotifications);

// Route đánh dấu tất cả thông báo đã đọc
router.patch('/notification', notificationController.markAllAsRead);

// Route đánh dấu một thông báo đã đọc
router.patch('/notification/:id', notificationController.markAsRead);

// Route xóa một thông báo
router.delete('/notification/:id', notificationController.deleteNotification);

// Route xóa tất cả thông báo
router.delete('/notification', notificationController.deleteAllNotifications);

module.exports = router;