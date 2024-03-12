const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const { createMeeting } = require("../utils/zoom");
const ApiError = require("../utils/ApiError");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");

exports.createClass = async (req, res, next) => {
  try {
    const { name, duration, start_date, start_time, teacher, students } =
      req.body;

    // Create a Zoom meeting
    const meeting = await createMeeting(name, duration, start_date, start_time);

    // Create a new class document
    const classInfo = await classModel.create({
      name,
      start_date,
      duration,
      start_time,
      classZoomLink: meeting.meeting_url,
      meetingPassword: meeting.password,
      teacher,
      studentsEnrolled: students,
    });

    res
      .status(201)
      .json({ message: "Success", class: classInfo, meetingInfo: meeting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getAllClasses = factory.getAll(classModel);

exports.getClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const document = await classModel.findById(id);

  if (!document) {
    return next(new ApiError(`No document found for this id:${id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.updateClass = factory.updateOne(classModel);

exports.addStudentstoclass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentId } = req.body;

  // Find the class by ID
  const classes = await classModel.findById(classId);
  if (!classes) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  // Find the user by ID
  const user = await userModel.findById(studentId);
  if (!user) {
    return next(new ApiError(`No user found with ID: ${studentId}`, 404));
  }

  // Check if the user is a student
  if (user.role !== "student") {
    return next(
      new ApiError(
        "Only users with role student can be enrolled in a class",
        400
      )
    );
  }

  // Add the new student ID to the studentsEnrolled array
  if (!classes.studentsEnrolled.includes(studentId)) {
    classes.studentsEnrolled.push(studentId);

    // Save the updated class
    const updatedClass = await classes.save();
  } else {
    return next(
      new ApiError(
        `Student with ID ${studentId} already exists in this class`,
        500
      )
    );
  }

  // Add the class ID to the user's classes array if it's not already present
  if (!user.classes.includes(classId)) {
    user.classes.push(classId);
    // Save the updated user
    await user.save();
  } else {
    return next(
      new ApiError(
        `Class with ID ${classId} already exists in this user's classes`,
        500
      )
    );
  }

  // // Find all users whose classes field contains the specific class ID
  // const users = await userModel.find({ classes: classId });
  // if (!users || users.length === 0) {
  //   return next(
  //     new ApiError(
  //       `No users found enrolled in course with ID: ${courseId}`,
  //       404
  //     )
  //   );
  // }

  // console.log("Users documents updated successfully:", users);
  
  res.status(200).json({ data: updatedClass });
});

exports.removeStudentFromClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentId } = req.body;

  // Find the class by ID
  const classes = await classModel.findById(classId);
  if (!classes) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  // Find the user by ID
  const user = await userModel.findById(studentId);
  if (!user) {
    return next(new ApiError(`No user found with ID: ${studentId}`, 404));
  }

  // Check if the user is enrolled in the class
  const studentIndex = classes.studentsEnrolled.indexOf(studentId);
  if (studentIndex === -1) {
    return next(
      new ApiError(`Student with ID ${studentId} is not enrolled in this class`, 404)
    );
  }

  // Remove the student ID from the studentsEnrolled array
  classes.studentsEnrolled.splice(studentIndex, 1);

  // Save the updated class
  const updatedClass = await classes.save();

  // Remove the class ID from the user's classes array
  const classIndex = user.classes.indexOf(classId);
  if (classIndex !== -1) {
    user.classes.splice(classIndex, 1);
    // Save the updated user
    await user.save();
  }

  res.status(200).json({ data: updatedClass });
});

exports.deleteClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Document = await classModel.findOneAndDelete({ _id: id });
  if (!Document) {
    return next(new ApiError(`No Class found for this id:${id}`, 404));
  }
  res.status(204).send("Class deleted successfully");
});
