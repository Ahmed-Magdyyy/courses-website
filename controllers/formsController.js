const asyncHandler = require("express-async-handler");
const fs = require("fs");

const ApiError = require("../utils/ApiError");
const Form = require("../models/formModel");
const FormSubmission = require("../models/formSubmissionsModel");

// Function to delete uploaded file
function deleteUploadedFile(fileUrl) {
  // Extract the filename from the URL
  const filename = fileUrl.split('/').pop();
  const filePath = path.join(__dirname, '..', 'uploads', 'forms', filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log("File deleted successfully:", filePath);
    }
  });
}

exports.createForm = asyncHandler(async (req, res, next) => {
  const { name, questions } = req.body;

  const form = await Form.create({ name, questions });

  res.status(200).json({ message: "Form created successfully", form });
});

exports.updateForm = asyncHandler(async (req, res, next) => {
  const formId = req.params.formId;
  const { name, questions } = req.body;

  const updatedForm = await Form.findByIdAndUpdate(
    { _id: formId },
    { name, questions },
    { new: true }
  );

  if (!updatedForm) {
    return next(new ApiError(`No form found for this id:${formId}`, 404));
  }

  res.status(200).json({ message: "form updated successfully", updatedForm });
});

exports.getForms = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, ...query } = req.query;

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

  const totalForms = await Form.countDocuments(filter);
  const totalPages = Math.ceil(totalForms / limitNum);

  const forms = await Form.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  res.status(200).json({
    totalPages,
    page: pageNum,
    results: forms.length,
    data: forms,
  });
});

exports.getSpecificForm = asyncHandler(async (req, res, next) => {
  const { formId } = req.params;

  const form = await Form.findById(formId);

  if (!form) {
    return next(new ApiError(`No form found for this id:${formId}`, 404));
  }

  res.status(200).json({ form });
});

// exports.deleteForm = asyncHandler(async (req, res, next) => {
//   const { formId } = req.params;

//   const form = await Form.findById(formId);

//   if (!form) {
//     return next(new ApiError(`No form found for this id:${formId}`, 404));
//   }

//   await Form.findByIdAndDelete(formId);
//   await FormSubmission.deleteMany({ formId });

//   res.status(204).send("form deleted successfully");
// });



exports.deleteForm = asyncHandler(async (req, res, next) => {
  const { formId } = req.params;

  const form = await Form.findById(formId);

  if (!form) {
    return next(new ApiError(`No form found for this id:${formId}`, 404));
  }

  // Get all submissions related to the form
  const submissions = await FormSubmission.find({ formId });

  // Iterate over each submission and delete associated files
  submissions.forEach(submission => {
    submission.answers.forEach(answer => {
      if (typeof answer.answer === 'string' && answer.answer.includes('form-file-')) {
        deleteUploadedFile(answer.answer);
      }
    });
  });

  // Delete all submissions related to the form
  await FormSubmission.deleteMany({ formId });

  // Delete the form itself
  await Form.findByIdAndDelete(formId);

  res.status(204).send("Form and related submissions deleted successfully");
});

