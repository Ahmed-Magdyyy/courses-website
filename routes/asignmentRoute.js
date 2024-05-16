const express = require("express");
const Router = express.Router();

const {
  uploadAssignmentFile,
  submitAssignment,
  getAssignments,
} = require("../controllers/assignmentController");

const { protect, allowedTo, enabledControls } = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(uploadAssignmentFile, submitAssignment)
.get(
  allowedTo("superAdmin", "admin", "teacher", "student"),
  enabledControls("classes"),
  getAssignments)

// Router.route("/:id").get(getAssignments);

module.exports = Router;
