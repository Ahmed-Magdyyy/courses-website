const express = require("express");
const Router = express.Router();

const {
  uploadAssignmentFile,
  submitAssignment,
  getAssignments,
} = require("../controllers/assignmentController");

const { protect } = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(uploadAssignmentFile, submitAssignment);

Router.route("/:id").get(getAssignments);

module.exports = Router;
