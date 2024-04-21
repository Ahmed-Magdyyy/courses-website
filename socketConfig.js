const { getMessages, sendMessage } = require("./controllers/chatController");

module.exports = (io) => {
  let onlineUsers = [];

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("addNewUser", (userId) => {
      !onlineUsers.some((user) => user.userId === userId) &&
        onlineUsers.push({ userId, socketId: socket.id });
      console.log("onlineUsers", onlineUsers);
      
      io.emit("getOnlineUsers", onlineUsers);
    });

    socket.on("sendMessage", (data) => {
      sendMessage(io, socket, data, socket.id);
    });

    socket.on("getMessages", (data) => {
      getMessages(io, socket, data);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
    });
  });
};
