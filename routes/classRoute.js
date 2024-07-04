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
  getAllClassesByMonthYear,
  getClassesGroupedByMonthAndStatus,
  classCheckIn,
  classCheckOut,
  getClassCheckInOut
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
  .get(
    allowedTo("superAdmin", "admin", "teacher", "student"),
    enabledControls("classes"),
    getAllClasses
  );

  Router.route("/classesByMonth").get(
    allowedTo("superAdmin", "admin", "teacher", "student"),
    enabledControls("classes"),
    getClassesGroupedByMonthAndStatus
  );

Router.route("/month-year").get(
  allowedTo("superAdmin", "admin", "teacher", "student"),
  enabledControls("classes"),
  getAllClassesByMonthYear
);

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

Router.route("/:id/addStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("classes"),
  addStudentsToClass
);

Router.route("/:id/removeStudents").put(
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
  allowedTo("superAdmin", "admin"),
  enabledControls("classes"),
  cancelClass
);

Router.route("/:classId/checkIn").post(
  allowedTo("superAdmin","teacher"),
  classCheckIn
);

Router.route("/:classId/checkOut").put(
  allowedTo("superAdmin","teacher"),
  classCheckOut
);

Router.route("/checkInOut/:classId").get(
  allowedTo("superAdmin","admin","teacher"),
  enabledControls("classes"),
  getClassCheckInOut
);

module.exports = Router;
