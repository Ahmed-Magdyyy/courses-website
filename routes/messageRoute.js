const express = require("express");
const Router = express.Router();

const {
  createmessage,
  getMessages,
} = require("../controllers/messageController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.post("/", createmessage)
  .get("/:chatId", getMessages)

module.exports = Router;
