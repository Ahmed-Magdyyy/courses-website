const mongoose = require("mongoose");
const moment = require("moment-timezone");

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachment: {
      type: String, // You can store the attachment file path or URL here
    },
  },
  { timestamps: true }
);

function setImageURL(doc) {
  if (doc.assignmentFile) {
    let fileType = "";
    if (doc.assignmentFile.startsWith("audio")) {
      fileType = "audio";
    } else if (doc.assignmentFile.startsWith("image")) {
      fileType = "image";
    }

    if (fileType) {
      const fileURL = `${process.env.BASE_URL}/assignments/${fileType}s/${doc.assignmentFile}`;
      doc.assignmentFile = fileURL;
    }
  }
}

// Middleware for initialization (loading from the database)
chatMessageSchema.post("init", setImageURL);

// Middleware for saving (before saving to the database)
chatMessageSchema.post("save", setImageURL);

// Pre-save hook to set timestamps
chatMessageSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

chatMessageSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const message = mongoose.model("message", chatMessageSchema);
module.exports = message;
