const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const coursesModel = require("../models/coursesModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");

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
    const filename = `course-${req.body.title
      .split(" ")
      .join("-")}-${uuidv4()}.${ext}`;
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

exports.createCourse = asyncHandler(async (req, res, next) => {
  const { title, summary, course_link, image } = req.body;

  try {
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
      const index = course.image.indexOf("courses");
      const path = `uploads/${course.image.substring(index)}`;
      deleteUploadedFile({
        path,
      });
    }

    res.status(204).send("Document deleted successfully");
  } catch (error) {
    next(error);
  }
});
