const express = require("express");
const Router = express.Router();

const { sendMessage, getMessages } = require("../controllers/chatController");

const {
  protect,
  allowedTo,
  enabledControls,
} = require("../controllers/authController");

// applied on all routes
Router.use(protect);

Router.post("/sendMessage", sendMessage).get("/messages", getMessages)

module.exports = Router;
