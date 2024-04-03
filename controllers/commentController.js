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
    console.log("====================================");
    console.log(`commenttt:`, req.file);
    console.log("====================================");

    if (!req.file) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      // A Multer error occurred
      console.error("Multer Error:", err);
      deleteUploadedFile(req.file); // Delete the uploaded file
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    } else if (err) {
      // An unknown error occurred
      console.error("Unknown Error:", err);
      deleteUploadedFile(req.file); // Delete the uploaded file
      return next(new ApiError(err, 500));
    }
    // File uploaded successfully
    req.body.image = req.file.filename; // Set the image filename to req.body.image
    next();
  });
};

exports.createComment = asyncHandler(async (req, res, next) => {
  const { content, postID, image } = req.body;
  try {
    const post = await postsModel.findById(postID);
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
      post: postID,
      content,
      author: req.user._id,
      image,
    });

    // Add the comment to the post's comments array
    await postsModel.findOneAndUpdate(
      { _id: postID },
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
      .sort({ createdAt: -1 });

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
    const comment = await commentsModel.findById(id);
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

  const comment = await commentsModel.findById(id);

  if (!comment) {
    if (comment.image) {
      const path = req.file.path;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    return next(new ApiError("Comment not found", 404));
  }

  if (req.user._id.toString() !== comment.author.toString()) {
    const path = req.file.path;
    deleteUploadedFile({
      fieldname: "image",
      path,
    });
    return next(new ApiError(`Only comment author can edit the comment.`, 400));
  }

  try {
    if (req.file && comment.image) {
      const index = comment.image.indexOf("posts/comments");
      const path = `uploads/${comment.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });

      // Update the comment
      comment.image = req.file.filename;
      comment.content = content;

      await comment.save();

      res
        .status(200)
        .json({ message: "Comment updated successfully", data: comment });
    } else {
      res.status(400).json({ message: "Error updating comment" });
    }
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
  const userId = req.user._id

  try {
    // Check if the post exists
    const comment = await commentsModel.findById(id);
    if (!comment) {
      return next(new ApiError("Comment not found", 404));
    }

    // Check if the user has already liked the post
    const userIndex = comment.likes.users.indexOf(userId);
    if (userIndex === -1) {
      // User hasn't liked the comment, so add like
      comment.likes.users.push(userId);
      comment.likes.count++;
    } else {
      // User has liked the comment, so remove like
      comment.likes.users.splice(userIndex, 1);
      comment.likes.count--;
    }

    // Save the updated post
    await comment.save();

    res.status(200).json({ message: "Toggle like successful", data: comment });
  } catch (error) {
    console.error("Error toggling like:", error);
    next(error);
  }
});