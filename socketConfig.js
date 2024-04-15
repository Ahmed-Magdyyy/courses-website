const {getMessages, sendMessage} = require('./controllers/chatController');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('sendMessage', (data) => {
      sendMessage(io, data);
    });

    socket.on('getMessages', (data) => {
      getMessages(io, data);
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
    });
  });
};
