const express = require("express");
const Router = express.Router();

const {
  submitForm,
  getSubmissions,
} = require("../controllers/submittedFormController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

Router.route("/")
  .post(submitForm)
  .get(
    protect,
    allowedTo("suberAdmin", "admin"),
    enabledControls("forms"),
    getSubmissions
  );
