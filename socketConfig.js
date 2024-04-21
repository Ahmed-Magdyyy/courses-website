// const {getMessages, sendMessage} = require('./controllers/chatController');

// module.exports = (io) => {
//   io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('sendMessage', (data) => {
//       sendMessage(io, socket, data ,socket.id);

//     });

//     socket.on('getMessages', (data) => {
//       getMessages(io, socket, data);
//     });

//     socket.on('disconnect', () => {
//       console.log('A user disconnected:', socket.id);
//     });
//   });
// };