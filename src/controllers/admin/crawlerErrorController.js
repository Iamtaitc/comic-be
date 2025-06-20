// src/controllers/admin/crawlerErrorController.js
const CrawlerLog = require('../../models').CrawlerLog;

// Lấy danh sách lỗi gần đây (mặc định 50 lỗi mới nhất)
exports.getCrawlerErrors = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const errors = await CrawlerLog.find({ status: 'error' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('error stack listType currentPage createdAt');
    res.json({ success: true, errors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};
