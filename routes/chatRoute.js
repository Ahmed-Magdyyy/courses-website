const express = require("express");
const Router = express.Router();

const {
  createChat,
  getUserChats,
  findChat,
  findSpeceficChat,
} = require("../controllers/chatController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/").post(createChat).get(getUserChats);

Router.route("/:chatId").get(findSpeceficChat)

Router.route("/users/:firstId/:secondId").get(findChat);


module.exports = Router;
