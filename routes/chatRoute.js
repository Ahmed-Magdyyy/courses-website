const express = require("express");
const Router = express.Router();

const {
  createChat,
  getUserChats,
  findChat,
  findSpecificChat,
  startSupportchat,
  closeSupportChat,
  studentTeacherChat,
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

Router.route("/studentTeacherChat/:classID").post(
  allowedTo("student"),
  studentTeacherChat
);

Router.route("/").get(
  allowedTo("superAdmin", "admin", "teacher", "student"),
  enabledControls("messaging"),
  getUserChats
);

Router.route("/:chatId")
  .get(findSpecificChat)
  .put(
    allowedTo("superAdmin", "admin"),
    enabledControls("messaging"),
    closeSupportChat
  );

Router.route("/users/:firstId/:secondId").get(
  allowedTo("superAdmin", "admin"),
  enabledControls("messaging"),
  findChat
);

module.exports = Router;
