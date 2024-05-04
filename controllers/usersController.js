const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

const usersModel = require("../models/userModel");
const classModel = require("../models/classModel");
const ApiError = require("../utils/ApiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");

//----- Admin Routes -----

exports.getUsers = asyncHandler(async (req, res, next) => {
  let filter = { active: true };
  const { page, limit, skip, ...query } = req.query;

  if (query && query.role) {
    filter = query;
  } else {
    filter = { ...query, role: { $ne: "superAdmin" } };
  }

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await usersModel.countDocuments(filter);
  const totalPages = Math.ceil(totalPostsCount / limitNum);

  if (query.role === "teacher") {
    const users = await usersModel.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "classes",
          localField: "classes",
          foreignField: "_id",
          as: "classes",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          classes: {
            $map: {
              input: "$classes",
              as: "class",
              in: {
                _id: "$$class._id",
                start_date: "$$class.start_date",
                start_time: "$$class.start_time",
                status: "$$class.status",
              },
            },
          },
        },
      },
      {
        $addFields: {
          completedClasses: {
            $size: {
              $filter: {
                input: "$classes",
                as: "class",
                cond: { $eq: ["$$class.status", "ended"] },
              },
            },
          },
          scheduledClasses: {
            $size: {
              $filter: {
                input: "$classes",
                as: "class",
                cond: { $eq: ["$$class.status", "scheduled"] },
              },
            },
          },
          cancelledClasses: {
            $size: {
              $filter: {
                input: "$classes",
                as: "class",
                cond: { $eq: ["$$class.status", "cancelled"] },
              },
            },
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skipNum,
      },
      {
        $limit: limitNum,
      },
    ]);

    res.status(200).json({ results: users.length, page: pageNum, data: users });
  } else {
    const users = await usersModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum);

    res
      .status(200)
      .json({ totalPages, page: pageNum, results: users.length, data: users });
  }
});

exports.getUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await usersModel.findById(id);

    if (!user) {
      return next(new ApiError(`No user found for this id:${id}`, 404));
    }

    if (user.role === "teacher") {
      const userData = await usersModel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        {
          $lookup: {
            from: "classes",
            localField: "classes",
            foreignField: "_id",
            as: "classes",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            phone: 1,
            role: 1,
            password: 1,
            passwordChangedAT: 1,
            passwordResetCode: 1,
            passwordResetCodeExpire: 1,
            passwordResetCodeVerified: 1,
            enabledControls: 1,
            account_status: 1,
            active: 1,
            courses: 1,
            classes: 1,
            products: 1,
            remainingClasses: 1,
            createdAt: 1,
            updatedAt: 1,
            classes: {
              $map: {
                input: "$classes",
                as: "class",
                in: {
                  _id: "$$class._id",
                  start_date: "$$class.start_date",
                  start_time: "$$class.start_time",
                  status: "$$class.status",
                },
              },
            },          },
        },
        {
          $addFields: {
            completedClasses: {
              $size: {
                $filter: {
                  input: "$classes",
                  as: "class",
                  cond: { $eq: ["$$class.status", "ended"] },
                },
              },
            },
            scheduledClasses: {
              $size: {
                $filter: {
                  input: "$classes",
                  as: "class",
                  cond: { $eq: ["$$class.status", "scheduled"] },
                },
              },
            },
            cancelledClasses: {
              $size: {
                $filter: {
                  input: "$classes",
                  as: "class",
                  cond: { $eq: ["$$class.status", "cancelled"] },
                },
              },
            },
          },
        },
      ]);

      res.status(200).json({ data: userData[0] });
    } else {
      res.status(200).json({ data: user });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

exports.createUser = asyncHandler(async (req, res, next) => {
  if (req.body.role === "superAdmin") {
    return next(new ApiError(`Can't create a new super admin!`, 400));
  }
  const newDoc = await usersModel.create({
    ...req.body,
    account_status: "confirmed",
  });
  res.status(201).json({ message: "Success", data: newDoc });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
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

exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await usersModel.findById(id);

  if (!user) {
    return next(new ApiError(`No User for this id:${req.params.id}`, 404));
  }

  if (user.role === "superAdmin") {
    return next(new ApiError(`Super admin can't be deleted!`, 400));
  }

  const deletedUser = await usersModel.findByIdAndDelete(id);

  res
    .status(204)
    .json({ message: "Document deleted successfully", deletedUser });
});

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

exports.getTeacher_students = asyncHandler(async (req, res, next) => {
  const teacher = req.params.teacher;
  const classesOfTeacher = await classModel.find({ teacher });

  const classesStudentss = classesOfTeacher.map((cls) =>
    cls.studentsEnrolled.map((students) => students)
  );
  console.log("classesOfTeacher", classesOfTeacher);
  console.log(
    "classesStudentss",
    Array.from(new Set(classesStudentss.flat().map((id) => id.toString())))
  );
});
