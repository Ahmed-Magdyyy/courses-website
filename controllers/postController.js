const fs = require("fs");
const multer = require("multer");
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

exports.uploadPostMedia = (req, res, next) => {
  upload(req, res, function (err) {
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
      // Check file size for images
      if (
        file.mimetype.startsWith("image") &&
        file.size > 5 * 1024 * 1024 // 5 MB limit for images
      ) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Image file size exceeds 5 MB", 400));
      }
      // Add file information to req.body.media
      req.body.media = req.body.media || []; // Initialize req.body.media if it's undefined
      req.body.media.push({
        type: file.mimetype.startsWith("image") ? "image" : "video",
        url: file.filename,
      });
    });

    if (err) {
      if (req.files) {
        mediaFiles.forEach((file) => deleteUploadedFile(file));
      }
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }

    next();
  });
};

exports.createPost = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  const media = req.body.media || [];

  try {
    const post = await postsModel.create({
      author: req.user._id,
      content,
      media,
    });

    res.status(201).json({ message: "Success", data: post });
  } catch (error) {
    console.error("Error creating post:", error);
    // Delete the uploaded media files if post creation fails
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    res.status(400).json({ message: "Error creating post", error });
    next(error);
  }
});

exports.editPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { content, oldMedia } = req.body;
  const updateFields = {};

  console.log('====================================');
  console.log("req.body:", req.body);
  console.log("OLD MEDIA:", oldMedia);
  console.log('====================================');
  try {
    const post = await postsModel.findById(id);

    if (!post) {
      // Delete the uploaded media files if post not found
      if (req.files) {
        req.files.forEach((file) => deleteUploadedFile(file));
      }
      return next(new ApiError(`No post found for ${id}`, 404));
    }

    if (
      req.user._id.toString() !== post.author.toString() &&
      req.user.role !== "superAdmin" &&
      req.user.role !== "admin"
    ) {
      if (req.files) {
        req.files.forEach((file) => deleteUploadedFile(file));
      }
      return next(new ApiError(`Only post author can edit the post.`, 403));
    }

    // Update post content
    if (content) {
      updateFields.content = content;
    }

    let newFiles = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        newFiles.push({
          type: file.mimetype.startsWith("image") ? "image" : "video",
          url: file.filename,
        });
      });
      if (oldMedia) {
        updateFields.media = [...oldMedia, ...newFiles];
      } else {
        updateFields.media = newFiles;
      }
    } else {
      updateFields.media = oldMedia;
    }

    console.log('====================================');
const olddata = oldMedia;
    console.log("OLD MEDIA 22:", olddata);
    console.log("OLD MEDIA 33:", ...olddata);
    console.log('====================================');

    // Delete files that exist in post.media but not in oldMedia
    if (oldMedia && oldMedia.length > 0) {
      const mediaToDelete = post.media.filter((mediaItem) => {
        return !oldMedia.find(
          (oldMediaItem) => oldMediaItem.url === mediaItem.url
        );
      });

      // Update media URLs
      mediaToDelete.forEach((mediaItemToDelete) => {
        // Construct the file path and delete the file
        const filePath = `uploads/posts/${mediaItemToDelete.url}`;
        deleteUploadedFile({ path: filePath });
      });
    }

    // Update post in the database
    const updatedPost = await postsModel.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    const updatedPostWithMediaUrl = updatedPost.media.forEach((mediaItem) => {
      mediaItem.url = `${process.env.BASE_URL}/posts/${mediaItem.url}`;
    });

    res.status(200).json({
      message: "Post updated successfully",
      data: updatedPostWithMediaUrl,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    // Delete the uploaded media files if post updating fails
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    res.status(400).json({ message: "Error updating post", error });

    next(error);
  }
});

exports.deletePost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

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
      return next(new ApiError(`Only post author can delete the post.`, 403));
    }

    const comments = await commentModel.find({ post: id });

    // Delete images associated with deleted comments
    for (const comment of comments) {
      if (comment.media && comment.media > 0) {
        const index = comment.image.indexOf("posts/comments");
        const path = `uploads/${comment.image.substring(index)}`;
        deleteUploadedFile({ path });
      }
    }

    // Delete all comments associated with the deleted post
    await commentModel.deleteMany({ post: id });

    // Delete media files associated with the post
    if (post.media && post.media.length > 0) {
      post.media.forEach((mediaItem) => {
        // Construct the file path and delete the file
        const filePath = `uploads/posts/${mediaItem.url}`;
        deleteUploadedFile({ path: filePath });
      });
    }

    // Delete post document from DB
    await post.deleteOne();

    res.status(204).send("Post deleted successfully");
  } catch (error) {
    console.error("Error deleting post:", error);
    next(error);
  }
});

exports.getAllPosts = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  if (query) {
    filter = query;
  }

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await postsModel.countDocuments(filter);
  const totalPages = Math.ceil(totalPostsCount / limitNum);

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

  posts.forEach((post) => {
    if (post.media && post.media.length > 0) {
      post.media.forEach((mediaItem) => {
        mediaItem.url = `${process.env.BASE_URL}/posts/${mediaItem.url}`;
      });
    }
  });

  res
    .status(200)
    .json({ totalPages, page: pageNum, results: posts.length, data: posts });
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

  if (post.media && post.media.length > 0) {
    post.media.forEach((mediaItem) => {
      mediaItem.url = `${process.env.BASE_URL}/posts/${mediaItem.url}`;
    });
  }

  res.status(200).json({ data: post });
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
