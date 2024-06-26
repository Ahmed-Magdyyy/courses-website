// const multer = require("multer");
// const { v4: uuidv4 } = require("uuid");
// const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const reportModel = require("../models/MonthlyReportModel");
const ApiError = require("../utils/ApiError");

exports.createReport = asyncHandler(async (req, res, next) => {
  const { teacher, student, month, questionsAndAnswers } = req.body;
  try {
    // Check if a report already exists for the same student and month
    const existingReport = await reportModel.findOne({ student, month });

    if (existingReport) {
      return next(
        new ApiError(`${month} report already exists for this student`, 400)
      );
    }

    const report = await reportModel.create({
      month,
      teacher,
      student,
      questionsAndAnswers,
    });
    res.status(201).json({ message: "Success", data: report });
  } catch (error) {
    next(error);
  }
});

exports.getReport = asyncHandler(async (req, res, next) => {
  const { role, _id: userId } = req.user; // Extract the user's role and ID from the request
  const { page, limit, skip, ...query } = req.query;

  let filter = {};

  // Apply role-based filtering
  if (role === 'teacher') {
    filter.teacher = userId;
  } else if (role === 'student') {
    filter.student = userId;
  }

  // Apply additional query filters if provided
  Object.assign(filter, query);

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;
  const totalPostsCount = await reportModel.countDocuments(filter);
  const totalPages = Math.ceil(totalPostsCount / limitNum);

  const reports = await reportModel
    .find(filter)
    .populate("teacher", "_id name")
    .populate("student", "_id name email")
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  if (!reports || reports.length === 0) {
    return next(new ApiError(`No reports found`, 404));
  }

  res.status(200).json({ totalPages, page: pageNum, results: reports.length, reports });
});
