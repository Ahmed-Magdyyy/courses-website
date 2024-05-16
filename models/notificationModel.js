const mongoose = require("mongoose");
const moment = require("moment-timezone");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    scope: {
      type:String,
      default: "general"
    },
    relatedId: {
      type:String,
      refPath: 'scope'
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to set timestamps
notificationSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

notificationSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const notification = mongoose.model("notification", notificationSchema);
module.exports = notification;
