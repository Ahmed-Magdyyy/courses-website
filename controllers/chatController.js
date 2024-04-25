const asyncHandler = require("express-async-handler");
const chatModel = require("../models/chatModel");

const ApiError = require("../utils/ApiError");

exports.createChat = asyncHandler(async (req, res, next) => {
  const userID = req.user._id;
  const { receiverID } = req.body;

  if (!userID || !receiverID) {
    return next(
      new ApiError(
        `Both userID and receiverID are required to create a chat`,
        400
      )
    );
  }

  try {
    const chat = await chatModel.findOne({
      members: { $all: [userID, receiverID] },
    });

    if (chat) {
      return next(
        new ApiError(
          `There is a chat already exists between users: ${userID} & ${receiverID}`,
          400
        )
      );
    }

    const newChat = await chatModel.create({
      members: [userID, receiverID],
    });

    res
      .status(200)
      .json({ message: "chat created successfully", chat: newChat });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

exports.getUserChats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  try {
    const chats = await chatModel
      .find({ members: { $in: [userId] } })
      .sort({ createdAt: -1 })
      .populate("members", "_id name role");

    if (!chats) {
      return next(new ApiError(`No chats found`, 404));
    }

    res.status(200).json({ results: chats.length, chats });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

exports.findChat = asyncHandler(async (req, res, next) => {
  const { firstId, secondId } = req.params;

  try {
    const chat = await chatModel.findOne({
      members: { $all: [firstId, secondId] },
    });

    if (!chat) {
      return next(
        new ApiError(
          `There is no chat found between users: (${firstId}) & (${secondId})`,
          404
        )
      );
    }

    res.status(200).json({ chat });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

exports.findSpeceficChat = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;

  try {
    const chat = await chatModel
      .findById(chatId)
      .populate("members", "_id name role");

    if (!chat) {
      return next(
        new ApiError(`There is no chat found for this id ${chatId}`, 404)
      );
    }

    res.status(200).json({ chat });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});
