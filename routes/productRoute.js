const express = require("express");
const Router = express.Router();

const {
  uploadProductFiles,
  createProduct,
  getAllProducts,
  getProduct,
  editProduct,
  deleteProduct,
  addStudentsToProduct,
  removeStudentsFromProduct,
  getStudentsOfProduct,
} = require("../controllers/productsController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/")
  .post(
    allowedTo("superAdmin", "admin"),
    enabledControls("lms"),
    uploadProductFiles,
    createProduct
  )
  .get(
    allowedTo("superAdmin", "admin", "student", "guest"),
    enabledControls("lms"),
    getAllProducts
  );

Router.route("/:id")
  .get(
    allowedTo("superAdmin", "admin", "student", "guest"),
    enabledControls("lms"),
    getProduct
  )
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("lms"),
    uploadProductFiles,
    editProduct
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("lms"),
    deleteProduct
  );

Router.route("/:id/addStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  addStudentsToProduct
);

Router.route("/:id/removeStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  removeStudentsFromProduct
);

Router.route("/productStudents/:productId").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("lms"),
  getStudentsOfProduct
);

module.exports = Router;
