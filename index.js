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
function deleteGameState() {
  // Reference to the "gameState" collection
  const gameStateRef = db.collection("gameState");

  // Reference to the "maze" document within the "gameState" collection
  const mazeDocRef = gameStateRef.doc("maze");

  // Delete the "maze" document
  mazeDocRef.delete()
    .then(() => {
      console.log("Game state deleted successfully");
    })
    .catch((error) => {
      console.error("Error deleting game state:", error);
    });
}

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
    // document.getElementById("startGameButton").disabled = false;

    // Listen to changes in game state, if atleast 2 players are searching for a game, start the game
    // otherwise, wait for more players to join and update the player status to "searching"

    db.collection("gameState")
      .doc("maze")
      .collection("players")
      .onSnapshot((querySnapshot) => {
        const playerCount = querySnapshot.size;

        if (playerCount >= 2) {
          document.getElementById("startGameButton").disabled = false;
        }

        // Update the player status to "searching"

        db.collection("gameState")
          .doc("maze")

          .collection("players")
          .doc(uid)
          .set({
            status: "searching",
          })

          .then(() => {
            console.log("Document successfully written!");
          })
          .catch((error) => {
            console.error("Error writing document: ", error);
          });
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
          console.log("Setting goal to: ", x, y);
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

          if (playerId === uid) {
            cell.classList.add("current-player");
          }
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
  const currentUser = firebase.auth().currentUser;
  gameStateRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        const gameState = doc.data();
        const player = gameState.players[uid];
        const goal = gameState.goal;
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
          console.log("Moving player to: ", newX, newY, goal, gameState, maze);
          const anyPlayerWon = Object.values(gameState.players).some(player => player.x === goal.x && player.y === goal.y);

          if (anyPlayerWon) {
            // Update the game status to indicate a player has won
            gameStateRef.update({
              status: 'Some player won', // You may want to customize this message

            })
              .then(() => {
                if (uid === currentUser.uid){
                  document.getElementById("winner").src = "assets/loss.jpg";

                  document.getElementById("winning-player").textContent = "You Lost";
                  document.getElementById("win-page").classList.remove("hidden");

                  // Hide the maze container by setting its display property to "none"
                  document.getElementById("mazeContainer").style.display = "none";
  
                  // Remove the "hidden" class from the "playAgainButton" element to display it
                  document.getElementById("playAgainButton").classList.remove("hidden");
  
                  // Enable the play again button by setting its disabled property to false
                  document.getElementById("playAgainButton").disabled = false;
  
                  console.log("Document successfully updated!");
                }
                // Update the UI or perform any additional actions
                // document.getElementById("winner").src = "assets/victoryP2.png";

                // Update the text content of the "winning-player" element to "You Lost"
            
              })
              .catch((error) => {
                console.error("Error updating document: ", error);
              });
          } else if (newX === goal.x && newY === goal.y) {
            // If the player has reached the goal, update the position and set the game status to "won"
            gameStateRef.update({
              [`players.${uid}`]: { x: newX, y: newY },
              status: `players.${uid} won`,
            })
              .then(() => {
                // Set the image source for the "winner" element based on the player's ID
                if (uid === currentUser.uid) {
                  // Set the image source to victoryP1.png if the current player won
                  document.getElementById("winner").src = "assets/victoryP1.png";

                  // Update the text content of the "winning-player" element to "You Won"
                  document.getElementById("winning-player").textContent = "You Won";
                  
                } else {
                  // Set the image source to victoryP2.png if the other player won
                  document.getElementById("winner").src = "assets/victoryP2.png";

                  // Update the text content of the "winning-player" element to "You Lost"
                  document.getElementById("winning-player").textContent = "You Lost";
                }

                // Remove the "hidden" class from the "win-page" element to display it
                document.getElementById("win-page").classList.remove("hidden");

                // Hide the maze container by setting its display property to "none"
                document.getElementById("mazeContainer").style.display = "none";

                // Remove the "hidden" class from the "playAgainButton" element to display it
                document.getElementById("playAgainButton").classList.remove("hidden");

                // Enable the play again button by setting its disabled property to false
                document.getElementById("playAgainButton").disabled = false;

                console.log("Document successfully updated!");
              })
              .catch((error) => {
                console.error("Error updating document: ", error);
              });
          } else {
            // Update the player's position in the game state
            gameStateRef
              .update({
                [`players.${uid}`]: { x: newX, y: newY },
              })
              .then(() => {
                console.log("Document successfully updated!");
              })
              .catch((error) => {
                console.error("Error updating document: ", error);
              });
          }
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
  // Generate the maze and encode it
  let maze = generateMaze(20, 20);
  let mazeStr = matrixEncode(maze);

  // Start the game
  db.collection("gameState")
    .doc("maze")
    .set({
      status: "ongoing",
      maze: mazeStr,
      players: {},
    })
    .then(() => {
      console.log("Document successfully written!");

      const gameStateRef = db.collection("gameState").doc("maze");
      gameStateRef
        .collection("players")
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            let uid = doc.id;
            let x = Math.floor(Math.random() * maze[0].length);
            let y = Math.floor(Math.random() * maze.length);
            while (maze[y][x] === 1) {
              x = Math.floor(Math.random() * maze[0].length);
              y = Math.floor(Math.random() * maze.length);
            }
            gameStateRef.update({
              [`players.${uid}`]: { x: x, y: y },
            });
          });
          const uid = firebase.auth().currentUser.uid;
          // hide start game button
          document.getElementById("startGameButton").style.display = "none";
          startGame(uid);
        });
    })
    .catch((error) => {
      console.error("Error writing document: ", error);
    });
});

