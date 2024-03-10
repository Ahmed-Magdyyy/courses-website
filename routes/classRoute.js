const express = require("express");
const Router = express.Router();

const {
  createClass,
  getAllClasses,
  getClass,
  updateClass,
  deleteClass,
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

module.exports = Router;
