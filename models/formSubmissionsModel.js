const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "form" },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  answers: [
    {
        _id: false,
      question: { type: String },
      answer: { type: mongoose.Schema.Types.Mixed },
    },
  ],
});

module.exports = mongoose.model("Submission", submissionSchema);
