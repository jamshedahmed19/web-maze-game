// Configuring Firebase
var firebaseConfig = {
  apiKey: "AIzaSyC5cBhr04ap8w58qocKqZZNQGFzW_ZL8r8",
  authDomain: "maze-game-da70a.firebaseapp.com",
  projectId: "maze-game-da70a",
  storageBucket: "maze-game-da70a.appspot.com",
  messagingSenderId: "687851404990",
  appId: "1:687851404990:web:3c443aa920cd89c857a8ef",
  measurementId: "G-8ZXD62MQSV",
};

firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();
// Initialize the Firebase Auth object
const auth = firebase.auth();

// Sign in the user anonymously
auth.signInAnonymously().catch((error) => {
  console.log("Error signing in anonymously: ", error);
});

// Listen for changes in the authentication state
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in.
    const uid = user.uid;

    // Display the player ID
    document.getElementById("playerId").textContent = "Player ID: " + uid;

    // enable start game button
    document.getElementById("startGameButton").disabled = false;

    // Get the current game state
    const gameStateRef = db.collection("gameState").doc("maze");
    gameStateRef.get().then((doc) => {
      if (doc.exists) {
        let mazeStr = doc.data().maze;
        let maze = matrixDecode(mazeStr);

        // Find all edge cells that are paths
        let edgeCells = [];
        for (let i = 0; i < maze.length; i++) {
          if (maze[i][0] === 0) edgeCells.push([i, 0]);
          if (maze[i][maze[0].length - 1] === 0)
            edgeCells.push([i, maze[0].length - 1]);
        }
        for (let j = 0; j < maze[0].length; j++) {
          if (maze[0][j] === 0) edgeCells.push([0, j]);
          if (maze[maze.length - 1][j] === 0)
            edgeCells.push([maze.length - 1, j]);
        }

        // If there are at least two edge cells, assign one to this player
        if (edgeCells.length >= 2) {
          let randomIndex = Math.floor(Math.random() * edgeCells.length);
          let [y, x] = edgeCells[randomIndex];

          // Add user to players in game state
          const playerRef = gameStateRef.collection("players").doc(uid);
          playerRef.set({
            x: x,
            y: y,
          });
        }
      }
    });
  } else {
    // User is signed out. This should not normally happen with anonymous sign-in.
    document.getElementById("playerId").textContent = "Not signed in";
  }
});

// Game starting function
function startGame(uid) {
  const mazeContainer = document.getElementById("mazeContainer");
  const gameStateRef = db.collection("gameState").doc("maze");

  // Listen for changes in game state
  gameStateRef.onSnapshot((doc) => {
    const gameState = doc.data();
    document.getElementById("gameStatus").textContent =
      "Game Status: " + gameState.status;
    renderMaze(mazeContainer, gameState, uid);
  });

  // Set the goal cell in Firestore
  db.collection("gameState")
    .doc("maze")
    .get()
    .then((doc) => {
      if (doc.exists) {
        let mazeStr = doc.data().maze;
        let maze = matrixDecode(mazeStr);

        // Find all edge cells that are paths
        let edgeCells = [];
        for (let i = 0; i < maze.length; i++) {
          if (maze[i][0] === 0) edgeCells.push([i, 0]);
          if (maze[i][maze[0].length - 1] === 0)
            edgeCells.push([i, maze[0].length - 1]);
        }
        for (let j = 0; j < maze[0].length; j++) {
          if (maze[0][j] === 0) edgeCells.push([0, j]);
          if (maze[maze.length - 1][j] === 0)
            edgeCells.push([maze.length - 1, j]);
        }

        // If there are at least one edge cell, assign one as the goal
        if (edgeCells.length >= 1) {
          let randomIndex = Math.floor(Math.random() * edgeCells.length);
          let [y, x] = edgeCells[randomIndex];

          // Set the goal in the game state
          db.collection("gameState").doc("maze").update({
            goal: { x, y },
          });
        }
      }
    });

  // Monitor the number of players
  gameStateRef.collection("players").onSnapshot((querySnapshot) => {
    const playerCount = querySnapshot.size;

    if (playerCount >= 2) {
      document.getElementById("startGameButton").disabled = false;
    } else {
      document.getElementById("startGameButton").disabled = true;
    }
  });
}

function renderMaze(mazeContainer, gameState, uid) {
  mazeContainer.innerHTML = "";

  let maze = matrixDecode(gameState.maze);

  let players = gameState.players;

  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      let cell = document.createElement("div");
      cell.classList.add("cell");

      // Determine if this cell is a wall or path
      if (maze[y][x] === 1) {
        cell.classList.add("wall");
      } else {
        if (
          gameState.goal &&
          gameState.goal.x === x &&
          gameState.goal.y === y
        ) {
          cell.classList.add("goal"); // The goal cell
        }
      }

      // Determine if a player is at this cell
      for (let playerId in players) {
        if (players[playerId].x === x && players[playerId].y === y) {
          cell.classList.add("player");
        }
      }

      mazeContainer.appendChild(cell);
    }
  }
}

