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

// const {
//   getUserValidator,
//   createUserValidator,
//   deleteUserValidator,
//   updateUserValidator,
//   changeUserPasswordValidator,
//   updateLoggedUserDataValidator,
//   updateLoggedUserPasswordValidator
// } = require("../utils/validators/userValidator");

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

Router.route("/")
  .get(allowedTo("superAdmin", "admin"), enabledControls("users"), getUsers)
  .post(allowedTo("superAdmin", "admin"), enabledControls("users"), createUser);

Router.route("/:id")
  .get(allowedTo("superAdmin", "admin"), enabledControls("users"), getUser)
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("users"),
    deleteUser
  )
  .put(allowedTo("superAdmin", "admin"), enabledControls("users"), updateUser);

Router.put(
  "/changePassword/:id",
  allowedTo("superAdmin", "admin"),
  enabledControls("users"),
  updateUserPassword
);

//----- /Admin Routes -----

Router.get(
  "/studentsOfTeacher",
  Router.use(allowedTo("teacher")),
  getTeacher_students
);

module.exports = Router;
