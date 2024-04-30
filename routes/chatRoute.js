const express = require("express");
const Router = express.Router();

const {
  createChat,
  getUserChats,
  findChat,
  findSpecificChat,
  startSupportchat,
  closeSupportChat,
} = require("../controllers/chatController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.route("/startSupportChat").post(
  allowedTo("teacher", "student"),
  startSupportchat
);

Router.route("/").get(getUserChats);

Router.route("/:chatId")
  .get(findSpecificChat)
  .put(allowedTo("superAdmin","admin"), enabledControls("chat","support"), closeSupportChat);

Router.route("/users/:firstId/:secondId").get(
  allowedTo("superAdmin","admin"),
  enabledControls("chat","support"),
  findChat
);

module.exports = Router;
