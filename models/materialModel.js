const mongoose = require("mongoose");

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
  },
  { 
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
   }
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

const material = mongoose.model("material", materialSchema);
module.exports = material;
