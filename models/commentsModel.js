const mongoose = require("mongoose");
const moment = require("moment-timezone");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    content: { type: String, required: true },
    image: String,
    likes: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    },
  },
  { timestamps: true }
);

function setImageURL(doc) {
  if (doc.image) {
    const imgURL = `${process.env.BASE_URL}/posts/${doc.image}`;
    doc.image = imgURL;
  }
}

postSchema.post("init", (doc) => {
  setImageURL(doc);
});
postSchema.post("save", (doc) => {
  setImageURL(doc);
});

postSchema.pre("save", function (next) {
  const currentTime = moment()
    .tz("Africa/Cairo")
    .format("YYYY-MM-DDTHH:mm:ss[Z]");

  this.createdAt = currentTime;
  this.updatedAt = currentTime;

  next();
});

postSchema.pre("findOneAndUpdate", function () {
  this.updateOne(
    {},
    {
      $set: {
        updatedAt: moment().tz("Africa/Cairo").format("YYYY-MM-DDTHH:mm:ss[Z]"),
      },
    }
  );
});

const post = mongoose.model("post", postSchema);
module.exports = post;
