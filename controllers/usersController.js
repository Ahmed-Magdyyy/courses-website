const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const usersModel = require("../models/userModel");
const classModel = require("../models/classModel");
const ApiError = require("../utils/ApiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");
const { encryptField, decryptField } = require("../utils/encryption");

function deleteUploadedFile(file) {
  if (file) {
    const filePath = `${file.path}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting user image:", err);
      } else {
        console.log("User image deleted successfully:", filePath);
      }
    });
  }
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/users");
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1];
    const filename = `user-${uuidv4()}.${ext}`;
    cb(null, filename);
  },
});

const multerfilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("only Images allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerfilter,
}).single("image");

exports.uploadUserImage = (req, res, next) => {
  upload(req, res, function (err) {
    // Check if the uploaded file is not an image
    if (req.file && !req.file.mimetype.startsWith("image")) {
      // Delete the uploaded file
      deleteUploadedFile(req.file);
      return next(new ApiError("Only images are allowed", 400));
    }

    // Check if the uploaded file exceeds the size limit
    if (req.file && req.file.size > 5 * 1024 * 1024) {
      // Delete the uploaded file
      deleteUploadedFile(req.file);
      return next(new ApiError("Image file size exceeds 5 MB", 400));
    }

    // File uploaded successfully
    if (req.file) req.body.image = req.file.filename; // Set the image filename to req.body.image
    next();

    if (err) {
      deleteUploadedFile(req.file); // Delete the uploaded file
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }
  });
};

//----- Admin Routes -----

exports.getUsers = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" };
    } else {
      filter[key] = query[key];
    }
  });

  if (!query.role) {
    filter.role = { $ne: "superAdmin" };
  }

  const totalPostsCount = await usersModel.countDocuments(filter);
  let users;
  if (limit && page) {
    // Pagination logic
    const pageNum = page * 1 || 1;
    const limitNum = limit * 1 || 5;
    const skipNum = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(totalPostsCount / limitNum);

    if (query.role === "teacher") {
      users = await usersModel.aggregate([
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
          $addFields: {
            monthYear: {
              $map: {
                input: "$classes",
                as: "class",
                in: {
                  month: {
                    $month: {
                      $dateFromString: {
                        dateString: "$$class.start_date",
                        format: "%d/%m/%Y",
                      },
                    },
                  },
                  year: {
                    $year: {
                      $dateFromString: {
                        dateString: "$$class.start_date",
                        format: "%d/%m/%Y",
                      },
                    },
                  },
                  status: "$$class.status",
                  classId: "$$class._id", // Add the class ID
                },
              },
            },
          },
        },
        { $unwind: { path: "$monthYear", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              userId: "$_id",
              month: "$monthYear.month",
              year: "$monthYear.year",
              status: "$monthYear.status",
            },
            count: { $sum: 1 },
            classIds: { $push: "$monthYear.classId" }, // Collect class IDs
          },
        },
        {
          $group: {
            _id: {
              userId: "$_id.userId",
              month: "$_id.month",
              year: "$_id.year",
            },
            classesByStatus: {
              $push: {
                status: "$_id.status",
                count: "$count",
                classIds: "$classIds", // Include class IDs in classesByStatus
              },
            },
          },
        },
        {
          $addFields: {
            classesByStatus: {
              $filter: {
                input: {
                  $map: {
                    input: ["ended", "scheduled", "cancelled"],
                    as: "status",
                    in: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$classesByStatus",
                            as: "classStatus",
                            cond: { $eq: ["$$classStatus.status", "$$status"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
                as: "classStatus",
                cond: { $ne: ["$$classStatus", null] }, // Filter out null values
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id.userId",
            classes: {
              $push: {
                month: "$_id.month",
                year: "$_id.year",
                classesByStatus: "$classesByStatus",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: "$userDetails",
        },
        {
          $addFields: {
            name: "$userDetails.name",
            email: "$userDetails.email",
            phone: "$userDetails.phone",
            role: "$userDetails.role",
            password: "$userDetails.password",
            passwordChangedAT: "$userDetails.passwordChangedAT",
            passwordResetCode: "$userDetails.passwordResetCode",
            passwordResetCodeExpire: "$userDetails.passwordResetCodeExpire",
            passwordResetCodeVerified: "$userDetails.passwordResetCodeVerified",
            enabledControls: "$userDetails.enabledControls",
            account_status: "$userDetails.account_status",
            active: "$userDetails.active",
            courses: "$userDetails.courses",
            products: "$userDetails.products",
            remainingClasses: "$userDetails.remainingClasses",
            createdAt: "$userDetails.createdAt",
            updatedAt: "$userDetails.updatedAt",
            zoom_account_id: "$userDetails.zoom_account_id",
            zoom_client_id: "$userDetails.zoom_client_id",
            zoom_client_Secret: "$userDetails.zoom_client_Secret",
            zoom_credentials: "$userDetails.zoom_credentials",
            image: {
              $cond: {
                if: { $ne: ["$userDetails.image", null] },
                then: {
                  $concat: [
                    `${process.env.BASE_URL}/users/`,
                    "$userDetails.image",
                  ],
                },
                else: null,
              },
            },
          },
        },
        {
          $project: {
            userDetails: 0, // Exclude the intermediate userDetails field
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

      // Decrypt the specified fields
      users.forEach((user) => {
        if (
          user.zoom_account_id !== "" &&
          user.zoom_account_id !== null &&
          user.zoom_account_id !== undefined
        ) {
          user.zoom_account_id = decryptField(user.zoom_account_id);
        }
        if (
          user.zoom_client_id !== "" &&
          user.zoom_client_id !== null &&
          user.zoom_client_id !== undefined
        ) {
          user.zoom_client_id = decryptField(user.zoom_client_id);
        }
        if (
          user.zoom_client_Secret !== "" &&
          user.zoom_client_Secret !== null &&
          user.zoom_client_Secret !== undefined
        ) {
          user.zoom_client_Secret = decryptField(user.zoom_client_Secret);
        }
      });

      // Additional check to ensure classes is an empty array if no classes found
      for (let i = 0; i < users.length; i++) {
        const teacherClasses = await classModel.find({ teacher: users[i]._id });
        if (teacherClasses.length < 1) {
          users[i].classes = [];
        }
      }
    } else {
      users = await usersModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(); // Use lean to return plain JavaScript objects

      users = users.map((user) => {
        if (user.image) {
          user.image = `${process.env.BASE_URL}/users/${user.image}`;
        }
        return user;
      });
    }

    res
      .status(200)
      .json({ totalPages, page: pageNum, results: users.length, data: users });
  } else {
    // Return all data without pagination
    users = await usersModel.find(filter).sort({ createdAt: -1 }).lean();
    users = users.map((user) => {
      if (user.image) {
        user.image = `${process.env.BASE_URL}/users/${user.image}`;
      }
      return user;
    });
    res.status(200).json({ results: users.length, data: users });
  }
});

exports.getUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await usersModel.findById(id).lean();

    if (!user) {
      return next(new ApiError(`No user found for this id: ${id}`, 404));
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
          $addFields: {
            monthYear: {
              $map: {
                input: "$classes",
                as: "class",
                in: {
                  month: {
                    $month: {
                      $dateFromString: {
                        dateString: "$$class.start_date",
                        format: "%d/%m/%Y",
                      },
                    },
                  },
                  year: {
                    $year: {
                      $dateFromString: {
                        dateString: "$$class.start_date",
                        format: "%d/%m/%Y",
                      },
                    },
                  },
                  status: "$$class.status",
                  classId: "$$class._id", // Add class ID
                },
              },
            },
          },
        },
        { $unwind: { path: "$monthYear", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              userId: "$_id",
              month: "$monthYear.month",
              year: "$monthYear.year",
              status: "$monthYear.status",
            },
            count: { $sum: 1 },
            classesId: { $push: "$monthYear.classId" }, // Collect class IDs
          },
        },
        {
          $group: {
            _id: {
              userId: "$_id.userId",
              month: "$_id.month",
              year: "$_id.year",
            },
            classesByStatus: {
              $push: {
                status: "$_id.status",
                count: "$count",
                classesId: "$classesId", // Include class IDs
              },
            },
          },
        },
        {
          $addFields: {
            classesByStatus: {
              $filter: {
                input: {
                  $map: {
                    input: ["ended", "scheduled", "cancelled"],
                    as: "status",
                    in: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$classesByStatus",
                            as: "classStatus",
                            cond: { $eq: ["$$classStatus.status", "$$status"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
                as: "classStatus",
                cond: { $ne: ["$$classStatus", null] }, // Filter out null values
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id.userId",
            classes: {
              $push: {
                month: "$_id.month",
                year: "$_id.year",
                classesByStatus: "$classesByStatus",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
        {
          $addFields: {
            name: "$userDetails.name",
            email: "$userDetails.email",
            phone: "$userDetails.phone",
            role: "$userDetails.role",
            password: "$userDetails.password",
            passwordChangedAT: "$userDetails.passwordChangedAT",
            passwordResetCode: "$userDetails.passwordResetCode",
            passwordResetCodeExpire: "$userDetails.passwordResetCodeExpire",
            passwordResetCodeVerified: "$userDetails.passwordResetCodeVerified",
            enabledControls: "$userDetails.enabledControls",
            account_status: "$userDetails.account_status",
            active: "$userDetails.active",
            courses: "$userDetails.courses",
            products: "$userDetails.products",
            remainingClasses: "$userDetails.remainingClasses",
            createdAt: "$userDetails.createdAt",
            updatedAt: "$userDetails.updatedAt",
            zoom_account_id: "$userDetails.zoom_account_id",
            zoom_client_id: "$userDetails.zoom_client_id",
            zoom_client_Secret: "$userDetails.zoom_client_Secret",
            zoom_credentials: "$userDetails.zoom_credentials",
            timezone: "$userDetails.timezone",
            image: {
              $cond: {
                if: { $ne: ["$userDetails.image", null] },
                then: {
                  $concat: [
                    `${process.env.BASE_URL}/users/`,
                    "$userDetails.image",
                  ],
                },
                else: null,
              },
            },
          },
        },
        { $project: { userDetails: 0, monthYear: 0 } },
      ]);

      if (userData.length === 0) {
        return res
          .status(404)
          .json({ message: "No user data found in aggregation" });
      }

      const userResult = userData[0];

      // Additional check to ensure classes is an empty array if no classes found
      const teacherClasses = await classModel.find({ teacher: id });
      if (teacherClasses.length < 1) {
        userResult.classes = [];
      }

      // Decrypt the specified fields
      if (
        userResult.zoom_account_id !== "" &&
        userResult.zoom_account_id !== null &&
        userResult.zoom_account_id !== undefined
      ) {
        userResult.zoom_account_id = decryptField(userResult.zoom_account_id);
      }
      if (
        userResult.zoom_client_id !== "" &&
        userResult.zoom_client_id !== null &&
        userResult.zoom_client_id !== undefined
      ) {
        userResult.zoom_client_id = decryptField(userResult.zoom_client_id);
      }
      if (
        userResult.zoom_client_Secret !== "" &&
        userResult.zoom_client_Secret !== null &&
        userResult.zoom_client_Secret !== undefined
      ) {
        userResult.zoom_client_Secret = decryptField(
          userResult.zoom_client_Secret
        );
      }

      res.status(200).json({ data: userResult });
    } else {
      if (user.image) {
        user.image = `${process.env.BASE_URL}/users/${user.image}`;
      }
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
  const {
    name,
    email,
    phone,
    role,
    remainingClasses,
    enabledControls,
    zoom_account_id,
    zoom_client_id,
    zoom_client_Secret,
    timezone
  } = req.body;

  const user = await usersModel.findById(req.params.id);

  if (!user) {
    return next(new ApiError(`No User for this id:${req.params.id}`, 404));
  }

  if (user.role === "teacher") {
    if (user.zoom_credentials === false) {
      // let encrypted_zoom_account_id;
      // let encrypted_zoom_client_id;
      // let encrypted_zoom_client_Secret;

      const updatedFields = {
        name,
        email,
        phone,
        role,
        timezone
      };

      if (
        zoom_account_id &&
        zoom_account_id !== null &&
        zoom_account_id !== undefined &&
        zoom_account_id !== ""
      ) {
        let encrypted_zoom_account_id = encryptField(zoom_account_id);
        updatedFields.zoom_account_id = encrypted_zoom_account_id;
        updatedFields.zoom_credentials = true;
      }

      if (
        zoom_client_id &&
        zoom_client_id !== null &&
        zoom_client_id !== undefined &&
        zoom_client_id !== ""
      ) {
        let encrypted_zoom_client_id = encryptField(zoom_client_id);
        updatedFields.zoom_client_id = encrypted_zoom_client_id;
        updatedFields.zoom_credentials = true;
      }

      if (
        zoom_client_Secret &&
        zoom_client_Secret !== null &&
        zoom_client_Secret !== undefined &&
        zoom_client_Secret !== ""
      ) {
        let encrypted_zoom_client_Secret = encryptField(zoom_client_Secret);
        updatedFields.zoom_client_Secret = encrypted_zoom_client_Secret;
        updatedFields.zoom_credentials = true;
      }

      const updatedUser = await usersModel.findByIdAndUpdate(
        req.params.id,
        updatedFields,
        {
          new: true,
        }
      );

      if (!updatedUser) {
        return next(new ApiError(`No User for this id:${req.params.id}`, 404));
      }
      res.status(200).json({ data: updatedUser });
    } else if (user.zoom_credentials === true) {
      const updatedUser = await usersModel.findByIdAndUpdate(
        req.params.id,
        {
          name,
          email,
          phone,
          role,
          timezone
        },
        {
          new: true,
        }
      );

      if (!updatedUser) {
        return next(new ApiError(`No User for this id:${req.params.id}`, 404));
      }
      res.status(200).json({ data: updatedUser });
    }
  } else {
    const updatedUser = await usersModel.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        phone,
        role,
        remainingClasses,
        enabledControls,
        timezone
      },
      {
        new: true,
      }
    );

    if (!updatedUser) {
      return next(new ApiError(`No User for this id:${req.params.id}`, 404));
    }
    res.status(200).json({ data: updatedUser });
  }
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
  const user = await usersModel.findById(req.user._id);

  if (!user) {
    if (req.file) {
      const path = req.file.path;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    return next(new ApiError(`No user found for this id:${req.user._id}`, 404));
  }

  if (user.image !== null && req.file) {
    deleteUploadedFile({
      fieldname: "image",
      path: `uploads/users/${user.image}`,
    });
  }

  const updatedUser = await usersModel.findByIdAndUpdate(
    req.user._id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      image: req.file && req.file.filename,
      timezone: req.body.timezone
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
  const teacher = req.user._id;
  const { page, limit, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limitNum;

  const classesOfTeacher = await classModel
    .find({ teacher })
    .populate("studentsEnrolled", "-__v");

  if (!classesOfTeacher || classesOfTeacher.length === 0) {
    return next(new ApiError(`No classes found for this teacher`, 404));
  }

  let uniqueStudents = new Set(); // Initialize a set to store unique student IDs
  let uniqueStudentsData = []; // Initialize an array to store unique student objects

  classesOfTeacher.forEach((cls) => {
    cls.studentsEnrolled.forEach((student) => {
      // Check if the student ID is not already in the set
      if (!uniqueStudents.has(student._id.toString())) {
        uniqueStudents.add(student._id.toString()); // Add student ID to the set
        uniqueStudentsData.push(student); // Push the student object to the array
      }
    });
  });

  // Apply filtering based on query parameters
  if (Object.keys(query).length > 0) {
    uniqueStudentsData = uniqueStudentsData.filter((student) => {
      for (const key in query) {
        if (student[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  const totalUsersCount = uniqueStudentsData.length;

  const totalPages = Math.ceil(totalUsersCount / limitNum);

  const paginatedStudents = uniqueStudentsData.slice(
    skipNum,
    skipNum + limitNum
  );

  res.status(200).json({
    message: "Success",
    totalPages,
    page: pageNum,
    totalUsersCount,
    studentsOfTeacher: paginatedStudents,
  });
});
