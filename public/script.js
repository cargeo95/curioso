import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ======================================================
// 1. CARGAR MODELO DE MANO
// ======================================================
let handLandmarker;
let runningMode = "IMAGE";

(async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    },
    numHands: 1,
    runningMode: runningMode,
  });

  console.log("Modelo cargado con éxito ✔️");
})();


// ======================================================
// 2. THREE.JS - ESCENA
// ======================================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// ======================================================
// SISTEMA DE PARTÍCULAS - GALAXIA
// ======================================================
const count = 8000;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  const i3 = i * 3;

  // posición
  const x = (Math.random() - 0.5) * 8;
  const y = (Math.random() - 0.5) * 8;
  const z = (Math.random() - 0.5) * 8;
  positions[i3] = x;
  positions[i3 + 1] = y;
  positions[i3 + 2] = z;

  // colores corporativos WEDOENGINEER (morado → amarillo)
  const t = (x + 4) / 8; // normalizar entre 0 y 1
  const r = 1.0 * t + 0.4 * (1 - t); // amarillo → morado
  const g = 0.8 * t + 0.1 * (1 - t);
  const b = 0.1 * t + 0.7 * (1 - t);

  colors[i3] = r;
  colors[i3 + 1] = g;
  colors[i3 + 2] = b;
}

const particles = new THREE.BufferGeometry();
particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
particles.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const mat = new THREE.PointsMaterial({
  size: 0.03,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
});

const system = new THREE.Points(particles, mat);
scene.add(system);


// ======================================================
// EFECTO GALAXIA: ESPIRAL + PULSO
// ======================================================
let pulse = 0;
let galaxyMode = false;

function updateGalaxyEffects() {
  pulse += 0.02;
  const scale = 1 + Math.sin(pulse) * 0.05;
  system.scale.set(scale, scale, scale);

  // espiral galáctica suave
  system.rotation.z += 0.0008;

  if (galaxyMode) {
    system.rotation.x += 0.002;
    system.rotation.y += 0.002;
  }
}


// ======================================================
// MANO + CONTROLES
// ======================================================
const video = document.getElementById("video");

function lerp(a, b, t) {
  return a + (b - a) * t;
}

let smoothRot = 0;

async function detect() {
  if (!handLandmarker) return requestAnimationFrame(detect);

  if (runningMode === "IMAGE") {
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
    runningMode = "VIDEO";
  }

  const results = await handLandmarker.detectForVideo(video, performance.now());

  if (results.landmarks && results.landmarks.length > 0) {
    const hand = results.landmarks[0];

    // ------------------------------------------
    // MOV. 5 → Rotación izquierda/derecha
    // ------------------------------------------
    const xPos = hand[9].x;
    const rotMapped = THREE.MathUtils.mapLinear(xPos, 0, 1, -1.4, 1.4);
    smoothRot = lerp(smoothRot, rotMapped, 0.15);
    system.rotation.y += smoothRot * 0.03;

    // ------------------------------------------
    // MOV. 6 → Zoom arriba/abajo
    // ------------------------------------------
    const yPos = hand[9].y;
    const zoom = THREE.MathUtils.mapLinear(yPos, 0, 1, 4, 8);
    camera.position.z = lerp(camera.position.z, zoom, 0.08);

    // ------------------------------------------
    // MOV. 7 → Activar GALAXIA (mano muy abierta)
    // ------------------------------------------
    const spread =
      Math.abs(hand[5].x - hand[17].x) +
      Math.abs(hand[5].y - hand[17].y);

    if (spread > 0.25) {
      galaxyMode = true;
      mat.size = 0.05; // partículas más brillantes
    }

    // ------------------------------------------
    // MOV. 8 → Colapso (puño)
    // ------------------------------------------
    const fist =
      Math.abs(hand[8].x - hand[12].x) +
      Math.abs(hand[12].x - hand[16].x);

    if (fist < 0.04) {
      galaxyMode = false;
      system.scale.set(0.3, 0.3, 0.3);
      mat.size = 0.03;
    }

    // ------------------------------------------
    // PINCH → Escalar galaxia
    // ------------------------------------------
    const dx = hand[4].x - hand[8].x;
    const dy = hand[4].y - hand[8].y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const pinchScale = THREE.MathUtils.mapLinear(d, 0.01, 0.15, 0.5, 3);
    system.scale.set(pinchScale, pinchScale, pinchScale);
  }

  updateGalaxyEffects();
  renderer.render(scene, camera);
  requestAnimationFrame(detect);
}


// ======================================================
// INICIAR WEBCAM (fix del ROI width 0)
// ======================================================
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;

  video.addEventListener("loadedmetadata", () => {
    console.log("Webcam lista:", video.videoWidth, video.videoHeight);

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      detect();
    } else {
      setTimeout(() => detect(), 200);
    }
  });

  video.play();
});
