const mongoose = require("mongoose");
const moment = require("moment-timezone");

const reportSchema = new mongoose.Schema(
  {
    teacher:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Teacher is required"],
      },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "Student is required"],
    },

    month: {
      type: String,
      lowercase: true,
      required: [true, "Report month is required"],
      enum: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    },
    questionsAndAnswers: [
      {
        _id: false,
        question: {
          type: String,
          required: [true, "Report question is required"],
        },
        answer: {
          type: String,
          required: [true, "Report answer is required"],
        },
      },
    ],
  },
  { timestamps: true }
);

// productSchema.post("save", async function (doc) {
//   const userModel = mongoose.model("user");

//   // Update teacher if exists
//   // if (doc.teacher) {
//   //   await userModel.updateOne(
//   //     { _id: doc.teacher, courses: { $ne: doc._id } }, // Add condition to check if the course ID is not already present
//   //     { $addToSet: { classes: doc._id } }
//   //   );
//   // }

//   // Update students
//   await userModel.updateMany(
//     { _id: { $in: doc.students }, products: { $ne: doc._id } }, // Add condition to check if the course ID is not already present
//     { $addToSet: { products: doc._id } }
//   );
// });

// productSchema.pre("findOneAndDelete", async function (next) {
//   const userModel = mongoose.model("user");

//   try {
//     const productDoc = await this.model.findOne(this.getFilter());

//     // If the product document exists
//     if (productDoc) {
//       const productId = productDoc._id;

//       // Update users who have the product ID in their products array and have the role of "student"
//       await userModel.updateMany(
//         { role: "student", products: productId },
//         { $pull: { products: productId } } // Remove class ID from 'courses' array
//       );
//     }

//     next();
//   } catch (error) {
//     next(error);
//   }
// });

reportSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  this.createdAt = currentTime;
  this.updatedAt = currentTime;

  next();
});

reportSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const report = mongoose.model("report", reportSchema);
module.exports = report;
