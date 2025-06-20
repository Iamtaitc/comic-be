const express = require("express");
const router = express.Router();

const { checkAuth, requireRole, requirePermission } = require('../../middlewares/auth.middleware');
router.use("/crawler", require("./crawlerError.routes"));

// Middleware kiểm tra quyền admin cho tất cả các routes
// router.use(checkAuth, requireRole(["admin"]));
// router.use(requireRole, requirePermission);

// router.use("/v1", require("./user"));

// router.get('/profile', userController.getProfile); // getProfile phải được export từ userController

module.exports = router;