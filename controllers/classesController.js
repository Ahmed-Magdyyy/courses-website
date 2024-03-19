const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const { createMeeting, deleteMeeting } = require("../utils/zoom");
const ApiError = require("../utils/ApiError");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");

exports.createClass = asyncHandler(async (req, res, next) => {
  try {
    const { name, duration, start_date, start_time, teacher, students } =
      req.body;

    // Check if all students have remaining classes greater than 0
    const invalidStudents = [];

    for (const studentId of students) {
      const student = await userModel.findOne({
        _id: studentId,
        remainingClasses: { $gt: 0 },
      });

      if (!student) {
        invalidStudents.push(studentId);
      }
    }

    if (invalidStudents.length > 0) {
      // Some students do not have remaining classes greater than 0
      return res.status(400).json({
        message: "Some students do not have remaining classes",
        invalidStudents,
      });
    }

    // Create a Zoom meeting
    const meeting = await createMeeting(name, duration, start_date, start_time);

    // Create a new class document
    const classInfo = await classModel.create({
      name,
      start_date,
      duration,
      start_time,
      zoomMeetingId: meeting.meetingId,
      classZoomLink: meeting.meeting_url,
      meetingPassword: meeting.password,
      teacher,
      studentsEnrolled: students,
      // Automatically generate attendance for enrolled students
      attendance: students.map((studentId) => ({
        student: studentId,
        attended: false,
      })),
    });

    res
      .status(201)
      .json({ message: "Success", class: classInfo, meetingInfo: meeting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

exports.getAllClasses = factory.getAll(classModel);

exports.getClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const document = await classModel.findById(id);

  if (!document) {
    return next(new ApiError(`No document found for this id:${id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.updateClass = asyncHandler(async (req, res, next) => {
  const { name, teacher, status } = req.body;
  const document = await classModel.findByIdAndUpdate(
    req.params.id,
    { name, teacher, status },
    {
      new: true,
    }
  );

  if (!document) {
    return next(new ApiError(`No document for this id:${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
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
    var updatedClass = await classes.save();
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
      new ApiError(
        `Student with ID ${studentId} is not enrolled in this class`,
        404
      )
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

  // Delete the Zoom meeting associated with the class
  const { zoomMeetingId } = Document;
  if (zoomMeetingId) {
    // Call deleteMeeting function and pass the meetingId
    await deleteMeeting(zoomMeetingId);
  }

  res.status(204).send("Class deleted successfully");
});

exports.classReport = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { attendance, classComment } = req.body;

  // Find the class by ID
  const cls = await classModel.findById(classId);

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  cls.comment = classComment;
  cls.status = "completed";

  console.log("Attendance received:", attendance);

  // Update attendance based on the request body
  for (const attendanceEntry of attendance) {
    const { studentId, attended, comment } = attendanceEntry;
    console.log(
      "Processing attendance for student:",
      studentId,
      "Attended:",
      attended
    );

    // Find the corresponding attendance entry in the class document
    const existingAttendanceIndex = cls.attendance.findIndex(
      (entry) => entry.student.toString() === studentId
    );

    if (existingAttendanceIndex !== -1) {
      // If the attendance entry exists, update it
      cls.attendance[existingAttendanceIndex].attended = attended;

      // Add comment based on attendance
      if (comment) {
        cls.attendance[existingAttendanceIndex].comment = comment;
      }

      // If the student attended, deduct 1 from remainingClasses using the middleware
      if (attended) {
        const student = await userModel.findById(studentId);
        if (student.remainingClasses > 0) {
          const deductionSuccessful = student.deductClassCredit();
          if (deductionSuccessful) {
            // If deduction was successful, save the updated user
            await student.save();
          } else {
            return next(
              new ApiError(
                `No remaining class credits for student ${studentId}`
              )
            );
          }
        } else {
          return next(
            new ApiError(`No remaining class credits for student ${studentId}`)
          );
        }
      }
    } else {
      return next(
        new ApiError(`Attendance entry for student ${studentId} not found`)
      );
    }
  }

  // Save the updated class
  await cls.save();

  res.status(200).json({ message: "class report updated successfully" });
});

exports.cancelClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;

  // Find the class by ID
  const cls = await classModel.findById(classId);

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  // Check if the class is already completed or cancelled
  if (cls.status === "completed" || cls.status === "cancelled") {
    return next(
      new ApiError(
        `Cannot cancel a class that is already completed or cancelled`,
        400
      )
    );
  }

  // Delete the Zoom meeting associated with the class
  const { zoomMeetingId } = cls;
  if (zoomMeetingId) {
    // Call deleteMeeting function and pass the meetingId
    await deleteMeeting(zoomMeetingId);
  }

  // Update the class status to "cancelled"
  cls.status = "cancelled";
  await cls.save();

  res.status(200).json({ message: "Class cancelled successfully" });
});

exports.zoomWebHook = asyncHandler(async (req, res, next) => {
  console.log(req.body);
  console.log("FROM ZOOM WEBHOOOOOOOK");

  // Webhook request event type is a challenge-response check
  if (req.body.event === "endpoint.url_validation") {
    const hashForValidate = crypto
      .createHmac("sha256", "KZNnqA3tTzq9ZZOLwgFwSw")
      .update(req.body.payload.plainToken)
      .digest("hex");

    res.status(200).json({
      plainToken: req.body.payload.plainToken,
      encryptedToken: hashForValidate,
    });
  }
  next();
});