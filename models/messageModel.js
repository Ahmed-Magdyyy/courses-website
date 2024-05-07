const mongoose = require("mongoose");
const moment = require("moment-timezone");

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
    timestamps: true,
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

// Pre-save hook to set timestamps
messageSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

messageSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const message = mongoose.model("message", messageSchema);
module.exports = message;
