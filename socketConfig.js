module.exports = (io) => {
  let users = [];

  const addUser = (userId, socketId) => {
    !users.some((user) => user.userId === userId) &&
      users.push({ userId, socketId });
  };

  const removeUser = (socketId) => {
    users = users.filter((user) => user.socketId !== socketId);
  };

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("addUser", (userId) => {
      addUser(userId, socket.id);
      io.emit("getUsers", users);
      console.log("users", users);
    });



    // socket.on("sendMessage", (message) => {
    //   const user = users.find(
    //     (user) => user.userId === message.recipientId
    //   );
    //   if (user) {
    //     io.to(user.socketId).emit("getMessage", message);
    //   }
    // });

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
      removeUser(socket.id);
      // io.emit("getOnlineUsers", onlineUsers);
      // console.log("onlineUsers", onlineUsers);
    });
  });
};
