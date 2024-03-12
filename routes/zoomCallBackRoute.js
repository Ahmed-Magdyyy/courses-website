const express = require("express");
const Router = express.Router();

const { getCallBack } = require("../controllers/zoomCallBack");

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin"),
    getCallBack
  )

module.exports = Router;
