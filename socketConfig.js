const {getMessages, sendMessage} = require('./controllers/chatController');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('sendMessage', (data) => {
      sendMessage(io, socket, data);
      console.log("//////////////////////");
      console.log(socket.id);
      console.log("//////////////////////");
    });

    socket.on('getMessages', (data) => {
      getMessages(io, socket, data);
      // console.log("//////////////////////");
      // console.log(socket.id);
      // console.log("//////////////////////");
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
    });
  });
};