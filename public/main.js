const socket = io();

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100}, scene);

    const playerMeshes = {};

    socket.on("players", (players) => {
        for (let id in players) {
            if (!playerMeshes[id]) {
                playerMeshes[id] = BABYLON.MeshBuilder.CreateBox(id, {}, scene);
            }
            playerMeshes[id].position.x = players[id].x;
            playerMeshes[id].position.z = players[id].z;
        }
    });

    let x = 0, z = 0;

    window.addEventListener("keydown", (e) => {
        if (e.key === "w") z += 0.1;
        if (e.key === "s") z -= 0.1;
        if (e.key === "a") x -= 0.1;
        if (e.key === "d") x += 0.1;

        socket.emit("move", { x, z });
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());