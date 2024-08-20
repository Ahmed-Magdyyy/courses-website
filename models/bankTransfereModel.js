const mongoose = require("mongoose");

const bankTransferSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    amountReceived: Number,
    currency: String,
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    subscription_start: String,
    subscription_end: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("bankTransfer", bankTransferSchema);
