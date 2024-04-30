const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const ApiError = require("../utils/ApiError");
const chatModel = require("../models/chatModel");
const userModel = require("../models/userModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

const courseNotify = async (array, user) => {
  // Send notifications to added students
  const adminToNotify = array;

  console.log("adminToNotify", adminToNotify);
  let userId;
  let socketID;
  if (adminToNotify.socketId) {
    // adminToNotify { id: '660fb37c7641db487a9582eb', count: 1 }
    // adminToNotify {
    //   userId: '660fb37c7641db487a9582eb',
    //   socketId: 'iKvYUNkbXdG3X4wgAAAL'
    // }
    userId = adminToNotify.userId;
    socketID = adminToNotify.socketId;
    console.log("ONLINE userId:", userId);
    console.log("ONLINE socketID:", socketID);
    console.log("USER USER USER:", user);

    const adminNotification = await Notification.create({
      scope: "chat",
      userId,
      message: `You have added to chat with user ${user}`,
    });

    const { io, users } = getIO();
    if (users && users.length > 0) {
      io.to(socketID).emit("notification", adminNotification);
    }
  } else if (adminToNotify.id) {
    userId = adminToNotify.id;
    console.log("OFFLINE userId:", userId);

    const adminNotification = await Notification.create({
      scope: "chat",
      userId,
      message: `You have added to chat with user ${req.user._id}`,
    });
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
      enabledControls: { $in: ["support"] },
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
            req.user.enabledControls.includes("support") &&
            `Can't start support chat since you are an Admin with Support control`,
          404
        )
      );
    }

    // Check if there's any open support chat with any other admin
    const openChats = await chatModel.find({
      status: "open",
      members: { $in: [req.user._id] },
    });

    console.log("openChats", openChats);

    if (openChats.length > 0) {
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
      console.log("onlineeee");

      const onlineSupportAdmins = users.filter((user) =>
        supportIds.includes(user.userId)
      );

      console.log("onlineSupportAdmins: ", onlineSupportAdmins);

      const onlineAdminWithLowestChatCount = onlineSupportAdmins.find(
        (admin) => admin.userId === adminWithLowestChatCount.id
      );

      console.log(
        "Online admin with lowest chat count:",
        onlineAdminWithLowestChatCount
      );
      var selectedOnlineAdmin = onlineAdminWithLowestChatCount;
      supportAdmin = onlineAdminWithLowestChatCount.userId;

      console.log("Final supportAdmin:", supportAdmin);
    } else {
      console.log("offlineeee");
      supportAdmin = adminWithLowestChatCount.id;
      var selectedofflineAdmin = adminWithLowestChatCount;

      console.log("Final supportAdmin:", supportAdmin);
    }

    console.log("supportAdmin after ifs", supportAdmin);

    const existingChat = await chatModel.find({
      members: {
        $all: [req.user._id, supportAdmin],
      },
    });

    console.log("existingChat", existingChat);

    if (existingChat && existingChat > 0) {
      if (existingChat.status === "open") {
        return next(new ApiError(`There is already an open support chat`, 400));
      } else {
        console.log("small else");
        const chat = await chatModel.create({
          members: [req.user._id, supportAdmin],
        });

        const populatedChat = await chat.populate("members", "_id name");

        // Proceed with creating a new chat
        res
          .status(200)
          .json({ message: "chat created successfully", populatedChat });
      }
    } else {
      console.log("big else");

      const chat = await chatModel.create({
        members: [req.user._id, supportAdmin],
      });

      const populatedChat = await chat.populate("members", "_id name");

      // Proceed with creating a new chat
      if (users && users.length > 0) {
        courseNotify(selectedOnlineAdmin, req.user._id);
        console.log(
          "selectedOnlineAdmin selectedOnlineAdmin",
          selectedOnlineAdmin
        );
      } else {
        courseNotify(selectedofflineAdmin, req.user._id);
        console.log(
          "selectedofflineAdmin selectedofflineAdmin",
          selectedofflineAdmin
        );
      }
      res
        .status(200)
        .json({ message: "chat created successfully", populatedChat });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

exports.getUserChats = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page, limit, skip } = req.query;


  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await chatModel.countDocuments({ members: { $in: [userId] } });
  const totalPages = Math.ceil(totalPostsCount / limitNum);

  try {
    const chats = await chatModel
      .find({ members: { $in: [userId] } })
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .populate("members", "_id name role");

    if (!chats) {
      return next(new ApiError(`No chats found`, 404));
    }

    res.status(200).json({totalPages, page: pageNum, results: chats.length, chats });
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

exports.closeSupportChat = asyncHandler(async (req, res, next) => {
  const { chatId } = req.params;

  try {
    const chat = await chatModel.findById(chatId);

    // console.log("chat", chat)

    if (!chat) {
      return next(new ApiError(`Chat not found`, 404));
    }

    console.log("req.user._id:", req.user._id);
    console.log(chat.members);
    console.log(
      chat.members.includes(req.user._id) && req.user.role === "admin"
    );

    if (chat.members.includes(req.user._id) && req.user.role === "admin") {
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
