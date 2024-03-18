const express = require("express");
const Router = express.Router();

const {
  uploadCourseImage,
  createCourse,
  getAllCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  addStudentToCourse,
  removeStudentFromCourse,
} = require("../controllers/coursesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin"),
    enabledControls("courses"),
    uploadCourseImage,
    createCourse
  )
  .get(getAllCourses);

Router.route("/:id")
  .get(getCourse)
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("courses"),
    updateCourse
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("courses"),
    deleteCourse
  );

Router.route("/:id/addStudent").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("courses"),
  addStudentToCourse
);

Router.route("/:id/removeStudent").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("courses"),
  removeStudentFromCourse
);

module.exports = Router;
