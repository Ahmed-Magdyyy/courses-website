const express = require("express");
const Router = express.Router();

const {authorize,redirect ,createMeeting , callBack} = require("../controllers/webexController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
// Router.use(protect);

Router.route("/authorize").get(authorize)
Router.route("/authorize/callback").get(callBack)


module.exports = Router;
