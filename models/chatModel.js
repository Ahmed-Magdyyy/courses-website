const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      validate: {
        validator: function (arr) {
          return arr.length === 2;
        },
        message: "Chat members field must have only 2 users",
      },
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    chatWith: {
      type: String,
      enum: ["support", "teacher"],
    },
  },
  { 
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
   }
);

const chat = mongoose.model("chat", chatSchema);
module.exports = chat;
