// services/NotificationService.js
const Notification = require("../../models/index");

class NotificationService {
  /**
   * Get notifications for a user with pagination and filters
   */
  static async getNotifications({
    userId,
    page = 1,
    limit = 10,
    unreadOnly,
    type,
    expirationDate,
  }) {
    try {
      const query = {
        userId,
        deletedAt: null,
        ...(unreadOnly && { isRead: false }),
        ...(type && { type }),
        ...(expirationDate
          ? {
              $or: [
                { expirationDate: null },
                { expirationDate: { $gte: new Date() } },
              ],
            }
          : {}),
      };

      const total = await Notification.countDocuments(query);
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("referenceId", "name title chapter_name");

      return {
        success: true,
        status: 200,
        message: "Notifications retrieved successfully",
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error retrieving notifications: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(id, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId, isRead: false, deletedAt: null },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return {
          success: false,
          status: 404,
          message: "Notification not found or already read",
          data: null,
        };
      }

      return {
        success: true,
        status: 200,
        message: "Notification marked as read",
        data: { notification },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error marking notification as read: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false, deletedAt: null },
        { isRead: true }
      );

      return {
        success: true,
        status: 200,
        message: "All notifications marked as read",
        data: { count: result.modifiedCount },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error marking all notifications as read: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Soft delete a notification
   */
  static async deleteNotification(id, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return {
          success: false,
          status: 404,
          message: "Notification not found or already deleted",
          data: null,
        };
      }

      return {
        success: true,
        status: 200,
        message: "Notification deleted successfully",
        data: { notification },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error deleting notification: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Soft delete all notifications for a user
   */
  static async deleteAllNotifications(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, deletedAt: null },
        { deletedAt: new Date() }
      );

      return {
        success: true,
        status: 200,
        message: "All notifications deleted successfully",
        data: { count: result.modifiedCount },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error deleting all notifications: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Count unread notifications for a user
   */
  static async countUnreadNotifications(userId) {
    try {
      const count = await Notification.countDocuments({
        userId,
        isRead: false,
        deletedAt: null,
        $or: [
          { expirationDate: null },
          { expirationDate: { $gte: new Date() } },
        ],
      });

      return {
        success: true,
        status: 200,
        message: "Unread notifications count retrieved successfully",
        data: { count },
      };
    } catch (error) {
      return {
        success: false,
        status: 500,
        message: `Error counting unread notifications: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Create a new notification
   */
  static async createNotification({
    userId,
    type,
    title,
    content,
    referenceType,
    referenceId,
    priority,
    expirationDate,
  }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        content,
        referenceType,
        referenceId,
        priority,
        expirationDate,
      });

      return {
        success: true,
        status: 200,
        message: "Notification created successfully",
        data: { notification },
      };
    } catch (error) {
      return {
        success: false,
        status: 400,
        message: `Error creating notification: ${error.message}`,
        data: null,
      };
    }
  }
}

module.exports = new NotificationService();
