const asyncHandler = require("express-async-handler");

const { createMeeting, deleteMeeting } = require("../utils/zoom");
const ApiError = require("../utils/ApiError");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");
const { decryptField } = require("../utils/encryption");

const classNotify = async (array, message, classId) => {
  // Send notifications to added students
  const studentsNotification = await Promise.all(
    array.map(async (studentId) => {
      return await Notification.create({
        scope: "class",
        userId: studentId,
        relatedId: classId,
        message,
      });
    })
  );

  // Emit notifications students
  const { io, users } = getIO();
  if (users.length > 0) {
    const connectedStudents = users.filter((user) =>
      array.includes(user.userId)
    );

    connectedStudents.forEach((student) => {
      const studentNotification = studentsNotification.find(
        (notification) =>
          notification.userId.toString() === student.userId.toString()
      );

      if (studentNotification) {
        const { userId, scope, message, _id, createdAt } = studentNotification;
        io.to(student.socketId).emit("notification", {
          userId,
          scope,
          classId,
          message,
          _id,
          createdAt,
        });
      }
    });
  }
};

exports.createClass = asyncHandler(async (req, res, next) => {
  try {
    const { name, duration, start_date, start_time, teacher, students } =
      req.body;

    // Check if the teacher exists
    const teacherExists = await userModel.findOne({ _id: teacher });
    if (!teacherExists) {
      return res.status(400).json({ message: "Teacher not found" });
    }

    // Decrypt Zoom credentials
    const decryptedZoomAccountId = decryptField(teacherExists.zoom_account_id);
    const decryptedZoomClientId = decryptField(teacherExists.zoom_client_id);
    const decryptedZoomClientSecret = decryptField(
      teacherExists.zoom_client_Secret
    );

    // Check if all students exist and have remaining classes greater than 0
    const invalidStudents = [];

    for (const studentId of students) {
      const studentExists = await userModel.exists({
        _id: studentId,
        remainingClasses: { $gt: 0 },
      });

      if (!studentExists) {
        invalidStudents.push(studentId);
      }
    }

    if (invalidStudents.length > 0) {
      return res.status(400).json({
        message: "Some students do not exist or do not have remaining classes",
        invalidStudents,
      });
    }

    // Create a Zoom meeting
    const meeting = await createMeeting(
      name,
      duration,
      start_date,
      start_time,
      decryptedZoomAccountId,
      decryptedZoomClientId,
      decryptedZoomClientSecret
    );

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

    const teacherNotification = await Notification.create({
      scope: "class",
      userId: teacher,
      relatedId: classInfo._id,
      message: `you have been assigned to class ${name}`,
    });

    const studentsNotification = await Promise.all(
      students.map(async (studentId) => {
        return await Notification.create({
          scope: "class",
          userId: studentId,
          relatedId: classInfo._id,
          message: `You have been enrolled in a new class: ${name}`,
        });
      })
    );

    // Emit notifications to teacher and students
    const { io, users } = getIO();

    if (users.length > 0) {
      const connectedTeacher = users.find(
        (user) => user.userId.toString() === teacher.toString()
      );
      const connectedStudents = users.filter((user) =>
        students.includes(user.userId)
      );


      if (connectedTeacher) {
        const { userId, scope, message, relatedId, _id, createdAt } =
          teacherNotification;
        io.to(connectedTeacher.socketId).emit("notification", {
          userId,
          scope,
          classId: relatedId,
          message,
          _id,
          createdAt,
        });
      }

      connectedStudents.forEach((student) => {
        const studentNotification = studentsNotification.find(
          (notification) =>
            notification.userId.toString() === student.userId.toString()
        );

        if (studentNotification) {
          const { userId, scope, message, _id, createdAt } =
            studentNotification;
          io.to(student.socketId).emit("notification", {
            userId,
            scope,
            message,
            _id,
            createdAt,
          });
        }
      });
    }

    res.status(200).json({
      message: "Success",
      class: classInfo,
      meetingInfo: meeting,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

exports.getAllClasses = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
    } else {
      filter[key] = query[key];
    }
  });

  if (req.user.role === "student") {
    const totalClassesCount = await classModel.countDocuments({
      studentsEnrolled: { $in: [req.user._id] },
      ...filter,
    });
    const totalPages = Math.ceil(totalClassesCount / limitNum);
    const documents = await classModel
      .find({
        studentsEnrolled: { $in: [req.user._id] },
        ...filter,
      })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else if (req.user.role === "teacher") {
    const totalClassesCount = await classModel.countDocuments({
      teacher: req.user._id,
      ...filter,
    });
    const totalPages = Math.ceil(totalClassesCount / limitNum);

    const documents = await classModel
      .find({ teacher: req.user._id, ...filter })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else {
    const totalClassesCount = await classModel.countDocuments(filter);
    const totalPages = Math.ceil(totalClassesCount / limitNum);

    const documents = await classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);



    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  }
});

exports.getClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const document = await classModel
    .findById(id)
    .populate("studentsEnrolled", "_id name email phone")
    .populate("studentsEnrolled", "_id name email phone")
    .populate("teacher", "_id name email phone")
    .populate("attendance.student", "_id name email");

  if (!document) {
    return next(new ApiError(`No document found for this id:${id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.updateClass = asyncHandler(async (req, res, next) => {
  const { name, status } = req.body;
  const document = await classModel.findByIdAndUpdate(
    req.params.id,
    { name, status },
    {
      new: true,
    }
  );

  if (!document) {
    return next(new ApiError(`No document for this id:${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.deleteClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Document = await classModel.findOne({ _id: id }).populate("teacher");
  if (!Document) {
    return next(new ApiError(`No Class found for this id:${id}`, 404));
  }

  // Decrypt Zoom credentials
  const decryptedZoomAccountId = decryptField(Document.teacher.zoom_account_id);
  const decryptedZoomClientId = decryptField(Document.teacher.zoom_client_id);
  const decryptedZoomClientSecret = decryptField(
    Document.teacher.zoom_client_Secret
  );

  // Delete the Zoom meeting associated with the class
  const { zoomMeetingId } = Document;
  if (zoomMeetingId) {
    // Call deleteMeeting function and pass the meetingId
    await deleteMeeting(
      zoomMeetingId,
      decryptedZoomAccountId,
      decryptedZoomClientId,
      decryptedZoomClientSecret
    );
  }

  await classModel.findOneAndDelete({ _id: id });

  classNotify(
    Document.studentsEnrolled,
    `Class: ${Document.name} has been deleted.`
  );

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
  cls.status = "ended";

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

  // Check if the class is already ended or cancelled
  if (cls.status !== "scheduled") {
    return next(
      new ApiError(
        `Can't cancel a class that is already ended or cancelled`,
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

  classNotify(cls.studentsEnrolled, `Class: ${cls.name} has been cancelled.`);

  res.status(200).json({ message: "Class cancelled successfully" });
});

exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the class by ID
    const classes = await classModel.findById(classId);
    if (!classes) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
    }

    if (classes.status !== "scheduled") {
      return next(
        new ApiError(`Can't add students to ${classes.status} classes`, 500)
      );
    }

    // Clear studentsEnrolled array and remove class from students' classes field if studentIds array is empty
    if (!studentIds || studentIds.length === 0) {
      await userModel.updateMany(
        { classes: classId },
        { $pull: { classes: classId } },
        { multi: true }
      );
      const updatedClass = await classModel.findOneAndUpdate(
        { _id: classId },
        { studentsEnrolled: studentIds }, // Clear studentsEnrolled array
        { new: true }
      );
      return res
        .status(200)
        .json({ message: "Class updated successfully", updatedClass });
    }

    // Find the students by IDs
    const students = await userModel.find({
      _id: { $in: studentIds },
      role: "student",
    });

    // Check if all students were found
    if (students.length !== studentIds.length) {
      const missingStudents = studentIds.filter(
        (id) => !students.map((student) => student._id.toString()).includes(id)
      );
      return next(
        new ApiError(
          `Students not found with IDs: ${missingStudents.join(", ")}`,
          404
        )
      );
    }

    // Remove all existing students from the class
    await userModel.updateMany(
      { _id: { $in: classes.studentsEnrolled } },
      { $pull: { classes: classId } },
      { multi: true }
    );

    // Add the new student IDs to the studentsEnrolled array of the class
    const updatedClass = await classModel.findOneAndUpdate(
      { _id: classId },
      { studentsEnrolled: studentIds },
      { new: true }
    );

    // Add the class ID to the classes array of each student
    await userModel.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { classes: classId } }
    );

    // Emit notifications to students
    classNotify(
      studentIds,
      `You have been enrolled in class: ${classes.name}`,
      classId
    );

    res
      .status(200)
      .json({ message: "Students added to class successfully", updatedClass });
  } catch (error) {
    console.error("Error adding students to class:", error);
    next(error);
  }
});

