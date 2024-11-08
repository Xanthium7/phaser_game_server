// server/server.js
const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins (adjust in production)
  },
});

let players = {};

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Add new player to the players object
  players[socket.id] = {
    x: 25,
    y: 20,
  };

  // Send the current players to the new player
  socket.emit("currentPlayers", players);

  // Notify existing players of the new player
  socket.broadcast.emit("newPlayer", {
    id: socket.id,
    x: players[socket.id].x,
    y: players[socket.id].y,
  });

  // Listen for player movement
  socket.on("playerMovement", (movementData) => {
    players[socket.id] = movementData;
    // Broadcast the movement to other players
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      x: movementData.x,
      y: movementData.y,
    });
  });

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
