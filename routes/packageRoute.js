const express = require("express");
const Router = express.Router();

const {
  createPackage,
  getPackages,
  createCheckoutSession,
  webhook
} = require("../controllers/packagesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(allowedTo("superAdmin"), createPackage).get(getPackages);

Router.route("/chackout-session/:packageId").post(allowedTo("student"),createCheckoutSession)

Router.route("/webhook").post(express.raw({ type: "application/json" }),webhook)


module.exports = Router;
