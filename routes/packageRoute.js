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
  getStudentInvoice,
  confirmBankTransferPayment,
  getBankTransferConfirmations,
} = require("../controllers/packagesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/invoices/student").get(
  allowedTo("superAdmin", "student"),
  getStudentInvoice
);

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    createPackage
  )
  .get(getPackages);

Router.route("/chackout-session/:packageId").post(
  allowedTo("student", "guest"),
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
  enabledControls("subscriptions"),
  getPackageSubscriptions
);

Router.route("/invoices").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("subscriptions"),
  getAllPaidInvoices
);

Router.route("/:packageId")
  .get(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    getSpeceficPackage
  )
  .put(allowedTo("superAdmin"), updatePackage);

Router.route("/bank-transfer")
  .post(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    confirmBankTransferPayment
  ).get(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    getBankTransferConfirmations
  );
module.exports = Router;
