const express = require("express");
const Router = express.Router();

const {
  uploadCommentImage,
  createComment,
  getCommentsForPost,
  getComment,
  updateComment,
  deleteComment,
  toggleLike,
} = require("../controllers/commentController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);
Router.use(
  allowedTo("superAdmin", "admin", "teacher", "student"),
  enabledControls("timeline")
);

Router.route("/post/:postId")
  .post(uploadCommentImage, createComment)
  .get(getCommentsForPost);

Router.route("/:id")
  .get(getComment)
  .put(uploadCommentImage, updateComment)
  .delete(deleteComment);

Router.route("/:id/like").put(toggleLike);
module.exports = Router;
