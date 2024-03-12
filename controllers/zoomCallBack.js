const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

const coursesModel = require("../models/coursesModel");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");

exports.getCallBack= asyncHandler(async (req, res, next) => {
    console.log(req.body)

    res.status(200).json({message:"message"});
});