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
    enabledControls("products"),
    uploadProductFiles,
    createProduct
  )
  .get(allowedTo("superAdmin", "admin", "student"), getAllProducts);

Router.route("/:id")
  .get(allowedTo("superAdmin", "admin", "student"), getProduct)
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("products"),
    uploadProductFiles,
    editProduct
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("products"),
    deleteProduct
  );

Router.route("/:id/addStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("products"),
  addStudentsToProduct
);

Router.route("/:id/removeStudents").put(
  allowedTo("superAdmin", "admin"),
  enabledControls("products"),
  removeStudentsFromProduct
);

Router.route("/productStudents/:productId").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("products"),
  getStudentsOfProduct
);

module.exports = Router;