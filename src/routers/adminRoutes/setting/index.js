/**
 * Router cho cấu hình hệ thống
 * Định nghĩa các routes liên quan đến quản lý cấu hình website
 */

const express = require("express");
const router = express.Router();
const settingController = require("../../../controllers/setting/settings.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer để upload file (logo, favicon, ...)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/settings";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Giữ nguyên tên file để dễ quản lý
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // giới hạn 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif|svg|ico/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "Chỉ chấp nhận file hình ảnh định dạng: jpeg, jpg, png, webp, gif, svg, ico"
      )
    );
  },
});

// Route lấy tất cả cấu hình
router.get("/", settingController.getAllSettings);

// Route lấy một cấu hình cụ thể theo key
router.get("/:key", settingController.getSettingByKey);

// Route cập nhật nhiều cấu hình cùng lúc
router.post("/", settingController.updateMultipleSettings);

// Route cập nhật một cấu hình
router.patch("/:key", settingController.updateSetting);

// Route upload file cấu hình (logo, favicon)
router.post(
  "/upload",
  upload.single("file"),
  settingController.uploadSettingFile
);

// Route lấy thông tin cấu hình website
router.get("/site-info", settingController.getSiteInfo);

// Route cập nhật thông tin cấu hình website
router.patch("/site-info", settingController.updateSiteInfo);

// Route lấy cấu hình mạng xã hội
router.get("/social", settingController.getSocialSettings);

// Route cập nhật cấu hình mạng xã hội
router.patch("/social", settingController.updateSocialSettings);

module.exports = router;
