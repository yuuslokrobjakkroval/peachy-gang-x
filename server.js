import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

let onlineUsers = [];

const addUser = (username, socketId) => {
  const isExist = onlineUsers.find((user) => user.socketId === socketId);
  if (!isExist) {
    onlineUsers.push({ username, socketId });
    console.log(`User ${username} added with socket ID ${socketId}`);
  } else {
    console.log(`User ${username} already exists with socket ID ${socketId}`);
  }
};

const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
  console.log(`User with socket ID ${socketId} removed`);
};

const getUser = (username) => {
  const user = onlineUsers.find((user) => user.username === username);
  if (!user) {
    console.log(`User ${username} not found`);
  }
  return user;
};

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      // Log incoming requests to debug routing issues
      console.log(`Incoming request: ${req.method} ${req.url}`);
      handler(req, res);
    });

    const io = new Server(httpServer, {
      cors: {
        origin: `http://${hostname}:${port}`,
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log(`New Socket.IO connection: ${socket.id}`);

      socket.on("newUser", (username) => {
        if (username) {
          addUser(username, socket.id);
          io.emit("onlineUsers", onlineUsers); // Broadcast updated user list
        } else {
          console.error("Invalid username received");
        }
      });

      socket.on("sendNotification", ({ receiverUsername, data }) => {
        const receiver = getUser(receiverUsername);
        if (receiver) {
          io.to(receiver.socketId).emit("getNotification", {
            id: uuidv4(),
            ...data,
          });
          console.log(`Notification sent to ${receiverUsername}`);
        } else {
          console.error(`Receiver ${receiverUsername} not found`);
        }
      });

      socket.on("disconnect", () => {
        removeUser(socket.id);
        io.emit("onlineUsers", onlineUsers); // Broadcast updated user list
      });
    });

    httpServer
      .once("error", (err) => {
        console.error("Server error:", err);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(`> Server running on http://${hostname}:${port}`);
      });
  })
  .catch((err) => {
    console.error("Failed to prepare Next.js app:", err);
    process.exit(1);
  });
