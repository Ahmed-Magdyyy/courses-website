const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");

const coursesModel = require("../models/coursesModel");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");

exports.getCallBack = asyncHandler(async (req, res, next) => {
  console.log(req.body);
  console.log("FROM ZOOM WEBHOOOOOOOK");

  // Webhook request event type is a challenge-response check
  if (req.body.event === "endpoint.url_validation") {
    const hashForValidate = crypto
      .createHmac("sha256", "KZNnqA3tTzq9ZZOLwgFwSw")
      .update(request.body.payload.plainToken)
      .digest("hex");

    res.status(200).json({
      plainToken: request.body.payload.plainToken,
      encryptedToken: hashForValidate,
    });
  }
});
