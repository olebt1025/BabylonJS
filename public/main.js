const socket = io(); // auto-connects to the same server

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

window.addEventListener("resize", () => {
    engine.resize();
});

// Generate a random player name for this session
const myName = "Player" + Math.floor(Math.random() * 1000);

const createScene = () => {
    const scene = new BABYLON.Scene(engine);

    // Camera
    const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // Light
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

    // Keep track of all player cubes and their name planes
    const playerMeshes = {};

    // Handle server updates
    socket.on("players", (players) => {

        // Create/update players
        for (let id in players) {

            // Create cube if it doesn't exist
            if (!playerMeshes[id]) {
                const box = BABYLON.MeshBuilder.CreateBox(id, {}, scene);

                // Assign material/color
                const mat = new BABYLON.StandardMaterial("mat" + id, scene);
                mat.diffuseColor = id === socket.id ? BABYLON.Color3.Red() : BABYLON.Color3.Random();
                box.material = mat;

                // Create floating name
                const namePlane = BABYLON.MeshBuilder.CreatePlane("name" + id, { size: 1 }, scene);
                const dt = new BABYLON.DynamicTexture("dt" + id, { width: 256, height: 64 }, scene);
                dt.drawText(players[id].name, null, 48, "bold 36px Arial", "white", "transparent");
                const nameMat = new BABYLON.StandardMaterial("nameMat" + id, scene);
                nameMat.diffuseTexture = dt;
                nameMat.emissiveColor = BABYLON.Color3.White();
                nameMat.backFaceCulling = false;
                namePlane.material = nameMat;
                namePlane.position.y = 1.2;
                namePlane.parent = box; // attach to cube so it moves automatically

                playerMeshes[id] = { cube: box, nameMesh: namePlane };
            }

            // Update cube position
            playerMeshes[id].cube.position.x = players[id].x;
            playerMeshes[id].cube.position.z = players[id].z;
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

    // Player movement
    let x = 0, z = 0;
    window.addEventListener("keydown", (e) => {
        if (e.key === "w") z += 0.1;
        if (e.key === "s") z -= 0.1;
        if (e.key === "a") x -= 0.1;
        if (e.key === "d") x += 0.1;

        socket.emit("move", { x, z, name: myName });
    });

    // Update camera to follow your cube each frame
    scene.onBeforeRenderObservable.add(() => {
        if (myCube) {
            // ArcRotateCamera target follows the cube
            camera.target = myCube.position.clone();
        }
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());