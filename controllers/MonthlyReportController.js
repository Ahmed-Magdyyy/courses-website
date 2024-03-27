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
  let filter = {};

  if (Object.keys(req.query).length === 0) {
    const reports = await reportModel
      .find(filter)
      .populate("teacher", "_id name")
      .populate("student", "_id name email");

    if (!reports) {
      return next(new ApiError(`No document found for this id:${id}`, 404));
    }
    res.status(200).json(reports);
  } else {
    filter = req.query;
    const reports = await reportModel
      .find(filter)
      .populate("teacher", "_id name")
      .populate("student", "_id name email");

    if (!reports) {
      return next(new ApiError(`No document found for this id:${id}`, 404));
    }
    res.status(200).json(reports);
  }
});
