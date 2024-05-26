const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "config.env" });
const app = express();
const PORT = process.env.PORT || 3000;
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

const ApiError = require("./utils/ApiError");
const globalError = require("./middlewares/errorMiddleware");
const dbConnection = require("./config/database");

const authRoute = require("./routes/authRoute");
const usersRoute = require("./routes/usersRoute");
const coursesRoute = require("./routes/coursesRoute");
const classRoute = require("./routes/classRoute");
const productRoute = require("./routes/productRoute");
const materialRoute = require("./routes/materialRoute");
const zoomRoute = require("./routes/zoomCallBackRoute");
const assignmentRoute = require("./routes/asignmentRoute");
const reportRoute = require("./routes/MonthlyReportRoute");
const postsRoute = require("./routes/postsRoute");
const commentsRoute = require("./routes/commentsRoute");
const chatRoute = require("./routes/chatRoute");
const messageRoute = require("./routes/messageRoute");
const notificationRoute = require("./routes/notificationRoute");
const socketConfig = require("./socketConfig");

// middlewares

app.use(cors());
app.options("*", cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// DB connecetion
dbConnection();

// Mount Routes
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", usersRoute);
app.use("/api/v1/courses", coursesRoute);
app.use("/api/v1/classes", classRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/materials", materialRoute);
app.use("/api/v1/zoom", zoomRoute);
app.use("/api/v1/assignments", assignmentRoute);
app.use("/api/v1/reports", reportRoute);
app.use("/api/v1/posts", postsRoute);
app.use("/api/v1/comments", commentsRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/messages", messageRoute);
app.use("/api/v1/notifications", notificationRoute);

app.all("*", (req, res, next) => {
  next(new ApiError(`can't find this route: ${req.originalUrl}`, 400));
});
// Global error handling middleware
app.use(globalError);

const server = app.listen(process.env.PORT, () =>
  console.log(`Example app listening on port ${PORT}!`)
);

// Initialize Socket.IO
socketConfig.initSocketServer(server);

// UnhandledRejections event handler (rejection outside express)
process.on("unhandledRejection", (err) => {
  console.error(
    `unhandledRejection Errors: ${err.name} | ${err.message} | ${err.stack}`
  );
  server.close(() => {
    console.log("server shutting down...");
    process.exit(1);
  });
});
