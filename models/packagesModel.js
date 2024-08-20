const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    packageStripeId: {
      type: String,
    },
    stripePriceIds: {
      usd: { type: String },
      aed: { type: String },
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
        stripePriceId: String,
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
    active:{
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: {
      timeZone: "UTC",
    },
  }
);

const Package = mongoose.model("Package", packageSchema);
module.exports = Package;
