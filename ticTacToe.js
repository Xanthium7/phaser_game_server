module.exports = function (io, socket) {
  const { roomId, playername } = socket.handshake.query;

  if (!io.games) {
    io.games = {};
  }

  if (!io.games[roomId]) {
    io.games[roomId] = {
      players: {},
      board: Array(9).fill(null),
      currentTurn: null,
      winner: null,
    };
  }
  const game = io.games[roomId];

  //adding the player part
  game.players[socket.id] = {
    id: socket.id,
    name: playername || "hehe",
    symbol: null, // 'X' or 'O'
  };

  const playerCount = Object.keys(game.players).length;
  if (playerCount === 1) {
    game.players[socket.id].symbol = "X";
    game.currentTurn = socket.id;
    socket.emit("gameStart", {
      symbol: "X",
      board: game.board,
      currentTurn: game.currentTurn,
    });
  } else if (playerCount === 2) {
    game.players[socket.id].symbol = "O";
    // notify both players
    io.to(roomId).emit("gameStart", {
      symbol: "O",
      board: game.board,
      currentTurn: game.currentTurn,
    });
  } else {
    socket.emit("gameFull");
  }

  socket.on("makeMove", (index) => {
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
    delete game.players[socket.id];
    io.to(roomId).emit("playerDisconnected", socket.id);

    // Reset game if a player disconnects
    game.board = Array(9).fill(null);
    game.currentTurn = null;
    game.winner = null;

    // Notify remaining players
    io.to(roomId).emit("gameReset", { board: game.board });
  });
};
