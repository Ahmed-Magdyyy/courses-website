const express = require("express");
const Router = express.Router();

const {
  createPost,
  getAllPosts,
  getPost,
  uploadPostMedia,
  editPost,
  deletePost,
  toggleLike,
} = require("../controllers/postController");

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
 
Router.route("/").post(uploadPostMedia, createPost).get(getAllPosts);

Router.route("/:id")
  .get(getPost)
  .put(uploadPostMedia, editPost)
  .delete(deletePost);
Router.route("/:id/like").put(toggleLike);

module.exports = Router;
