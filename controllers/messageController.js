const asyncHandler = require("express-async-handler");
const messageModel = require("../models/messageModel");
const chatModel = require("../models/chatModel");
const ApiError = require("../utils/ApiError");

exports.createmessage = asyncHandler(async (req, res, next) => {
  const { chatId, text } = req.body;

  const chat = await chatModel.findById(chatId);

  if (!chat) {
    return next(new ApiError(`No chat found for this chatid ${chatId}`, 404));
  }

  console.log(!chat.members.includes(req.user._id));
  if (!chat.members.includes(req.user._id)) {
    return next(
      new ApiError(
        `You can't access this chat since you are not a party in it`,
        401
      )
    );
  }

  try {
    const message = await messageModel.create({
      chatId,
      senderId: req.user._id,
      text,
    });

    res.status(200).json(message);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

exports.getMessages = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;
  console.log(req.query);
  try {
    const messages = await messageModel
      .find({ chatId })
      .sort({ createdAt: -1 })
      .populate("senderId", "_id name");

      if (!messages) {
        return next(new ApiError(`No messages found for this chatId ${chatId}`, 404));
      }

    res.status(200).json({ results: messages.length, messages });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
