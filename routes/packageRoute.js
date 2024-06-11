const express = require("express");
const Router = express.Router();

const {
  createPackage,
  getPackages,
  createCheckoutSession,
} = require("../controllers/packagesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(allowedTo("superAdmin"), createPackage).get(getPackages);

Router.route("/chackout-session/:packageId").post(createCheckoutSession)


module.exports = Router;
