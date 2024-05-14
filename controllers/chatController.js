const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const ApiError = require("../utils/ApiError");
const chatModel = require("../models/chatModel");
const userModel = require("../models/userModel");
const classModel = require("../models/classModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");
const { request } = require("express");

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
      console.log(
        "tryied to send online notification to:",
        adminToNotify.userId,
        adminToNotify.socketId
      );
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
    console.log("OFFLINE userId:", userID);
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

    console.log("supportAdmins", supportAdmins);

    if (!supportAdmins || supportAdmins.length === 0) {
      return next(new ApiError(`No support admins found`, 404));
    }

    const supportIds = supportAdmins.map((admin) => admin._id.toString());
    console.log("supportIds", supportIds);

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

    console.log("openChats", openChats);

    if (openChats && openChats.length > 0) {
      return next(new ApiError(`There is already an open support chat`, 400));
    }

    const getChatCount = async (supportId) => {
      const count = await chatModel.countDocuments({
        members: { $in: [supportId] },
      });
      return { id: supportId, count: count };
    };

    const supportIdsChatCount = await Promise.all(
      supportIds.map(async (supportId) => {
        return getChatCount(supportId);
      })
    );

    console.log("supportIdsChatCount", supportIdsChatCount);

    const minChatCount = Math.min(
      ...supportIdsChatCount.map((admin) => admin.count)
    );
    const adminsWithMinChatCount = supportIdsChatCount.filter(
      (admin) => admin.count === minChatCount
    );

    let supportAdmin;
    let adminWithLowestChatCount;

    if (adminsWithMinChatCount.length > 1) {
      const randomIndex = Math.floor(
        Math.random() * adminsWithMinChatCount.length
      );
      adminWithLowestChatCount = adminsWithMinChatCount[randomIndex];
    } else {
      adminWithLowestChatCount = adminsWithMinChatCount[0];
    }

    console.log("minChatCount:", minChatCount);
    console.log("adminsWithMinChatCount:", adminsWithMinChatCount);
    console.log("adminWithLowestChatCount:", adminWithLowestChatCount);

    const { io, users } = getIO();
    if (users.length > 0) {
      console.log("users from socket", users);
      console.log("onlineeee");

      const onlineSupportAdmins = users.filter((user) =>
        supportIds.includes(user.userId)
      );

      if (!onlineSupportAdmins || onlineSupportAdmins.length == 0) {
        supportAdmin = adminWithLowestChatCount.id;
        var selectedofflineAdmin = adminWithLowestChatCount;
        console.log(
          "no online support admins found no online support admins found"
        );
        console.log("supportAdmin", supportAdmin);
        console.log("selectedofflineAdmin", selectedofflineAdmin);
        console.log(
          "no online support admins found no online support admins found"
        );
        // return next(new ApiError(`no online support admins found`, 404));
      } else {
        console.log("onlineSupportAdmins: ", onlineSupportAdmins);

        const onlineAdminWithLowestChatCount = onlineSupportAdmins.find(
          (admin) => admin.userId === adminWithLowestChatCount.id
        );

        console.log(
          "Online admin with lowest chat count:",
          onlineAdminWithLowestChatCount
        );

        if (onlineAdminWithLowestChatCount) {
          var selectedOnlineAdmin = onlineAdminWithLowestChatCount;
          supportAdmin = onlineAdminWithLowestChatCount.userId;
        } else {
          supportAdmin = adminWithLowestChatCount.id;
        }

        console.log("Final supportAdmin:", supportAdmin);
      }
    } else {
      console.log("offlineeee");
      supportAdmin = adminWithLowestChatCount.id;
      var selectedofflineAdmin = adminWithLowestChatCount;

      console.log("Final supportAdmin:", supportAdmin);
    }

    console.log("supportAdmin after ifs", supportAdmin);

    const existingChat = await chatModel.find({
      chatWith: "support",
      status: "open",
      members: {
        $all: [req.user._id, supportAdmin],
      },
    });

    console.log("existingChat", existingChat);

    if (existingChat && existingChat.length > 0) {
      return next(new ApiError(`There is already an open support chat`, 400));
    } else {
      const chat = await chatModel.create({
        members: [req.user._id, supportAdmin],
        chatWith: "support",
      });

      const populatedChat = await chat.populate("members", "_id name");

      // Proceed with creating a new chat
      if (users && users.length > 0) {
        if (selectedOnlineAdmin !== undefined) {
          chatNotify(selectedOnlineAdmin, req.user._id);
          console.log(
            "selectedOnlineAdmin selectedOnlineAdmin",
            selectedOnlineAdmin
          );
        }
      } else {
        chatNotify(selectedofflineAdmin, req.user._id);
        console.log(
          "selectedofflineAdmin selectedofflineAdmin",
          selectedofflineAdmin
        );
      }
      res
        .status(200)
        .json({ message: "chat created successfully", chat: populatedChat });
    }
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
      return next(
        new ApiError(`There is already a chat with this teacher`, 400)
      );
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

    console.log("AdminNotification:", AdminNotification);

    // Emit notifications students
    const { io, users } = getIO();
    if (users.length > 0) {
      const connectedTeacher = users.filter(
        (user) => user.userId === Class.teacher.toString()
      );

      console.log("connectedTeacher:", connectedTeacher);

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
      if (query) {
        filter = query;
      }

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

    if (!chat.members.includes(req.user._id)) {
      return next(
        new ApiError(
          `You can't access this chat since you are not a member in it`,
          401
        )
      );
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

    // console.log("chat", chat)

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

    console.log("req.user._id:", req.user._id);
    console.log(chat.members);
    console.log(
      chat.members.includes(req.user._id) && req.user.role === "admin"
    );

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
