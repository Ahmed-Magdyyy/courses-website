const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

const usersModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");
const createToken = require("../utils/createToken");

//----- Admin Routes -----

exports.getUsers = factory.getAll(usersModel);

exports.getUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let filter = {};
  if (!req.query == {}) {
    filter = req.query;

    const user = await usersModel.findById(filter);
    if (!user) {
      return next(new ApiError(`No user found for this id:${id}`, 404));
    }
    res.status(200).json({ data: user });
  } else {
    const user = await usersModel.findById(id);
    if (!user) {
      return next(new ApiError(`No user found for this id:${id}`, 404));
    }
    res.status(200).json({ data: user });
  }
});

exports.createUser = asyncHandler(async (req, res) => {
  const newDoc = await usersModel.create({
    ...req.body,
    account_status: "confirmed",
  });
  res.status(201).json({ message: "Success", data: newDoc });
});

exports.updateuser = asyncHandler(async (req, res, next) => {
  const { name, email, phone, remainingClasses, enabledControls } = req.body;

  const User = await usersModel.findByIdAndUpdate(
    req.params.id,
    { name, email, phone, remainingClasses, enabledControls },
    {
      new: true,
    }
  );

  if (!User) {
    return next(new ApiError(`No User for this id:${req.params.id}`, 404));
  }
  res.status(200).json({ data: User });
});

exports.updateUserPassword = asyncHandler(async (req, res, next) => {
  const { password } = req.body;

  const User = await usersModel.findByIdAndUpdate(
    req.params.id,
    {
      password: await bcrypt.hash(password, 12),
      passwordChangedAT: Date.now(),
    },
    {
      new: true,
    }
  );

  if (!User) {
    return next(new ApiError(`No User for this id:${req.params.id}`, 404));
  }
  res.status(200).json({ data: User });
});

exports.deleteUser = factory.deleteOne(usersModel);

//----- /Admin Routes -----

//----- User Routes -----

exports.getLoggedUser = asyncHandler(async (req, res, next) => {
  req.params.id = req.user._id;
  next();
});

exports.updateLoggedUserPassword = asyncHandler(async (req, res, next) => {
  //1) update user password based on user's payload (req.user._id)
  const { currentPassword, newPassword } = req.body;

  const user = await usersModel.findById(req.user._id);

  if ((await bcrypt.compare(currentPassword, user.password)) == true) {
    const Updateduser = await usersModel.findByIdAndUpdate(
      req.user._id,
      {
        password: await bcrypt.hash(newPassword, 12),
        passwordChangedAT: Date.now(),
      },
      {
        new: true,
      }
    );

    // 2) generate new token

    const token = createToken(user._id, user.role);
    res.status(200).json({ data: Updateduser, token });
  } else {
    return next(new ApiError("Current password is incorrect", 401));
  }
});

exports.updateLoggedUserData = asyncHandler(async (req, res, next) => {
  const updatedUser = await usersModel.findByIdAndUpdate(
    req.user._id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    },
    { new: true }
  );

  res.status(200).json({ data: updatedUser });
});

exports.deleteLoggedUserData = asyncHandler(async (req, res, next) => {
  await usersModel.findByIdAndUpdate(req.user._id, { active: false });
  res.status(204).json({ message: "Success" });
});

//----- /User Routes -----
