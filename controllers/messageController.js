const asyncHandler = require("express-async-handler");
const moment = require("moment-timezone");

const messageModel = require("../models/messageModel");
const chatModel = require("../models/chatModel");
const ApiError = require("../utils/ApiError");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

exports.createmessage = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const { text } = req.body;
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  const chat = await chatModel.findById(chatId);

  if (!chat) {
    return next(new ApiError(`No chat found for this chatid ${chatId}`, 404));
  }

  if (!chat.members.includes(req.user._id)) {
    return next(
      new ApiError(
        `You can't access this chat since you are not a party in it`,
        401
      )
    );
  }

  const chatData = await chat.populate("members", "_id name role");

  const receiver = chatData.members.find(
    (u) => u._id.toString() !== req.user._id.toString()
  );

  try {
    const Message = await messageModel.create({
      chatId,
      senderId: req.user._id,
      text,
    });

    // send offline notification to message receiver
    const notification = await Notification.create({
      scope: "message",
      userId: receiver._id,
      message: `You got a new message from ${req.user.name} -${req.user.role}`,
    });

    const { userId, scope, message, _id, createdAt } = notification;

    // Emit the notification to message receiver
    const { io, users } = getIO();

    if (users.length > 0) {
      const user = users.find(
        (user) => user.userId.toString() === receiver._id.toString()
      );
      console.log("pppp")
      console.log("user",user)
      console.log("receiver._id.toString()",receiver._id.toString())
      console.log("user.userId.toString()",user.userId.toString())
      console.log("receiver._id.toString() == user.userId.toString()",receiver._id.toString() === user.userId.toString())

      if (user !== undefined) {
        console.log("hhhhhhh")
        io.to(user.socketId).emit("notification", {
          userId,
          scope,
          message,
          _id,
          createdAt,
        });
      }
    }

    res
      .status(200)
      .json({
        message: `message sent successfully, and a notification was sent to user ${receiver._id}`,
        messageSent: Message,
        notification: { userId, scope, message, _id, createdAt },
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

exports.getMessages = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const { page, limit, skip } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalMessageCount = await messageModel.countDocuments({ chatId });
  const totalPages = Math.ceil(totalMessageCount / limitNum);
  try {
    const messages = await messageModel
      .find({ chatId })
      .sort({ createdAt: -1 })
      .populate("senderId", "_id name")
      .skip(skipNum)
      .limit(limitNum);

    if (!messages) {
      return next(
        new ApiError(`No messages found for this chatId ${chatId}`, 404)
      );
    }

    res
      .status(200)
      .json({ totalPages, page: pageNum, results: messages.length, messages });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
