const express = require("express");
const Router = express.Router();

const {
  createForm,
  getForms,
  getSpecificForm,
  updateForm,
  deleteForm,
} = require("../controllers/formsController");

const {
  submitForm,
  getFormSubmissions,
  getSpeceficSubmission,
  deleteSubmission
} = require("../controllers/submittedFormController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

Router.route("/:formId/submissions").get(
  protect,
  allowedTo("superAdmin", "admin"),
  enabledControls("forms"),
  getFormSubmissions
);

Router.route("/submissions/:submissionId").get(
  protect,
  allowedTo("superAdmin", "admin"),
  enabledControls("forms"),
  getSpeceficSubmission
).delete(
  protect,
  allowedTo("superAdmin", "admin"),
  enabledControls("forms"),
  deleteSubmission
)

Router.route("/")
  .post(
    protect,
    allowedTo("superAdmin", "admin"),
    enabledControls("forms"),
    createForm
  )
  .get(getForms);

Router.route("/:formId")
  .get(getSpecificForm)
  .put(
    protect,
    allowedTo("superAdmin", "admin"),
    enabledControls("forms"),
    updateForm
  )
  .delete(
    protect,
    allowedTo("superAdmin", "admin"),
    enabledControls("forms"),
    deleteForm
  );

Router.route("/submit").post(submitForm);

Router.route("/submissions/delete/:submissionId").post(submitForm);



module.exports = Router;
