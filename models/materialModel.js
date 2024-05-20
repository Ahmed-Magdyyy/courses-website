const mongoose = require("mongoose");
const moment = require("moment-timezone");

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "material title is required"],
      unique: true,
    },
    summary: {
      type: String,
      required: [true, "material summary is required"],
    },
    image: {
      type: String,
      required: [true, "material image is required"],
    },
    materialFile: {
      type: String,
      required: [true, "material file link is required"],
    },
    // students: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  },
  { timestamps: true }
);

function setImageURL(doc) {
  if (doc.image) {
    const imgURL = `${process.env.BASE_URL}/materials/images/${doc.image}`;
    doc.image = imgURL;
  }
  if (doc.materialFile) {
    const fileURL = `${process.env.BASE_URL}/materials/files/${doc.materialFile}`;
    doc.materialFile = fileURL;
  }
}

materialSchema.post("init", (doc) => {
  setImageURL(doc);
});

materialSchema.post("save", (doc, next) => {
  setImageURL(doc);
  next();
});

// materialSchema.post("save", async function (doc) {
//   const userModel = mongoose.model("user");

//   // Update students
//   await userModel.updateMany(
//     { _id: { $in: doc.students }, materials: { $ne: doc._id } }, // Add condition to check if the material ID is not already present
//     { $addToSet: { materials: doc._id } }
//   );
// });

// materialSchema.pre("findOneAndDelete", async function (next) {
//   const userModel = mongoose.model("user");

//   try {
//     const materialDoc = await this.model.findOne(this.getFilter());

//     // If the product document exists
//     if (materialDoc) {
//       const materialId = materialDoc._id;

//       // Update users who have the material ID in their materials array and have the role of "student"
//       await userModel.updateMany(
//         { role: "student", materials: materialId },
//         { $pull: { materials: materialId } } // Remove class ID from 'courses' array
//       );
//     }

//     next();
//   } catch (error) {
//     next(error);
//   }
// });

materialSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  this.createdAt = currentTime;
  this.updatedAt = currentTime;

  next();
});

materialSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const material = mongoose.model("material", materialSchema);
module.exports = material;
