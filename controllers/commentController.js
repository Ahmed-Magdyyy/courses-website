const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");

const postsModel = require("../models/postModel");
const commentsModel = require("../models/commentModel");
const factory = require("./controllersFactory");
const ApiError = require("../utils/ApiError");

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
    const filename = `comment-${currentDate}-${currentTime}.${ext}`;
    cb(null, filename);
  },
});

const multerfilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("only Images allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
}).single("image");

exports.uploadCommentImage = (req, res, next) => {
  upload(req, res, function (err) {
    // File uploaded successfully
    if (req.file) req.body.image = req.file.filename; // Set the image filename to req.body.image
    next();

    if (err) {
      deleteUploadedFile(req.file); // Delete the uploaded file
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }
  });
};

exports.createComment = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const { content, image } = req.body;
  try {
    const post = await postsModel.findById(postId);
    if (!post) {
      if (req.file) {
        const path = req.file.path;
        deleteUploadedFile({
          path,
        });
      }
      return next(new ApiError("Post not found", 404));
    }

    // Create the comment
    const comment = await commentsModel.create({
      post: postId,
      content,
      author: req.user._id,
      image,
    });

    // Add the comment to the post's comments array
    await postsModel.findOneAndUpdate(
      { _id: postId },
      { $push: { comments: comment._id } }
    );

    res
      .status(201)
      .json({ message: "Comment created successfully", data: comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    const path = req.file.path;
    deleteUploadedFile({
      fieldname: "image",
      path,
    });
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

  console.log("req.file fileeee", req.file);

  try {
    const comment = await commentsModel.findById(id);

    if (!comment) {
      if (req.file) {
        const path = req.file.path;
        deleteUploadedFile({
          fieldname: "image",
          path,
        });
      }
      return next(new ApiError("Comment not found", 404));
    }

    if (req.user._id.toString() !== comment.author.toString()) {
      if (req.file) {
        const path = req.file.path;
        deleteUploadedFile({
          fieldname: "image",
          path,
        });
      }
      return next(
        new ApiError(`Only comment author can edit the comment.`, 400)
      );
    }

    if (req.file && comment.image) {
      const index = comment.image.indexOf("posts/comments");
      const path = `uploads/${comment.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
      updateFields.image = req.file.filename;
    }

    if (content) {
      updateFields.content = content;
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
    res.status(400).json({ message: "Error updating comment", error });
    next(error);
  }
});

exports.deleteComment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const comment = await commentsModel.findByIdAndDelete(id);
    if (!comment) {
      return next(new ApiError("Comment not found", 404));
    }

    // Remove the comment from the post's comments array
    await postsModel.findByIdAndUpdate(comment.post, {
      $pull: { comments: id },
    });

    if (comment.image) {
      const index = comment.image.indexOf("posts/comments");
      const path = `uploads/${comment.image.substring(index)}`;
      deleteUploadedFile({
        path,
      });
    }

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
