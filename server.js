const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));
const server = http.createServer(app);
const io = new Server(server);

const players = {};

io.on("connection", (socket) => {
    console.log("Player joined:", socket.id);

    players[socket.id] = { x: 0, z: 0 };

    socket.on("move", (data) => {
        players[socket.id] = data;
        io.emit("players", players);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("players", players);
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
