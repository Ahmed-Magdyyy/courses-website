const moment = require("moment-timezone");
let io;
let users;

function initSocket(server) {
  io = require("socket.io")(server, {
    cors: {
      origin: "*",
    },
  });

  users = [];

  const addUser = (userId, socketId) => {
    !users.some((user) => user.userId === userId) &&
      users.push({ userId, socketId });
  };

  const removeUser = (socketId) => {
    users = users.filter((user) => user.socketId !== socketId);
  };

  const getUser = (userId) => {
    return users.find((user) => user.userId === userId);
  };

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("addUser", (userId) => {
      addUser(userId, socket.id);
      io.emit("getUsers", users);
      console.log("users connected to socket", users);
    });

    socket.on("sendMessage", ({ senderId, receiverId, text }) => {
      const user = getUser(receiverId);

      if (user == undefined || !user) {
        io.emit("error", "error getting user id.");
        return;
      }

      io.to(user.socketId).emit("getMessage", {
        senderId,
        text,
      });

      const currentTime = moment()
        .tz("Africa/Cairo")
        .format("YYYY-MM-DDTHH:mm:ss[Z]");

      // io.to(user.socketId).emit("notification", {
      //   senderId,
      //   isRead: false,
      //   createdAt: currentTime,
      // });
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
      removeUser(socket.id);
      io.emit("getUsers", users);
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }
  return { io, users };
}

module.exports = {
  initSocket,
  getIO,
};
