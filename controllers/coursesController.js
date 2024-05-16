const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const asyncHandler = require("express-async-handler");

const ApiError = require("../utils/ApiError");
const coursesModel = require("../models/coursesModel");
const userModel = require("../models/userModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

function deleteUploadedFile(file) {
  if (file) {
    const filePath = `${file.path}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting course image:", err);
      } else {
        console.log("Course image deleted successfully:", file.path);
      }
    });
  }
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/courses");
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1];
    const filename = `course-${uuidv4()}.${ext}`;
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

exports.uploadCourseImage = (req, res, next) => {
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

const courseNotify = async (array, message,courseId) => {
  // Send notifications to added students
  const studentsNotification = await Promise.all(
    array.map(async (studentId) => {
      return await Notification.create({
        scope: "class",
        userId: studentId,
        relatedId: courseId,
        message,
      });
    })
  );

  console.log("studentsNotification:", studentsNotification);

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
          message,
          _id,
          createdAt,
        });
      }
    });
  }
};

exports.createCourse = asyncHandler(async (req, res, next) => {
  const { title, summary, course_link, image } = req.body;

  try {
    const existCourse = await coursesModel.findOne({ title });

    if (existCourse) {
      deleteUploadedFile(req.file);
      return next(
        new ApiError(`Course already exists with same title: ${title}`, 400)
      );
    }

    const Document = await coursesModel.create({
      title,
      summary,
      image,
      course_link,
    });

    res.status(201).json({ message: "Success", data: Document });
  } catch (error) {
    console.error("Error creating course:", error);
    // Delete the uploaded image file if course creation fails
    if (req.file) {
      deleteUploadedFile(req.file);
    }
    next(error);
  }
});

exports.getAllCourses = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  if (query) {
    filter = query;
  }

  if (req.user.role === "student") {
    const totalCoursesCount = await coursesModel.countDocuments({
      studentsEnrolled: { $in: [req.user._id] },
    });
    const totalPages = Math.ceil(totalCoursesCount / limitNum);
    const documents = await coursesModel
      .find({
        studentsEnrolled: { $in: [req.user._id] },
      })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else {
    const totalCoursesCount = await coursesModel.countDocuments(filter);
    const totalPages = Math.ceil(totalCoursesCount / limitNum);
    const documents = await coursesModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
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

exports.addStudentsToCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the course by ID
    const course = await coursesModel.findById(courseId);
    if (!course) {
      return next(new ApiError(`No course found for this id:${courseId}`, 404));
    }

    // Clear studentsEnrolled array and remove course from students' courses field if studentIds array is empty
    if (!studentIds || studentIds.length === 0) {
      await userModel.updateMany(
        { courses: courseId },
        { $pull: { courses: courseId } },
        { multi: true }
      );
      const updatedCourse = await coursesModel.findOneAndUpdate(
        { _id: courseId },
        { studentsEnrolled: studentIds },
        { new: true }
      );
      return res
        .status(200)
        .json({ message: "Course updated successfully", updatedCourse });
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

    // Filter out the student IDs that are already present in the course's studentsEnrolled array
    const newStudentIds = studentIds.filter(
      (id) => !course.studentsEnrolled.includes(id)
    );

    // Add the course ID to the courses array of each student
    await Promise.all(
      students.map(async (student) => {
        if (!student.courses.includes(courseId)) {
          student.courses.push(courseId);
          await student.save();
        }
      })
    );

    // Add the new student IDs to the studentsEnrolled array of the course
    const updatedCourse = await coursesModel.findOneAndUpdate(
      { _id: courseId },
      { $addToSet: { studentsEnrolled: { $each: newStudentIds } } },
      { new: true }
    );

    courseNotify(
      studentIds,
      `You have been enrolled in course: ${course.title}`,
      courseId
    );

    res
      .status(200)
      .json({ message: "Students added successfully", updatedCourse });
  } catch (error) {
    console.error("Error adding students to course:", error);
    next(error);
  }
});

exports.removeStudentFromCourse = asyncHandler(async (req, res, next) => {
  const courseId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the course by ID
    const course = await coursesModel.findById(courseId);
    if (!course) {
      return next(new ApiError(`No course found for this id:${courseId}`, 404));
    }

    // Check if provided student IDs match any enrolled students in the course
    const enrolledStudents = course.studentsEnrolled.map((id) => id.toString());
    const invalidStudentIds = studentIds.filter(
      (id) => !enrolledStudents.includes(id.toString())
    );

    // If any invalid student IDs found, return an error
    if (invalidStudentIds.length > 0) {
      return next(
        new ApiError(
          `Students with IDs ${invalidStudentIds.join(
            ", "
          )} are not enrolled in the course`,
          400
        )
      );
    }

    // Remove the course ID from the courses array of each student
    await userModel.updateMany(
      { _id: { $in: studentIds }, role: "student" },
      { $pull: { courses: courseId } }
    );

    // Remove the student IDs from the studentsEnrolled array of the course
    course.studentsEnrolled = course.studentsEnrolled.filter(
      (id) => !studentIds.includes(id.toString())
    );

    // Update the course document using findOneAndUpdate
    const updatedCourse = await coursesModel.findOneAndUpdate(
      { _id: courseId },
      { studentsEnrolled: course.studentsEnrolled },
      { new: true } // Return the updated document
    );

    courseNotify(
      studentIds,
      `You have been reomoved from course: ${course.title}`,
      courseId
    );

    res
      .status(200)
      .json({ message: "Students removed successfully", updatedCourse });
  } catch (error) {
    console.error("Error removing students from course:", error);
    next(error);
  }
});

exports.updateCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { title, summary, course_link } = req.body;
  const updateFields = {};

  try {
    const course = await coursesModel.findById(id);

    if (!course) {
      if (req.file) {
        const path = req.file.path;
        deleteUploadedFile({
          fieldname: "image",
          path,
        });
      }
      return next(new ApiError(`No document for this id:${id}`, 404));
    }

    if (req.file && course.image) {
      const index = course.image.indexOf("courses");
      const path = `uploads/${course.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
      updateFields.image = req.file.filename;
    }

    if (title) {
      updateFields.title = title;
    }

    if (summary) {
      updateFields.summary = summary;
    }

    if (course_link) {
      updateFields.course_link = course_link;
    }

    // Update the course in the database
    const updatedCourse = await coursesModel.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    res
      .status(200)
      .json({ message: "Course updated successfully", data: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    next(error);
  }
});

exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    // Find the course document to get the image filename
    const course = await coursesModel.findById(id);
    if (!course) {
      return next(new ApiError(`No Course found for this id:${id}`, 404));
    }

    // Delete the course document
    const deletedCourse = await coursesModel.findOneAndDelete({ _id: id });
    if (!deletedCourse) {
      return next(new ApiError(`Failed to delete course with id:${id}`, 500));
    }

    // Delete the associated image file
    if (course.image) {
      const index = course.image.indexOf("courses/");
      const path = `uploads/${course.image.substring(index)}`;
      deleteUploadedFile({
        path,
      });
    }

    courseNotify(
      course.studentsEnrolled,
      `Course: ${course.title} has been deleted`
    );

    res.status(204).send("Document deleted successfully");
  } catch (error) {
    next(error);
  }
});

exports.getStudentsOfCourse = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;

  const { page, limit, ...query } = req.query;
  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  try {
    // Find the product by ID
    const course = await coursesModel.findById(courseId);

    if (!course) {
      return next(new ApiError(`No course found for this id:${courseId}`, 404));
    }

    // Query students directly with pagination and filtering
    const students = await coursesModel
      .findById(courseId)
      .select("studentsEnrolled")
      .slice("studentsEnrolled", [skipNum, limitNum])
      .populate({
        path: "studentsEnrolled",
        match: { ...query },
        select: "-__v",
      });

    console.log("====================================");
    console.log(students);
    console.log("====================================");

    // Calculate total pages based on total students count and limit
    const totalStudentsCount = course.studentsEnrolled.length;
    const totalPages = Math.ceil(totalStudentsCount / limitNum);

    res.status(200).json({
      message: "Success",
      totalPages,
      page: pageNum,
      results: students.studentsEnrolled.length,
      students: students.studentsEnrolled,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
