const mongoose = require("mongoose");
const moment = require("moment-timezone");

const assignmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "assignment name is required"],
    },
  },
  { timestamps: true }
);



// Pre-save hook to set timestamps
assignmentSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

assignmentSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const assignment = mongoose.model("assignment", assignmentSchema);
module.exports = assignment;
