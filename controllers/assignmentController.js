const asyncHandler = require("express-async-handler");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const ApiError = require("../utils/ApiError");
const factory = require("./controllersFactory");
const classModel = require("../models/classModel");
const userModel = require("../models/userModel");
const assignmentModel = require("../models/assignmentModel");

function deleteUploadedFile(file) {
  if (file) {
    let folder;
    if (file.mimetype.startsWith("audio")) {
      folder = "uploads/assignments/audio";
    } else if (file.mimetype.startsWith("image")) {
      folder = "uploads/assignments/images";
    } else {
      console.error("Unsupported file type:", file.mimetype);
      return;
    }

    const filePath = `${folder}/${file.filename}`;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file (${file.filename}):`, err);
      } else {
        console.log(`File (${file.filename}) deleted successfully`);
      }
    });
  }
}

// Define multer storage
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine the destination folder based on the file type
    let destFolder = "uploads/assignments"; // Default destination folder
    if (file.mimetype.startsWith("audio")) {
      destFolder += "/audios"; // Audio files folder
    } else if (file.mimetype.startsWith("image")) {
      destFolder += "/images"; // Image files folder
    } else {
      // Reject the file if it's not an audio or image file
      return cb(new ApiError("Only audio or image files are allowed", 400));
    }
    // Create the destination folder if it doesn't exist
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    cb(null, destFolder); // Set destination folder
  },
  filename: function (req, file, cb) {
    const ext = file.mimetype.split("/")[1]; // Get file extension
    if (file.mimetype.startsWith("audio")) {
      const filename = `audio-assignment-${req.body.classId}-${Math.floor(
        Math.random() * 100000
      )}.${ext}`; // Generate unique filename
      cb(null, filename);
    } else if (file.mimetype.startsWith("image")) {
      const filename = `image-assignment-${req.body.classId}-${Math.floor(
        Math.random() * 100000
      )}.${ext}`; // Generate unique filename
      cb(null, filename);
    }
  },
});

const multerFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image") || file.mimetype.startsWith("audio")) {
    cb(null, true);
  } else {
    cb(new Error("File type not supported"), false);
  }
};

// Initialize multer upload middleware
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
}).single("assignmentFile");

exports.uploadAssignmentFile = (req, res, next) => {
  upload(req, res, function (err) {
    // File uploaded successfully
    if (req.file) req.body.assignmentFile = req.file.filename; // Set the image filename to req.body.image
    next();

    if (err) {
      deleteUploadedFile(req.file); // Delete the uploaded file
      return next(
        new ApiError(`An error occurred while uploading the file. ${err}`, 500)
      );
    }
  });
};

exports.submitAssignment = asyncHandler(async (req, res, next) => {
  const { classId, studentId, assignmentFile } = req.body;

  console.log(assignmentFile);
  try {
    const cls = await classModel.findOne({ _id: classId });
    if (!cls) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
    }

    const student = await userModel.findOne({ _id: studentId });
    if (!student) {
      return next(
        new ApiError(`No student found for this id:${studentId}`, 404)
      );
    }

    if (!cls.status == "ended") {
      return next(new ApiError(`class must be ended to submit assignment`));
    }

    if (!cls.studentsEnrolled.includes(studentId)) {
      return next(new ApiError(`User was not enrolled in this class`));
    }

    const assignment = await assignmentModel.create({
      class: classId,
      student: studentId,
      assignmentFile,
    });

    res.status(200).json({ message: "Success", assignment });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

exports.getAssignments = asyncHandler(async (req, res, next) => {
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

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  if (req.user.role == "student") {
    const totalAssignmentsCount = await assignmentModel.countDocuments({ student: req.user._id });
    const totalPages = Math.ceil(totalAssignmentsCount / limitNum);

    const assignments = await assignmentModel
      .find({ student: req.user._id })
      .sort({ createdAt: -1 })
      .populate("class", "-__v")
      .populate("student", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({
        totalPages,
        page: pageNum,
        results: assignments.length,
        assignments,
      });
  } else if (req.user.role === "teacher") {
    const totalAssignmentsCount = await assignmentModel.countDocuments({ teacher: req.user._id });
    const totalPages = Math.ceil(totalAssignmentsCount / limitNum);

    const classes = await classModel
      .find({ teacher: req.user._id })
      .sort({ createdAt: -1 })
      .populate("teacher", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);

    const classesIDs = classes.map((cls) => cls._id);

    const assignments = await assignmentModel
      .find({ class: { $in: classesIDs } })
      .sort({ createdAt: -1 })
      .populate("class", "-__v")
      .populate("student", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({
        totalPages,
        page: pageNum,
        results: assignments.length,
        assignments,
      });
  } else {
    const totalAssignmentsCount = await assignmentModel.countDocuments(filter);
    const totalPages = Math.ceil(totalAssignmentsCount / limitNum);

    const assignments = await assignmentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("class", "-__v")
      .populate("student", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({
        totalPages,
        page: pageNum,
        results: assignments.length,
        assignments,
      });
  }
});
