const express = require("express");
const Router = express.Router();

const {
  uploadCommentMedia,
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
  .post(uploadCommentMedia, createComment)
  .get(getCommentsForPost);

Router.route("/:id")
  .get(getComment)
  .put(uploadCommentMedia, updateComment)
  .delete(deleteComment);

Router.route("/:id/like").put(toggleLike);
module.exports = Router;
