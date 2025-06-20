// be\src\utils\updateStoryCount.js
const cron = require('node-cron');
const CategoryService = require('../services/comic/comic.service');

const updateStoryCountJob = () => {
  cron.schedule('0 1 * * *', async () => {
    console.log('Bắt đầu cập nhật số lượng truyện cho thể loại');
    try {
      await CategoryService.updateStoryCount();
      console.log('Cập nhật số lượng truyện thành công');
    } catch (error) {
      console.error('Lỗi khi cập nhật số lượng truyện:', error);
    }
  });
};

module.exports = updateStoryCountJob;