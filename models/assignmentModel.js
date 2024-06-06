const mongoose = require("mongoose");
const fs = require("fs");

const assignmentSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "class",
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    assignmentFile: String,
  },
  {
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
  }
);

function setImageURL(doc) {
  if (doc.assignmentFile) {
    let fileType = "";
    if (doc.assignmentFile.startsWith("audio")) {
      fileType = "audio";
    } else if (doc.assignmentFile.startsWith("image")) {
      fileType = "image";
    }

    if (fileType) {
      const fileURL = `${process.env.BASE_URL}/assignments/${fileType}s/${doc.assignmentFile}`;
      doc.assignmentFile = fileURL;
    }
  }
}

// Middleware for initialization (loading from the database)
assignmentSchema.post("init", setImageURL);

// Middleware for saving (before saving to the database)
assignmentSchema.post("save", setImageURL);

assignmentSchema.post("save", async function (doc) {
  try {
    // Retrieve the class document
    const Class = await mongoose.model("class").findById(doc.class);

    // Add the assignment ID to the class's assignments field
    if (Class) {
      Class.assignments.push(doc._id);
      await Class.save();
    }
  } catch (error) {
    console.error("Error adding assignment to class:", error);
  }
});

assignmentSchema.pre(/delete/i, async function (next) {
  try {
    const assignment = await this.model.findOne(this.getFilter());
    if (!assignment) {
      // Assignment not found
      console.error("Assignment not found");
      next();
    }

    // Determine the file path based on the file type
    let folder;

    if (assignment.assignmentFile.split("/")[3].startsWith("audio")) {
      folder = "uploads/assignments/audio";
    } else if (assignment.assignmentFile.split("/")[3].startsWith("image")) {
      folder = "uploads/assignments/images";
    } else {
      // Unsupported file type
      return next(new Error("Unsupported file type"));
    }

    const filePath = `${folder}/${assignment.assignmentFile.split("/")[3]}`;

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(
          `Error deleting assignment file (${
            assignment.assignmentFile.split("/")[3]
          }):`,
          err
        );
      } else {
        console.log(
          `Assignment file (${
            assignment.assignmentFile.split("/")[3]
          }) deleted successfully`
        );
      }
    });

    next();
  } catch (error) {
    next(error);
  }
});

const assignment = mongoose.model("assignment", assignmentSchema);
module.exports = assignment;
