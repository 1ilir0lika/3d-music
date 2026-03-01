// main.js
import { axisLabels, getMappedAxisFeatures, porcamadonna } from './ui.js';
import { createStreetView } from './streetview.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createArrowCircle } from './arrowCircle.js';
import { denotePlaces } from './denotePlaces.js';
import { setupUI } from './ui.js';
import { switchTo2D } from './switch2d.js';
import { spheres } from './denotePlaces';
import {
  cubeFeatures,
  syncCubePosition,
  moveCubeAlongFeature,
  featureToWorld,
  FEATURE_KEYS,
} from './cubeState.js';
import './style.css';

// ── Scene setup ────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151515);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(5, 7, 10);
camera.layers.enable(1); // ARROW_LAYER
camera.layers.enable(2); // LABEL_LAYER

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.getElementById('canvas-wrapper').appendChild(renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.update();

// ── Lighting ───────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// ── Grids ──────────────────────────────────────────────────────────────────────
function createGridHelper(rotation, color1, color2) {
  const grid = new THREE.GridHelper(50, 50, color1, color2);
  grid.rotation.set(...rotation);
  scene.add(grid);
}
createGridHelper([0, 0, 0],           0x888888, 0x444444);
createGridHelper([Math.PI / 2, 0, 0], 0x888888, 0x444444);
createGridHelper([0, 0, Math.PI / 2], 0x888888, 0x444444);

// ── Quadrant planes ────────────────────────────────────────────────────────────
function createQuadrantPlane(size, color, position, rotation = [-Math.PI / 2, 0, 0]) {
  const material = new THREE.MeshStandardMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.35,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.set(...rotation);
  mesh.position.set(...position);
  scene.add(mesh);
}
const qSize = 25, hSize = qSize / 2;
createQuadrantPlane(qSize, 0xff6666, [-hSize, 0.0, -hSize]);
createQuadrantPlane(qSize, 0x66ccff, [ hSize, 0.0, -hSize]);
createQuadrantPlane(qSize, 0x66ff66, [-hSize, 0.0,  hSize]);
createQuadrantPlane(qSize, 0xffcc66, [ hSize, 0.0,  hSize]);

// ── Cube (player) ──────────────────────────────────────────────────────────────
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ffff })
);
scene.add(cube);

// Place cube at its initial feature-space position
syncCubePosition(cube, getMappedAxisFeatures());

// ── Trail ──────────────────────────────────────────────────────────────────────
const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x3399ff });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trailLine);

// ── Arrows ─────────────────────────────────────────────────────────────────────
// Arrow step: 0.05 in feature space (5% of the 0-1 range)
const FEATURE_STEP = 0.05;

const arrowCircle = createArrowCircle(scene, cube, camera, renderer, (dir, label) => {
  if (!streetView?.isActive()) {
    const axes = getMappedAxisFeatures();

    // Figure out which axis (x/y/z) this arrow belongs to and its polarity
    const dx = Math.round(dir.x), dy = Math.round(dir.y), dz = Math.round(dir.z);
    if (dx !== 0) moveCubeAlongFeature(cube, axes, 'x', dx * FEATURE_STEP);
    else if (dy !== 0) moveCubeAlongFeature(cube, axes, 'y', dy * FEATURE_STEP);
    else if (dz !== 0) moveCubeAlongFeature(cube, axes, 'z', dz * FEATURE_STEP);

    updateStats();
  }
});

window.addEventListener('mousemove', arrowCircle.handleMouseMove);
window.addEventListener('click', arrowCircle.handleClick);

// ── Street view ────────────────────────────────────────────────────────────────
const streetView = createStreetView(scene, camera, cube, spheres, controls, renderer, arrowCircle);

window.addEventListener('enter-street-view', () => {
  if (spheres.length === 0) return;
  streetView.enter();
});
window.addEventListener('exit-street-view', () => {
  streetView.exit();
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);
});

// ── Axis label sprites ─────────────────────────────────────────────────────────
function createAxisLabel(text, position) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5, 5, 1);
  sprite.position.set(...position);
  scene.add(sprite);
  return sprite;
}

