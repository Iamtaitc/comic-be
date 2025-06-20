/**
 * Middleware xử lý upload file
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình multer để upload ảnh
const StoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/Storys';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Chỉ chấp nhận file ảnh định dạng: jpeg, jpg, png, webp'));
};

const StoryUpload = multer({
  storage: StoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // giới hạn 5MB
  fileFilter
});

module.exports = {
  StoryUpload
};