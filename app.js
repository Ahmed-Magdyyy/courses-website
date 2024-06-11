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

const socketConfig = require("./socketConfig");

// Routes
const mountRoutes = require("./routes");
const {webhook} = require("./controllers/packagesController")

// middlewares

app.use(cors());
app.options("*", cors());
app.use(express.urlencoded({ extended: false }));

app.post("/api/v1/packages/webhook",express.raw({ type: "application/json" }),webhook)

app.use(express.json());
app.use(express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// DB connecetion
dbConnection();

// Mount Routes
mountRoutes(app)

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
