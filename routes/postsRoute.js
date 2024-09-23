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
  changePostVisibleTo,
  updatePostStatus,
} = require("../controllers/postController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
    enabledControls("timeline"),
    uploadPostMedia,
    createPost
  )
  .get(
    allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
    enabledControls("timeline"),
    getAllPosts
  );

Router.route("/:id")
  .get(
    allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
    enabledControls("timeline"),
    getPost
  )
  .put(
    allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
    enabledControls("timeline"),
    uploadPostMedia,
    editPost
  )
  .delete(
    allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
    enabledControls("timeline"),
    deletePost
  );

Router.route("/:id/like").put(
  allowedTo("superAdmin", "admin", "teacher", "student", "guest"),
  enabledControls("timeline"),
  toggleLike
);

Router.route("/:id/approve").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("timeline"),
  updatePostStatus
);

Router.route("/:id/visibleTo").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("timeline"),
  changePostVisibleTo
);

module.exports = Router;