document.getElementById("playAgainButton").addEventListener("click", () => {
  const uid = firebase.auth().currentUser.uid;

  // Remove the "hidden" class from the "mazeContainer" element to display it
  document.getElementById("mazeContainer").classList.remove("hidden");
  document.getElementById("mazeContainer").style.display = "grid";

  // Generate the maze and encode it
  let maze = generateMaze(20, 20);
  let mazeStr = matrixEncode(maze);

  // Get all players from the collection
  db.collection("gameState")
    .doc("maze")
    .collection("players")
    .get()
    .then((querySnapshot) => {
      const players = {};

      querySnapshot.forEach((doc) => {
        let playerId = doc.id;
        // Determine a random starting position for each player
        let x = Math.floor(Math.random() * maze[0].length);
        let y = Math.floor(Math.random() * maze.length);

        while (maze[y][x] === 1) {
          x = Math.floor(Math.random() * maze[0].length);
          y = Math.floor(Math.random() * maze.length);
        }

        players[playerId] = { x: x, y: y };
      });

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

          // Hide win page
          document.getElementById("win-page").classList.add("hidden");

          // Show the maze container
          document.getElementById("mazeContainer").display = "grid";

          // hide play again button
          document.getElementById("playAgainButton").style.display = "none";

          // Show the start game button
          document.getElementById("startGameButton").style.display = "block";
          startGame(uid);
        })
        .catch((error) => {
          console.error("Error writing document: ", error);
        });
    });
});

// document.getElementById("startGameButton").addEventListener("click", () => {
//   const uid = firebase.auth().currentUser.uid;

//   // Generate the maze and encode it
//   let maze = generateMaze(20, 20);
//   let mazeStr = matrixEncode(maze);
//   const players = {};

//   let x = Math.floor(Math.random() * maze[0].length);
//   let y = Math.floor(Math.random() * maze.length);
//   while (maze[y][x] === 1) {
//     x = Math.floor(Math.random() * maze[0].length);
//     y = Math.floor(Math.random() * maze.length);
//   }
//   players[uid] = { x: x, y: y };

//   // Start the game
//   db.collection("gameState")
//     .doc("maze")
//     .set({
//       status: "ongoing",
//       maze: mazeStr,
//       players: players,
//     })
//     .then(() => {
//       console.log("Document successfully written!");
//       // hide start game button
//       document.getElementById("startGameButton").style.display = "none";
//       startGame(uid);
//     })
//     .catch((error) => {
//       console.error("Error writing document: ", error);
//     });
// });

function generateMaze(size) {
  // Create an empty grid
  const maze = [];
  for (let i = 0; i < size; i++) {
    maze[i] = [];
    for (let j = 0; j < size; j++) {
      maze[i][j] = 1; // Initialize all cells as walls
    }
  }

  // Starting position
  const startRow = Math.floor(Math.random() * size);
  const startCol = Math.floor(Math.random() * size);

  // Create a stack to track visited cells
  const stack = [];
  stack.push([startRow, startCol]);

  while (stack.length > 0) {
    const [currentRow, currentCol] = stack.pop();
    maze[currentRow][currentCol] = 0; // Set the current cell as a path

    // Get the neighbors of the current cell
    const neighbors = getNeighbors(currentRow, currentCol, size);

    // Shuffle the neighbors randomly
    shuffle(neighbors);

    for (let [row, col] of neighbors) {
      if (maze[row][col] === 1) {
        // Mark the neighbor as visited
        maze[row][col] = 0;

        // Push the neighbor to the stack
        stack.push([row, col]);

        // Remove the wall between the current cell and the neighbor
        const wallRow = currentRow + (row - currentRow) / 2;
        const wallCol = currentCol + (col - currentCol) / 2;
        maze[wallRow][wallCol] = 0;
      }
    }
  }

  return maze;
}

// Function to get the neighbors of a cell
function getNeighbors(row, col, size) {
  const neighbors = [];

  if (row - 2 >= 0) neighbors.push([row - 2, col]);
  if (row + 2 < size) neighbors.push([row + 2, col]);
  if (col - 2 >= 0) neighbors.push([row, col - 2]);
  if (col + 2 < size) neighbors.push([row, col + 2]);

  return neighbors;
}

// Function to shuffle an array in place
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
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