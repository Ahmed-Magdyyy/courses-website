const express = require("express");
const Router = express.Router();

const {
  createChat,
  getUserChats,
  findChat,
} = require("../controllers/chatController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.post("/", createChat)
  .get("/", getUserChats)
  .get("/users/:firstId/:secondId", findChat);

module.exports = Router;
