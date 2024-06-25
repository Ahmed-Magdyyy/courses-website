const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
    image: {
      type: String,
      default: null,
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
    zoom_account_id: {
      type: String,
      default: null,
    },
    zoom_client_id: {
      type: String,
      default: null,
    },
    zoom_client_Secret: {
      type: String,
      default: null,
    },
    zoom_credentials: {
      type: Boolean,
      default: false,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "cancelled",null],
      default: null,
    },
    subscription: {
      package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Package",
        default: null,
      },
      packageStripeId: {
        type: String,
        default: null,
      },
      stripeSubscriptionId: {
        type: String,
        default: null,
      },
      stripeCustomerId: {
        type: String,
        default: null,
      },
      stripeInvoiceId:{
        type: String,
        default: null,
      }
    },
    timezone: {
      type: String,
      required: true,
      default: 'UTC'
    }
  },
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
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

const user = mongoose.model("user", userSchema);
module.exports = user;
