/**
 * Service xử lý các chức năng liên quan đến bình luận
 */
const { Story, Chapter, Comment, Notification } = require("../../models/index");
const logger = require("../../utils/logger");

class CommentService {
  /**
   * Bình luận truyện hoặc chapter
   * @param {string} userId ID người dùng
   * @param {string} storyId ID truyện
   * @param {string} content Nội dung bình luận
   * @param {string} chapterId ID chapter (tùy chọn)
   * @param {string} parentId ID bình luận cha (nếu là trả lời)
   * @returns {Promise<Object>} Kết quả với định dạng API thống nhất
   */
  static async commentStory(
    userId,
    storyId,
    content,
    chapterId = null,
    parentId = null
  ) {
    try {
      // Kiểm tra truyện có tồn tại và chưa bị xóa mềm
      const story = await Story.findOne({ _id: storyId, deletedAt: null });
      if (!story) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy truyện",
          data: null,
        };
      }

      // Kiểm tra chapter nếu có
      if (chapterId) {
        const chapter = await Chapter.findOne({
          _id: chapterId,
          storyId,
          deletedAt: null,
        });
        if (!chapter) {
          return {
            success: false,
            status: 404,
            message: "Không tìm thấy chương",
            data: null,
          };
        }
      }

      // Kiểm tra bình luận cha nếu có
      if (parentId) {
        const parentComment = await Comment.findOne({
          _id: parentId,
          deletedAt: null,
        });
        if (!parentComment) {
          return {
            success: false,
            status: 404,
            message: "Không tìm thấy bình luận cha",
            data: null,
          };
        }
        // Kiểm tra bình luận cha có thuộc cùng truyện hoặc chương
        if (
          (storyId &&
            parentComment.storyId?.toString() !== storyId.toString()) ||
          (chapterId &&
            parentComment.chapterId?.toString() !== chapterId.toString())
        ) {
          return {
            success: false,
            status: 400,
            message: "Bình luận cha không thuộc cùng truyện hoặc chương",
            data: null,
          };
        }
      }

      // Tạo bình luận mới
      const newComment = new Comment({
        userId,
        storyId,
        chapterId,
        content,
        parentId,
      });

      await newComment.save();

      // Populate thông tin người dùng, truyện, và chương
      await newComment.populate([
        { path: "userId", select: "username avatar" },
        { path: "storyId", select: "name slug" },
        {
          path: "chapterId",
          select: "chapterNumber chapter_name chapter_title",
        },
      ]);

      // Gửi thông báo cho người dùng nếu là bình luận trả lời
      if (parentId) {
        const parentComment = await Comment.findById(parentId);
        if (parentComment.userId.toString() !== userId.toString()) {
          await Notification.create({
            userId: parentComment.userId,
            title: "Bình luận của bạn được trả lời",
            content: `Bình luận của bạn trong truyện ${story.name} đã nhận được phản hồi.`,
            type: "comment",
            referenceType: "Comment",
            referenceId: newComment._id,
            priority: "medium",
          });
        }
      }

