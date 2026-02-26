// ============================
// main.js
// ============================

// Canvas & Babylon engine
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
// Join Button
// ============================
joinBtn.addEventListener("click", () => {
    myName = nameInput.value || "Player";
    myColor = colorInput.value;

    // Hide menu, show canvas
    menu.style.display = "none";
    canvas.style.display = "block";

    // Connect to server
    socket = io();

    // Start the game
    startGame();
});

// ============================
// Main Game Function
// ============================
function startGame() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.5, 0.8, 1.0); // light blue sky

    // ============================
    // Lighting & Shadows
    // ============================
    const light = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-1, -2, -1),
        scene
    );
    light.position = new BABYLON.Vector3(20, 40, 20);
    light.intensity = 1.0;

    const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // ============================
    // Ground
    // ============================
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
    ground.material = groundMat;
    ground.receiveShadows = true;

    // ============================
    // Camera
    // ============================
    // ArcRotateCamera for third-person view
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI,        // alpha = behind player
        Math.PI / 3,    // beta = slightly above
        15,             // radius = distance from player
        new BABYLON.Vector3(0, 0, 0), // temporary target
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 30;
    camera.wheelDeltaPercentage = 0.01;

    // ============================
    // Player management
    // ============================
    const playerMeshes = {}; // All players
    let myCube = null;       // Your own cube

    const keys = {}; // Track movement keys
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);

    let x = 0, z = 0;
    const speed = 0.2
    const LIMIT = 49;

    // ============================
    // Tell server we joined
    // ============================
    socket.emit("join", {
        id: playerId,
        name: myName,
        color: myColor
    });

    // ============================
    // Server updates: all players
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

                // Create floating name label
                const namePlane = BABYLON.MeshBuilder.CreatePlane("name" + id, { size: 1 }, scene);
                const dt = new BABYLON.DynamicTexture("dt" + id, { width: 512, height: 128 }, scene);
                dt.drawText(players[id].name, null, 90, "bold 72px Arial", "white", "transparent");

                const nameMat = new BABYLON.StandardMaterial("nameMat" + id, scene);
                nameMat.diffuseTexture = dt;
                nameMat.emissiveColor = BABYLON.Color3.White();
                nameMat.backFaceCulling = false;

                namePlane.material = nameMat;
                namePlane.position.y = 1.2;
                namePlane.parent = box;

                // Shadows
                shadowGenerator.addShadowCaster(box);

                playerMeshes[id] = { cube: box, name: namePlane };

                // Attach camera if this is me
                if (id === playerId) {
                    myCube = box;

                    // Camera will follow your cube every frame
                    scene.onBeforeRenderObservable.add(() => {
                        if (myCube) camera.target = myCube.position.clone();
                    });
                }
            }

            // Smooth interpolation for all cubes
            const mesh = playerMeshes[id].cube;
            mesh.position.x += (players[id].x - mesh.position.x) * 0.2;
            mesh.position.z += (players[id].z - mesh.position.z) * 0.2;
        }

        // Remove disconnected players (optional)
        for (let id in playerMeshes) {
            if (!players[id]) {
                playerMeshes[id].cube.dispose();
                playerMeshes[id].name.dispose();
                delete playerMeshes[id];
            }
        }
    });

    // ============================
    // Movement / Input
    // ============================
    scene.onBeforeRenderObservable.add(() => {
        if (!myCube) return;

        if (keys["w"]) z += speed;
        if (keys["s"]) z -= speed;
        if (keys["a"]) x -= speed;
        if (keys["d"]) x += speed;

        // Clamp to world borders
        x = Math.max(-LIMIT, Math.min(LIMIT, x));
        z = Math.max(-LIMIT, Math.min(LIMIT, z));

        // Send movement to server
        socket.emit("move", { x, z });
    });

    // ============================
    // Render loop
    // ============================
    engine.runRenderLoop(() => {
        scene.render();
    });
}