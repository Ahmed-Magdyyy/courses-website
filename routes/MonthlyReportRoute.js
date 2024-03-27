const express = require("express");
const Router = express.Router();

const {
    createReport,
    getReport

  } = require("../controllers/MonthlyReportController");
  
  const {
    protect,
    allowedTo,
    enabledControls,
  } = require("../controllers/authController");
  
  // applied on all routes
  Router.use(protect);

  Router.route("/").post(
    allowedTo("superAdmin", "admin", "teacher"),
    enabledControls("users", "classes"),
    createReport
  ).get(
    allowedTo("superAdmin", "admin", "teacher"),
    enabledControls("users", "classes"),
    getReport
  )

module.exports = Router;
