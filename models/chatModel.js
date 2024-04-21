const mongoose = require("mongoose");
const moment = require("moment-timezone");


const chatSchema = new mongoose.Schema({
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
}, {timestamps:true});

// Pre-save hook to set timestamps
chatSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

chatSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const chat = mongoose.model("chat", chatSchema);
module.exports = chat;
