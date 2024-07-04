const mongoose = require("mongoose");

const checkInOutSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "class",
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date },
});

const checkInOut = mongoose.model("checkInOut", checkInOutSchema);
module.exports = checkInOut;
