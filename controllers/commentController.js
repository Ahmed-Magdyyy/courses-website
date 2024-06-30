const fs = require("fs");
const multer = require("multer");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");

const userModel = require("../models/userModel");
const postsModel = require("../models/postModel");
const commentsModel = require("../models/commentModel");
const ApiError = require("../utils/ApiError");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

function deleteUploadedFile(file) {
  if (file) {
    const filePath = `${file.path}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting image:", err);
      } else {
        console.log("Image deleted successfully:", filePath);
      }
    });
  }
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/posts/comments");
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1];
    const currentDate = moment.tz("Africa/Cairo").format("DDMMYYYY");
    const currentTime = moment.tz("Africa/Cairo").format("HH-mm-ss");
    const filename = `comment-${currentDate}-${currentTime}${Math.floor(
      Math.random() * 1000000
    )}.${ext}`;
    cb(null, filename);
  },
});

const multerfilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    req.fileType = "image";
    cb(null, true);
  } else if (file.mimetype.startsWith("video")) {
    req.fileType = "video";
    cb(null, true);
  } else {
    cb(new ApiError("Only images and videos are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
  limits: {
    fileSize: function (req, file, cb) {
      if (req.fileType === "image") {
        cb(null, 5 * 1024 * 1024); // 5 MB limit for images
      } else if (req.fileType === "video") {
        cb(null, 25 * 1024 * 1024); // 25 MB limit for videos
      } else {
        cb(new ApiError("Invalid file type", 400));
      }
    },
  },
}).single("media"); // Accept only one file

exports.uploadCommentMedia = (req, res, next) => {
  upload(req, res, function (err) {
    if (req.file) {
      if (
        !req.file.mimetype.startsWith("image") &&
        !req.file.mimetype.startsWith("video")
      ) {
        deleteUploadedFile(req.file);
        return next(new ApiError("Only image ore video is allowed", 400));
      }

      if (
        req.file.mimetype.startsWith("video") &&
        req.file.size > 25 * 1024 * 1024
      ) {
        // Delete uploaded files
        deleteUploadedFile(req.file);
        return next(new ApiError("Video file size exceeds 25 MB", 400));
      }

      if (
        req.file.mimetype.startsWith("image") &&
        req.file.size > 5 * 1024 * 1024 // 5 MB limit for images
      ) {
        // Delete uploaded files
        deleteUploadedFile(req.file);
        return next(new ApiError("Image file size exceeds 5 MB", 400));
      }

      if (err) {
        if (req.file) {
          deleteUploadedFile(req.file);
        }
        return next(
          new ApiError(
            `An error occurred while uploading the file. ${err}`,
            500
          )
        );
      }
    }
    next();
  });
};

exports.createComment = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { content } = req.body;

  try {
    const post = await postsModel.findById(postId);
    if (!post) {
      if (req.file) {
        deleteUploadedFile(req.file);
      }
      return next(new ApiError("Post not found", 404));
    }

    // Create the comment
    const comment = await commentsModel.create({
      post: postId,
      content,
      author: req.user._id,
      media: req.file ? req.file.filename : "",
    });

    // Add the comment to the post's comments arrays
    await postsModel.findOneAndUpdate(
      { _id: postId },
      { $push: { comments: comment._id } }
    );

    const postOwner = post.author;
    const commentAuthor = await userModel.findById(comment.author);

    const postOwnernotification = await Notification.create({
      scope: "post",
      userId: postOwner.toString(),
      relatedId: postId,
      message: `${commentAuthor.name} commented on your post.`,
    });

    // Emit notifications students
    const { io, users } = getIO();
    if (users.length > 0) {
      const connectedPostOwner = users.filter(
        (user) => user.userId === postOwner.toString()
      );

      if (connectedPostOwner && connectedPostOwner.length > 0) {
        const { userId, scope, message, _id, createdAt } =
          postOwnernotification;
        io.to(connectedPostOwner[0].socketId).emit("notification", {
          scope,
          postOwner: userId,
          userCommented: commentAuthor._id,
          postId,
          message,
          notificationId: _id,
          createdAt,
        });
      }
    }

    res
      .status(201)
      .json({ message: "Comment created successfully", data: comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    if (req.file) {
      deleteUploadedFile(req.file);
    }
    res.status(400).json({ message: "Error creating comment", error });
    next(error);
  }
});

exports.getCommentsForPost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { page, limit, skip } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await commentsModel.countDocuments({ post: postId });
  const totalPages = Math.ceil(totalPostsCount / limitNum);

  try {
    // Check if the post exists
    const post = await postsModel.findById(postId);
    if (!post) {
      return next(new ApiError("Post not found", 404));
    }

    // Find all comments for the post
    const comments = await commentsModel
      .find({ post: postId })
      .sort({ createdAt: -1 })
      .populate("author", "_id name email phone role image")
      .populate("likes.users", "_id name")
      .skip(skipNum)
      .limit(limitNum);

    res
      .status(200)
      .json({ totalPages, page: pageNum, results: comments.length, comments });
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(400).json({ message: "Error getting comments", error });
    next(error);
  }
});

exports.getComment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const comment = await commentsModel
      .findById(id)
      .populate("author", "_id name email phone role image")
      .populate("likes.users", "_id name");
    if (!comment) {
      return next(new ApiError("Comment not found", 404));
    }

    res.status(200).json({ data: comment });
  } catch (error) {
    console.error("Error getting comment:", error);
    res.status(400).json({ message: "Error getting comment", error });
    next(error);
  }
});

exports.updateComment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { content } = req.body;
  const updateFields = {};

  try {
    const comment = await commentsModel.findById(id);

    if (!comment) {
      if (req.file) {
        deleteUploadedFile(req.file);
      }
      return next(new ApiError("Comment not found", 404));
    }

    if (
      req.user._id.toString() !== comment.author.toString() &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "admin"
    ) {
      if (req.file) {
        deleteUploadedFile(req.file);
      }
      return next(
        new ApiError(`Only comment author can edit the comment.`, 403)
      );
    }

    // Update post content
    if (content) {
      updateFields.content = content;
    }

    // Update post media if any
    if (req.file) {
      updateFields.media = req.file.filename;
      if (comment.media) {
        const index = comment.media.indexOf("posts/comments");
        const path = `uploads/${comment.media.substring(index)}`;
        deleteUploadedFile({ path });
      }
    }

    // Update the comment in the database
    const updatedComment = await commentsModel.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    res
      .status(200)
      .json({ message: "Comment updated successfully", data: updatedComment });
  } catch (error) {
    console.error("Error updating comment:", error);
    // Delete the uploaded media files if comment updating fails
    if (req.file) {
      deleteUploadedFile(req.file);
    }
    res.status(400).json({ message: "Error updating comment", error });
    next(error);
  }
});

exports.deleteComment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const comment = await commentsModel.findById(id);
    if (!comment) {
      return next(new ApiError("Comment not found", 404));
    }

    if (
      req.user._id.toString() !== comment.author.toString() &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "admin"
    ) {
      return next(
        new ApiError(`Only comment author can delete the comment.`, 400)
      );
    }

    // Remove the comment from the post's comments array
    await postsModel.findByIdAndUpdate(comment.post, {
      $pull: { comments: id },
    });

    // Delete media files associated with the comment
    if (comment.media) {
      const index = comment.media.indexOf("posts/comments");
      const path = `uploads/${comment.media.substring(index)}`;
      deleteUploadedFile({ path });
    }

    // Delete post document from DB
    await comment.deleteOne();

    res.status(204).send("Comment deleted successfully");
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(400).json({ message: "Error deleting comment", error });
    next(error);
  }
});

exports.toggleLike = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    // Check if the comment exists
    const comment = await commentsModel.findById(id);
    if (!comment) {
      return next(new ApiError("Comment not found", 404));
    }

    // Check if the user has already liked the comment
    const userIndex = comment.likes.users.indexOf(userId);
    let updateOperation;
    let message;

    if (userIndex === -1) {
      // User hasn't liked the comment, so add like
      updateOperation = {
        $push: { "likes.users": userId },
        $inc: { "likes.count": 1 },
      };
      message = "You have successfully liked the comment";

      const commentOwnernotification = await Notification.create({
        scope: "comment",
        userId: comment.author.toString(),
        relatedId: comment.post,
        message: `${req.user.name} liked your comment.`,
      });

      // Emit notifications students
      const { io, users } = getIO();
      if (users.length > 0) {
        const connectedCommentOwner = users.filter(
          (user) => user.userId === comment.author.toString()
        );

        if (connectedCommentOwner && connectedCommentOwner.length > 0) {
          const { userId, scope, message, _id, createdAt } =
            commentOwnernotification;
          io.to(connectedCommentOwner[0].socketId).emit("notification", {
            scope,
            commentOwner: userId,
            userLikedTheComment: req.user._id,
            commentId: id,
            postId: comment.post,
            message,
            notificationId: _id,
            createdAt,
          });
        }
      }
    } else {
      // User has liked the comment, so remove like
      updateOperation = {
        $pull: { "likes.users": userId },
        $inc: { "likes.count": -1 },
      };
      message = "Like removed";
    }

    // Update the comment
    const updatedComment = await commentsModel.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true }
    );

    res.status(200).json({ message, data: updatedComment });
  } catch (error) {
    console.error("Error toggling like:", error);
    next(error);
  }
});
