const express = require("express");
const Router = express.Router();

const { getCallBack } = require("../controllers/zoomCallBack");

const {
    protect,
    allowedTo,
    enabledControls,
  } = require("../controllers/authController");

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin"),
    getCallBack
  )

module.exports = Router;
