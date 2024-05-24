const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const factory = require("./controllersFactory");
const asyncHandler = require("express-async-handler");

const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");
const sendEmail = require("../utils/sendEmails");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socketConfig");

const productNotify = async (array, message,productId) => {
  // Send notifications to added students
  const studentsNotification = await Promise.all(
    array.map(async (studentId) => {
      return await Notification.create({
        scope: "product",
        userId: studentId,
        relatedId: productId,
        message,
      });
    })
  );


  // Emit notifications students
  const { io, users } = getIO();
  if (users.length > 0) {
    const connectedStudents = users.filter((user) =>
      array.includes(user.userId)
    );

    connectedStudents.forEach((student) => {
      const studentNotification = studentsNotification.find(
        (notification) =>
          notification.userId.toString() === student.userId.toString()
      );

      if (studentNotification) {
        const { userId, scope, message, _id, createdAt } = studentNotification;
        io.to(student.socketId).emit("notification", {
          userId,
          scope,
          productId,
          message,
          _id,
          createdAt,
        });
      }
    });
  }
};

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

  const existsProduct = await productModel.findOne({ title });

  if (existsProduct) {
    deleteUploadedFile(image[0]);
    deleteUploadedFile(productFile[0]);
    return next(
      new ApiError(`Product already exists with same title: ${title}`, 400)
    );
  }

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

  if (req.user.role === "student") {
    const totalProductsCount = await productModel.countDocuments({
      students: { $in: [req.user._id] },
    });
    const totalPages = Math.ceil(totalProductsCount / limitNum);

    const documents = await productModel
      .find({
        students: { $in: [req.user._id] },
      })
      .sort({ createdAt: -1 })
      .select("-students")
      .skip(skipNum)
      .limit(limitNum);
    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else if (req.user.role === "teacher") {
    const totalProductsCount = await productModel.countDocuments({
      teacher: req.user._id,
    });
    const totalPages = Math.ceil(totalProductsCount / limitNum);

    const documents = await productModel
      .find({ teacher: req.user._id })
      .sort({ createdAt: -1 })
      .populate("students", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else {
    const totalProductsCount = await productModel.countDocuments(filter);
    const totalPages = Math.ceil(totalProductsCount / limitNum);

    const documents = await productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("students", "_id name email phone")
      .skip(skipNum)
      .limit(limitNum);
    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  }
});

exports.getProduct = factory.getOne(productModel);

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

    // Clear studentsEnrolled array and remove course from students' courses field if studentIds array is empty
    if (!studentIds || studentIds.length === 0) {
      await userModel.updateMany(
        { products: productId },
        { $pull: { products: productId } },
        { multi: true }
      );
      const updatedProduct = await productModel.findOneAndUpdate(
        { _id: productId },
        { students: studentIds },
        { new: true }
      );
      return res
        .status(200)
        .json({ message: "Course updated successfully", updatedProduct });
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

    // Filter out the student IDs that are already present in the product's students array
    const newStudentIds = studentIds.filter(
      (id) => !product.students.includes(id)
    );

    // Add the product ID to the products array of each student
    await Promise.all(
      students.map(async (student) => {
        if (!student.products.includes(productId)) {
          student.products.push(productId);
          await student.save();
        }
      })
    );

    // Save all updated students
    await Promise.all(students.map((student) => student.save()));

    // Add the new student IDs to the students array of the product
    product.students.push(...newStudentIds);

    // Update the product document using findOneAndUpdate
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: productId },
      { students: product.students },
      { new: true } // Return the updated document
    ).populate("students", "_id name email phone");

    if (updatedProduct) {
      updatedProduct.students.forEach(async (student)=>{
        let capitalizeFirstLetterOfName =
        student.name.split(" ")[0].charAt(0).toUpperCase() +
        student.name.split(" ")[0].slice(1).toLocaleLowerCase();

      let img =
        "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

      let emailTamplate = `<!DOCTYPE html>
              <html lang="en-US">
                <head>
                  <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
                  <title>You have access to product ${updatedProduct.title}</title>
                  <meta name="description" content="You have access to product ${updatedProduct.title}" />
                  <style type="text/css">
                    a:hover {
                      text-decoration: underline !important;
                    }
                  </style>
                </head>
              
                <body
                  marginheight="0"
                  topmargin="0"
                  marginwidth="0"
                  style="margin: 0px; background-color: #f2f3f8"
                  leftmargin="0"
                >
                  <!--100% body table-->
                  <table
                    cellspacing="0"
                    border="0"
                    cellpadding="0"
                    width="100%"
                    bgcolor="#f2f3f8"
                    style="
                      @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
                      font-family: 'Open Sans', sans-serif;
                    "
                  >
                    <tr>
                      <td>
                        <table
                          style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                          width="100%"
                          border="0"
                          align="center"
                          cellpadding="0"
                          cellspacing="0"
                        >
                          <tr>
                            <td style="height: 80px">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="text-align: center">
                              <a
                                href="https://learning.jawwid.com"
                                title="logo"
                                target="_blank"
                              >
                                <img width="250" src="${img}" title="logo" alt="logo" />
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td style="height: 20px">&nbsp;</td>
                          </tr>
                          <tr>
                            <td>
                              <table
                                width="95%"
                                border="0"
                                align="center"
                                cellpadding="0"
                                cellspacing="0"
                                style="
                                  max-width: 670px;
                                  background: #fff;
                                  border-radius: 3px;
                                  text-align: center;
                                  -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                  -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                  box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                "
                              >
                                <tr>
                                  <td style="height: 40px">&nbsp;</td>
                                </tr>
                                <tr>
                                  <td style="padding: 0 35px">
                                    <span
                                      style="
                                        display: inline-block;
                                        vertical-align: middle;
                                        margin: 29px 0 26px;
                                        border-bottom: 1px solid #cecece;
                                        width: 200px;
                                      "
                                    ></span>
                                    <p
                                      style="
                                        color: #455056;
                                        font-size: 17px;
                                        line-height: 24px;
                                        text-align: left;
                                      "
                                    >
                                      Hello ${capitalizeFirstLetterOfName},
                                    </p>
                                    <p
                                      style="
                                        color: #455056;
                                        font-size: 17px;
                                        line-height: 24px;
                                        text-align: left;
                                      "
                                    >
                                    We hope you are enjoying your time on Jawwid.<br>
                                    <br>
                                    You have access to product: ${updatedProduct.title}<br>
                                    Thank you for choosing Jawwid.
                                  </p>
                                    
              
                                    <br>
                                    <p
                                      style="
                                        margin-top: 3px;
                                        color: #455056;
                                        font-size: 17px;
                                        line-height: 2px;
                                        text-align: left;
                                      "
                                    >
                                      The Jawwid Team.
                                    </p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="height: 40px">&nbsp;</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
              
                          <tr>
                            <td style="height: 20px">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="text-align: center">
                              <p
                                style="
                                  font-size: 14px;
                                  color: rgba(69, 80, 86, 0.7411764705882353);
                                  line-height: 18px;
                                  margin: 0 0 0;
                                "
                              >
                                &copy; <strong>https://learning.jawwid.com</strong>
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td style="height: 80px">&nbsp;</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <!--/100% body table-->
                </body>
              </html>`;

      try {
        await sendEmail({
          email: student.email,
          subject: `${capitalizeFirstLetterOfName},  You have access to product ${updatedProduct.title}`,
          message: emailTamplate,
        });
        console.log("Email sent");
      } catch (error) {
        console.log(error);
      }
      })
    }

    productNotify(studentIds, `You have access to product: ${product.title}`,productId);

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

    productNotify(
      studentIds,
      `Your access to product: ${product.title} have been removed`,
      productId
    );

    res
      .status(200)
      .json({ message: "Students removed successfully", updatedProduct });
  } catch (error) {
    console.error("Error removing students from product:", error);
    next(error);
  }
});

exports.getStudentsOfProduct = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;

  const { page, limit, ...query } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 5;
  const skipNum = (pageNum - 1) * limitNum;

  try {
    // Find the product by ID
    const product = await productModel.findById(productId);

    if (!product) {
      return next(
        new ApiError(`No product found for this id:${productId}`, 404)
      );
    }

    // Query students directly with pagination and filtering
    const students = await productModel
      .findById(productId)
      .select("students")
      .slice("students", [skipNum, limitNum])
      .populate({
        path: "students",
        match: { ...query },
        select: "-__v",
      });

    // Calculate total pages based on total students count and limit
    const totalStudentsCount = product.students.length;
    const totalPages = Math.ceil(totalStudentsCount / limitNum);

    res.status(200).json({
      message: "Success",
      totalPages,
      page: pageNum,
      results: students.students.length,
      students: students.students,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
