const { check, body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const userModel = require("../../models/userModel");
const slugify = require("slugify");
const bcrypt = require("bcrypt");

exports.getUserValidator = [
  check("id").isMongoId().withMessage("Invalid id format"),
  validatorMiddleware,
];

exports.createUserValidator = [
  check("name")
    .notEmpty()
    .withMessage("user name is required")
    .isLength({ min: 3 })
    .withMessage("too short name")
    .custom((value, { req }) => {
      req.body.slug = slugify(value);
      return true;
    }),
  check("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address")
    .custom((value) =>
      userModel.findOne({ email: value }).then((user) => {
        if (user) {
          return Promise.reject(new Error("Email already exists"));
        }
      })
    ),
  check("phone")
    .notEmpty()
    .withMessage("Phone is required")
    .isMobilePhone("ar-SA")
    .withMessage("Only Saudi Arabia phone numbers allowed"),
  check("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .custom((password, { req }) => {
      if (password !== req.body.confirmationPassword) {
        throw new Error("Password confirmation is incorrect");
      }
      return true;
    }),
  check("confirmationPassword")
    .notEmpty()
    .withMessage("Confirmation Pssword is required"),
  validatorMiddleware,
];

exports.updateUserValidator = [
  check("id").isMongoId().withMessage("Invalid user id format"),
  body("name")
    .optional()
    .custom((value, { req }) => {
      req.body.slug = slugify(value);
      return true;
    }),
  check("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address")
    .custom((value) =>
      userModel.findOne({ email: value }).then((user) => {
        if (user) {
          return Promise.reject(new Error("Email already exists"));
        }
      })
    ),
  check("phone")
    .optional()
    .isMobilePhone("ar-SA")
    .withMessage("Only Saudi Arabia phone numbers allowed"),
  validatorMiddleware,
];

exports.changeUserPasswordValidator = [
  check("id").isMongoId().withMessage("Invalid user id format"),
  check("currentPassword")
    .notEmpty()
    .withMessage("You must enter your current password")
    .custom(async (value, { req }) => {
      // verifying user's current password
      const user = await userModel.findById(req.params.id);
      if (!user) {
        throw new Error("no user found for this id");
      }

      const isCorrectPassword = await bcrypt.compare(
        req.body.currentPassword,
        user.password
      );
      if (!isCorrectPassword) {
        throw new Error("Current password is incorrect");
      }
    }),
  check("confirmationPassword")
    .notEmpty()
    .withMessage("You must enter confirmation password"),
  check("password")
    .notEmpty()
    .withMessage("You must enter a new password")
    .custom(async (value, { req }) => {
      // verifying new password = confirmation
      if (value !== req.body.confirmationPassword) {
        throw new Error("Password confirmation is incorrect");
      }
      return true;
    }),

  validatorMiddleware,
];

exports.deleteUserValidator = [
  check("id").isMongoId().withMessage("Invalid user id format"),
  validatorMiddleware,
];

exports.updateLoggedUserDataValidator = [
  body("name")
    .optional()
    .custom((value, { req }) => {
      req.body.slug = slugify(value);
      return true;
    }),
  check("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address")
    .custom((value) =>
      userModel.findOne({ email: value }).then((user) => {
        if (user) {
          return Promise.reject(new Error("Email already exists"));
        }
      })
    ),
  check("phone")
    .optional()
    .isMobilePhone("ar-SA")
    .withMessage("Only Saudi Arabia phone numbers allowed"),
  validatorMiddleware,
];

exports.updateLoggedUserPasswordValidator = [
  check("newPassword").notEmpty()
  .withMessage("Please enter your new password")
  .isLength({ min: 6 })
  .withMessage("Password must be at least 6 characters"),
  validatorMiddleware,
]