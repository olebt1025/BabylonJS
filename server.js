const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {

    socket.on("join", (data) => {

        const id = data.id;

        if (!players[id]) {
            players[id] = {
                x: 0,
                z: 0,
                name: data.name,
                color: data.color
            };
        }

        socket.playerId = id;
    });

    socket.on("move", (data) => {
        if (socket.playerId && players[socket.playerId]) {
            players[socket.playerId].x = data.x;
            players[socket.playerId].z = data.z;
        }
    });

    socket.on("disconnect", () => {
        // DO NOTHING
        // Player stays in memory
    });
});

setInterval(() => {
    io.emit("players", players);
}, 1000 / 30);

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});