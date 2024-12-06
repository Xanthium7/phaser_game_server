module.exports = function (io, socket) {
  const { roomId, playername } = socket.handshake.query;

  socket.on("chatMessage", (messageData) => {
    console.log(`Message from ${playername}: ${messageData.message}`);

    socket.to(roomId).emit("chatMessage", {
      playername: playername,
      message: messageData.message,
      time: new Date().toLocaleTimeString(),
    });
  });
};
