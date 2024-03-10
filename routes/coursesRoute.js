const express = require("express");
const Router = express.Router();

const {
  createCourse,
  getAllCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  addStudentstoCourse,
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
  addStudentstoCourse
);

Router.route("/:id/removeStudent").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("courses"),
  removeStudentFromCourse
);

module.exports = Router;