document.addEventListener("keydown", (event) => {
  let uid = auth.currentUser.uid;
  switch (event.key) {
    case "ArrowUp":
      movePlayer(uid, "up");
      break;
    case "ArrowDown":
      movePlayer(uid, "down");
      break;
    case "ArrowLeft":
      movePlayer(uid, "left");
      break;
    case "ArrowRight":
      movePlayer(uid, "right");
      break;
  }
});

function movePlayer(uid, direction) {
  const gameStateRef = db.collection("gameState").doc("maze");
  gameStateRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        const gameState = doc.data();
        const player = gameState.players[uid];
        let maze = matrixDecode(gameState.maze);

        // Determine the player's new position based on the direction of movement
        let newX = player.x;
        let newY = player.y;

        switch (direction) {
          case "up":
            newY--;
            break;
          case "down":
            newY++;
            break;
          case "left":
            newX--;
            break;
          case "right":
            newX++;
            break;
        }

        // Check if the new position is within the maze and not a wall
        if (
          newX >= 0 &&
          newX < maze[0].length &&
          newY >= 0 &&
          newY < maze.length &&
          maze[newY][newX] !== 1
        ) {
          // Update the player's position in the game state
          const newPlayerState = {};
          newPlayerState[`players.${uid}.x`] = newX;
          newPlayerState[`players.${uid}.y`] = newY;
          gameStateRef.update(newPlayerState);
        }
      } else {
        console.log("No such document!");
      }
    })
    .catch((error) => {
      console.log("Error getting document:", error);
    });
}

// Event listener for the start game button
document.getElementById("startGameButton").addEventListener("click", () => {
  const uid = firebase.auth().currentUser.uid;

  // Generate the maze and encode it
  let maze = generateMaze(10, 10);
  let mazeStr = matrixEncode(maze);
  const players = {};
  // set player positions randomly within the maze but not on walls

  let x = Math.floor(Math.random() * maze[0].length);
  let y = Math.floor(Math.random() * maze.length);
  while (maze[y][x] === 1) {
    x = Math.floor(Math.random() * maze[0].length);
    y = Math.floor(Math.random() * maze.length);
  }
  players[uid] = { x: x, y: y };

  // Start the game
  db.collection("gameState")
    .doc("maze")
    .set({
      status: "ongoing",
      maze: mazeStr,
      players: players,
    })
    .then(() => {
      console.log("Document successfully written!");
      // hide start game button
      document.getElementById("startGameButton").style.display = "none";
      startGame(uid);
    })
    .catch((error) => {
      console.error("Error writing document: ", error);
    });
});

function generateMaze(width, height) {
  let maze = new Array(height).fill(0).map(() => new Array(width).fill(1));

  let stack = [];
  let visited = new Array(height)
    .fill(false)
    .map(() => new Array(width).fill(false));

  // Choose a random start point and mark it as visited
  let startX = Math.floor(Math.random() * width);
  let startY = Math.floor(Math.random() * height);
  maze[startY][startX] = 0;
  visited[startY][startX] = true;
  stack.push([startX, startY]);

  let directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]; // Left, right, up, down

  while (stack.length > 0) {
    let [x, y] = stack[stack.length - 1]; // Get the current cell

    // Get all unvisited neighbours
    let neighbours = directions
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(
        ([nx, ny]) =>
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height && // Within bounds
          !visited[ny][nx] && // Not visited
          directions
            .map(([dx, dy]) => [nx + dx, ny + dy]) // Has at least two wall neighbours
            .filter(([x, y]) => x >= 0 && x < width && y >= 0 && y < height)
            .map(([x, y]) => maze[y][x])
            .filter((cell) => cell === 1).length >= 2
      );

    if (neighbours.length > 0) {
      // Choose a random neighbour and carve a path to it
      let [nx, ny] = neighbours[Math.floor(Math.random() * neighbours.length)];
      maze[ny][nx] = 0;
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    } else {
      // No unvisited neighbours, backtrack
      stack.pop();
    }
  }

  return maze;
}

function matrixEncode(matrix) {
  // Convert the matrix to a string
  let str = "";
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      str += matrix[i][j];
    }
    str += "\n";
  }

  return str;
}

function matrixDecode(str) {
  // Convert the string to a matrix
  let matrix = [];
  let rows = str.split("\n");
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]) {
      matrix[i] = rows[i].split("").map(Number);
    }
  }

  return matrix;
}
