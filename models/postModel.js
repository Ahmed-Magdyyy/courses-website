const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    content: { type: String, required: true },
    media: [
      {
        _id: false,
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: { type: String, required: true },
      },
    ],
    url: { type: String, default: null },
    likes: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    },
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment",
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },
    visibleTo: {
      type: [String],
      enum: ["student", "teacher", "admin", "guest"],
      default: "all",
    },
  },
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
);

const post = mongoose.model("post", postSchema);
module.exports = post;
