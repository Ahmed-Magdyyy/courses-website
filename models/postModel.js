const mongoose = require("mongoose");
const moment = require("moment-timezone");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    content: { type: String, required: true },
    media: [
      {
        _id: false,
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: { type: String, required: true },
      },
    ],
    likes: {
      count: { type: Number, default: 0 },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    },
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment",
      },
    ],
  },
  { timestamps: true }
);


function setMediaURL(doc) {
  if (doc.media && doc.media.length > 0) {
    doc.media.forEach((mediaItem) => {
      mediaItem.url = `${process.env.BASE_URL}/posts/${mediaItem.url}`;
    });
  }
}

// postSchema.post("init", (doc) => {
//   setMediaURL(doc);
// });
// postSchema.post("save", (doc) => {
//   setMediaURL(doc);
// });
// postSchema.post(/find/, (doc) => {
//   setMediaURL(doc);
// });

// postSchema.pre(/^find/, function (next) {
//   console.log("this:", this)
//   setMediaURL(this);
//   next()
// })



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
