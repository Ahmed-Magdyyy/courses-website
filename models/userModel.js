const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const moment = require("moment-timezone");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Name is required"],
      lowercase: true,
    },
    email: {
      type: String,
      unique: [true, "Email must be unique"],
      required: [true, "Email is required"],
      lowercase: true,
    },
    phone: {
      type: String,
      unique: [true, "Phone must be unique"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    passwordChangedAT: Date,
    passwordResetCode: String,
    passwordResetCodeExpire: Date,
    passwordResetCodeVerified: Boolean,
    role: {
      type: String,
      enum: ["superAdmin", "admin", "student", "teacher"],
      default: "student",
    },
    enabledControls: { type: [String] },
    account_status: {
      type: String,
      enum: ["pending", "confirmed"],
      default: "pending",
    },
    active: {
      type: Boolean,
      default: true,
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "course",
      },
    ],
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "class",
      },
    ],
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],
    remainingClasses: {
      type: Number,
      default: 0,
    },
    zoom_account_id: String,
    zoom_client_id: String,
    zoom_client_Secret: String,
  },
  { timestamps: true }
);

userSchema.methods.deductClassCredit = function () {
  if (this.remainingClasses > 0) {
    this.remainingClasses -= 1;
    return true; // Indicate that deduction was successful
  } else {
    return false; // Indicate that deduction failed due to insufficient remaining classes
  }
};


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // Password hashing
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  this.createdAt = currentTime;
  this.updatedAt = currentTime;

  next();
});

userSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const user = mongoose.model("user", userSchema);
module.exports = user;
