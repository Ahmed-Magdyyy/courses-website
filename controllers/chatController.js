const Message = require("../models/chatMessageModel");

exports.sendMessage = async (io, data) => {
  try {
    const { sender, receiver, content } = data;
    let attachment = null;

    if (data.attachment) {
      // Process the attachment (e.g., save it to the server or database)
      // For simplicity, we'll assume attachment is already processed and saved
      attachment = data.attachment;
    }

    const message = await Message.create({
      sender,
      receiver,
      content,
      attachment,
    });

    io.to(receiver).emit("message", message);

    console.log("Message sent:", message);
  } catch (error) {
    console.error("Error sending message:", error);
    // Handle error if necessary
  }
};

exports.getMessages = async (io, data) => {
  try {
    const { sender, receiver } = data;
    const messages = await Message.find({ sender, receiver })
      .sort({ createdAt: -1 })
      .populate("sender", "_id name email phone")
      .populate("receiver", "_id name email phone");

    io.to(receiver).emit("messages", messages);

    console.log("Messages sent from getMessages:", messages);
  } catch (error) {
    console.error("Error receiving messages:", error);
    // Handle error if necessary
  }
};
