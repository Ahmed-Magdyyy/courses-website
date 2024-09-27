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
  getStudentsOfCourse,
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
    enabledControls("lms"),
    uploadCourseImage,
    createCourse
  )
  .get(
    allowedTo("superAdmin", "admin", "student", "guest"),
    enabledControls("lms"),
    getAllCourses
  );

Router.route("/:id")
  .get(
    allowedTo("superAdmin", "admin", "student", "guest"),
    enabledControls("lms"),
    getCourse
  )
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("lms"),
    uploadCourseImage,
    updateCourse
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("lms"),
    deleteCourse
  );

Router.route("/:id/addStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  addStudentsToCourse
);

Router.route("/:id/removeStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  removeStudentFromCourse
);

Router.route("/courseStudents/:courseId").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  getStudentsOfCourse
);

module.exports = Router;
