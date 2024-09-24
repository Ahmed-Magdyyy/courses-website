const asyncHandler = require("express-async-handler");

const ApiError = require("../utils/ApiError");
const chatModel = require("../models/chatModel");
const userModel = require("../models/userModel");
const classModel = require("../models/classModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

const chatNotify = async (array, user) => {
  // Send notifications to added students
  var adminToNotify = array;

  if (adminToNotify.socketId) {
    let userID = adminToNotify.userId;
    let socketID = adminToNotify.socketId;

    const adminNotification = await Notification.create({
      scope: "chat",
      userId: userID,
      message: `You have been added to chat with user ${user}`,
    });

    const { userId, scope, message, _id, createdAt } = adminNotification;

    const { io, users } = getIO();
    if (users && users.length > 0) {
      io.to(socketID).emit("notification", {
        notificationID: _id,
        scope,
        notifiedAdmin: userId,
        userNeededSupport: user,
        message,
        createdAt,
      });
    }
  } else if (adminToNotify.id) {
    let userID = adminToNotify.id;
  }
};

exports.startSupportchat = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "student" && req.user.role !== "teacher") {
    return next(
      new ApiError(
        `You can't start support chat unless you are Student or Teacher`,
        400
      )
    );
  }

  try {
    const supportAdmins = await userModel.find({
      role: "admin",
      enabledControls: { $in: ["messaging"] },
    });

    if (!supportAdmins || supportAdmins.length === 0) {
      return next(new ApiError(`No support admins found`, 404));
    }

    const supportIds = supportAdmins.map((admin) => admin._id.toString());

    if (supportIds.includes(req.user._id.toString())) {
      return next(
        new ApiError(
          req.user.role == "admin" &&
            req.user.enabledControls.includes("messaging") &&
            `Can't start support chat since you are an Admin with Support control`,
          404
        )
      );
    }

    // Check if there's any open support chat with any other admin
    const openChats = await chatModel.find({
      chatWith: "support",
      status: "open",
      members: { $in: [req.user._id] },
    });

    if (openChats && openChats.length > 0) {
      return next(new ApiError(`There is already an open support chat`, 400));
    }

    const getChatCount = async (supportId) => {
      const count = await chatModel.countDocuments({
        members: { $in: [supportId] },
      });
      return { id: supportId, count: count };
    };

    const filterAdmins = (data) => {
      // Find the minimum count among admins
      const minCount = Math.min(...data.map((admin) => admin.count));

      // Filter admins with the lowest count
      const filteredAdmins = data.filter((admin) => admin.count === minCount);

      // Handle different cases
      if (filteredAdmins.length === 1) {
        // Only one admin with the lowest count, return it (filter it out)
        return filteredAdmins[0];
      } else if (filteredAdmins.length > 0) {
        // Multiple admins with the same lowest count, pick one randomly
        return filteredAdmins[
          Math.floor(Math.random() * filteredAdmins.length)
        ];
      } else {
        // All admins have the same count, pick one randomly (no filtering)
        return data[Math.floor(Math.random() * data.length)];
      }
    };

    let selectedAdmin

    const { io, users } = getIO();

    // Check if there are users connected to socket including admins and other users
    if (users.length > 0) {
      // Check for online admins connected to socket (in users)
      const onlineSupportAdmins = users.filter((user) =>
        supportIds.includes(user.userId)
      );

      if (onlineSupportAdmins.length > 0) {
        // There are online admins
        const OnlineSupportIdsChatCount = await Promise.all(
          onlineSupportAdmins.map(async (OnlineSupportId) => {
            return getChatCount(OnlineSupportId.userId);
          })
        );

        if (OnlineSupportIdsChatCount.length > 0) {
          selectedAdmin = filterAdmins(OnlineSupportIdsChatCount);
        }
      } else {
        // There are online users but NON of them are admins
        const supportIdsChatCount = await Promise.all(
          supportIds.map(async (supportId) => {
            return getChatCount(supportId);
          })
        );

        selectedAdmin = filterAdmins(supportIdsChatCount);
      }
    } else {
      const supportIdsChatCount = await Promise.all(
        supportIds.map(async (supportId) => {
          return getChatCount(supportId);
        })
      );

      selectedAdmin = filterAdmins(supportIdsChatCount);
    }

    const chat = await chatModel.create({
      members: [req.user._id, selectedAdmin.id],
      chatWith: "support",
    });

    const populatedChat = await chat.populate("members", "_id name");

    res
      .status(200)
      .json({ message: "chat created successfully", chat: populatedChat });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

exports.studentTeacherChat = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "student") {
    return next(new ApiError(`Student only can start chat with teachers`, 403));
  }
  const { classID } = req.params;

  const Class = await classModel.findById(classID);

  if (!Class) {
    return next(new ApiError(`No class found for this id: ${classID}`, 404));
  }

  if (Class.status !== "ended") {
    return next(new ApiError(`Can't start chat unless class is ended`, 400));
  }

  const existInClass = Class.studentsEnrolled.includes(req.user.id);

  if (existInClass) {
    const existingChat = await chatModel.find({
      members: {
        $all: [req.user._id, Class.teacher],
      },
    });

    if (existingChat && existingChat.length > 0) {
      return res.status(400).json({
        message: "There is already a chat with this teacher",
        chatId: existingChat[0]._id,
      });
    }
    const chat = await chatModel.create({
      members: [req.user._id, Class.teacher],
      chatWith: "teacher",
    });

    const populatedChat = await chat.populate("members", "_id name");

    const AdminNotification = await Notification.create({
      scope: "chat",
      userId: Class.teacher.toString(),
      message: `Student: ${req.user.name} sent you a message`,
    });

    // Emit notifications students
    const { io, users } = getIO();
    if (users.length > 0) {
      const connectedTeacher = users.filter(
        (user) => user.userId === Class.teacher.toString()
      );

      if (connectedTeacher && connectedTeacher.length > 0) {
        // const { userId, scope, message, _id, createdAt } =
        //   postOwnernotification;
        io.to(connectedTeacher[0].socketId).emit("notification", {
          scope: "chat",
          chatID: populatedChat._id,
          studentID: req.user._id,
          teacherID: connectedTeacher[0].userId,
          message: `Student: ${req.user.name} sent you a message`,
        });
      }
    }

    res
      .status(200)
      .json({ message: "chat created successfully", populatedChat });
  } else {
    return next(
      new ApiError(
        `You cant start chat since you are not enrolled in this class.`,
        400
      )
    );
  }
});

