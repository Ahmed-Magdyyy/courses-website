const express = require("express");
const Router = express.Router();

const {
  //----- Admin Routes -----
  getUsers,
  getUser,
  createUser,
  deleteUser,
  updateUser,
  updateUserPassword,
  //----- /Admin Routes -----

  //----- User's Routes -----
  getLoggedUser,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
  //----- /User's Routes -----
  getTeacher_students,
} = require("../controllers/usersController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

//----- User Routes -----

// applied on all routes
Router.use(protect);

Router.get("/getLoggedUser", getLoggedUser, getUser);
Router.put("/updateLoggedUserPassword", updateLoggedUserPassword);
Router.put("/updateLoggedUserData", updateLoggedUserData);
Router.delete("/deleteLoggedUserData", deleteLoggedUserData);

//----- /User Routes -----

//----- Admin Routes -----
Router.get(
  "/studentsOfTeacher",
  allowedTo("superAdmin", "admin", "teacher"),
  enabledControls("users"),
  getTeacher_students
);

Router.use(allowedTo("superAdmin", "admin"));
Router.use(enabledControls("users"));

Router.route("/").get(getUsers).post(createUser);

Router.route("/:id").get(getUser).delete(deleteUser).put(updateUser);

Router.put("/changePassword/:id", updateUserPassword);

//----- /Admin Routes -----

module.exports = Router;
