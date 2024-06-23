const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "form" },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  answers: [
    {
        _id: false,
      question: { type: String },
      answer: { type: mongoose.Schema.Types.Mixed },
    },
  ],
});

module.exports = mongoose.model("Submission", submissionSchema);