exports.getUserChats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let filter = {};
  const { page, limit, skip, ...query } = req.query;
  const baseQuery = { members: { $in: [userId] }, ...query }; // Spread query properties here

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  try {
    if (req.user.role === "superAdmin") {
      // Modify the filter to support partial matches for string fields
      Object.keys(query).forEach((key) => {
        if (typeof query[key] === "string") {
          filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
        } else {
          filter[key] = query[key];
        }
      });

      const totalPostsCount = await chatModel.countDocuments(filter);
      const totalPages = Math.ceil(totalPostsCount / limitNum);

      const chats = await chatModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate("members", "_id name role");

      if (!chats) {
        return next(new ApiError(`No chats found`, 404));
      }

      res
        .status(200)
        .json({ totalPages, page: pageNum, results: chats.length, chats });
    } else {
      const totalPostsCount = await chatModel.countDocuments(baseQuery);
      const totalPages = Math.ceil(totalPostsCount / limitNum);

      const chats = await chatModel
        .find(baseQuery)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate("members", "_id name role");

      if (!chats) {
        return next(new ApiError(`No chats found`, 404));
      }

      res
        .status(200)
        .json({ totalPages, page: pageNum, results: chats.length, chats });
    }
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

exports.findSpecificChat = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;

  try {
    const chat = await chatModel.findById(chatId);
    // .populate("members", "_id name role");

    if (!chat) {
      return next(
        new ApiError(`There is no chat found for this id ${chatId}`, 404)
      );
    }

    if (req.user.role !== "superAdmin") {
      if (!chat.members.includes(req.user._id)) {
        return next(
          new ApiError(
            `You can't access this chat since you are not a member in it`,
            401
          )
        );
      }
    }

    res
      .status(200)
      .json({ chat: await chat.populate("members", "_id name role") });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

exports.closeSupportChat = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;

  try {
    const chat = await chatModel.findById(chatId);

    if (!chat) {
      return next(new ApiError(`No chat found`, 404));
    }

    if (chat.chatWith == "teacher") {
      return next(
        new ApiError(
          `Can't close a chat with teacher, Only chat with support can be closed.`,
          400
        )
      );
    }

    if (!chat) {
      return next(new ApiError(`Chat not found`, 404));
    }

    if (
      (chat.members.includes(req.user._id) && req.user.role === "admin") ||
      req.user.role === "superAdmin"
    ) {
      if (chat.status === "closed") {
        return next(new ApiError(`Chat already closed`, 400));
      }

      // Change the status of the chat to "closed"
      chat.status = "closed";
      await chat.save();
    } else {
      return next(
        new ApiError(
          `You can't access this chat since you are not responsible for this supprt chat.`,
          401
        )
      );
    }

    res.status(200).json({ message: "Chat closed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
