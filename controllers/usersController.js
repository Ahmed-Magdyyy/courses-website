const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

const usersModel = require("../models/userModel");
const classModel = require("../models/classModel");
const ApiError = require("../utils/ApiError");
const createToken = require("../utils/createToken");
const mongoose = require("mongoose");
const { encryptField, decryptField } = require("../utils/encryption");

//----- Admin Routes -----

exports.getUsers = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
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
            },
            // Decrypt Zoom-related fields for teachers
            zoom_account_id: 1,
            zoom_client_id: 1,
            zoom_client_Secret: 1,
            zoom_credentials: 1,
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
    } else {
      users = await usersModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum);
    }

    res
      .status(200)
      .json({ totalPages, page: pageNum, results: users.length, data: users });
  } else {
    // Return all data without pagination
    users = await usersModel.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ results: users.length, data: users });
  }
});

// exports.getUsers = asyncHandler(async (req, res, next) => {
//   let filter = {};
//   const { page, limit, skip, ...query } = req.query;

//   // Modify the filter to support partial matches for string fields
//   Object.keys(query).forEach((key) => {
//     if (typeof query[key] === "string") {
//       filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
//     } else {
//       filter[key] = query[key];
//     }
//   });

//   if (!query.role) {
//     filter.role = { $ne: "superAdmin" };
//   }

//   const totalPostsCount = await usersModel.countDocuments(filter);
//   let users;
//   if (limit && page) {
//     // Pagination logic
//     const pageNum = page * 1 || 1;
//     const limitNum = limit * 1 || 5;
//     const skipNum = (pageNum - 1) * limitNum;
//     const totalPages = Math.ceil(totalPostsCount / limitNum);

//     if (query.role === "teacher") {
//       users = await usersModel.aggregate([
//         { $match: filter },
//         {
//           $lookup: {
//             from: "classes",
//             localField: "classes",
//             foreignField: "_id",
//             as: "classes",
//           },
//         },
//         {
//           $addFields: {
//             classes: {
//               $map: {
//                 input: "$classes",
//                 as: "class",
//                 in: {
//                   _id: "$$class._id",
//                   start_date: "$$class.start_date",
//                   start_time: "$$class.start_time",
//                   status: "$$class.status",
//                 },
//               },
//             },
//           },
//         },
//         {
//           $addFields: {
//             monthYear: {
//               $map: {
//                 input: "$classes",
//                 as: "class",
//                 in: {
//                   month: {
//                     $month: {
//                       $dateFromString: {
//                         dateString: "$$class.start_date",
//                         format: "%d/%m/%Y",
//                       },
//                     },
//                   },
//                   year: {
//                     $year: {
//                       $dateFromString: {
//                         dateString: "$$class.start_date",
//                         format: "%d/%m/%Y",
//                       },
//                     },
//                   },
//                   status: "$$class.status",
//                 },
//               },
//             },
//           },
//         },
//         {
//           $unwind: "$monthYear",
//         },
//         {
//           $group: {
//             _id: {
//               userId: "$_id",
//               month: "$monthYear.month",
//               year: "$monthYear.year",
//               status: "$monthYear.status",
//             },
//             count: { $sum: 1 },
//           },
//         },
//         {
//           $group: {
//             _id: {
//               userId: "$_id.userId",
//               month: "$_id.month",
//               year: "$_id.year",
//             },
//             classesByStatus: {
//               $push: {
//                 status: "$_id.status",
//                 count: "$count",
//               },
//             },
//           },
//         },
//         {
//           $group: {
//             _id: "$_id.userId",
//             monthlyClasses: {
//               $push: {
//                 month: "$_id.month",
//                 year: "$_id.year",
//                 classesByStatus: "$classesByStatus",
//               },
//             },
//           },
//         },
//         {
//           $lookup: {
//             from: "users", // Assuming "users" is the correct collection name
//             localField: "_id",
//             foreignField: "_id",
//             as: "userDetails",
//           },
//         },
//         {
//           $unwind: "$userDetails",
//         },
//         {
//           $addFields: {
//             name: "$userDetails.name",
//             email: "$userDetails.email",
//             phone: "$userDetails.phone",
//             role: "$userDetails.role",
//             password: "$userDetails.password",
//             passwordChangedAT: "$userDetails.passwordChangedAT",
//             passwordResetCode: "$userDetails.passwordResetCode",
//             passwordResetCodeExpire: "$userDetails.passwordResetCodeExpire",
//             passwordResetCodeVerified: "$userDetails.passwordResetCodeVerified",
//             enabledControls: "$userDetails.enabledControls",
//             account_status: "$userDetails.account_status",
//             active: "$userDetails.active",
//             courses: "$userDetails.courses",
//             products: "$userDetails.products",
//             remainingClasses: "$userDetails.remainingClasses",
//             createdAt: "$userDetails.createdAt",
//             updatedAt: "$userDetails.updatedAt",
//             zoom_account_id: "$userDetails.zoom_account_id",
//             zoom_client_id: "$userDetails.zoom_client_id",
//             zoom_client_Secret: "$userDetails.zoom_client_Secret",
//             zoom_credentials: "$userDetails.zoom_credentials",
//           },
//         },
//         {
//           $project: {
//             userDetails: 0, // Exclude the intermediate userDetails field
//           },
//         },
//         {
//           $sort: { createdAt: -1 },
//         },
//         {
//           $skip: skipNum,
//         },
//         {
//           $limit: limitNum,
//         },
//       ]);

