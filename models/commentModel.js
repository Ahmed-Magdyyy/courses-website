const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post", // Assuming your post model is named "Post"
      required: true,
    },
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    media: String,
    likes: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    },
  },
  { 
    timestamps: {
      timeZone: "UTC", // Set the time zone to UTC
    },
   }
);

function setMediaURL(doc) {
  if (doc.media) {
    const mediaURL = `${process.env.BASE_URL}/posts/comments/${doc.media}`;
    doc.media = mediaURL;
  }
}

commentSchema.post("init", (doc) => {
  setMediaURL(doc);
});
commentSchema.post("save", (doc) => {
  setMediaURL(doc);
});

const comment = mongoose.model("comment", commentSchema);
module.exports = comment;
