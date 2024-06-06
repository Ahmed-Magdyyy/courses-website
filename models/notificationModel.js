const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    scope: {
      type: String,
    },
    relatedId: {
      type: String,
      refPath: "scope",
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
);

const notification = mongoose.model("notification", notificationSchema);
module.exports = notification;