exports.removeStudentFromClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the class by ID
    const classes = await classModel.findById(classId);
    if (!classes) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
    }

    if (classes.status !== "scheduled") {
      return next(
        new ApiError(
          `Can't remove students from ${classes.status} classes`,
          500
        )
      );
    }

    // Check if provided student IDs match any enrolled students in the class
    const enrolledStudents = classes.studentsEnrolled.map((id) =>
      id.toString()
    );
    const invalidStudentIds = studentIds.filter(
      (id) => !enrolledStudents.includes(id.toString())
    );

    // If any invalid student IDs found, return an error
    if (invalidStudentIds.length > 0) {
      return next(
        new ApiError(
          `Students with IDs ${invalidStudentIds.join(
            ", "
          )} are not enrolled in the class`,
          400
        )
      );
    }

    // Find the students by IDs
    const students = await userModel.find({
      _id: { $in: studentIds },
      role: "student",
    });

    // Remove the class ID from the classes array of each student
    students.forEach((student) => {
      const index = student.classes.indexOf(classId);
      if (index !== -1) {
        student.classes.splice(index, 1);
      }
    });

    // Save all updated students
    await Promise.all(students.map((student) => student.save()));

    // Remove the student IDs from the studentsEnrolled array of the class
    classes.studentsEnrolled = classes.studentsEnrolled.filter(
      (id) => !studentIds.includes(id.toString())
    );

    // Update the class document using findOneAndUpdate
    const updatedClass = await classModel.findOneAndUpdate(
      { _id: classId },
      { studentsEnrolled: classes.studentsEnrolled },
      { new: true } // Return the updated document
    );

    // Emit notifications to students
    classNotify(
      studentIds,
      `You have been removed from class: ${classes.name}`,
      classId
    );

    res
      .status(200)
      .json({ message: "Students removed successfully", updatedClass });
  } catch (error) {
    console.error("Error removing students from class:", error);
    next(error);
  }
});
