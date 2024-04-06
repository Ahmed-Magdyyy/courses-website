const express = require("express");
const Router = express.Router();

const {
  uploadCourseImage,
  createCourse,
  getAllCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  addStudentsToCourse,
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
  .get(
    allowedTo("superAdmin", "admin", "student"),
    enabledControls("courses"),
    getAllCourses
  );

Router.route("/:id")
  .get(allowedTo("superAdmin", "admin", "student"), getCourse)
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("courses"),
    uploadCourseImage,
    updateCourse
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("courses"),
    deleteCourse
  );

Router.route("/:id/addStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("courses"),
  addStudentsToCourse
);

Router.route("/:id/removeStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("courses"),
  removeStudentFromCourse
);

module.exports = Router;
