require("dotenv").config({ path: ".env.local" });
// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();
const { createServer } = require("http");
const { Server } = require("socket.io");
const roomChat = require("./roomChat");
const ticTacToe = require("./ticTacToe");

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  }
});
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "https://chillverse.vercel.app"],
    methods: ["GET", "POST"],
  },
});

// useAzureSocketIO(io, {
//   hub: "Hub", // The hub name can be any valid string.
//   connectionString: process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING,
// });

const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const roomPlayers = new Map();

io.on("connection", (socket) => {
  const { roomId, playername } = socket.handshake.query;
  socket.join(roomId);
  console.log(`Player connected: ${socket.id} joined room: ${roomId}`);

  // Initialize players object for the room if it doesn't exist
  if (!roomPlayers.has(roomId)) {
    roomPlayers.set(roomId, {});
  }

  // Reference to players in the room
  const players = roomPlayers.get(roomId);

  // Add new player to the players AND the starting position
  players[socket.id] = {
    id: socket.id,
    x: 130,
    y: 80,
    name: playername || "Player",
    speed: 4,
  };

  // ** socket.broadcast.emit() is same as socket.to(roomId).emit() [notfying all palyers]**

  socket.on("getCurrentPlayers", () => {
    socket.emit("currentPlayers", players);
    console.log("Sent currentPlayers upon request:", players);
  });

  socket.to(roomId).emit("newPlayer", players[socket.id]);

  socket.on("playerMovement", (movementData) => {
    // console.log("Received playerMovement:", movementData);
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].speed = movementData.speed;

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

  socket.on("playPlaylist", ({ playlistLink }) => {
    console.log(
      `Broadcasting playPlaylist with link: ${playlistLink} to room: ${roomId}`
    );
    io.to(roomId).emit("playPlaylist", { playlistLink: playlistLink }); // everyplayer includingthe current player, ina room
  });

  socket.on("pausePlaylist", () => {
    io.to(roomId).emit("pausePlaylist");
  });

  socket.on("resumePlaylist", () => {
    io.to(roomId).emit("resumePlaylist");
  });

  socket.on("skipSong", () => {
    io.to(roomId).emit("skipSong");
  });
  socket.on("prevSong", () => {
    io.to(roomId).emit("prevSong");
  });

  socket.on("stopPlaylist", () => {
    io.to(roomId).emit("stopPlaylist");
  });

  //* Chat message handling
  roomChat(io, socket);
  //* Tic-Tac-Toe handling
  // ticTacToe(io, socket);

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    delete players[socket.id];

    io.emit("playerDisconnected", socket.id);
  });
});
