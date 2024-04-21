const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");

const postsModel = require("../models/postModel");
const commentModel = require("../models/commentModel");
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
    cb(null, "uploads/posts");
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1];
    const currentDate = moment.tz("Africa/Cairo").format("DDMMYYYY");
    const currentTime = moment.tz("Africa/Cairo").format("HH-mm-ss");
    const filename = `post-${currentDate}-${currentTime}-${Math.floor(
      Math.random() * 1000000
    )}.${ext}`;
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

exports.uploadPostImage = (req, res, next) => {
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

exports.createPost = asyncHandler(async (req, res, next) => {
  const { content, image } = req.body;

  try {
    const post = await postsModel.create({
      author: req.user._id,
      content,
      image,
    });

    res.status(201).json({ message: "Success", data: post });
  } catch (error) {
    console.error("Error creating course:", error);
    // Delete the uploaded image file if post creation fails
    if (req.file) {
      deleteUploadedFile(req.file);
    }
    next(error);
  }
});

exports.getAllPosts = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  if (query) {
    filter = query;
  }

  const posts = await postsModel
    .find(filter)
    .populate("author", "_id name email phone role")
    .populate("likes.users", "_id name")
    .populate({
      path: "comments",
      select: "-__v -post",
      populate: {
        path: "author",
        select: "_id name",
      },
    })
    .populate({
      path: "comments",
      select: "-__v -post",
      populate: {
        path: "likes.users",
        select: "_id name",
      },
    })
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);
  res.status(200).json({ results: posts.length, page: pageNum, data: posts });
});

exports.getPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const post = await postsModel
    .findById(id)
    .populate("author", "_id name email phone role")
    .populate("likes.users", "_id name")
    .populate("comments", "_id name")
    .populate({
      path: "comments",
      select: "-__v -post",
      populate: {
        path: "author",
        select: "_id name",
      },
    })
    .populate({
      path: "comments",
      select: "-__v -post",
      populate: {
        path: "likes.users",
        select: "_id name",
      },
    });

  if (!post) {
    return next(new ApiError(`No post found for this ${id}`, 404));
  }

  res.status(200).json({ data: post });
});

exports.editPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { content } = req.body;
  const updateFields = {};

  try {
    const post = await postsModel.findById(id);

    if (!post) {
      return next(new ApiError(`No post found for ${id}`, 404));
    }

    if (
      req.user._id.toString() !== post.author.toString() &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "admin"
    ) {
      if (req.file) {
        const path = req.file.path;
        deleteUploadedFile({
          fieldname: "image",
          path,
        });
      }
      return next(new ApiError(`Only post author can edit the post.`, 403));
    }

    if (req.file && post.image) {
      const index = post.image.indexOf("posts");
      const path = `uploads/${post.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
      updateFields.image = req.file.filename; // Update image field in case of a new file
    }

    // Update post content
    if (content) {
      updateFields.content = content;
    }

    // Update post in the database
    const updatedPost = await postsModel.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    res
      .status(200)
      .json({ message: "Post updated successfully", data: updatedPost });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(400).json({ message: "Error updating post", error });
    next(error);
  }
});

exports.deletePost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const Post = await postsModel.findById(id);

  if (!Post) {
    return next(new ApiError(`No post found for ${id}`, 404));
  }

  if (
    req.user._id.toString() !== post.author.toString() &&
    req.user.role !== "superAdmin" &&
    req.user.role !== "admin"
  ) {
    if (req.file) {
      const path = req.file.path;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    return next(new ApiError(`Only post author can delete the post.`, 400));
  }

  const comments = await commentModel.find({ post: id });

  // Delete images associated with deleted comments
  for (const comment of comments) {
    if (comment.image) {
      const index = comment.image.indexOf("posts/comments");
      const path = `uploads/${comment.image.substring(index)}`;
      deleteUploadedFile({ path });
    }
  }

  // Delete all comments associated with the deleted post
  await commentModel.deleteMany({ post: id });

  if (Post.image) {
    const index = Post.image.indexOf("posts");
    const Post_path = `uploads/${Post.image.substring(index)}`;
    console.log("====================================");
    console.log("Post.image:", Post.image);
    console.log("path:", Post_path);
    console.log("====================================");
    deleteUploadedFile({
      path: Post_path,
    });
  }

  // Delete Post document from DB
  await Post.deleteOne({ id });

  res.status(204).send("Document deleted successfully");
});

exports.toggleLike = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    // Check if the post exists
    const post = await postsModel.findById(id);
    if (!post) {
      return next(new ApiError("Post not found", 404));
    }

    // Check if the user has already liked the post
    const userIndex = post.likes.users.indexOf(userId);
    let updateOperation;
    let message;

    if (userIndex === -1) {
      // User hasn't liked the post, so add like
      updateOperation = {
        $push: { "likes.users": userId },
        $inc: { "likes.count": 1 },
      };
      message = "You liked the post";
    } else {
      // User has liked the post, so remove like
      updateOperation = {
        $pull: { "likes.users": userId },
        $inc: { "likes.count": -1 },
      };
      message = "Like removed";
    }

    // Update the post
    const updatedPost = await postsModel.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true }
    );

    res.status(200).json({ message, data: updatedPost });
  } catch (error) {
    console.error("Error toggling like:", error);
    next(error);
  }
});
