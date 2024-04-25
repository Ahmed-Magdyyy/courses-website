const express = require("express");
const Router = express.Router();

const {
  createNotification,
  getNotifications,
} = require("../controllers/notificationController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/")
  .post(allowedTo("superAdmin", "admin"), createNotification)
  .get(getNotifications);

module.exports = Router;
