// ============================
// main.js
// ============================

// Canvas & Babylon Engine
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Fix blurry rendering on high-DPI screens
engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
window.addEventListener("resize", () => engine.resize());

// ============================
// Persistent Player ID
// ============================
let playerId = localStorage.getItem("playerId");
if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem("playerId", playerId);
}

// ============================
// UI Elements
// ============================
const menu = document.getElementById("menu");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");

let socket;
let myName;
let myColor;

// ============================
// Join Game
// ============================
joinBtn.addEventListener("click", () => {
    myName = nameInput.value || "Player";
    myColor = colorInput.value || "#ff0000"; // default red

    menu.style.display = "none";
    canvas.style.display = "block";

    socket = io();
    startGame();
});

// ============================
// Main Game Function
// ============================
function startGame() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.5, 0.8, 1.0); // light blue sky

    // ============================
    // Lighting
    // ============================
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = .3;

    // ============================
    // Ground
    // ============================
    const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 100, height: 100 },
        scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
    ground.material = groundMat;

    // ============================
    // Top-Down Fixed Camera
    // ============================
    const camera = new BABYLON.FreeCamera(
        "topCamera",
        new BABYLON.Vector3(0, 120, 0),
        scene
    );
    camera.setTarget(new BABYLON.Vector3(0, 0, 0));
    camera.rotation.x = Math.PI / 2;
    camera.rotation.y = 0;
    camera.rotation.z = 0;
    camera.inputs.clear(); // disable mouse controls

    // ============================
    // Player Storage
    // ============================
    const playerMeshes = {};
    let myCube = null;

    let x = 0, z = 0;
    const speed = 0.2;
    const LIMIT = 49;

    // ============================
    // Keyboard Input
    // ============================
    const keys = {};
    window.addEventListener("keydown", e => keys[e.key] = true);
    window.addEventListener("keyup", e => keys[e.key] = false);

    // ============================
    // Tell Server We Joined
    // ============================
    socket.emit("join", {
        id: playerId,
        name: myName,
        color: myColor
    });

    // ============================
    // Server Player Updates
    // ============================
    socket.on("players", (players) => {
        for (let id in players) {
            // Create cube if it doesn't exist
            if (!playerMeshes[id]) {
                const box = BABYLON.MeshBuilder.CreateBox(id, {}, scene);

                // Set cube color
                const mat = new BABYLON.StandardMaterial("mat" + id, scene);
                mat.diffuseColor = BABYLON.Color3.FromHexString(players[id].color);
                box.material = mat;

                // --- NAMETAG ---
                const namePlane = BABYLON.MeshBuilder.CreatePlane("name" + id, { size: 5 }, scene);

                const dt = new BABYLON.DynamicTexture("dt" + id, { width: 512, height: 128 }, scene);
                dt.drawText(players[id].name, null, 100, "bold 72px Arial", "white", "transparent");

                const nameMat = new BABYLON.StandardMaterial("nameMat" + id, scene);
                nameMat.diffuseTexture = dt;
                nameMat.diffuseTexture.hasAlpha = true; // important for transparency
                nameMat.emissiveColor = BABYLON.Color3.White();
                nameMat.backFaceCulling = false;
                nameMat.alpha = 1;
                namePlane.material = nameMat;

                namePlane.position.y = -10; // above cube
                namePlane.parent = box;
                namePlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; // always face camera

                playerMeshes[id] = { cube: box, nameMesh: namePlane };

                if (id === playerId) myCube = box;
            }

            const mesh = playerMeshes[id].cube;

            if (id === playerId) {
                // Snap your own cube to local position
                mesh.position.x = x;
                mesh.position.z = z;
            } else {
                // Smooth other players
                mesh.position.x += (players[id].x - mesh.position.x) * 0.2;
                mesh.position.z += (players[id].z - mesh.position.z) * 0.2;
            }
        }

        // Remove disconnected players
        for (let id in playerMeshes) {
            if (!players[id]) {
                playerMeshes[id].cube.dispose();
                playerMeshes[id].nameMesh.dispose();
                delete playerMeshes[id];
            }
        }
    });

    // ============================
    // Main Update Loop
    // ============================
    scene.onBeforeRenderObservable.add(() => {
        if (!myCube) return;

        // World-axis movement
        if (keys["w"]) z += speed;
        if (keys["s"]) z -= speed;
        if (keys["a"]) x -= speed;
        if (keys["d"]) x += speed;

        // Clamp inside map
        x = Math.max(-LIMIT, Math.min(LIMIT, x));
        z = Math.max(-LIMIT, Math.min(LIMIT, z));

        // Send updated position to server
        socket.emit("move", { x, z });
    });

    // ============================
    // Start Rendering
    // ============================
    engine.runRenderLoop(() => {
        scene.render();
    });
}