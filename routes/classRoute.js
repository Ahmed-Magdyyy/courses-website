const express = require("express");
const Router = express.Router();

const {
  createClass,
  getAllClasses,
  getClass,
  updateClass,
  deleteClass,
  addStudentsToClass,
  removeStudentFromClass,
  classReport,
  cancelClass,
  zoomWebHook
} = require("../controllers/classesController");

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
    enabledControls("classes"),
    createClass
  )
  .get(getAllClasses);

Router.route("/:id")
  .get(getClass)
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("classes"),
    updateClass
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("classes"),
    deleteClass
  );

Router.route("/:id/addStudent").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("classes"),
  addStudentsToClass
);

Router.route("/:id/removeStudent").delete(
  allowedTo("superAdmin", "admin"),
  enabledControls("classes"),
  removeStudentFromClass
);

Router.route("/:id/classReport").put(
  allowedTo("superAdmin", "admin", "teacher"),
  enabledControls("classes"),
  classReport
);

Router.route("/:id/cancelClass").put(
  allowedTo("superAdmin", "admin", "teacher"),
  enabledControls("classes"),
  cancelClass
);

module.exports = Router;
