const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const productModel = require("../models/productModel");
const ApiError = require("../utils/ApiError");

// Function to delete uploaded file
function deleteUploadedFile(file) {
  if (file.fieldname === "image") {
    const filePath = file.path;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting product image file:", err);
      } else {
        console.log("Product image file deleted successfully:");
      }
    });
  }

  if (file.fieldname === "productFile") {
    const filePath = file.path;
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting product file:", err);
      } else {
        console.log("Product file deleted successfully:");
      }
    });
  }
}

// Multer storage configuration
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let destFolder = "uploads/products";
    if (file.mimetype.startsWith("image")) {
      destFolder += "/images"; // Image files folder
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      destFolder += "/files"; // PowerPoint files folder
    } else {
      // Reject the file if it's not an image or PowerPoint file
      return cb(
        new ApiError("Only image or PowerPoint files (PPTX) are allowed", 400)
      );
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
      const filename = `image-product-${uuidv4()}.${ext}`;
      cb(null, filename);
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      // Generate unique filename for PowerPoint files
      const filename = `file-product-${uuidv4()}.pptx`;
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
const pptxFilter = function (req, file, cb) {
  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    cb(null, true);
  } else {
    cb(new ApiError("Only PowerPoint files (PPTX) are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: function (req, file, cb) {
    if (file.fieldname === "image") {
      imageFilter(req, file, cb);
    } else if (file.fieldname === "productFile") {
      pptxFilter(req, file, cb);
    } else {
      cb(new ApiError("Unexpected field", 400), false);
    }
  },
});

exports.uploadProductFiles = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "productFile", maxCount: 1 },
]);

exports.createProduct = asyncHandler(async (req, res, next) => {
  const { title, summary } = req.body;
  const { image, productFile } = req.files;

  // Check if both files are uploaded
  if (!image || !productFile) {
    return next(new ApiError("Both image and product file are required", 400));
  }

  try {
    const Document = await productModel.create({
      title,
      summary,
      image: image[0].filename,
      productFile: productFile[0].filename,
    });

    res.status(201).json({ message: "Success", data: Document });
  } catch (error) {
    console.error("Error creating product:", error);
    // Delete the uploaded files if product creation fails

    deleteUploadedFile(image[0]);
    deleteUploadedFile(productFile[0]);
    next(error);
  }
});

exports.getAllProducts = factory.getAll(productModel);

exports.getProduct = factory.getOne(productModel);

exports.editProduct = asyncHandler(async (req, res, next) => {
  const { title, summary } = req.body;
  const { image, productFile } = req.files;

  try {
    const product = await productModel.findById(req.params.id);

    if (!product) {
      return next(new ApiError(`No product for this id:${req.params.id}`, 404));
    }

    // Delete old files if new files are uploaded
    if (image && product.image) {
      const index = product.image.indexOf("products");
      const path = `uploads/${product.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    if (productFile && product.productFile) {
      const index = product.productFile.indexOf("products");
      const path = `uploads/${product.productFile.substring(index)}`;
      deleteUploadedFile({
        fieldname: "productFile",
        path,
      });
    }

    // Update product details
    product.title = title;
    product.summary = summary;
    product.image = image[0].filename;
    product.productFile = productFile[0].filename;

    // Save the updated product
    await product.save();

    res
      .status(200)
      .json({ message: "Product updated successfully", data: product });
  } catch (error) {
    console.error("Error updating product:", error);
    next(error);
  }
});

exports.deleteProduct = asyncHandler(async (req, res, next) => {
  try {
    const product = await productModel.findOneAndDelete({ _id: req.params.id });

    if (!product) {
      return next(new ApiError(`No product for this id:${req.params.id}`, 404));
    }

    // Delete files
    if (product.image) {
      const index = product.image.indexOf("products");
      const path = `uploads/${product.image.substring(index)}`;
      deleteUploadedFile({
        fieldname: "image",
        path,
      });
    }
    if (product.productFile) {
      const index = product.productFile.indexOf("products");
      const path = `uploads/${product.productFile.substring(index)}`;
      deleteUploadedFile({
        fieldname: "productFile",
        path,
      });
    }
    res.status(204).send("Product deleted successfully");
  } catch (error) {
    next(error);
  }
});
