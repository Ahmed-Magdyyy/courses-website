const express = require("express");
const Router = express.Router();

const {
  createPost,
  getAllPosts,
  getPost,
  uploadPostImage,
  editPost,
  deletePost
} = require("../controllers/postController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(uploadPostImage, createPost).get(getAllPosts);

Router.route("/:id").get(getPost).put(uploadPostImage,editPost).delete(deletePost)

module.exports = Router;
