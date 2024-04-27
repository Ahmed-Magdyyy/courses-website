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
        console.log("Image deleted successfully:", file.path);
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
  if (file.mimetype.startsWith("image") || file.mimetype.startsWith("video")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images and videos are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
  limits: {
    files: 10, // Limit total number of files to 10
  },
}).array("media", 10); // Accept up to 10 media files

exports.uploadCommentMedia = (req, res, next) => {
  upload(req, res, function (err) {
    if (err) {
      if (req.files) {
        mediaFiles.forEach((file) => deleteUploadedFile(file));
      }
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }

    let mediaFiles = [];

    // Check uploaded files
    if (req.files) mediaFiles = req.files;

    // Check the total number of files
    if (mediaFiles.length > 10) {
      // Delete uploaded files
      mediaFiles.forEach((file) => deleteUploadedFile(file));
      return next(new ApiError("Exceeded maximum number of files (10)", 400));
    }

    // Validate each file
    mediaFiles.forEach((file) => {
      if (
        !file.mimetype.startsWith("image") &&
        !file.mimetype.startsWith("video")
      ) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Only images and videos are allowed", 400));
      }
      // Check file size for videos
      if (file.mimetype.startsWith("video") && file.size > 25 * 1024 * 1024) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Video file size exceeds 25 MB", 400));
      }
      // Add file information to req.body.media
      req.body.media = req.body.media || []; // Initialize req.body.media if it's undefined
      req.body.media.push({
        type: file.mimetype.startsWith("image") ? "image" : "video",
        url: file.filename,
      });
    });

    next();
  });
};

exports.createComment = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { content } = req.body;
  const media = req.body.media || [];
  console.log("req.files", req.files);
  console.log("media", media);

  try {
    const post = await postsModel.findById(postId);
    if (!post) {
      if (req.files) {
        req.files.forEach((file) => deleteUploadedFile(file));
      }
      return next(new ApiError("Post not found", 404));
    }

    // Create the comment
    const comment = await commentsModel.create({
      post: postId,
      content,
      author: req.user._id,
      media,
    });

    // Add the comment to the post's comments array
    await postsModel.findOneAndUpdate(
      { _id: postId },
      { $push: { comments: comment._id } }
    );

    const postOwner = post.author;
    const commentAuthor = await userModel.findById(comment.author);

    // if (postOwner.toString() === commentAuthor.toString()) {
      const postOwnernotification = await Notification.create({
        scope: "comment",
        userId: postOwner.toString(),
        message: `${commentAuthor.name} commented on your post.`,
      });

      // Emit notifications students
      const { io, users } = getIO();
      if (users.length > 0) {
        const connectedPostOwner = users.filter(
          (user) => user.userId === postOwner.toString()
        );

        if (connectedPostOwner) {
          const { userId, scope, message, _id, createdAt } =
            postOwnernotification;
          io.to(connectedPostOwner[0].socketId).emit("notification", {
            userId,
            scope,
            message,
            _id,
            createdAt,
          });
        }
      }
    // }

    res
      .status(201)
      .json({ message: "Comment created successfully", data: comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    res.status(400).json({ message: "Error creating comment", error });
    next(error);
  }
});

exports.getCommentsForPost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

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
      .populate("author", "_id name email phone role")
      .populate("likes.users", "_id name");

    res.status(200).json({ results: comments.length, comments });
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
      .populate("author", "_id name email phone role")
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
      if (req.files) {
        req.files.forEach((file) => deleteUploadedFile(file));
      }
      return next(new ApiError("Comment not found", 404));
    }

    if (
      req.user._id.toString() !== comment.author.toString() &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "admin"
    ) {
      if (req.files) {
        req.files.forEach((file) => deleteUploadedFile(file));
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
    if (req.body.media) {
      updateFields.media = req.body.media;
    }

    if (req.body.media && comment.media.length > 0) {
      comment.media.forEach((mediaItem) => {
        const index = mediaItem.url.indexOf("posts/comments");
        const path = `uploads/${mediaItem.url.substring(index)}`;
        console.log(path);
        deleteUploadedFile({ path });
      });
    }

    console.log(updateFields);
    // Update the comment in the database
    const updatedComment = await commentsModel.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );
    console.log("updatedComment", updatedComment._id);
    console.log("updatedComment", updatedComment.content);

    res
      .status(200)
      .json({ message: "Comment updated successfully", data: updatedComment });
  } catch (error) {
    console.error("Error updating comment:", error);
    // Delete the uploaded media files if comment updating fails
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
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
    if (comment.media && comment.media.length > 0) {
      comment.media.forEach((mediaItem) => {
        const index = mediaItem.url.indexOf("posts/comments");
        const path = `uploads/${mediaItem.url.substring(index)}`;
        console.log(path);
        deleteUploadedFile({ path });
      });
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
