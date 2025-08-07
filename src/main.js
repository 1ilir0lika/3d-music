// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createArrowCircle } from './arrowCircle.js';
import { denotePlaces } from './denotePlaces.js';
import { setupUI } from './ui.js';
import './style.css';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151515);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5, 7, 10);
camera.layers.enable(1); // ARROW_LAYER
camera.layers.enable(2); // LABEL_LAYER

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.getElementById('canvas-wrapper').appendChild(renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

function createGridHelper(rotation, color1, color2) {
  const grid = new THREE.GridHelper(50, 50, color1, color2);
  grid.rotation.set(...rotation);
  scene.add(grid);
}

createGridHelper([0, 0, 0], 0x888888, 0x444444); // XZ
createGridHelper([Math.PI / 2, 0, 0], 0x888888, 0x444444); // XY
createGridHelper([0, 0, Math.PI / 2], 0x888888, 0x444444); // YZ

function createQuadrantPlane(size, color, position, rotation = [-Math.PI / 2, 0, 0]) {
  const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.set(...rotation);
  mesh.position.set(...position);
  scene.add(mesh);
}

const qSize = 25;
const hSize = qSize / 2;

createQuadrantPlane(qSize, 0xff6666, [-hSize, 0.0, -hSize]); // Q2: Left + Authoritarian
createQuadrantPlane(qSize, 0x66ccff, [hSize, 0.0, -hSize]);  // Q1: Right + Authoritarian
createQuadrantPlane(qSize, 0x66ff66, [-hSize, 0.0, hSize]);  // Q3: Left + Libertarian
createQuadrantPlane(qSize, 0xffcc66, [hSize, 0.0, hSize]);   // Q4: Right + Libertarian

// Cube (player)
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ffff })
);
scene.add(cube);

// Trail
const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x3399ff });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trailLine);

// Arrows
const arrowCircle = createArrowCircle(scene, cube, camera,renderer, (dir, label) => {
  cube.position.add(dir.clone().multiplyScalar(0.5));
  updateStats();
});

window.addEventListener('mousemove', arrowCircle.handleMouseMove);
window.addEventListener('click', arrowCircle.handleClick);

const progressiveLabel = createTextLabel('Progressive', [0, 26, 0], scene);
const conservativeLabel = createTextLabel('Conservative', [0, -26, 0], scene);

// Pass them into setupUI
const labelRefs = {
  progressive: progressiveLabel,
  conservative: conservativeLabel
};
const { updateStats, setupToggleButtons, openTopPanel } = setupUI({
  scene,
  renderer,
  arrowCircle,
  cube,
  camera,
  controls,
  labelRefs
});
setupToggleButtons();
// Initial state: simulate "2D", hide cube, arrows, and labels
document.getElementById('2d').click();
document.getElementById('toggle-cube').click();
document.getElementById('toggle-arrows').click();
document.getElementById('toggle-labels').click();

// Directional labels
let updateLabels = () => {};

denotePlaces(scene, camera, renderer, 'data/playlist_chosic_data.json', openTopPanel).then(res => {
  updateLabels = res.updateLabels;
});

function createTextLabel(text, position, scene) {
  const canvasSize = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  ctx.font = 'bold 140px sans-serif'; // Scaled up to match resolution
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasSize / 2, canvasSize / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; // Avoid mipmap blurring
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(10, 10, 1); // Keep display size large but crisp
  sprite.position.set(...position);

  scene.add(sprite);
  return sprite;
}

createTextLabel('Authoritarian', [0, 0.01, -26], scene);
createTextLabel('Libertarian', [0, 0.01, 26], scene);
createTextLabel('Left', [-26, 0.01, 0], scene);
createTextLabel('Right', [26, 0.01, 0], scene);

// Animate
function animate() {
  requestAnimationFrame(animate);

  const pos = cube.position.clone();
  const last = trailPoints[trailPoints.length - 1];
  if (!last || last.distanceTo(pos) > 0.05) {
    trailPoints.push(pos);
    if (trailPoints.length > 500) trailPoints.shift();
    trailGeometry.setFromPoints(trailPoints);
  }

  arrowCircle.updatePositions();
  arrowCircle.update();
  updateLabels();
  renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});