const axisLabelSprites = {
  xMin: createAxisLabel('', [-26, 0.01, 0]),
  xMax: createAxisLabel('', [ 26, 0.01, 0]),
  yMin: createAxisLabel('', [0, -26, 0]),
  yMax: createAxisLabel('', [0,  26, 0]),
  zMin: createAxisLabel('', [0, 0.01, -26]),
  zMax: createAxisLabel('', [0, 0.01,  26]),
};

const labelRefs = {
  up:   axisLabelSprites.yMax,
  down: axisLabelSprites.yMin,
};

function updateAxisTextLabels() {
  const axes = getMappedAxisFeatures();
  const updateLabel = (sprite, text) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 60px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    sprite.material.map.image = canvas;
    sprite.material.map.needsUpdate = true;
  };
  updateLabel(axisLabelSprites.xMin, axisLabels[axes.x]?.[0] || 'Min X');
  updateLabel(axisLabelSprites.xMax, axisLabels[axes.x]?.[1] || 'Max X');
  updateLabel(axisLabelSprites.yMin, axisLabels[axes.y]?.[0] || 'Min Y');
  updateLabel(axisLabelSprites.yMax, axisLabels[axes.y]?.[1] || 'Max Y');
  updateLabel(axisLabelSprites.zMin, axisLabels[axes.z]?.[0] || 'Min Z');
  updateLabel(axisLabelSprites.zMax, axisLabels[axes.z]?.[1] || 'Max Z');
}

// ── UI setup ───────────────────────────────────────────────────────────────────
const { updateStats, setupToggleButtons, openTopPanel, setupYearFilter } = setupUI({
  scene,
  renderer,
  arrowCircle,
  cube,
  camera,
  controls,
  labelRefs,
});

// ── Axis change handler ────────────────────────────────────────────────────────
function syncArrowLabels() {
  arrowCircle.syncLabels(getMappedAxisFeatures(), axisLabels);
}

['axis-x', 'axis-y', 'axis-z'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      const axes = getMappedAxisFeatures();

      // ✨ Key: re-map cube world position from feature vector with new axes
      syncCubePosition(cube, axes);

      refreshSpheres();
      updateAxisTextLabels();
      syncArrowLabels();
      updateStats();

      if (porcamadonna) {
        switchTo2D(spheres);
      }
    });
  }
});

// ── Initial state ──────────────────────────────────────────────────────────────
document.getElementById('2d').click();
document.getElementById('toggle-cube').click();
document.getElementById('toggle-arrows').click();
document.getElementById('toggle-labels').click();

// ── denotePlaces ───────────────────────────────────────────────────────────────
let updateLabels    = () => {};
let refreshSpheres  = () => {};
let updateBubbles   = () => {};
let toggleBubbles   = () => {};

denotePlaces(scene, camera, renderer, 'data/playlist_chosic_data.json', openTopPanel).then(res => {
  updateLabels   = res.updateLabels;
  refreshSpheres = res.refreshSpheres;
  updateBubbles  = res.updateBubbles  ?? (() => {});
  toggleBubbles  = res.toggleBubbles  ?? (() => {});
  updateAxisTextLabels();
  syncArrowLabels();
});

setupToggleButtons();
setupYearFilter();

// ── Animation loop ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const pos  = cube.position.clone();
  const last = trailPoints[trailPoints.length - 1];
  if (!last || last.distanceTo(pos) > 0.05) {
    trailPoints.push(pos);
    if (trailPoints.length > 500) trailPoints.shift();
    trailGeometry.setFromPoints(trailPoints);
  }

  arrowCircle.updatePositions();
  arrowCircle.update();
  updateLabels();
  updateBubbles();
  streetView.update();
  updateStats();
  renderer.render(scene, camera);
}
animate();

// ── Events ─────────────────────────────────────────────────────────────────────
window.addEventListener('toggle-bubbles', (e) => toggleBubbles(e.detail));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});