const express = require("express");
const Router = express.Router();

const {
  uploadProductFiles,
  createMaterial,
getAllMaterials,
getMaterial,
editMaterial,
deleteMaterial
} = require("../controllers/materialController");

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
    enabledControls("materials"),
    uploadProductFiles,
    createMaterial
  )
  .get(
    allowedTo("superAdmin", "admin", "teacher", "student"),
    enabledControls("materials"),
    getAllMaterials
  );

Router.route("/:id")
  .get(
    allowedTo("superAdmin", "admin", "teacher", "student"),
    enabledControls("materials"),
    getMaterial
  )
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("materials"),
    uploadProductFiles,
    editMaterial
  )
  .delete(
    allowedTo("superAdmin", "admin"),
    enabledControls("materials"),
    deleteMaterial
  );

module.exports = Router;
