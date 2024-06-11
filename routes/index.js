const authRoute = require("./authRoute");
const usersRoute = require("./usersRoute");
const coursesRoute = require("./coursesRoute");
const classRoute = require("./classRoute");
const productRoute = require("./productRoute");
const materialRoute = require("./materialRoute");
const zoomRoute = require("./zoomCallBackRoute");
const assignmentRoute = require("./asignmentRoute");
const reportRoute = require("./MonthlyReportRoute");
const postsRoute = require("./postsRoute");
const commentsRoute = require("./commentsRoute");
const chatRoute = require("./chatRoute");
const messageRoute = require("./messageRoute");
const notificationRoute = require("./notificationRoute");
const packagesRoute = require("./packageRoute");

const mountRoutes = (app) => {
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
  app.use("/api/v1/packages", packagesRoute);
};

module.exports = mountRoutes
