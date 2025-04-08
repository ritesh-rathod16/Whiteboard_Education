require("dotenv").config();
const express = require("express");
const { Server } = require("socket.io");
const { addUser, removeUser, getUsersInRoom } = require("./utils/users");

const app = express();
const PORT = process.env.PORT || 5000;

let roomIdGlobal, imgURLGlobal;

// Setup the HTTP server with express
const server = app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", // Use a specific frontend URL for security
    methods: ["GET", "POST"],
  },
});

// Express route
app.get("/", (req, res) => {
  res.send("This is the home page");
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("userJoined", (data) => {
    const { name, userId, roomId, host, presenter } = data;
    roomIdGlobal = roomId;
    socket.join(roomId);

    const users = addUser(data);

    // Send user list to the newly joined user
    socket.emit("allUsers", users);

    // Broadcast updated user list to others in the room
    socket.broadcast.to(roomId).emit("userJoinedMSG", name);
    socket.broadcast.to(roomId).emit("allUsers", users);

    // Send whiteboard data if available
    socket.emit("whiteBoardDataResponse", { imgURL: imgURLGlobal });
  });

  socket.on("WhiteboardData", (data) => {
    imgURLGlobal = data;
    socket.broadcast
      .to(roomIdGlobal)
      .emit("whiteBoardDataResponse", { imgURL: data });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    const removedUser = removeUser(socket.id);

    if (removedUser) {
      const users = getUsersInRoom(removedUser.roomId);
      io.to(removedUser.roomId).emit("allUsers", users);
      socket.broadcast.to(roomIdGlobal).emit("userLeftMSG", removedUser.name);
    }
  });

  // User leaves manually or closes the tab
  socket.on("userLeft", (userId) => {
    const removedUser = removeUser(userId);
    if (removedUser) {
      const usersInRoom = getUsersInRoom(removedUser.roomId);
      io.to(removedUser.roomId).emit("allUsers", usersInRoom); // Update users list
      socket.broadcast.to(roomIdGlobal).emit("userLeftMSG", removedUser.name);
    }
  });

  // Handle disconnect when tab closes or user loses connection
  socket.on("disconnect", () => {
    const removedUser = removeUser(socket.id); // Remove by socket ID
    if (removedUser) {
      const usersInRoom = getUsersInRoom(removedUser.roomId);
      io.to(removedUser.roomId).emit("allUsers", usersInRoom);
      socket.broadcast.to(roomIdGlobal).emit("userLeftMSG", removedUser.name);
    }
  });
});
