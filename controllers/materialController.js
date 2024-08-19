const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const materialModel = require("../models/materialModel");
const ApiError = require("../utils/ApiError");

// Function to delete uploaded file
function deleteUploadedFile(file) {
  if (file.fieldname === "image") {
    const filePath = file.path;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting product image file:", err);
      } else {
        console.log("Product image file deleted successfully:", filePath);
      }
    });
  }

  if (file.fieldname === "materialFile") {
    const filePath = file.path;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting product file:", err);
      } else {
        console.log("Product file deleted successfully:", filePath);
      }
    });
  }
}

// Multer storage configuration
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let destFolder = "uploads/materials";
    if (file.mimetype.startsWith("image")) {
      destFolder += "/images"; // Image files folder
    } else if (file.mimetype === "application/pdf") {
      destFolder += "/files"; // PDF files folder
    } else {
      // Reject the file if it's not an image or PowerPoint file
      return cb(new ApiError("Only image or PDF files are allowed", 400));
    }
    // Create the destination folder if it doesn't exist
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    cb(null, destFolder); // Set destination folder
  },
  filename: function (req, file, cb) {
    if (file.mimetype.startsWith("image")) {
      // Generate unique filename for image files
      const ext = file.mimetype.split("/")[1];
      const filename = `image-material-${uuidv4()}.${ext}`;
      cb(null, filename);
    } else if (file.mimetype === "application/pdf") {
      // Generate unique filename for PowerPoint files
      const filename = `file-material-${uuidv4()}.pdf`;
      cb(null, filename);
    }
  },
});

// Multer filter for image files
const imageFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images are allowed", 400), false);
  }
};

// Multer filter for PowerPoint files
const pdfFilter = function (req, file, cb) {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new ApiError("Only PDF files are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: function (req, file, cb) {
    if (file.fieldname === "image") {
      imageFilter(req, file, cb);
    } else if (file.fieldname === "materialFile") {
        pdfFilter(req, file, cb);
    } else {
      cb(new ApiError("Unexpected field", 400), false);
    }
  },
});

exports.uploadProductFiles = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "materialFile", maxCount: 1 },
]);

exports.createMaterial = asyncHandler(async (req, res, next) => {
  const { title, summary } = req.body;
  const { image, materialFile } = req.files;

  const existsmaterial = await materialModel.findOne({ title });

  if (existsmaterial) {
    deleteUploadedFile(image[0]);
    deleteUploadedFile(materialFile[0]);
    return next(
      new ApiError(`Material already exists with same title: ${title}`, 400)
    );
  }

  // Check if both files are uploaded
  if (!image || !materialFile) {
    return next(new ApiError("Both image and material file are required", 400));
  }

  try {
    const Document = await materialModel.create({
      title,
      summary,
      image: image[0].filename,
      materialFile: materialFile[0].filename,
    });

    res.status(201).json({ message: "Success", data: Document });
  } catch (error) {
    console.error("Error creating product:", error);
    // Delete the uploaded files if product creation fails

    deleteUploadedFile(image[0]);
    deleteUploadedFile(materialFile[0]);
    next(error);
  }
});

exports.getAllMaterials = asyncHandler(async (req, res, next) => {
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

  const totalMaterialsCount = await materialModel.countDocuments(filter);
  const totalPages = Math.ceil(totalMaterialsCount / limitNum);

  const documents = await materialModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  res.status(200).json({
    totalPages,
    page: pageNum,
    results: documents.length,
    data: documents,
  });

});

exports.getMaterial = factory.getOne(materialModel);

exports.editMaterial = asyncHandler(async (req, res, next) => {
  const { title, summary } = req.body;

  const material = await materialModel.findById(req.params.id);

  if (!material) {
    return next(new ApiError(`No material found for this id:${req.params.id}`, 404));
  }

  try {
    let updateFields = {};

    // Check if image or materialFile are uploaded
    if (req.files) {
      if (req.files.image || req.files.materialFile) {
        // Delete old files if new files are uploaded
        if (req.files.image && material.image) {
          const index = material.image.indexOf("materials");
          const path = `uploads/${material.image.substring(index)}`;
          deleteUploadedFile({
            fieldname: "image",
            path,
          });
        }
        if (req.files.materialFile && material.materialFile) {
          const index = material.materialFile.indexOf("materials");
          const path = `uploads/${material.materialFile.substring(index)}`;
          deleteUploadedFile({
            fieldname: "materialFile",
            path,
          });
        }

        // Update material details with new files
        if (title) {
          updateFields.title = title;
        }

        if (summary) {
          updateFields.summary = summary;
        }

        if (req.files.image) updateFields.image = req.files.image[0].filename;
        if (req.files.materialFile)
          updateFields.materialFile = req.files.materialFile[0].filename;
      } else {
        // No files uploaded, update only the material details
        if (title) {
          updateFields.title = title;
        }

        if (summary) {
          updateFields.summary = summary;
        }
      }
    }

    // Update the product document
    const updatedMaterial = await materialModel.findOneAndUpdate(
      { _id: req.params.id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    if (!updatedMaterial) {
      return next(new ApiError(`No material found for this id:${req.params.id}`, 404));
    }

    res
      .status(200)
      .json({ message: "material updated successfully", data: updatedMaterial });
  } catch (error) {
    console.error("Error updating product:", error);
    next(error);
  }
});

exports.deleteMaterial = asyncHandler(async (req, res, next) => {
  try {
    const material = await materialModel.findOneAndDelete({ _id: req.params.id });

    if (!material) {
      return next(new ApiError(`No material found for this id:${req.params.id}`, 404));
    }

    // Delete files
    if (material.image) {
      const index = material.image.indexOf("materials");
      const path = `uploads/${material.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    if (material.materialFile) {

      const index = material.materialFile.indexOf("materials");
      const path = `uploads/${material.materialFile.substring(index)}`;
      deleteUploadedFile({
        fieldname: "materialFile",
        path,
      });
    }
    res.status(204).send("material deleted successfully");
  } catch (error) {
    next(error);
  }
});
