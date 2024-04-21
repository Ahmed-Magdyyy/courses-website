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

exports.getAllClasses = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  if (query) {
    filter = query;
  }

  if (req.user.role === "student") {
    console.log("====================================");
    console.log("from student role");
    console.log("====================================");
    const documents = await classModel
      .find({
        studentsEnrolled: { $in: [req.user._id] },
      })
      .sort({ createdAt: -1 })
      .select("-studentsEnrolled")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({ results: documents.length, data: documents });
  } else if (req.user.role === "teacher") {
    console.log("====================================");
    console.log("from teacher role");
    console.log("====================================");

    const documents = await classModel
      .find({ teacher: req.user._id })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({ results: documents.length, data: documents });
  } else {
    console.log("====================================");
    console.log("from rest role");
    console.log("====================================");

    const documents = await classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res
      .status(200)
      .json({ results: documents.length, page: pageNum, data: documents });
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

// exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
//   const classId = req.params.id;
//   const { studentId } = req.body;

//   try {
//     // Find the class by ID
//     const classes = await classModel.findById(classId);
//     if (!classes) {
//       return next(new ApiError(`No class found for this id:${classId}`, 404));
//     }

//     // Find the user by ID
//     const user = await userModel.findById(studentId);
//     if (!user) {
//       return next(new ApiError(`No user found with ID: ${studentId}`, 404));
//     }

//     // Check if the user is a student
//     if (user.role !== "student") {
//       return next(
//         new ApiError(
//           "Only users with role student can be enrolled in a class",
//           400
//         )
//       );
//     }

//     // Add the new student ID to the studentsEnrolled array
//     if (!classes.studentsEnrolled.includes(studentId)) {
//       classes.studentsEnrolled.push(studentId);

//       // Save the updated class
//       var updatedClass = await classes.save();
//     } else {
//       return next(
//         new ApiError(
//           `Student with ID ${studentId} already exists in this class`,
//           500
//         )
//       );
//     }

//     // Add the class ID to the user's classes array if it's not already present
//     if (!user.classes.includes(classId)) {
//       user.classes.push(classId);
//       // Save the updated user
//       await user.save();
//     } else {
//       return next(
//         new ApiError(
//           `Class with ID ${classId} already exists in this user's classes`,
//           500
//         )
//       );
//     }

//     // // Find all users whose classes field contains the specific class ID
//     // const users = await userModel.find({ classes: classId });
//     // if (!users || users.length === 0) {
//     //   return next(
//     //     new ApiError(
//     //       `No users found enrolled in course with ID: ${courseId}`,
//     //       404
//     //     )
//     //   );
//     // }

//     // console.log("Users documents updated successfully:", users);

//     res.status(200).json({ data: updatedClass });
//   } catch (error) {
//     console.error("Error adding students to class:", error);
//     next(error);
//   }
// });

// exports.removeStudentFromClass = asyncHandler(async (req, res, next) => {
//   const classId = req.params.id;
//   const { studentId } = req.body;

//   // Find the class by ID
//   const classes = await classModel.findById(classId);
//   if (!classes) {
//     return next(new ApiError(`No class found for this id:${classId}`, 404));
//   }

//   // Find the user by ID
//   const user = await userModel.findById(studentId);
//   if (!user) {
//     return next(new ApiError(`No user found with ID: ${studentId}`, 404));
//   }

//   // Check if the user is enrolled in the class
//   const studentIndex = classes.studentsEnrolled.indexOf(studentId);
//   if (studentIndex === -1) {
//     return next(
//       new ApiError(
//         `Student with ID ${studentId} is not enrolled in this class`,
//         404
//       )
//     );
//   }

//   // Remove the student ID from the studentsEnrolled array
//   classes.studentsEnrolled.splice(studentIndex, 1);

//   // Save the updated class
//   const updatedClass = await classes.save();

//   // Remove the class ID from the user's classes array
//   const classIndex = user.classes.indexOf(classId);
//   if (classIndex !== -1) {
//     user.classes.splice(classIndex, 1);
//     // Save the updated user
//     await user.save();
//   }

//   res.status(200).json({ data: updatedClass });
// });

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
  if (cls.status === "ended" || cls.status === "cancelled") {
    return next(
      new ApiError(
        `Cannot cancel a class that is already ended or cancelled`,
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

// exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
//   const classId = req.params.id;
//   const { studentIds } = req.body;

//   try {
//     // Find the class by ID
//     const classes = await classModel.findById(classId);
//     if (!classes) {
//       return next(new ApiError(`No class found for this id:${classId}`, 404));
//     }

//     // Clear studentsEnrolled array and remove class from students' classes field if studentIds array is empty
//     if (!studentIds || studentIds.length === 0) {
//       await userModel.updateMany(
//         { classes: classId },
//         { $pull: { classes: classId } },
//         { multi: true }
//       );
//       const updatedClass = await classModel.findOneAndUpdate(
//         { _id: classId },
//         { studentsEnrolled: studentIds },
//         { new: true }
//       );
//       return res
//         .status(200)
//         .json({ message: "Class updated successfully", updatedClass });
//     }

//     // Filter out the student IDs that are already present in the class's studentsEnrolled array
//     const newStudentIds = studentIds.filter(
//       (id) => !classes.studentsEnrolled.includes(id)
//     );

//     // Add the new student IDs to the studentsEnrolled array of the class
//     const updatedClass = await classModel.findOneAndUpdate(
//       { _id: classId },
//       { $addToSet: { studentsEnrolled: { $each: newStudentIds } } },
//       { new: true }
//     );

//     // Add the class ID to the classes array of each student
//     await userModel.updateMany(
//       { _id: { $in: newStudentIds } },
//       { $addToSet: { classes: classId } }
//     );

//     res.status(200).json({ message: "Students added to class successfully", updatedClass });
//   } catch (error) {
//     console.error("Error adding students to class:", error);
//     next(error);
//   }
// });

exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the class by ID
    const classes = await classModel.findById(classId);
    if (!classes) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
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

    // Remove the product ID from the products array of each student
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

    res.status(200).json({ message: "Students removed successfully",updatedClass });
  } catch (error) {
    console.error("Error removing students from class:", error);
    next(error);
  }
});
