const express = require("express");
const Router = express.Router();

const {
  createmessage,
  getMessages,
  uploadPostMedia
} = require("../controllers/messageController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.post("/:chatId",uploadPostMedia, createmessage)
  .get("/:chatId", getMessages)

module.exports = Router;
