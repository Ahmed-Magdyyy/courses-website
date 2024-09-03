const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    packageStripeId: {
      type: String,
    },
    title: {
      type: String,
      required: [true, "Package title is required"],
      lowercase: true,
      unique: true,
    },
    prices: [
      {
        _id: false,
        currency: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        stripePriceId: {
          subscription: { type: String, required: true },
          oneTime: { type: String, required: true },
        },
      },
    ],
    classesNum: {
      type: Number,
      required: [true, "Classes number is required"],
    },
    visibleTo: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      timeZone: "UTC",
    },
  }
);

const Package = mongoose.model("Package", packageSchema);
module.exports = Package;