//       // Decrypt the specified fields
//       users.forEach((user) => {
//         if (
//           user.zoom_account_id !== "" &&
//           user.zoom_account_id !== null &&
//           user.zoom_account_id !== undefined
//         ) {
//           user.zoom_account_id = decryptField(user.zoom_account_id);
//         }
//         if (
//           user.zoom_client_id !== "" &&
//           user.zoom_client_id !== null &&
//           user.zoom_client_id !== undefined
//         ) {
//           user.zoom_client_id = decryptField(user.zoom_client_id);
//         }
//         if (
//           user.zoom_client_Secret !== "" &&
//           user.zoom_client_Secret !== null &&
//           user.zoom_client_Secret !== undefined
//         ) {
//           user.zoom_client_Secret = decryptField(user.zoom_client_Secret);
//         }
//       });
//     } else {
//       users = await usersModel
//         .find(filter)
//         .sort({ createdAt: -1 })
//         .skip(skipNum)
//         .limit(limitNum);
//     }

//     res
//       .status(200)
//       .json({ totalPages, page: pageNum, results: users.length, data: users });
//   } else {
//     // Return all data without pagination
//     users = await usersModel.find(filter).sort({ createdAt: -1 });
//     res.status(200).json({ results: users.length, data: users });
//   }
// });

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
            zoom_account_id: 1,
            zoom_client_Secret: 1,
            zoom_client_id: 1,
            zoom_credentials: 1,
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
      ]);

      // Decrypt the specified fields
      userData.forEach((user) => {
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

      res.status(200).json({ data: userData[0] });
    } else {
      res.status(200).json({ data: user });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// exports.getUser = asyncHandler(async (req, res, next) => {
//   const { id } = req.params;

//   try {
//     const user = await usersModel.findById(id);

//     if (!user) {
//       return next(new ApiError(`No user found for this id: ${id}`, 404));
//     }

//     if (user.role === "teacher") {
//       const userData = await usersModel.aggregate([
//         { $match: { _id: new mongoose.Types.ObjectId(id) } },
//         {
//           $lookup: {
//             from: "classes",
//             localField: "classes",
//             foreignField: "_id",
//             as: "classes",
//           },
//         },
//         {
//           $addFields: {
//             monthYear: {
//               $map: {
//                 input: "$classes",
//                 as: "class",
//                 in: {
//                   month: {
//                     $month: {
//                       $dateFromString: {
//                         dateString: "$$class.start_date",
//                         format: "%d/%m/%Y",
//                       },
//                     },
//                   },
//                   year: {
//                     $year: {
//                       $dateFromString: {
//                         dateString: "$$class.start_date",
//                         format: "%d/%m/%Y",
//                       },
//                     },
//                   },
//                   status: "$$class.status",
//                 },
//               },
//             },
//           },
//         },
//         { $unwind: "$monthYear" },
//         {
//           $group: {
//             _id: {
//               userId: "$_id",
//               month: "$monthYear.month",
//               year: "$monthYear.year",
//               status: "$monthYear.status",
//             },
//             count: { $sum: 1 },
//           },
//         },
//         {
//           $group: {
//             _id: {
//               userId: "$_id.userId",
//               month: "$_id.month",
//               year: "$_id.year",
//             },
//             classesByStatus: {
//               $push: {
//                 status: "$_id.status",
//                 count: "$count",
//               },
//             },
//           },
//         },
//         {
//           $group: {
//             _id: "$_id.userId",
//             monthlyClasses: {
//               $push: {
//                 month: "$_id.month",
//                 year: "$_id.year",
//                 classesByStatus: "$classesByStatus",
//               },
//             },
//           },
//         },
//         {
//           $lookup: {
//             from: "users",
//             localField: "_id",
//             foreignField: "_id",
//             as: "userDetails",
//           },
//         },
//         { $unwind: "$userDetails" },
//         {
//           $addFields: {
//             name: "$userDetails.name",
//             email: "$userDetails.email",
//             phone: "$userDetails.phone",
//             role: "$userDetails.role",
//             password: "$userDetails.password",
//             passwordChangedAT: "$userDetails.passwordChangedAT",
//             passwordResetCode: "$userDetails.passwordResetCode",
//             passwordResetCodeExpire: "$userDetails.passwordResetCodeExpire",
//             passwordResetCodeVerified: "$userDetails.passwordResetCodeVerified",
//             enabledControls: "$userDetails.enabledControls",
//             account_status: "$userDetails.account_status",
//             active: "$userDetails.active",
//             courses: "$userDetails.courses",
//             products: "$userDetails.products",
//             remainingClasses: "$userDetails.remainingClasses",
//             createdAt: "$userDetails.createdAt",
//             updatedAt: "$userDetails.updatedAt",
//             zoom_account_id: "$userDetails.zoom_account_id",
//             zoom_client_id: "$userDetails.zoom_client_id",
//             zoom_client_Secret: "$userDetails.zoom_client_Secret",
//             zoom_credentials: "$userDetails.zoom_credentials",
//           },
//         },
//         { $project: { userDetails: 0 } },
//       ]);

//       // Decrypt the specified fields
//       userData.forEach((user) => {
//         if (
//           user.zoom_account_id !== "" &&
//           user.zoom_account_id !== null &&
//           user.zoom_account_id !== undefined
//         ) {
//           user.zoom_account_id = decryptField(user.zoom_account_id);
//         }
//         if (
//           user.zoom_client_id !== "" &&
//           user.zoom_client_id !== null &&
//           user.zoom_client_id !== undefined
//         ) {
//           user.zoom_client_id = decryptField(user.zoom_client_id);
//         }
//         if (
//           user.zoom_client_Secret !== "" &&
//           user.zoom_client_Secret !== null &&
//           user.zoom_client_Secret !== undefined
//         ) {
//           user.zoom_client_Secret = decryptField(user.zoom_client_Secret);
//         }
//       });

//       res.status(200).json({ data: userData[0] });
//     } else {
//       res.status(200).json({ data: user });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

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
  } = req.body;

  const user = await usersModel.findById(req.params.id);

  if (!user) {
    return next(new ApiError(`No User for this id:${req.params.id}`, 404));
  }

  if (user.role === "teacher") {
    if (user.zoom_credentials === false) {
      let encrypted_zoom_account_id;
      let encrypted_zoom_client_id;
      let encrypted_zoom_client_Secret;

      const updatedFields = {
        name,
        email,
        phone,
        role,
      };

      if (
        zoom_account_id &&
        zoom_account_id !== null &&
        zoom_account_id !== undefined &&
        zoom_account_id !== ""
      ) {
        encrypted_zoom_account_id = encryptField(zoom_account_id);
        updatedFields.zoom_account_id = encrypted_zoom_account_id;
        updatedFields.zoom_credentials = true;
      }

      if (
        zoom_client_id &&
        zoom_client_id !== null &&
        zoom_client_id !== undefined &&
        zoom_client_id !== ""
      ) {
        encrypted_zoom_client_id = encryptField(zoom_client_id);
        updatedFields.zoom_client_id = encrypted_zoom_client_id;
        updatedFields.zoom_credentials = true;
      }

      if (
        zoom_client_Secret &&
        zoom_client_Secret !== null &&
        zoom_client_Secret !== undefined &&
        zoom_client_Secret !== ""
      ) {
        encrypted_zoom_client_Secret = encryptField(zoom_client_Secret);
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

