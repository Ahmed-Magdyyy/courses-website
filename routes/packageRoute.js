const express = require("express");
const Router = express.Router();

const {
  createPackage,
  getPackages,
  getSpeceficPackage,
  createCheckoutSession,
  updatePackage,
  deactivatePackage,
  reactivatePackage,
  managePackageSubscription,
  getPackageSubscriptions,
  getAllPaidInvoices,
} = require("../controllers/packagesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

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
  enabledControls("subscription"),
  getPackageSubscriptions
);

Router.route("/invoices").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("subscription"),
  getAllPaidInvoices
);

Router.route("/:packageId")
  .get(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscription"),
    getSpeceficPackage
  )
  .put(allowedTo("superAdmin"), updatePackage);

module.exports = Router;
