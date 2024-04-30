const asyncHandler = require("express-async-handler");
const Notification = require("../models/notificationModel");
const ApiError = require("../utils/ApiError");
const { getIO } = require("../socketConfig");

// Controller to create a new notification
exports.createNotification = asyncHandler(async (req, res, next) => {
  const { scope, userId, message } = req.body;
  try {
    const notification = await Notification.create({ userId, message });

    // Emit the new notification to connected clients
    const { io, users } = getIO();

    if (users.length > 0) {
      const user = users.find((user) => user.userId === userId);

      if (user !== undefined) {
        io.to(user.socketId).emit("notification", { notification });
      }
    }

    res
      .status(201)
      .json({ message: "Notification sent successfully", notification });
  } catch (error) {
    console.error("Error creating notification:", error);
    return next(new ApiError("Error creating notification", 500));
  }
});

// Controller to get all notifications for a user
exports.getNotifications = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page, limit, skip } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await Notification.countDocuments({ userId });
  const totalPages = Math.ceil(totalPostsCount / limitNum);
  try {
    const notifications = await Notification.find({ userId })
      .sort({
        createdAt: -1,
      })
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({
        totalPages,
        page: pageNum,
        results: notifications.length,
        data: notifications,
      });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return next(new ApiError("Error getting notifications", 500));
  }
});
