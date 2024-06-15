const express = require("express");
const Router = express.Router();

const {
  createPackage,
  getPackages,
  createCheckoutSession,
  updatePackage,
  deactivatePackage,
  reactivatePackage,
  managePackageSubscription,
  getPackageSubscriptions,
  getAllPaidInvoices,
} = require("../controllers/packagesController");

const { protect, allowedTo } = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(allowedTo("superAdmin"), createPackage).get(getPackages);

Router.route("/chackout-session/:packageId").post(
  allowedTo("student"),
  createCheckoutSession
);

Router.route("/manage-subscription").get(
  allowedTo("student"),
  managePackageSubscription
);

Router.route("/:packageId").put(allowedTo("superAdmin"), updatePackage);

Router.route("/:packageId/deactivate").put(
  allowedTo("superAdmin"),
  deactivatePackage
);
Router.route("/:packageId/reactivate").put(
  allowedTo("superAdmin"),
  reactivatePackage
);

Router.route("/subscriptions").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("packages"),
  getPackageSubscriptions
);
Router.route("/invoices").get(
  allowedTo("superAdmin"),
  enabledControls("packages"),
  getAllPaidInvoices
);
module.exports = Router;
