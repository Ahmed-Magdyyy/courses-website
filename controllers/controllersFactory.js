const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

exports.deleteOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const Document = await Model.findByIdAndDelete(id);
    if (!Document) {
      return next(new ApiError(`No Document found for this id:${id}`, 404));
    }
    res.status(204).send("Document deleted successfully");
  });

exports.createOne = (Model) =>
  asyncHandler(async (req, res) => {
    const newDoc = await Model.create(req.body);
    res.status(201).json({ message: "Success", data: newDoc });
  });

exports.getOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const document = await Model.findById(id);
    if (!document) {
      return next(new ApiError(`No document found for this id:${id}`, 404));
    }
    res.status(200).json({ data: document });
  });

exports.getAll = (Model) =>
  asyncHandler(async (req, res, next) => {
    let filter = {};
    if (req.query) {
      filter = req.query;
    }

    const documents = await Model.find(filter);
    res.status(200).json({ results: documents.length, data: documents });
  });

exports.updateOne = (Model) =>
  asyncHandler(async (req, res, next) => {
    const document = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!document) {
      return next(
        new ApiError(`No document for this id:${req.params.id}`, 404)
      );
    }
    res.status(200).json({ data: document });
  });
