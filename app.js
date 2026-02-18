const STAR_COUNT = 12000;
const ARM_COUNT = 5;
const statusEl = document.getElementById("status");
const videoEl = document.getElementById("input-video");
const debugCanvas = document.getElementById("debug-canvas");
const debugCtx = debugCanvas.getContext("2d");

const state = {
  rotationSpeed: 0.0017,
  brightness: 1.15,
  spread: 1,
  pulse: 0,
  heartMode: false,
  heartHold: 0,
};

let isHandsProcessing = false;

const lastHands = {
  right: null,
  left: null,
};

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("webgl-canvas"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x010104, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000008, 0.00055);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1100);
camera.position.z = 74;

const basePositions = new Float32Array(STAR_COUNT * 3);
const positions = new Float32Array(STAR_COUNT * 3);
const textTargets = new Float32Array(STAR_COUNT * 3);
const colors = new Float32Array(STAR_COUNT * 3);
const sizes = new Float32Array(STAR_COUNT);

for (let i = 0; i < STAR_COUNT; i += 1) {
  const arm = (i % ARM_COUNT) / ARM_COUNT;
  const radius = Math.pow(Math.random(), 0.42) * 40;
  const angle = arm * Math.PI * 2 + radius * 0.34 + (Math.random() - 0.5) * 0.65;
  const height = (Math.random() - 0.5) * 8;

  const ix = i * 3;
  const x = Math.cos(angle) * radius;
  const y = height;
  const z = Math.sin(angle) * radius;

  basePositions[ix] = x;
  basePositions[ix + 1] = y;
  basePositions[ix + 2] = z;

  positions[ix] = x;
  positions[ix + 1] = y;
  positions[ix + 2] = z;

  const temp = 0.6 + Math.random() * 0.4;
  colors[ix] = 0.6 + temp * 0.45;
  colors[ix + 1] = 0.52 + temp * 0.35;
  colors[ix + 2] = 0.75 + temp * 0.25;

  sizes[i] = 0.7 + Math.random() * 2.2;
}

prepareTextTargets();

const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
galaxyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
galaxyGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

const galaxyMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: {
    time: { value: 0 },
    brightness: { value: state.brightness },
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float time;
    uniform float brightness;

    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float twinkle = 0.75 + 0.25 * sin(time * 2.0 + position.x * 0.4 + position.z * 0.35);
      gl_PointSize = size * twinkle * brightness * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;

    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float dist = length(c);
      float glow = smoothstep(0.55, 0.0, dist);
      glow += smoothstep(0.9, 0.2, dist) * 0.28;
      if (dist > 0.55) discard;
      gl_FragColor = vec4(vColor, glow);
    }
  `,
});

const points = new THREE.Points(galaxyGeometry, galaxyMaterial);
scene.add(points);

const haloTexture = new THREE.TextureLoader().load(
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=512&q=60",
  () => renderer.render(scene, camera)
);
const haloGeometry = new THREE.SphereGeometry(80, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({
  map: haloTexture,
  transparent: true,
  opacity: 0.2,
  side: THREE.BackSide,
});
const haloSphere = new THREE.Mesh(haloGeometry, haloMaterial);
scene.add(haloSphere);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  debugCanvas.width = window.innerWidth;
  debugCanvas.height = window.innerHeight;
});

debugCanvas.width = window.innerWidth;
debugCanvas.height = window.innerHeight;

function prepareTextTargets() {
  const off = document.createElement("canvas");
  off.width = 1200;
  off.height = 420;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.font = "900 210px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(255,255,255,1)";
  ctx.shadowBlur = 22;
  ctx.fillText("mozhgani", off.width / 2, off.height / 2);

  const data = ctx.getImageData(0, 0, off.width, off.height).data;
  const samples = [];
  for (let y = 0; y < off.height; y += 4) {
    for (let x = 0; x < off.width; x += 4) {
      if (data[(y * off.width + x) * 4 + 3] > 100) {
        samples.push({
          x: (x / off.width - 0.5) * 105,
          y: -(y / off.height - 0.5) * 30,
        });
      }
    }
  }

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const j = i * 3;
    const sample = samples[i % samples.length];
    const depth = (Math.random() - 0.5) * 2.8;
    textTargets[j] = sample.x + (Math.random() - 0.5) * 0.7;
    textTargets[j + 1] = sample.y + (Math.random() - 0.5) * 0.7;
    textTargets[j + 2] = depth;
  }
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updateHands(landmarks, handednesses) {
  lastHands.left = null;
  lastHands.right = null;

  if (!landmarks || !handednesses) return;

  for (let i = 0; i < landmarks.length; i += 1) {
    const hand = landmarks[i];
    const handedness = handednesses[i]?.[0]?.label;
    if (!handedness) continue;
    const side = handedness.toLowerCase();
    if (side === "left" || side === "right") {
      lastHands[side] = hand;
    }
  }

  const right = lastHands.right;
  if (right) {
    const palm = right[9];
    state.rotationSpeed = THREE.MathUtils.lerp(state.rotationSpeed, (palm.x - 0.5) * 0.015, 0.15);
    state.brightness = THREE.MathUtils.lerp(state.brightness, 0.65 + (1 - palm.y) * 1.45, 0.08);
  }

  const left = lastHands.left;
  if (left) {
    const pinch = getDistance(left[4], left[8]);
    const openness = getDistance(left[5], left[17]);
    const spreadTarget = THREE.MathUtils.clamp((openness + pinch) * 1.4, 0.55, 2.2);
    state.spread = THREE.MathUtils.lerp(state.spread, spreadTarget, 0.1);
    state.pulse = THREE.MathUtils.lerp(state.pulse, THREE.MathUtils.clamp((0.11 - pinch) * 9, 0, 1.2), 0.18);
  } else {
    state.pulse = THREE.MathUtils.lerp(state.pulse, 0, 0.08);
  }

  const heartNow = detectHeartGesture(lastHands.left, lastHands.right);
  state.heartHold = heartNow ? Math.min(state.heartHold + 0.08, 1.3) : Math.max(state.heartHold - 0.06, 0);
  state.heartMode = state.heartHold > 0.72;

  if (state.heartMode) {
    statusEl.textContent = "❤️ ژست قلب تشخیص داده شد — mozhgani activated";
  } else {
    statusEl.textContent = "دست‌ها را در کادر نگه دارید؛ با ژست قلب، ستاره‌ها تایپوگرافی می‌شوند.";
  }
}

function detectHeartGesture(left, right) {
  if (!left || !right) return false;

  const leftPinch = getDistance(left[4], left[8]) < 0.1;
  const rightPinch = getDistance(right[4], right[8]) < 0.1;
  const indexDistance = getDistance(left[8], right[8]);
  const thumbDistance = getDistance(left[4], right[4]);
  const palmDistance = getDistance(left[9], right[9]);

  return leftPinch && rightPinch && indexDistance < 0.25 && thumbDistance < 0.25 && palmDistance < 0.35;
}

function onHandsResults(results) {
  debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  if (results?.multiHandLandmarks) {
    for (const marks of results.multiHandLandmarks) {
      drawConnectors(debugCtx, marks, HAND_CONNECTIONS, {
        color: "rgba(130, 220, 255, 0.65)",
        lineWidth: 2,
      });
      drawLandmarks(debugCtx, marks, { color: "rgba(255,255,255,0.9)", lineWidth: 1, radius: 2 });
    }
  }

  updateHands(results.multiHandLandmarks, results.multiHandedness);
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0,
  minDetectionConfidence: 0.65,
  minTrackingConfidence: 0.55,
});
hands.onResults(onHandsResults);

const cam = new Camera(videoEl, {
  onFrame: async () => {
    if (isHandsProcessing) return;
    isHandsProcessing = true;
    try {
      await hands.send({ image: videoEl });
    } finally {
      isHandsProcessing = false;
    }
  },
  width: 1280,
  height: 720,
});

cam.start()
  .then(() => {
    statusEl.textContent = "دوربین آماده است — دست‌ها را مقابل دوربین بگیرید.";
  })
  .catch((err) => {
    statusEl.textContent = `خطا در دسترسی به دوربین: ${err.message}`;
  });

const clock = new THREE.Clock();
function animate() {
  const elapsed = clock.getElapsedTime();

  const arr = galaxyGeometry.attributes.position.array;
  const t = elapsed * 0.35;
  const morphPower = state.heartMode ? Math.min((state.heartHold - 0.72) * 1.9, 1) : 0;

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const idx = i * 3;
    const bx = basePositions[idx] * state.spread;
    const by = basePositions[idx + 1] * state.spread;
    const bz = basePositions[idx + 2] * state.spread;

    const swirl = Math.sin(t + bx * 0.06 + bz * 0.08) * 0.75;
    const breathing = Math.cos(t * 1.6 + i * 0.0016) * (0.18 + state.pulse * 0.4);

    const gx = bx + swirl;
    const gy = by + breathing;
    const gz = bz - swirl;

    arr[idx] = THREE.MathUtils.lerp(gx, textTargets[idx], morphPower);
    arr[idx + 1] = THREE.MathUtils.lerp(gy, textTargets[idx + 1], morphPower);
    arr[idx + 2] = THREE.MathUtils.lerp(gz, textTargets[idx + 2], morphPower);
  }

  galaxyGeometry.attributes.position.needsUpdate = true;
  galaxyMaterial.uniforms.time.value = elapsed;
  galaxyMaterial.uniforms.brightness.value = state.brightness + morphPower * 0.35;

  points.rotation.y += state.rotationSpeed;
  points.rotation.x = Math.sin(elapsed * 0.14) * 0.12;
  haloSphere.rotation.y -= state.rotationSpeed * 0.25;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
