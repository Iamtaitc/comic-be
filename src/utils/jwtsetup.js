const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

/**
 * Đảm bảo các biến môi trường JWT cần thiết được thiết lập
 * Tạo file .env nếu chưa tồn tại và thêm JWT_SECRET và JWT_EXPIRATION
 */
function ensureJwtEnvVars() {
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    let envContent = "";
    let envMap = {};

    // Kiểm tra xem file .env đã tồn tại chưa
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");

      // Parse nội dung file .env hiện tại
      const lines = envContent.split("\n").filter(Boolean);
      envMap = Object.fromEntries(
        lines
          .map((line) => {
            const [key, ...rest] = line.split("=");
            return [key?.trim(), rest.join("=").trim()];
          })
          .filter(([key]) => key)
      ); // Lọc các dòng không hợp lệ
    }

    let updated = false;

    // Tạo JWT_SECRET nếu chưa có
    if (!envMap.JWT_SECRET) {
      const newSecret = crypto.randomBytes(32).toString("hex");
      if (envContent && !envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += `JWT_SECRET=${newSecret}\n`;
      updated = true;
      console.log("JWT_SECRET được tạo mới");
    }

    // Thêm JWT_EXPIRATION nếu chưa có
    if (!envMap.JWT_EXPIRATION) {
      if (envContent && !envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += `JWT_EXPIRATION=1d\n`;
      updated = true;
      console.log("JWT_EXPIRATION được thiết lập mặc định");
    }

    // Ghi lại vào file nếu có thay đổi
    if (updated) {
      try {
        fs.writeFileSync(envPath, envContent);
        console.log(
          "File .env đã được cập nhật với JWT_SECRET và JWT_EXPIRATION"
        );
        return true;
      } catch (writeError) {
        console.error("Không thể ghi file .env:", writeError.message);
        return false;
      }
    } else {
      console.log("JWT_SECRET và JWT_EXPIRATION đã tồn tại trong file .env");
      return true;
    }
  } catch (error) {
    console.error("Lỗi khi thiết lập biến môi trường JWT:", error.message);
    return false;
  }
}

// Thực thi hàm khi file được require
const setupResult = ensureJwtEnvVars();
if (!setupResult) {
  console.warn(
    "Cảnh báo: Có thể không thiết lập được các biến JWT. Kiểm tra quyền truy cập file .env"
  );
}

module.exports = {
  ensureJwtEnvVars,
};
