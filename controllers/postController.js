const fs = require("fs");
const multer = require("multer");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");

const postsModel = require("../models/postModel");
const userModel = require("../models/userModel");
const commentModel = require("../models/commentModel");
const ApiError = require("../utils/ApiError");
const Notification = require("../models/notificationModel");
const sendEmail = require("../utils/sendEmails");
const { getIO } = require("../socketConfig");
const { devNull } = require("os");

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
      if (file.mimetype.startsWith("video") && file.size > 50 * 1024 * 1024) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Video file size exceeds 50 MB", 400));
      }
      // Check file size for images
      if (
        file.mimetype.startsWith("image") &&
        file.size > 10 * 1024 * 1024 // 10 MB limit for images
      ) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Image file size exceeds 10 MB", 400));
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
  const { content, url, visibleTo } = req.body;
  const media = req.body.media || [];

  const allowedVisibleToValues = ["student", "teacher", "admin"];

  // Validate visibleTo field
  if (visibleTo && !Array.isArray(visibleTo)) {
    return next(
      new ApiError(`Invalid visibleTo value, it should be an array`, 400)
    );
  }

  if (
    visibleTo &&
    !visibleTo.every((v) => allowedVisibleToValues.includes(v))
  ) {
    return next(new ApiError(`Invalid visibleTo values`, 400));
  }

  // Default to all roles if visibleTo is not provided
  let postVisibleTo = ["student", "teacher", "admin"]; //Default value

  if (visibleTo && visibleTo.length > 0) {
    postVisibleTo = visibleTo;
  }

  try {
    const post = await postsModel.create({
      author: req.user._id,
      content,
      media,
      url,
      status:
        req.user.role === "superAdmin" || req.user.role === "admin"
          ? "approved"
          : "pending",
      visibleTo: postVisibleTo,
    });

    const superAdmin = await userModel.findOne({ role: "superAdmin" });

    let img =
      "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

    let capitalizeFirstLetterOfName =
      superAdmin.name.split(" ")[0].charAt(0).toUpperCase() +
      superAdmin.name.split(" ")[0].slice(1).toLocaleLowerCase();

    let emailTamplate = `<!DOCTYPE html>
    <html lang="en-US">
      <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Your remaining classes credit is running out</title>
        <meta name="description" content="Your remaining classes credit is running out" />
        <style type="text/css">
          a:hover {
            text-decoration: underline !important;
          }
        </style>
      </head>
    
      <body
        marginheight="0"
        topmargin="0"
        marginwidth="0"
        style="margin: 0px; background-color: #f2f3f8"
        leftmargin="0"
      >
        <!--100% body table-->
        <table
          cellspacing="0"
          border="0"
          cellpadding="0"
          width="100%"
          bgcolor="#f2f3f8"
          style="
            @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
            font-family: 'Open Sans', sans-serif;
          "
        >
          <tr>
            <td>
              <table
                style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                width="100%"
                border="0"
                align="center"
                cellpadding="0"
                cellspacing="0"
              >
                <tr>
                  <td style="height: 80px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="text-align: center">
                    <a
                      href="https://learning.jawwid.com"
                      title="logo"
                      target="_blank"
                    >
                      <img width="250" src="${img}" title="logo" alt="logo" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="height: 20px">&nbsp;</td>
                </tr>
                <tr>
                  <td>
                    <table
                      width="95%"
                      border="0"
                      align="center"
                      cellpadding="0"
                      cellspacing="0"
                      style="
                        max-width: 670px;
                        background: #fff;
                        border-radius: 3px;
                        text-align: center;
                        -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      "
                    >
                      <tr>
                        <td style="height: 40px">&nbsp;</td>
                      </tr>
                      <tr>
                        <td style="padding: 0 35px">
                          <span
                            style="
                              display: inline-block;
                              vertical-align: middle;
                              margin: 29px 0 26px;
                              border-bottom: 1px solid #cecece;
                              width: 200px;
                            "
                          ></span>
                          <p
                            style="
                              color: #455056;
                              font-size: 17px;
                              line-height: 24px;
                              text-align: left;
                            "
                          >
                            Hello ${capitalizeFirstLetterOfName},
                          </p>
                          <p
                            style="
                              color: #455056;
                              font-size: 17px;
                              line-height: 24px;
                              text-align: left;
                            "
                          >
                          User <span style="font-weight: 600">${req.user.name}</span> submitted a post and needs your approval.
                          <br>
                          <br>
                          You can either approve or delete that post.
                        </p>
                          
    
                          <br>
                          <p
                            style="
                              margin-top: 3px;
                              color: #455056;
                              font-size: 17px;
                              line-height: 2px;
                              text-align: left;
                            "
                          >
                            The Jawwid Team.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="height: 40px">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
    
                <tr>
                  <td style="height: 20px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="text-align: center">
                    <p
                      style="
                        font-size: 14px;
                        color: rgba(69, 80, 86, 0.7411764705882353);
                        line-height: 18px;
                        margin: 0 0 0;
                      "
                    >
                      &copy; <strong>https://learning.jawwid.com</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="height: 80px">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--/100% body table-->
      </body>
    </html>`;

    if (req.user.role !== "superAdmin") {
      try {
        await sendEmail({
          email: superAdmin.email,
          subject: `${capitalizeFirstLetterOfName}, User ${req.user.name} submitted a post`,
          message: emailTamplate,
        });
        console.log("Email sent");
      } catch (error) {
        console.log(error);
      }

      const superAdminNotification = await Notification.create({
        scope: "post",
        userId: superAdmin._id,
        relatedId: post._id,
        message: `${req.user.name} submitted a post and needs your approval.`,
      });
    }

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
  const { content, url, oldMedia } = req.body;
  const updateFields = {};

  let ParsedOldMedia;
  if (oldMedia) {
    ParsedOldMedia = JSON.parse(oldMedia);
  }

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

    if (url) {
      if (req.user.role === "superAdmin" || req.user.role === "admin") {
        updateFields.url = url;
      } else {
        updateFields.url = null;
      }
    }

    let newFiles = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        newFiles.push({
          type: file.mimetype.startsWith("image") ? "image" : "video",
          url: file.filename,
        });
      });
      if (ParsedOldMedia) {
        const allFiles = [...ParsedOldMedia, ...newFiles];
        if (allFiles.length > 10) {
          if (req.files) {
            req.files.forEach((file) => deleteUploadedFile(file));
          }

          return next(
            new ApiError(
              `Maximum number of media is 10, please delete some media files`,
              400
            )
          );
        } else {
          updateFields.media = allFiles;
        }
      } else {
        updateFields.media = newFiles;
      }
    } else {
      updateFields.media = ParsedOldMedia;
    }

    // Delete files that exist in post.media but not in oldMedia
    if (ParsedOldMedia && ParsedOldMedia.length > 0) {
      const mediaToDelete = post.media.filter((mediaItem) => {
        return !ParsedOldMedia.find(
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

    // res.status(200).json({message: true, oldMedia})
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
    await Notification.deleteMany({ relatedId: post._id.toString() });

    res.status(204).send("Post deleted successfully");
  } catch (error) {
    console.error("Error deleting post:", error);
    next(error);
  }
});

exports.getAllPosts = asyncHandler(async (req, res, next) => {
  let filter = { status: "approved" }; // Filter for approved posts by default
  const { page, limit, status, ...query } = req.query;

  // Check if status is "pending" and adjust the filter based on the user's role
  if (status && status === "pending") {
    if (req.user.role !== "superAdmin") {
      // For non-superAdmin users, only allow viewing their own pending posts
      filter = { status: "pending", author: req.user._id };
    } else {
      // For superAdmin users, allow viewing all pending posts
      filter.status = "pending";
    }
  }

  if (status) {
    filter.status = status;
  }

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
    } else {
      filter[key] = query[key];
    }
  });

  // Adjust filter based on user's role
  if (req.user.role !== "superAdmin") {
    if (req.user.role === "guest") {
      // Treat guest users as students
      filter.visibleTo = { $in: ["student"] };
    } else {
      filter.visibleTo = { $in: req.user.role };
    }
  }

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await postsModel.countDocuments(filter);
  const totalPages = Math.ceil(totalPostsCount / limitNum);

  const posts = await postsModel
    .find(filter)
    .populate("author", "_id name email phone role image")
    .populate("likes.users", "_id name")
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

    const validPosts = posts.filter(post => post.author !== null);


    validPosts.forEach((post) => {
    if (post.media && post.media.length > 0) {
      post.media.forEach((mediaItem) => {
        mediaItem.url = `${process.env.BASE_URL}/posts/${mediaItem.url}`;
      });
    }

    console.log("====================================");
    console.log("post.author", post);
    console.log("====================================");

    // if (post.author !== null) {
      if (post.author.image !== null) {
        const baseUrl = "https://api.jawwid.com/users/";
        if (!post.author.image.startsWith(baseUrl)) {
          post.author.image = `${baseUrl}${post.author.image}`;
        }
      }
    // }
  });

  res
    .status(200)
    .json({ totalPages, page: pageNum, results: validPosts.length, data: validPosts });
});

