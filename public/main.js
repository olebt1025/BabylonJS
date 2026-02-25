const socket = io(); // connect to server

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

window.addEventListener("resize", () => {
    engine.resize();
});

// Random player name
const myName = "Player" + Math.floor(Math.random() * 1000);

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    const keys = {};
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);

    // Sky color
    scene.clearColor = new BABYLON.Color3(0.5, 0.8, 1.0);

    // Camera (3rd person style)
    const camera = new BABYLON.ArcRotateCamera(
        "cam",
        Math.PI / 2,
        Math.PI / 3,
        15,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);

    // Light
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1.2;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
    ground.material = groundMat;

    // Store all players
    const playerMeshes = {};
    let myCube = null;

    // World boundary limit
    const LIMIT = 49;

    // Handle players from server
    socket.on("players", (players) => {
        for (let id in players) {

            // Create cube if missing
            if (!playerMeshes[id]) {
                const box = BABYLON.MeshBuilder.CreateBox(id, {}, scene);

                // Color
                const mat = new BABYLON.StandardMaterial("mat" + id, scene);
                mat.diffuseColor = id === socket.id ? BABYLON.Color3.Red() : BABYLON.Color3.Random();
                box.material = mat;

                // Name tag
                const namePlane = BABYLON.MeshBuilder.CreatePlane("name" + id, { size: 1 }, scene);
                const dt = new BABYLON.DynamicTexture("dt" + id, { width: 256, height: 64 }, scene);
                dt.drawText(players[id].name, null, 48, "bold 36px Arial", "white", "transparent");

                const nameMat = new BABYLON.StandardMaterial("nameMat" + id, scene);
                nameMat.diffuseTexture = dt;
                nameMat.emissiveColor = BABYLON.Color3.White();
                nameMat.backFaceCulling = false;

                namePlane.material = nameMat;
                namePlane.position.y = 1.2;
                namePlane.parent = box;

                playerMeshes[id] = { cube: box, name: namePlane };

                // Save MY cube
                if (id === socket.id) {
                    myCube = box;
                }
            }

            // Update positions
            playerMeshes[id].cube.position.x = players[id].x;
            playerMeshes[id].cube.position.z = players[id].z;
        }

        // Remove disconnected players
        for (let id in playerMeshes) {
            if (!players[id]) {
                playerMeshes[id].cube.dispose();
                playerMeshes[id].name.dispose();
                delete playerMeshes[id];
            }
        }
    });

    // Player movement
    let x = 0, z = 0;

    window.addEventListener("keydown", (e) => {
        const speed = 0.5;

        if (e.key === "w") z += speed;
        if (e.key === "s") z -= speed;
        if (e.key === "a") x -= speed;
        if (e.key === "d") x += speed;

        // 🚧 WORLD BORDER LIMIT
        x = Math.max(-LIMIT, Math.min(LIMIT, x));
        z = Math.max(-LIMIT, Math.min(LIMIT, z));

        socket.emit("move", { x, z, name: myName });
    });

    // Camera follows player
    scene.onBeforeRenderObservable.add(() => {
        if (myCube) {
            camera.target = myCube.position;
        }
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());