const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    text: String,
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
  },
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
);

function setMediaURL(doc) {
  if (doc.media && doc.media.length > 0) {
    doc.media.forEach((mediaItem) => {
      mediaItem.url = `${process.env.BASE_URL}/messages/${mediaItem.url}`;
    });
  }
}

messageSchema.post("init", (doc) => {
  setMediaURL(doc);
});
messageSchema.post("save", (doc) => {
  setMediaURL(doc);
});

const message = mongoose.model("message", messageSchema);
module.exports = message;
