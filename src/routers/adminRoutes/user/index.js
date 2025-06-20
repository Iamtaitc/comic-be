/**
 * Router cho quản lý người dùng
 * Định nghĩa các routes liên quan đến quản lý người dùng
 */

const express = require("express");
const router = express.Router();
const userController = require("../../../controllers/admin/users.admin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer để upload avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/avatars";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "avatar-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // giới hạn 2MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Chỉ chấp nhận file ảnh định dạng: jpeg, jpg, png, webp"));
  },
});

// Route lấy danh sách người dùng có phân trang và tìm kiếm
router.get("/", userController.getUsers);

// Route lấy thông tin chi tiết của một người dùng
router.get("/:id", userController.getUserById);

// Route tạo người dùng mới
router.post("/", upload.single("avatar"), userController.createUser);

// Route cập nhật thông tin người dùng
router.patch("/:id", upload.single("avatar"), userController.updateUser);

// Route đặt lại mật khẩu cho người dùng
router.patch("/:id/password", userController.resetPassword);

// Route xóa người dùng
router.delete("/:id", userController.deleteUser);

// Route cập nhật hàng loạt người dùng
router.post("/batch-update", userController.batchUpdateUsers);

module.exports = router;
