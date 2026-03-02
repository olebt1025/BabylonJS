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
                x: typeof data.x === "number" ? data.x : 0,
                z: typeof data.z === "number" ? data.z : 0,
                name: data.name,
                color: data.color
            };
        } else {
            // If player already exists, update name/color
            players[id].name = data.name;
            players[id].color = data.color;
        }

        socket.playerId = id;
    });

});

setInterval(() => {
    io.emit("players", players);
}, 1000 / 30);

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});