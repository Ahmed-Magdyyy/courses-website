const express = require("express");
const Router = express.Router();

const {
  uploadProductFiles,
  createProduct,
  getAllProducts,
  getProduct,
  editProduct,
  deleteProduct,
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
  .get(getAllProducts);

Router.route("/:id")
  .get(getProduct)
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
module.exports = Router;
