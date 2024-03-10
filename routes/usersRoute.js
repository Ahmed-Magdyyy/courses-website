const express = require("express");
const Router = express.Router();

const {
  //----- Admin Routes -----
  getUsers,
  getUser,
  createUser,
  deleteUser,
  updateuser,
  updateUserPassword,
  //----- /Admin Routes -----

  //----- User's Routes -----
  getLoggedUser,
  updateLoggedUserPassword,
  updateLoggedUserData,
  deleteLoggedUserData,
  //----- /User's Routes -----
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

Router.use(allowedTo("superAdmin", "admin"));

Router.route("/").get(enabledControls("users"), getUsers).post(createUser);

Router.route("/:id")
  .get(enabledControls("users"), getUser)
  .delete(enabledControls("users"), deleteUser)
  .put(enabledControls("users"), updateuser);

Router.put("/changePassword/:id", enabledControls("users"), updateUserPassword);

//----- /Admin Routes -----

module.exports = Router;
