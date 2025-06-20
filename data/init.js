db = db.getSiblingDB('comic_database'); // Kết nối đúng DB

const bcrypt = require('bcrypt');

const hashPassword = (plain) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plain, salt);
};

// Kiểm tra nếu chưa có user nào thì tạo tài khoản admin
if (db.users.countDocuments({ username: 'admin' }) === 0) {
  db.users.insertOne({
    username: "admin",
    password: hashPassword("T@i96-admin"), 
    fullName: "Super Admin",
    role: "admin",
    status: "active",
    isActive: true,
    avatar: "",
    preferences: {
      theme: "system",
      fontSize: 16,
      notifications: {
        newChapter: true,
        updates: true,
        email: true
      }
    },
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}
