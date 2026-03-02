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
// Auto Rejoin If Stored
// ============================

const savedName = localStorage.getItem("playerName");
const savedColor = localStorage.getItem("playerColor");

const savedX = localStorage.getItem("playerX");
const savedZ = localStorage.getItem("playerZ");

if (savedName && savedColor) {

    myName = savedName;
    myColor = savedColor;

    menu.style.display = "none";
    canvas.style.display = "block";

    socket = io();
    startGame();
}


// ============================
// Join Game
// ============================
joinBtn.addEventListener("click", () => {

    myName = nameInput.value || "Player";
    myColor = colorInput.value || "#ff0000";

    localStorage.setItem("playerName", myName);
    localStorage.setItem("playerColor", myColor);

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
    scene.clearColor = new BABYLON.Color3(0.7, 0.8, 1.0);

    scene.collisionsEnabled = true;


    // ============================
    // Lighting
    // ============================
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(10, 1, 0),
        scene
    );
    light.intensity = 2;


    // ============================
    // Ground
    // ============================
    const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 100, height: 100 },
        scene
    );

    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.2);
    ground.material = groundMat;

    ground.checkCollisions = true;


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
    camera.inputs.clear();


    // ============================
    // Player Storage
    // ============================
    const playerMeshes = {};
    let myCube = null;

    const speed = 0.4;


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
        color: myColor,
        x: savedX ? parseFloat(savedX) : 0,
        z: savedZ ? parseFloat(savedZ) : 0
    });


    // ============================
    // Server Player Updates
    // ============================
    socket.on("players", (players) => {

        for (let id in players) {

            // ============================
            // Create player if missing
            // ============================
            if (!playerMeshes[id]) {

                const box = BABYLON.MeshBuilder.CreateBox(id, { size: 2 }, scene);

                // Enable collision
                box.checkCollisions = true;
                box.ellipsoid = new BABYLON.Vector3(1, 1, 1);

                // Material / Color
                const mat = new BABYLON.StandardMaterial("mat" + id, scene);
                mat.diffuseColor = BABYLON.Color3.FromHexString(players[id].color);
                box.material = mat;

                // ============================
                // Nametag
                // ============================
                const namePlane = BABYLON.MeshBuilder.CreatePlane(
                    "name" + id,
                    { size: 4 },
                    scene
                );

                const dt = new BABYLON.DynamicTexture(
                    "dt" + id,
                    { width: 512, height: 128 },
                    scene
                );

                dt.drawText(
                    players[id].name,
                    null,
                    90,
                    "bold 72px Arial",
                    "white",
                    "transparent"
                );

                const nameMat = new BABYLON.StandardMaterial("nameMat" + id, scene);
                nameMat.diffuseTexture = dt;
                nameMat.diffuseTexture.hasAlpha = true;
                nameMat.useAlphaFromDiffuseTexture = true;
                nameMat.emissiveColor = BABYLON.Color3.White();
                nameMat.backFaceCulling = false;

                namePlane.material = nameMat;
                namePlane.position.y = 2.5;
                namePlane.parent = box;
                namePlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

                playerMeshes[id] = {
                    cube: box,
                    nameMesh: namePlane
                };

                if (id === playerId) {
                    myCube = box;
                }
            }

            // ============================
            // Smooth other players
            // ============================
            const mesh = playerMeshes[id].cube;

            if (id !== playerId) {
                mesh.position.x += (players[id].x - mesh.position.x) * 0.2;
                mesh.position.z += (players[id].z - mesh.position.z) * 0.2;
            }
        }

        // ============================
        // Remove disconnected players
        // ============================
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

        let moveVector = BABYLON.Vector3.Zero();

        if (keys["w"]) moveVector.z += speed;
        if (keys["s"]) moveVector.z -= speed;
        if (keys["a"]) moveVector.x -= speed;
        if (keys["d"]) moveVector.x += speed;

        myCube.moveWithCollisions(moveVector);

        socket.emit("move", {
            x: myCube.position.x,
            z: myCube.position.z
        });

        localStorage.setItem("playerX", myCube.position.x);
        localStorage.setItem("playerZ", myCube.position.z);

    });


    // ============================
    // Start Rendering
    // ============================
    engine.runRenderLoop(() => {
        scene.render();
    });

}


