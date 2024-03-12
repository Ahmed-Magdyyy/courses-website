const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

const coursesModel = require("../models/coursesModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");

exports.createCourse = factory.createOne(coursesModel);

exports.getAllCourses = asyncHandler(async (req, res, next) => {
  let filter = {};
  if (req.filterObj) {
    filter = req.filterObj;
  }
  const documents = await coursesModel
    .find(filter)
    .populate("teacher")
    .populate("studentsEnrolled");
  res.status(200).json({ results: documents.length, data: documents });
});

exports.getCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const document = await coursesModel
    .findById(id)
    .populate(
      "teacher",
      "-password -account_status -active -createdAt -updatedAt -__v -passwordChangedAT -enabledControls"
    )
    .populate(
      "studentsEnrolled",
      "-password -account_status -active -createdAt -updatedAt -__v -passwordChangedAT -enabledControls"
    );
  if (!document) {
    return next(new ApiError(`No document found for this id:${id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.addStudentstoCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentId } = req.body;

  // Find the course by ID
  const course = await coursesModel.findById(courseId);
  if (!course) {
    return next(new ApiError(`No course found for this id:${courseId}`, 404));
  }

  // Add the new student ID to the studentsEnrolled array
  course.studentsEnrolled.push(studentId);

  // Save the updated course
  const updatedCourse = await course.save();

  // Find the user by ID
  const user = await userModel.findById(studentId);
  if (!user) {
    return next(new ApiError(`No user found with ID: ${studentId}`, 404));
  }

  // Check if the user is a student
  if (user.role === "student") {
    // Check if the course ID is already present in the user's courses array
    if (!user.courses.includes(courseId)) {
      // Add the course ID to the user's courses array
      user.courses.push(courseId);
      // Save the updated user
      await user.save();
    }
  }

  // Find all users whose courses field contains the specific course ID
  const users = await userModel.find({ courses: courseId });
  if (!users || users.length === 0) {
    return next(
      new ApiError(
        `No users found enrolled in course with ID: ${courseId}`,
        404
      )
    );
  }

  console.log("Users documents updated successfully:", users);
  res.status(200).json({ data: updatedCourse, users: users });
});

exports.removeStudentFromCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentId } = req.body;

  const course = await coursesModel.findById(courseId);

  if (!course) {
    return next(new ApiError(`No course found for this id:${courseId}`, 404));
  }

  // Remove the specified student ID from the studentsEnrolled array
  const index = course.studentsEnrolled.indexOf(studentId);
  if (index !== -1) {
    course.studentsEnrolled.splice(index, 1);
  }

  // Save the updated course
  newDoc = await course.save();

  // Find all users whose courses field contains the specific course ID
  const users = await userModel.find({ courses: courseId });
  console.log(users);

  if (!users || users.length === 0) {
    return next(
      new ApiError(
        `No users found enrolled in course with ID: ${courseId}`,
        404
      )
    );
  }

  // Remove the course ID from the courses array field for each user
  const updatedUsers = await Promise.all(
    users.map(async (user) => {
      if (user.role === "student" || user.role === "superAdmin") {
        user.courses = user.courses.filter((id) => id.toString() !== courseId);
        return user.save();
      } else {
        // For teachers, simply return the user without modifying the courses array
        return user;
      }
    })
  );

  console.log("Users documents updated successfully:", updatedUsers);
  res.status(200).json({ data: newDoc, users: updatedUsers });
});

exports.updateCourse = factory.updateOne(coursesModel);

exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Document = await coursesModel.findOneAndDelete({_id:id});
  if (!Document) {
    return next(new ApiError(`No Document found for this id:${id}`, 404));
  }
  res.status(204).send("Document deleted successfully");
});
