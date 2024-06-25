const asyncHandler = require("express-async-handler");

const ApiError = require("../utils/ApiError");
const FormSubmission = require("../models/formSubmissionsModel");
const Form = require("../models/formModel");

exports.submitForm = asyncHandler(async (req, res, next) => {
  const { userName, userEmail, formId, answers } = req.body;

  if (!formId || !answers || answers.length === 0) {
    return next(new ApiError("Missing required fields in request body", 400));
  }

  try {
    const submissionExists = await FormSubmission.findOne({
      userEmail,
      formId,
    });

    if (submissionExists) {
      return next(
        new ApiError(
          `This email: ${userEmail} already submitted a form before.`,
          404
        )
      );
    }

    const form = await Form.findById(formId);
    if (!form) {
      return next(new ApiError(`No form found for this id: ${formId}`, 404));
    }

    // Validate answer count matches form question count
    if (answers.length !== form.questions.length) {
      return next(
        new ApiError("Number of answers doesn't match form questions", 400)
      );
    }

    const formsubmission = await FormSubmission.create({
      userName,
      userEmail,
      formId,
      //   userId: req.user._id ? req.user._id : null, // Set user ID if provided, otherwise null
      answers: answers.map((answer) => ({
        question: answer.question, // Use form questions for clarity
        answer: answer.answer,
      })),
    });

    const submissionsCount = await FormSubmission.countDocuments({ formId });
    form.submissionsCount = submissionsCount;
    await form.save();

    res.status(200).json({
      message: "Form submitted successfully",
      submittedForm: formsubmission,
    });
  } catch (err) {
    console.error("Error submitting form:", err);
    return next(new ApiError("Error submitting form", 500));
  }
});

exports.getFormSubmissions = asyncHandler(async (req, res, next) => {
  const { formId } = req.params;

  let filter = { formId };
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

  const form = await Form.findById(formId);
  if (!form) {
    return next(new ApiError(`No form found for this id: ${formId}`, 404));
  }

  const totalSubmissions = await FormSubmission.countDocuments(filter);
  const totalPages = Math.ceil(totalSubmissions / limitNum);

  const Submissions = await FormSubmission.find(filter)
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  res.status(200).json({
    totalPages,
    page: pageNum,
    results: Submissions.length,
    data: Submissions,
  });
});

exports.getSpeceficSubmission = asyncHandler(async (req, res, next) => {
  const { submissionId } = req.params;

  const submission = await FormSubmission.findById(submissionId);

  if (!submission) {
    return next(
      new ApiError(`No submission found for this id:${submissionId}`, 404)
    );
  }

  res.status(200).json({ message: "Success", date: submission });
});

exports.deleteSubmission = asyncHandler(async (req, res, next) => {
  const { submissionId } = req.params;

  const submittedForm = await FormSubmission.findById(submissionId);

  if (!submittedForm) {
    return next(
      new ApiError(`No form submission for this id:${submissionId}`, 404)
    );
  }

  await FormSubmission.findByIdAndDelete(submissionId);

  const submissionsCount = await FormSubmission.countDocuments({ formId: submittedForm.formId });
  const form = await Form.findById(submittedForm.formId);
  form.submissionsCount = submissionsCount;
  await form.save();


  res.status(204).send("form submission deleted successfully");
});
