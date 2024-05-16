const mongoose = require("mongoose");
const moment = require("moment-timezone");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      unique: true,
    },
    summary: {
      type: String,
      required: [true, "Product summary is required"],
    },
    image: {
      type: String,
        required: [true, "Product image is required"],
    },
    productFile: {
      type: String,
      required: [true, "Product file link is required"],
    },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  },
  { timestamps: true }
);

function setImageURL(doc) {
  if (doc.image) {
    const imgURL = `${process.env.BASE_URL}/products/images/${doc.image}`;
    doc.image = imgURL;
  }
  if (doc.productFile) {
    const fileURL = `${process.env.BASE_URL}/products/files/${doc.productFile}`;
    doc.productFile = fileURL;
  }
}

productSchema.post("init", (doc) => {
  setImageURL(doc);
});

productSchema.post("save", (doc,next) => {
  setImageURL(doc);
  next();
});

productSchema.post("save", async function (doc) {
  const userModel = mongoose.model("user");

  // Update teacher if exists
  // if (doc.teacher) {
  //   await userModel.updateOne(
  //     { _id: doc.teacher, courses: { $ne: doc._id } }, // Add condition to check if the course ID is not already present
  //     { $addToSet: { classes: doc._id } }
  //   );
  // }

  // Update students
  await userModel.updateMany(
    { _id: { $in: doc.students }, products: { $ne: doc._id } }, // Add condition to check if the course ID is not already present
    { $addToSet: { products: doc._id } }
  );
});

productSchema.pre("findOneAndDelete", async function (next) {
  const userModel = mongoose.model("user");

  try {
    const productDoc = await this.model.findOne(this.getFilter());

    // If the product document exists
    if (productDoc) {
      const productId = productDoc._id;

      // Update users who have the product ID in their products array and have the role of "student"
      await userModel.updateMany(
        { role: "student", products: productId },
        { $pull: { products: productId } } // Remove class ID from 'courses' array
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// productSchema.pre("save", function (next) {
//   const currentTime = moment()
//     .tz("Africa/Cairo")
//     .format("YYYY-MM-DDTHH:mm:ss[Z]");

//   this.createdAt = currentTime;
//   this.updatedAt = currentTime;

//   next();
// });

// productSchema.pre("findOneAndUpdate", function () {
//   this.updateOne(
//     {},
//     {
//       $set: {
//         updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
//       },
//     }
//   );
// });

const product = mongoose.model("product", productSchema);
module.exports = product;
