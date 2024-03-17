const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const coursesModel = require("../models/coursesModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");

const multerStorage = multer.memoryStorage();
const multerfilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("only Images allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerfilter });

exports.uploadourseImg = upload.single("courseImg")

exports.createCourse = asyncHandler(async (req, res) => {
  const { title, summary, image, course_link } = req.body;

  const Document = await coursesModel.create({
    title,
    summary,
    image,
    course_link,
  });
  res.status(201).json({ message: "Success", data: Document });
});

exports.getAllCourses = factory.getAll(coursesModel);

exports.getCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let filter = {};

  if (!req.query == {}) {
    filter = req.query;

    const document = await coursesModel
      .findById(filter)
      .populate("studentsEnrolled", "_id name email phone");
    if (!document) {
      return next(new ApiError(`No document found for this id:${id}`, 404));
    }
    res.status(200).json({ data: document });
  } else {
    const document = await coursesModel
      .findById(id)
      .populate("studentsEnrolled", "_id name email phone");
    if (!document) {
      return next(new ApiError(`No document found for this id:${id}`, 404));
    }
    res.status(200).json({ data: document });
  }
});

exports.addStudentToCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentId } = req.body;

  // Find the course by ID
  const course = await coursesModel.findById(courseId);
  if (!course) {
    return next(new ApiError(`No course found for this id:${courseId}`, 404));
  }

  // Find the student by ID
  const student = await userModel.findOne({ _id: studentId, role: "student" });
  if (!student) {
    return next(new ApiError(`No user found with ID: ${studentId}`, 404));
  }

  // Check if the course ID is already present in the student's courses array
  if (student.courses.includes(courseId)) {
    return res
      .status(400)
      .json({ message: "Course ID already exists for this user" });
  }

  // Add the course ID to the student's courses array
  student.courses.push(courseId);
  // Save the updated user
  await student.save();

  // Add the new student ID to the studentsEnrolled array of the course
  course.studentsEnrolled.push(studentId);
  // Save the updated course
  const updatedCourse = await course.save();

  res
    .status(200)
    .json({ message: "Student added successfully", updatedCourse });
});

exports.removeStudentFromCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentId } = req.body;

  // Find the course by ID
  const course = await coursesModel.findById(courseId);
  if (!course) {
    return next(new ApiError(`No course found for this id:${courseId}`, 404));
  }

  // Find the student by ID
  const student = await userModel.findOne({ _id: studentId, role: "student" });
  if (!student) {
    return next(new ApiError(`No user found with ID: ${studentId}`, 404));
  }

  // Check if the course ID is present in the student's courses array
  const courseIndex = student.courses.indexOf(courseId);
  if (courseIndex === -1) {
    return res
      .status(400)
      .json({ message: "Course ID does not exist for this user" });
  }

  // Remove the course ID from the student's courses array
  student.courses.splice(courseIndex, 1);
  // Save the updated user
  await student.save();

  // Remove the student ID from the studentsEnrolled array of the course
  const studentIndex = course.studentsEnrolled.indexOf(studentId);
  if (studentIndex !== -1) {
    course.studentsEnrolled.splice(studentIndex, 1);
  }
  // Save the updated course
  const updatedCourse = await course.save();

  res
    .status(200)
    .json({ message: "Student removed successfully", updatedCourse });
});

exports.updateCourse = factory.updateOne(coursesModel);

exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Document = await coursesModel.findOneAndDelete({ _id: id });
  if (!Document) {
    return next(new ApiError(`No Course found for this id:${id}`, 404));
  }
  res.status(204).send("Document deleted successfully");
});
