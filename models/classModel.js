const mongoose = require("mongoose");

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
    zoomMeetingId: {
      type: Number,
      required: [true, "zoom meeting id is required"],
    },
    classZoomLink: { type: String, required: [true, "class link is required"] },
    meetingPassword: {
      type: String,
      required: [true, "meeting password is required"],
    },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    studentsEnrolled: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    status: {
      type: String,
      enum: ["scheduled", "ended", "cancelled"],
      default: "scheduled",
    },
    comment: {
      type: String,
    },
    attendance: [
      {
        _id: false,
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        attended: {
          type: Boolean,
          default: false,
        },
        comment: {
          type: String,
          default: "",
        },
      },
    ],
    assignments: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "assignment"
    },
  },
  { 
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
   }
);

classSchema.post("save", async function (doc) {
  const userModel = mongoose.model("user");

  // Update teacher if exists
  if (doc.teacher) {
    await userModel.updateOne(
      { _id: doc.teacher, classes: { $ne: doc._id } }, // Add condition to check if the class ID is not already present
      { $addToSet: { classes: doc._id } }
    );
  }

  // Update studentsEnrolled
  await userModel.updateMany(
    { _id: { $in: doc.studentsEnrolled }, classes: { $ne: doc._id } }, // Add condition to check if the class ID is not already present
    { $addToSet: { classes: doc._id } }
  );
});

classSchema.pre("findOneAndDelete", async function (next) {
  const userModel = mongoose.model("user");
const assignmentModel = require("../models/assignmentModel")



  try {
    const classDoc = await this.model.findOne(this.getFilter());

    // If the class document exists
    if (classDoc) {
      const classId = classDoc._id;

      // Update users who were either teachers or students in the deleted class
      await userModel.updateMany(
        {
          $or: [
            { role: "teacher", classes: classId },
            { role: "student", classes: classId },
          ],
        },
        {
          $pull: { classes: classId }, // Remove class ID from 'classes' array
        }
      );


    const deletedAssignments=  await assignmentModel.deleteMany({ class: classId });
    }

    next();
  } catch (error) {
    next(error);
  }
});

const classes = mongoose.model("class", classSchema);
module.exports = classes;
