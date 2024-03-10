const express = require("express");

const {
  signup,
  login,
  forgetPassword,
  verifyPasswordResetCode,
  resetPassword,
  protect,
  confirmEmail
} = require("../controllers/authController");

// const {
//   signupValidator,
//   loginValidator,
// } = require("../utils/validators/authValidator");

const Router = express.Router();

Router.post("/signup", signup);
Router.post("/login", login);
Router.post("/forgetPassword", forgetPassword);
Router.post("/verifyResetcode", verifyPasswordResetCode);
Router.put("/resetPassword", resetPassword);
Router.get("/confirm-email/:token", confirmEmail);

// Router.route("/:id")
//   .get(getUserValidator, getUser)
//   .delete(deleteUserValidator, deleteUser)
//   .put(updateUserValidator, updateuser);

module.exports = Router;
