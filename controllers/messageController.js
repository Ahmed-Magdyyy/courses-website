const fs = require("fs");
const multer = require("multer");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");

const messageModel = require("../models/messageModel");
const chatModel = require("../models/chatModel");
const ApiError = require("../utils/ApiError");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

function deleteUploadedFile(file) {
  if (file) {
    const filePath = `${file.path}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting image:", err);
      } else {
        console.log("Image deleted successfully:", file.path);
      }
    });
  }
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/messages");
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1];
    const currentDate = moment.tz("Africa/Cairo").format("DDMMYYYY");
    const currentTime = moment.tz("Africa/Cairo").format("HH-mm-ss");
    const filename = `message-${currentDate}-${currentTime}-${Math.floor(
      Math.random() * 1000000
    )}.${ext}`;
    cb(null, filename);
  },
});

const multerfilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image") || file.mimetype.startsWith("video")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images and videos are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
  limits: {
    files: 10, // Limit total number of files to 10
  },
}).array("media", 10); // Accept up to 10 media files

exports.uploadPostMedia = (req, res, next) => {
  upload(req, res, function (err) {
    let mediaFiles = [];

    // Check uploaded files
    if (req.files) mediaFiles = req.files;

    // Check the total number of files
    if (mediaFiles.length > 10) {
      // Delete uploaded files
      mediaFiles.forEach((file) => deleteUploadedFile(file));
      return next(new ApiError("Exceeded maximum number of files (10)", 400));
    }

    // Validate each file
    mediaFiles.forEach((file) => {
      if (
        !file.mimetype.startsWith("image") &&
        !file.mimetype.startsWith("video")
      ) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Only images and videos are allowed", 400));
      }
      // Check file size for videos
      if (file.mimetype.startsWith("video") && file.size > 25 * 1024 * 1024) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Video file size exceeds 25 MB", 400));
      }
      // Check file size for images
      if (
        file.mimetype.startsWith("image") &&
        file.size > 5 * 1024 * 1024 // 5 MB limit for images
      ) {
        // Delete uploaded files
        mediaFiles.forEach((file) => deleteUploadedFile(file));
        return next(new ApiError("Image file size exceeds 5 MB", 400));
      }
      // Add file information to req.body.media
      req.body.media = req.body.media || []; // Initialize req.body.media if it's undefined
      req.body.media.push({
        type: file.mimetype.startsWith("image") ? "image" : "video",
        url: file.filename,
      });
    });

    if (err) {
      if (req.files) {
        mediaFiles.forEach((file) => deleteUploadedFile(file));
      }
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }

    next();
  });
};

exports.createmessage = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const { text } = req.body;
  const media = req.body.media || [];

  // Check if text field is empty
  if (!text.trim()) {
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    return next(new ApiError("Message text cannot be empty", 400));
  }

  const chat = await chatModel.findById(chatId);

  if (!chat) {
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    return next(new ApiError(`No chat found for this chatid ${chatId}`, 404));
  }

  if (!chat.members.includes(req.user._id)) {
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    return next(
      new ApiError(
        `You can't access this chat since you are not a member in it`,
        401
      )
    );
  }

  if (chat.status === "closed") {
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
    return next(new ApiError(`Chat is closed! you can't send messages.`, 400));
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
      media,
    });

    // send offline notification to message receiver
    const notification = await Notification.create({
      scope: "chat",
      userId: receiver._id,
      relatedId: chatId,
      message: `You got a new message from ${req.user.name} -${req.user.role}`,
    });

    // Emit the notification to message receiver
    const { io, users } = getIO();

    const populatedMessage = await Message.populate("senderId", "name role");

    if (users.length > 0) {
      const user = users.find(
        (user) => user.userId.toString() === receiver._id.toString()
      );

      if (user !== undefined) {
        io.to(user.socketId).emit("notification", {
          userId: receiver._id,
          chatId,
          scope: "chat",
          message: `You got a new message from ${req.user.name} -${req.user.role}`,
          createdAt: moment()
            .tz("Africa/Cairo")
            .format("YYYY-MM-DDTHH:mm:ss[Z]"),
        });

        io.to(user.socketId).emit("getMessage", populatedMessage);
      } else {
        // send offline notification to message receiver
        const notification = await Notification.create({
          scope: "chat",
          userId: receiver._id,
          relatedId: chatId,
          message: `You got a new message from ${req.user.name} -${req.user.role}`,
        });

        console.log("notification:", notification);
      }
    } else {
      // send offline notification to message receiver
      const notification = await Notification.create({
        scope: "chat",
        userId: receiver._id,
        relatedId: chatId,
        message: `You got a new message from ${req.user.name} -${req.user.role}`,
      });

      console.log("notification:", notification);
    }

    res.status(200).json({
      message: `Message sent successfully`,
      messageSent: Message,
      // notification: { userId, scope, message, _id, createdAt },
    });
  } catch (error) {
    console.log(error);
    if (req.files) {
      req.files.forEach((file) => deleteUploadedFile(file));
    }
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