exports.getPost = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let filter = { _id: id }; // Filter for approved posts by default

  // Adjust filter based on user's role
  if (req.user.role !== "superAdmin") {
    filter.visibleTo = { $in: req.user.role };
  }

  const post = await postsModel
    .findOne(filter)
    .populate("author", "_id name email phone role image")
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

  if (post.author.image !== null) {
    const baseUrl = "https://api.jawwid.com/users/";
    if (!post.author.image.startsWith(baseUrl)) {
      post.author.image = `${baseUrl}${post.author.image}`;
    }
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

      const postOwnernotification = await Notification.create({
        scope: "post",
        userId: post.author.toString(),
        relatedId: id,
        message: `${req.user.name} liked your post.`,
      });

      // Emit notifications students
      const { io, users } = getIO();
      if (users.length > 0) {
        const connectedPostOwner = users.filter(
          (user) => user.userId === post.author.toString()
        );

        if (connectedPostOwner && connectedPostOwner.length > 0) {
          const { userId, scope, message, _id, createdAt } =
            postOwnernotification;
          io.to(connectedPostOwner[0].socketId).emit("notification", {
            scope,
            postOwner: userId,
            userLikedThePost: req.user._id,
            postId: id,
            message,
            notificationId: _id,
            createdAt,
          });
        }
      }
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

exports.updatePostStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const updatedPost = await postsModel.findByIdAndUpdate(
      { _id: id },
      { $set: { status: "approved" } },
      { new: true }
    );

    if (!updatedPost) {
      return next(new ApiError(`No post found for ${id}`, 404));
    }

    // Check if the user is authorized to update the status
    if (req.user.role !== "superAdmin") {
      return next(new ApiError(`Only superAdmin can update the status.`, 403));
    }

    res.status(200).json({
      message: "Post status updated to approved successfully",
      data: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post status:", error);
    res.status(400).json({ message: "Error updating post status", error });
  }
});

exports.changePostVisibleTo = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { visibleTo } = req.body;

  const allowedVisibleToValues = ["student", "teacher", "admin"];
  if (
    !Array.isArray(visibleTo) ||
    visibleTo.some((role) => !allowedVisibleToValues.includes(role))
  ) {
    return next(new ApiError(`Invalid visibleTo values: ${visibleTo}`, 400));
  }

  try {
    const updatedPost = await postsModel.findByIdAndUpdate(
      id,
      { $set: { visibleTo } },
      { new: true }
    );

    if (!updatedPost) {
      return next(new ApiError(`No post found for ${id}`, 404));
    }

    res.status(200).json({
      message: "Post visibility updated successfully",
      data: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post visibility:", error);
    res.status(400).json({ message: "Error updating post visibility", error });
  }
});
