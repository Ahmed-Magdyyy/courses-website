const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
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

exports.getAllProducts = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  if (query) {
    filter = query;
  }

  if (req.user.role === "student") {
    console.log("====================================");
    console.log("from student role");
    console.log("====================================");
    const documents = await productModel
      .find({
        students: { $in: [req.user._id] },
      })
      .sort({ createdAt: -1 })
      .select("-students")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({ results: documents.length, page: pageNum, data: documents });
  } else if (req.user.role === "teacher") {
    console.log("====================================");
    console.log("from teacher role");
    console.log("====================================");

    const documents = await productModel
      .find({ teacher: req.user._id })
      .sort({ createdAt: -1 })
      .populate("students", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({ results: documents.length, page: pageNum, data: documents });
  } else {
    console.log("====================================");
    console.log("from rest roles");
    console.log("====================================");

    const documents = await productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("students", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res
      .status(200)
      .json({ results: documents.length, page: pageNum, data: documents });
  }
});

exports.getProduct = factory.getOne(productModel);

// exports.editProduct = asyncHandler(async (req, res, next) => {
//   const { title, summary } = req.body;
//   const { image, productFile } = req.files;

//   try {
//     const product = await productModel.findById(req.params.id);
// console.log('====================================');
// console.log(product.image);
// console.log('====================================');
//     if (!product) {
//       return next(new ApiError(`No product for this id:${req.params.id}`, 404));
//     }

//     // Check if image or productFile are uploaded
//     if (image || productFile) {
//       // Delete old files if new files are uploaded
//       if (image && product.image) {
//         const index = product.image.indexOf("products");
//         const path = `uploads/${product.image.substring(index)}`;
//         deleteUploadedFile({
//           fieldname: "image",
//           path,
//         });
//       }
//       if (productFile && product.productFile) {
//         const index = product.productFile.indexOf("products");
//         const path = `uploads/${product.productFile.substring(index)}`;
//         deleteUploadedFile({
//           fieldname: "productFile",
//           path,
//         });
//       }

//       // Update product details with new files
//       if (title) {
//         product.title = title;
//       }

//       if (summary) {
//         product.summary = summary;
//       }

//       if (req.files.image) {product.image = req.files.image[0].filename}
//        else {
//         product.image = product.image
//       }
//       if (req.files.productFile) {product.productFile = req.files.productFile[0].filename}
//        else {
//         product.productFile= product.productFile
//       }

//     } else {
//       // No files uploaded, update only the product details
//       if (title) {
//         product.title = title;
//       }

//       if (summary) {
//         product.summary = summary;
//       }
//     }

//     // Save the updated product
//     await product.save();

//     res
//       .status(200)
//       .json({ message: "Product updated successfully", data: product });
//   } catch (error) {
//     console.error("Error updating product:", error);
//     next(error);
//   }
// });

exports.editProduct = asyncHandler(async (req, res, next) => {
  const { title, summary } = req.body;

  const product = await productModel.findById(req.params.id);

  if (!product) {
    return next(new ApiError(`No product for this id:${req.params.id}`, 404));
  }

  try {
    let updateFields = {};

    // Check if image or productFile are uploaded
    if (req.files) {
      if (req.files.image || req.files.productFile) {
        // Delete old files if new files are uploaded
        if (req.files.image && product.image) {
          const index = product.image.indexOf("products");
          const path = `uploads/${product.image.substring(index)}`;
          deleteUploadedFile({
            fieldname: "image",
            path,
          });
        }
        if (req.files.productFile && product.productFile) {
          const index = product.productFile.indexOf("products");
          const path = `uploads/${product.productFile.substring(index)}`;
          deleteUploadedFile({
            fieldname: "productFile",
            path,
          });
        }

        // Update product details with new files
        if (title) {
          updateFields.title = title;
        }

        if (summary) {
          updateFields.summary = summary;
        }

        if (req.files.image) updateFields.image = req.files.image[0].filename;
        if (req.files.productFile)
          updateFields.productFile = req.files.productFile[0].filename;
      } else {
        // No files uploaded, update only the product details
        if (title) {
          updateFields.title = title;
        }

        if (summary) {
          updateFields.summary = summary;
        }
      }
    }

    // Update the product document
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: req.params.id },
      { $set: updateFields },
      { new: true } // Return the updated document
    );

    if (!updatedProduct) {
      return next(new ApiError(`No product for this id:${req.params.id}`, 404));
    }

    res
      .status(200)
      .json({ message: "Product updated successfully", data: updatedProduct });
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

exports.addStudentsToProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the product by ID
    const product = await productModel.findById(productId);
    if (!product) {
      return next(
        new ApiError(`No product found for this id:${productId}`, 404)
      );
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

    // Check if any student IDs already exist in the product.students array
    const existingStudents = studentIds.filter((id) =>
      product.students.includes(id)
    );

    // If any existing students found, return an error
    if (existingStudents.length > 0) {
      return next(
        new ApiError(
          `Students with IDs ${existingStudents.join(
            ", "
          )} are already enrolled in the product`,
          400
        )
      );
    }

    // Add the product ID to the products array of each student
    students.forEach((student) => {
      if (!student.products.includes(productId)) {
        student.products.push(productId);
      }
    });

    // Save all updated students
    await Promise.all(students.map((student) => student.save()));

    // Add the new student IDs to the students array of the product
    product.students.push(...studentIds);

    // Update the product document using findOneAndUpdate
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: productId },
      { students: product.students },
      { new: true } // Return the updated document
    );

    res
      .status(200)
      .json({ message: "Students added successfully", updatedProduct });
  } catch (error) {
    console.error("Error adding students to product:", error);
    next(error);
  }
});

exports.removeStudentsFromProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the product by ID
    const product = await productModel.findById(productId);
    if (!product) {
      return next(
        new ApiError(`No product found for this id:${productId}`, 404)
      );
    }

    // Check if provided student IDs match any enrolled students in the product
    const enrolledStudents = product.students.map((id) => id.toString());
    const invalidStudentIds = studentIds.filter(
      (id) => !enrolledStudents.includes(id.toString())
    );

    // If any invalid student IDs found, return an error
    if (invalidStudentIds.length > 0) {
      return next(
        new ApiError(
          `Students with IDs ${invalidStudentIds.join(
            ", "
          )} are not enrolled in the product`,
          400
        )
      );
    }

    // Find the students by IDs
    const students = await userModel.find({
      _id: { $in: studentIds },
      role: "student",
    });

    // Remove the product ID from the products array of each student
    students.forEach((student) => {
      const index = student.products.indexOf(productId);
      if (index !== -1) {
        student.products.splice(index, 1);
      }
    });

    // Save all updated students
    await Promise.all(students.map((student) => student.save()));

    // Remove the student IDs from the students array of the product
    product.students = product.students.filter(
      (id) => !studentIds.includes(id.toString())
    );

    // Update the product document using findOneAndUpdate
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: productId },
      { students: product.students },
      { new: true } // Return the updated document
    );

    res
      .status(200)
      .json({ message: "Students removed successfully", updatedProduct });
  } catch (error) {
    console.error("Error removing students from product:", error);
    next(error);
  }
});