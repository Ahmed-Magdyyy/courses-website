const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const moment = require("moment-timezone");

const postsModel = require("../models/postModel");
const factory = require("./controllersFactory");
const ApiError = require("../utils/ApiError");

function deleteUploadedFile(file) {
  if (file) {
    const filePath = `${file.path}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting course image:", err);
      } else {
        console.log("Course image deleted successfully:", file.path);
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
    const filename = `post-${currentDate}-${currentTime}-${Math.floor(Math.random() * 1000000)}.${ext}`;
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

exports.uploadPostImage = (req, res, next) => {
  upload(req, res, function (err) {
    console.log("====================================");
    console.log(`posttt:`, req.file);
    console.log("====================================");
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

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
}).single("image");

exports.createPost = asyncHandler(async (req, res, next) => {
  const { author, content, image } = req.body;

  try {
    const post = await postsModel.create({ author, content, image });
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
  if (req.query) {
    filter = req.query;
  }

  const posts = await postsModel
    .find(filter)
    .populate("author", "_id name email phone role")
    .sort({ createdAt: -1 });
  res.status(200).json({ results: posts.length, data: posts });
});

exports.getPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const post = await postsModel
    .findById(id)
    .populate("author", "_id name email phone role");

  if (!post) {
    return next(new ApiError(`No post found for this ${id}`, 404));
  }

  res.status(200).json({ data: post });
});

exports.editPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    const post = await postsModel.findById(id);

    if (!post) {
      return next(new ApiError(`No post found for ${id}`, 404));
    }

    if (req.file && post.image) {
      const index = post.image.indexOf("posts");
      const path = `uploads/${post.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }

    // Update post details
    post.content = content;
    post.image = req.file.filename;

    // Save the updated post
    await post.save();

    res.status(200).json({ message: "Post updated successfully", data: post });
  } catch (error) {
    console.error("Error updating post:", error);
    next(error);
  }
});

exports.deletePost = asyncHandler(async (req, res, next)=> {
  const {id} = req.params

  const deletdPost = await postsModel.findByIdAndDelete(id)

  if (!deletdPost) {
    return next(new ApiError(`No post found for ${id}`, 404));
  }

  console.log('deleted post:', deletdPost);


  const index = deletdPost.image.indexOf("posts");
  const path = `uploads/${deletdPost.image.substring(index)}`;
  deleteUploadedFile({
    path,
  });

  res.status(204).send("Document deleted successfully");
})
