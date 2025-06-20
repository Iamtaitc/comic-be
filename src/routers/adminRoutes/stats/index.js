/**
 * Router cho thống kê và báo cáo
 * Định nghĩa các routes và middleware liên quan
 */

const express = require("express");
const router = express.Router();
const StatsController = require("../../../controllers/admin/stats.admin");

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Lấy thống kê tổng quan hệ thống
 * @access  Admin
 */
router.get("/overview", StatsController.getOverviewStats);

/**
 * @route   GET /api/admin/stats/daily
 * @desc    Lấy thống kê theo ngày
 * @access  Admin
 */
router.get("/daily", StatsController.getDailyStats);

/**
 * @route   GET /api/admin/stats/top-Storys
 * @desc    Lấy danh sách truyện hàng đầu
 * @access  Admin, Moderator
 */
router.get("/top-Story", StatsController.getTopStorys);

/**
 * @route   GET /api/admin/stats/export
 * @desc    Xuất báo cáo dạng CSV
 * @access  Admin
 */
router.get("/export", StatsController.exportReport);

module.exports = router;
