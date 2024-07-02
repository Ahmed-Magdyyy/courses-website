const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "form" },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  answers: [
    {
        _id: false,
      question: { type: mongoose.Schema.Types.Mixed },
      answer: { type: mongoose.Schema.Types.Mixed },
    },
  ],
}, {
  timestamps: {
    timeZone: "UTC", // Set the time zone to UTC
  }, 
});

module.exports = mongoose.model("Submission", submissionSchema);
