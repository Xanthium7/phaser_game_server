// server/server.js
const { createServer } = require("http");
const { Server } = require("socket.io");
const roomChat = require("./roomChat");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins (adjust in production)
  },
});

io.on("connection", (socket) => {
  const { roomId, playername } = socket.handshake.query;
  socket.join(roomId);
  console.log(`Player connected: ${socket.id} joined room: ${roomId}`);

  // Initialize players object for the room if it doesn't exist
  if (!io.sockets.adapter.rooms.get(roomId).players) {
    io.sockets.adapter.rooms.get(roomId).players = {};
  }

  // Reference to players in the room
  const players = io.sockets.adapter.rooms.get(roomId).players;

  // Add new player to the players AND the starting position
  players[socket.id] = {
    id: socket.id,
    x: 130,
    y: 80,
    name: playername || "Player",
  };

  // ** socket.broadcast.emit() is same as socket.to(roomId).emit() [notfying all palyers]**

  socket.on("getCurrentPlayers", () => {
    socket.emit("currentPlayers", players);
    console.log("Sent currentPlayers upon request:", players);
  });

  socket.to(roomId).emit("newPlayer", players[socket.id]);

  socket.on("playerMovement", (movementData) => {
    console.log("Received playerMovement:", movementData);
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;

    socket.to(roomId).emit("playerMoved", players[socket.id]);
  });

  //*   Handling WebRTC

  socket.on("initiate-video-call", ({ targetId }) => {
    console.log("Initiating video call to:", targetId);
    // This target id is basically the socket id of the player we want to call
    socket.to(targetId).emit("video-call-offer", {
      from: socket.id,
      name: players[socket.id].name,
    });
  });

  socket.on("accept-video-call", ({ callerId }) => {
    console.log("Call accepted by:", socket.id, "for caller:", callerId);
    socket.to(callerId).emit("call-accepted", { from: socket.id });
  });

  // Existing signaling handlers
  socket.on("video-offer", (data) => {
    console.log("Relaying video offer to:", data.target);
    socket.to(data.target).emit("video-offer", {
      sdp: data.sdp,
      sender: socket.id,
    });
  });
  socket.on("video-answer", (data) => {
    console.log("Relaying video answer to:", data.target);
    socket.to(data.target).emit("video-answer", {
      sdp: data.sdp,
      sender: socket.id,
    });
  });

  socket.on("new-ice-candidate", (data) => {
    console.log("Relaying ICE candidate to:", data.target);
    socket.to(data.target).emit("new-ice-candidate", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  socket.on("end-call", ({ targetId }) => {
    socket.to(targetId).emit("end-call");
  });

  //* MUSIC PLAYER
  socket.on("showJukeboxModal", () => {
    socket.emit("showJukeboxModal");
  });

  socket.on("playPlaylist", (playlistLink) => {
    io.to(roomId).emit("playPlaylist", { playlistLink }); // everyplayer includingthe current player, ina room
  });

  socket.on("pausePlaylist", () => {
    io.to(roomId).emit("pausePlaylist");
  });

  socket.on("skipSong", () => {
    io.to(roomId).emit("skipSong");
  });

  socket.on("stopPlaylist", () => {
    io.to(roomId).emit("stopPlaylist");
  });

  //* Chat message handling
  roomChat(io, socket);

  // Handle player disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    // Remove from players object
    delete players[socket.id];
    // Notify remaining players
    io.emit("playerDisconnected", socket.id);
  });
});

httpServer.listen(3001, () => {
  console.log("Server is listening on port 3001");
});
