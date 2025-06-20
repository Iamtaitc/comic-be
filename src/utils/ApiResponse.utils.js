/**
 * Lớp xử lý phản hồi API - Chuẩn hóa định dạng phản hồi cho toàn bộ ứng dụng
 */
class ApiResponse {
  /**
   * Tạo phản hồi thành công
   * @param {object} res - Express response object
   * @param {any} data - Dữ liệu trả về
   * @param {string} message - Thông báo thành công
   * @param {number} statusCode - Mã trạng thái HTTP
   * @returns {object} Express response
   */
  static success(res, data = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Tạo phản hồi lỗi
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {number} statusCode - Mã trạng thái HTTP
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static error(
    res,
    message = "Error occurred",
    statusCode = 500,
    errors = null
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phản hồi lỗi xác thực/ủy quyền (401)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static unauthorized(res, message = "Unauthorized", errors = null) {
    return this.error(res, message, 401, errors);
  }

  /**
   * Phản hồi lỗi không có quyền truy cập (403)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static forbidden(res, message = "Forbidden", errors = null) {
    return this.error(res, message, 403, errors);
  }

  /**
   * Phản hồi lỗi yêu cầu không hợp lệ (400)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static badRequest(res, message = "Bad request", errors = null) {
    return this.error(res, message, 400, errors);
  }

  /**
   * Phản hồi lỗi không tìm thấy tài nguyên (404)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @returns {object} Express response
   */
  static notFound(res, message = "Resource not found") {
    return this.error(res, message, 404);
  }

  /**
   * Phản hồi lỗi xung đột (409)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static conflict(res, message = "Conflict", errors = null) {
    return this.error(res, message, 409, errors);
  }

  /**
   * Phản hồi lỗi quá nhiều yêu cầu (429)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @returns {object} Express response
   */
  static tooManyRequests(res, message = "Too many requests") {
    return this.error(res, message, 429);
  }

  /**
   * Phản hồi lỗi máy chủ (500)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @param {any} errors - Chi tiết lỗi
   * @returns {object} Express response
   */
  static serverError(res, message = "Internal server error", errors = null) {
    return this.error(res, message, 500, errors);
  }

  /**
   * Phản hồi lỗi dịch vụ không khả dụng (503)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo lỗi
   * @returns {object} Express response
   */
  static serviceUnavailable(res, message = "Service unavailable") {
    return this.error(res, message, 503);
  }

  /**
   * Phản hồi khi tạo tài nguyên thành công (201)
   * @param {object} res - Express response object
   * @param {any} data - Dữ liệu trả về
   * @param {string} message - Thông báo thành công
   * @returns {object} Express response
   */
  static created(res, data = null, message = "Resource created successfully") {
    return this.success(res, data, message, 201);
  }

  /**
   * Phản hồi không có nội dung (204)
   * @param {object} res - Express response object
   * @returns {object} Express response
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Phản hồi phân trang
   * @param {object} res - Express response object
   * @param {array} data - Mảng dữ liệu
   * @param {number} totalItems - Tổng số item
   * @param {number} currentPage - Trang hiện tại
   * @param {number} pageSize - Kích thước trang
   * @param {string} message - Thông báo
   * @returns {object} Express response
   */
  static paginated(
    res,
    data,
    totalItems,
    currentPage,
    pageSize,
    message = "Data retrieved successfully"
  ) {
    const totalPages = Math.ceil(totalItems / pageSize);

    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        totalItems,
        totalPages,
        currentPage,
        pageSize,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phản hồi khi yêu cầu được chấp nhận nhưng xử lý bất đồng bộ (202)
   * @param {object} res - Express response object
   * @param {string} message - Thông báo
   * @returns {object} Express response
   */
  static accepted(res, message = "Request accepted for processing") {
    return this.success(res, null, message, 202);
  }
}

// Export the class itself, not an instance
module.exports = ApiResponse;