const { v4: uuidv4 } = require("uuid"); // For generating unique room IDs

// Initialize a waiting queue
if (!module.exports.waitingPlayers) {
  module.exports.waitingPlayers = {};
}

module.exports = function (io, socket) {
  const { roomId, playername } = socket.handshake.query;

  if (!io.games) {
    io.games = {};
  }

  // Handle startTicTacToe event
  socket.on("startTicTacToe", () => {
    if (!module.exports.waitingPlayers[roomId]) {
      // No player waiting, mark this socket as waiting
      module.exports.waitingPlayers[roomId] = socket.id;
      socket.emit("waitingForPlayer");
    } else {
      // Found a waiting player, pair them
      const waitingSocketId = module.exports.waitingPlayers[roomId];
      delete module.exports.waitingPlayers[roomId];

      // Create a unique game room id
      const gameRoomId = uuidv4();
      // Join both sockets to the game room
      socket.join(gameRoomId);
      const waitingSocket = io.sockets.sockets.get(waitingSocketId);
      if (waitingSocket) {
        waitingSocket.join(gameRoomId);

        // Initialize game state
        io.games[gameRoomId] = {
          players: {},
          board: Array(9).fill(null),
          currentTurn: null,
          winner: null,
        };

        // Assign symbols
        io.games[gameRoomId].players[waitingSocketId] = {
          id: waitingSocketId,
          name: playername || "Player",
          symbol: "X",
        };
        io.games[gameRoomId].players[socket.id] = {
          id: socket.id,
          name: playername || "Player",
          symbol: "O",
        };

        // Set current turn
        io.games[gameRoomId].currentTurn = waitingSocketId;

        // Emit gameStart to both players with roomId
        waitingSocket.emit("gameStart", {
          symbol: "X",
          board: io.games[gameRoomId].board,
          currentTurn: io.games[gameRoomId].currentTurn,
          roomId: gameRoomId,
        });
        socket.emit("gameStart", {
          symbol: "O",
          board: io.games[gameRoomId].board,
          currentTurn: io.games[gameRoomId].currentTurn,
          roomId: gameRoomId,
        });
      } else {
        // Waiting socket was disconnected before pairing
        socket.emit("waitingForPlayer");
      }
    }
  });

  // Handle player's move
  socket.on("makeMove", (data) => {
    const { index, roomId } = data;
    const game = io.games[roomId];
    if (!game) {
      socket.emit("invalidMove", "Game not found.");
      return;
    }

    if (game.winner) {
      socket.emit("invalidMove", "Game has already been won.");
      return;
    }

    if (game.currentTurn !== socket.id) {
      socket.emit("invalidMove", "It's not your turn.");
      return;
    }

    if (game.board[index] !== null) {
      socket.emit("invalidMove", "Cell already occupied.");
      return;
    }

    const playerSymbol = game.players[socket.id].symbol;
    game.board[index] = playerSymbol;

    // Check for winner
    const winningCombos = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // Rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // Columns
      [0, 4, 8],
      [2, 4, 6], // Diagonals
    ];

    for (const combo of winningCombos) {
      const [a, b, c] = combo;
      if (
        game.board[a] &&
        game.board[a] === game.board[b] &&
        game.board[a] === game.board[c]
      ) {
        game.winner = socket.id;
        io.to(roomId).emit("gameUpdate", {
          board: game.board,
          winner: socket.id,
        });
        return;
      }
    }

    // Check for draw
    if (!game.board.includes(null)) {
      io.to(roomId).emit("gameUpdate", { board: game.board, winner: null });
      return;
    }

    // Switch turn
    const playerIds = Object.keys(game.players);
    game.currentTurn = playerIds.find((id) => id !== socket.id) || socket.id;

    io.to(roomId).emit("gameUpdate", {
      board: game.board,
      currentTurn: game.currentTurn,
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Remove from waiting players if in waiting
    if (module.exports.waitingPlayers[roomId] === socket.id) {
      delete module.exports.waitingPlayers[roomId];
    }

    // Find all games this socket is in
    for (const gameRoomId in io.games) {
      const game = io.games[gameRoomId];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.to(gameRoomId).emit("playerDisconnected", socket.id);

        // Reset game
        game.board = Array(9).fill(null);
        game.currentTurn = null;
        game.winner = null;

        // Notify remaining players
        io.to(gameRoomId).emit("gameReset", { board: game.board });
        break;
      }
    }
  });
};