      return {
        success: true,
        status: 201,
        message: "Bình luận thành công",
        data: { comment: newComment },
      };
    } catch (error) {
      logger.error(
        `Lỗi khi bình luận truyện ${storyId} của người dùng ${userId}:`,
        error
      );
      return {
        success: false,
        status: 500,
        message: `Lỗi khi thêm bình luận: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Lấy danh sách bình luận của truyện hoặc chapter
   * @param {string} storyId ID truyện
   * @param {string} chapterId ID chapter (tùy chọn)
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng mỗi trang
   * @returns {Promise<Object>} Kết quả với định dạng API thống nhất
   */
  static async getComments(storyId, chapterId = null, page = 1, limit = 20) {
    try {
      // Kiểm tra truyện có tồn tại
      const story = await Story.findOne({ _id: storyId, deletedAt: null });
      if (!story) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy truyện",
          data: null,
        };
      }

      // Kiểm tra chapter nếu có
      if (chapterId) {
        const chapter = await Chapter.findOne({
          _id: chapterId,
          storyId,
          deletedAt: null,
        });
        if (!chapter) {
          return {
            success: false,
            status: 404,
            message: "Không tìm thấy chương",
            data: null,
          };
        }
      }

      const query = {
        storyId,
        parentId: null, // Chỉ lấy bình luận gốc
        deletedAt: null,
      };

      if (chapterId) {
        query.chapterId = chapterId;
      }

      const total = await Comment.countDocuments(query);

      // Lấy bình luận gốc
      const comments = await Comment.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("userId", "username avatar")
        .select("content likeCount replyCount isEdited createdAt updatedAt");

      // Lấy trả lời cho mỗi bình luận
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parentId: comment._id,
            deletedAt: null,
          })
            .sort({ createdAt: 1 })
            .populate("userId", "username avatar")
            .select("content likeCount isEdited createdAt updatedAt");

          return {
            ...comment.toObject(),
            replies,
          };
        })
      );

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách bình luận thành công",
        data: {
          comments: commentsWithReplies,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error(`Lỗi khi lấy bình luận truyện ${storyId}:`, error);
      return {
        success: false,
        status: 500,
        message: `Lỗi khi lấy danh sách bình luận: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Lấy danh sách bình luận chờ duyệt
   * @param {number} page Trang hiện tại
   * @param {number} limit Số lượng mỗi trang
   * @returns {Promise<Object>} Kết quả với định dạng API thống nhất
   */
  static async getPendingComments(page = 1, limit = 20) {
    try {
      const query = {
        deletedAt: null,
      };

      const total = await Comment.countDocuments(query);

      const comments = await Comment.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("userId", "username avatar")
        .populate("storyId", "name slug")
        .populate("chapterId", "chapterNumber chapter_name chapter_title")
        .select("content likeCount replyCount isEdited createdAt updatedAt");

      return {
        success: true,
        status: 200,
        message: "Lấy danh sách bình luận chờ duyệt thành công",
        data: {
          comments,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error("Lỗi khi lấy danh sách bình luận:", error);
      return {
        success: false,
        status: 500,
        message: `Lỗi khi lấy danh sách bình luận chờ duyệt: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Phê duyệt hoặc từ chối bình luận
   * @param {string} commentId ID bình luận
   * @param {string} status Trạng thái mới (approved/rejected)
   * @returns {Promise<Object>} Kết quả với định dạng API thống nhất
   */
  static async moderateComment(commentId, status) {
    try {
      if (!["approved", "rejected"].includes(status)) {
        return {
          success: false,
          status: 400,
          message: "Trạng thái không hợp lệ",
          data: null,
        };
      }

      const comment = await Comment.findOneAndUpdate(
        { _id: commentId, deletedAt: null },
        { updatedAt: new Date() },
        { new: true }
      );

      if (!comment) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy bình luận",
          data: null,
        };
      }

      // Gửi thông báo cho người dùng nếu bình luận được phê duyệt
      if (status === "approved") {
        await Notification.create({
          userId: comment.userId,
          title: "Bình luận của bạn đã được phê duyệt",
          content: `Bình luận của bạn trong truyện ${
            comment.storyId?.name || "một chương"
          } đã được phê duyệt.`,
          type: "comment",
          referenceType: "Comment",
          referenceId: comment._id,
          priority: "medium",
        });
      }

      return {
        success: true,
        status: 200,
        message: `Bình luận đã được ${
          status === "approved" ? "phê duyệt" : "từ chối"
        }`,
        data: { comment },
      };
    } catch (error) {
      logger.error(`Lỗi khi xử lý bình luận ${commentId}:`, error);
      return {
        success: false,
        status: 500,
        message: `Lỗi khi xử lý bình luận: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Xóa bình luận (xóa mềm)
   * @param {string} commentId ID bình luận
   * @param {string} userId ID người dùng (để kiểm tra quyền)
   * @param {boolean} isAdmin Đánh dấu người dùng là admin (tùy chọn)
   * @returns {Promise<Object>} Kết quả với định dạng API thống nhất
   */
  static async deleteComment(commentId, userId, isAdmin = false) {
    try {
      // Kiểm tra bình luận tồn tại
      const comment = await Comment.findOne({
        _id: commentId,
        deletedAt: null,
      });
      if (!comment) {
        return {
          success: false,
          status: 404,
          message: "Không tìm thấy bình luận",
          data: null,
        };
      }

      // Kiểm tra quyền xóa
      if (!isAdmin && comment.userId.toString() !== userId.toString()) {
        return {
          success: false,
          status: 403,
          message: "Bạn không có quyền xóa bình luận này",
          data: null,
        };
      }

      // Xóa mềm bình luận
      comment.deletedAt = new Date();
      await comment.save();

      // Nếu là bình luận cha, xóa mềm các bình luận con
      if (!comment.parentId) {
        await Comment.updateMany(
          { parentId: commentId, deletedAt: null },
          { deletedAt: new Date() }
        );
      }

      return {
        success: true,
        status: 200,
        message: "Xóa bình luận thành công",
        data: null,
      };
    } catch (error) {
      logger.error(`Lỗi khi xóa bình luận ${commentId}:`, error);
      return {
        success: false,
        status: 500,
        message: `Lỗi khi xóa bình luận: ${error.message}`,
        data: null,
      };
    }
  }
}

module.exports = new CommentService();
