const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");
const { createMeeting } = require("../utils/zoom");
const ApiError = require("../utils/ApiError");
const classModel = require("../models/classModel");

exports.createClass = async (req, res, next) => {
  try {
    const { name, duration, start_date, start_time, teacher, students } = req.body;

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
      studentsEnrolled: students
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

exports.deleteClass = factory.deleteOne(classModel);
