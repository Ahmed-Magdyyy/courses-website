const mongoose = require("mongoose");

const bankTransferSchema = new mongoose.Schema(
  {
    referenceNum: String,
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    studentName: String,
    studentEmail: String,
    amountReceived: Number,
    currency: String,
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    psckageName: String,
    subscription_start: String,
    subscription_end: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("bankTransfer", bankTransferSchema);
