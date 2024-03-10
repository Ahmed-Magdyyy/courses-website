const mongoose = require("mongoose");
const moment = require("moment-timezone");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "class name is required"],
    },
    start_date: {
      type: String,
      required: [true, "class date is required"],
    },
    duration: { type: String, default: 40 },
    start_time: {
      type: String,
      required: [true, "class starting time is required"],
    },
    classZoomLink: { type: String, required: [true, "class link is required"] },
    meetingPassword: {
      type: String,
      required: [true, "meeting password is required"],
    },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "teacher" },
    studentsEnrolled: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    status: {
      type: String,
      enum: ["scheduled", "started", "cancelled"],
      default: "Scheduled",
    },
    cancelledBy: {
      type: String,
      enum: ["teacher", "student"],
    },
    comment: {
      type: String,
    },
  },
  { timestamps: true }
);

// // Pre-save hook to format start_date and start_time
// classSchema.pre("save", function (next) {
//   const datetimeString = `${this.start_date}T${this.start_time}`;
//   const formattedDateTime = moment.tz(datetimeString, "DD-MM-YYYYTHH:mm A", "Africa/Cairo");
//   const formattedCairoDateTime = formattedDateTime.clone().tz("Africa/Cairo");
//   this.start_date = formattedCairoDateTime.format("DD/MM/YYYY");
//   this.start_time = formattedCairoDateTime.format("hh:mm A");
//   next();
// });

// Pre-save hook to set timestamps
classSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

classSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const classes = mongoose.model("class", classSchema);
module.exports = classes;
