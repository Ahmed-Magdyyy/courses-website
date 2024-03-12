const mongoose = require("mongoose");
const moment = require("moment-timezone");

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
    },
    summary: {
      type: String,
      required: [true, "Course summary is required"],
    },
    image: {
      type: String,
      required: [true, "Course image is required"],
    },
    course_link: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    studentsEnrolled: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  },
  { timestamps: true }
);

courseSchema.post("save", async function (doc) {
  // Skip middleware if the document is new (i.e., a new course is being created)
  if (doc.isNew) {
    return;
  }

  const userModel = mongoose.model("user");

  // Update teacher if exists
  if (doc.teacher) {
    await userModel.updateOne(
      { _id: doc.teacher },
      { $addToSet: { courses: doc._id } }
    );
  }

  // Update studentsEnrolled
  await userModel.updateMany(
    { _id: { $in: doc.studentsEnrolled } },
    { $addToSet: { courses: doc._id } }
  );
});

courseSchema.pre("findOneAndDelete", async function (next) {
  const userModel = mongoose.model("user");

  try {
    const courseDoc = await this.model.findOne(this.getFilter());

    // If the course document exists
    if (courseDoc) {
      const courseId = courseDoc._id;

      // Update users who were either teachers or students in the deleted course
      await userModel.updateMany(
        {
          $or: [
            { role: "teacher", courses: courseId },
            { role: "student", courses: courseId },
          ],
        },
        {
          $pull: { courses: courseId }, // Remove class ID from 'courses' array
        }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

courseSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  this.createdAt = currentTime;
  this.updatedAt = currentTime;

  next();
});

courseSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

// Virtual property to get the number of students enrolled
courseSchema.virtual("numberOfStudentsEnrolled").get(function () {
  return this.studentsEnrolled.length;
});

const course = mongoose.model("course", courseSchema);
module.exports = course;
