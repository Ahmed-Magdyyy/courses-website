const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    teacher: {
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
      enum: [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ],
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
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
);

const report = mongoose.model("report", reportSchema);
module.exports = report;
