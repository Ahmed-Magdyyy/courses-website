const express = require("express");
const Router = express.Router();

const {
  createPackage,
  getPackages,
  getSpeceficPackage,
  createCheckoutSession,
  createOneTimePaymentSession,
  updatePackage,
  deactivatePackage,
  reactivatePackage,
  managePackageSubscription,
  getPackageSubscriptions,
  getAllPaidInvoices,
  getStudentInvoice,
  confirmBankTransferPayment,
  getBankTransfer,
} = require("../controllers/packagesController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/bank-transfer")
  .post(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    confirmBankTransferPayment
  )
  .get(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    getBankTransfer
  );

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

Router.route("/oneTime-chackout-session/:packageId").post(
  allowedTo("student", "guest"),
  createOneTimePaymentSession
);

Router.route("/manage-subscription").get(
  allowedTo("student"),
  managePackageSubscription
);

Router.route("/:packageId/deactivate").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("subscriptions"),
  deactivatePackage
);
Router.route("/:packageId/reactivate").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("subscriptions"),
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
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("subscriptions"),
    updatePackage
  );

module.exports = Router;
