// streetview.js
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { syncFeaturesFromWorld } from './cubeState.js';
import { getMappedAxisFeatures } from './ui.js';

const MAX_AUDIO_DIST = 8.0;

export function createStreetView(scene, camera, cube, spheres, controls, renderer, arrowCircle) {
  let active = false;

  // ── Free-look drag ─────────────────────────────────────────────────────────
  let isDragging = false;
  let hasDragged = false;
  let dragStart  = { x: 0, y: 0 };
  let yaw = 0, pitch = 0;

  function applyLook() {
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    camera.quaternion.copy(qY).multiply(qX);
  }

  function onPointerDown(e) {
    if (!active) return;
    if (e.target !== renderer.domElement) return; // ignore clicks on HTML buttons
    isDragging = true;
    hasDragged = false;
    dragStart  = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e) {
    if (!active || !isDragging) return;
    const dx = (e.clientX - dragStart.x) * 0.005;
    const dy = (e.clientY - dragStart.y) * 0.005;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) hasDragged = true;
    dragStart = { x: e.clientX, y: e.clientY };
    yaw   -= dx;
    pitch -= dy;
    pitch  = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
    applyLook();
  }

  function onPointerUp(e) {
    if (!active) return;
    isDragging = false;
    hasDragged = false;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup',   onPointerUp);
  // Also catch releases outside the canvas
  window.addEventListener('pointerup', onPointerUp);

  const MOVE_STEP = 2.5;
  const LIMIT     = 24;

  function moveInDirection(localX, localZ) {
    // Rotate by yaw so forward always matches where camera is looking
    const dir = new THREE.Vector3(localX, 0, localZ);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    dir.normalize();

    const next = cube.position.clone().addScaledVector(dir, MOVE_STEP);
    if (Math.abs(next.x) > LIMIT || Math.abs(next.z) > LIMIT) return;

    cube.position.addScaledVector(dir, MOVE_STEP);
    syncFeaturesFromWorld(cube, getMappedAxisFeatures());
    onArrowMoved();
  }

  // ── Arrow keys + WASD ─────────────────────────────────────────────────────
  function handleKey(e) {
    if (!active) return;
    const map = {
      ArrowUp:    [ 0, -1], w: [ 0, -1],
      ArrowDown:  [ 0,  1], s: [ 0,  1],
      ArrowLeft:  [-1,  0], a: [-1,  0],
      ArrowRight: [ 1,  0], d: [ 1,  0],
    };
    if (map[e.key]) {
      e.preventDefault();
      moveInDirection(...map[e.key]);
    }
  }
  window.addEventListener('keydown', handleKey);

  // ── HUD ────────────────────────────────────────────────────────────────────
  const hud = document.createElement('div');
  hud.style.cssText = `
    position:fixed; top:20px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.72); border:1px solid #333; border-radius:12px;
    padding:10px 18px; color:white; font-family:monospace; font-size:12px;
    pointer-events:none; z-index:95; display:none; min-width:280px;
    backdrop-filter:blur(6px);
  `;
  document.body.appendChild(hud);

  const featureDisplay = { valence: 0.5, energy: 0.5, tempo: 0.5, danceability: 0.5, acousticness: 0.5 };
  const LABELS = {
    valence:      ['Sad',       'Happy'    ],
    energy:       ['Mellow',    'Intense'  ],
    tempo:        ['Slow',      'Fast'     ],
    danceability: ['Listen',    'Dance'    ],
    acousticness: ['Synthetic', 'Acoustic' ],
  };

  function updateHUD() {
    const weights = {}, sums = {};
    for (const k of Object.keys(featureDisplay)) { weights[k] = 0; sums[k] = 0; }
    for (const s of spheres) {
      const dist = s.position.distanceTo(cube.position);
      if (dist > MAX_AUDIO_DIST * 2) continue;
      const w = 1 / (dist + 0.1);
      const f = s.userData.audio_features ?? {};
      for (const k of Object.keys(featureDisplay)) {
        const v = k === 'tempo' ? Math.min((f[k] ?? 120) / 200, 1) : (f[k] ?? 0);
        sums[k] += v * w; weights[k] += w;
      }
    }
    for (const k of Object.keys(featureDisplay))
      if (weights[k] > 0) featureDisplay[k] = sums[k] / weights[k];

    hud.innerHTML = `<div style="text-align:center;color:#555;font-size:10px;margin-bottom:6px;letter-spacing:0.05em">
      ↑ ↓ ← → or WASD to move &nbsp;·&nbsp; drag to look
    </div>` + Object.entries(featureDisplay).map(([k, v]) => {
      const [lo, hi] = LABELS[k];
      const pct = Math.round(v * 100);
      const bar = '█'.repeat(Math.round(v * 14)) + '░'.repeat(14 - Math.round(v * 14));
      return `<div style="display:flex;gap:6px;align-items:center;margin:2px 0">
        <span style="width:70px;text-align:right;color:#888;font-size:11px">${lo}</span>
        <span style="color:#4fc3f7;letter-spacing:-0.5px">${bar}</span>
        <span style="width:70px;color:#888;font-size:11px">${hi}</span>
        <span style="width:30px;color:#fff;text-align:right">${pct}%</span>
      </div>`;
    }).join('');
  }

  // ── Now playing ────────────────────────────────────────────────────────────
  const nowPlaying = document.createElement('div');
  nowPlaying.style.cssText = `
    position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.82); border:1px solid #444; border-radius:24px;
    padding:10px 24px; color:white; font-family:-apple-system,sans-serif;
    font-size:14px; pointer-events:none; z-index:95; display:none;
    text-align:center; white-space:nowrap; backdrop-filter:blur(6px);
  `;
  document.body.appendChild(nowPlaying);

  // ── Audio ──────────────────────────────────────────────────────────────────
  let currentAudio = null, currentSphere = null, audioFadeTimer = null;

  function updateNearestSong() {
    if (!spheres.length) return;
    let closest = null, closestDist = Infinity;
    for (const s of spheres) {
      const d = s.position.distanceTo(cube.position);
      if (d < closestDist) { closestDist = d; closest = s; }
    }
    if (closest && closestDist < MAX_AUDIO_DIST) playNearest(closest);
    else stopAudio();
    if (closest && closestDist < MAX_AUDIO_DIST) {
      const { title = '?', artist = '' } = closest.userData;
      nowPlaying.innerHTML = `<span style="opacity:.6;font-size:11px">♪ Now playing</span><br>
        <strong>${title}</strong>${artist ? ` <span style="opacity:.7">— ${artist}</span>` : ''}`;
      nowPlaying.style.display = 'block';
    } else {
      nowPlaying.style.display = 'none';
    }
    updateHUD();
  }

  function playNearest(sphere) {
    if (sphere === currentSphere) return;
    stopAudio();
    const url = sphere.userData.preview_url;
    if (!url) return;
    currentSphere = sphere;
    currentAudio  = new Audio(url);
    currentAudio.volume = 0;
    currentAudio.loop   = true;
    currentAudio.play().catch(() => {});
    let vol = 0;
    clearInterval(audioFadeTimer);
    audioFadeTimer = setInterval(() => {
      vol = Math.min(vol + 0.05, 0.8);
      if (currentAudio) currentAudio.volume = vol;
      if (vol >= 0.8) clearInterval(audioFadeTimer);
    }, 80);
  }

  function stopAudio() {
    if (!currentAudio) return;
    const audio = currentAudio;
    currentAudio = null;
    currentSphere = null;
    clearInterval(audioFadeTimer);
    let vol = audio.volume;
    const fade = setInterval(() => {
      vol = Math.max(vol - 0.05, 0);
      audio.volume = vol;
      if (vol <= 0) { clearInterval(fade); audio.pause(); }
    }, 80);
  }

  // ── Exit button ────────────────────────────────────────────────────────────
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕ Exit Street View';
  exitBtn.style.cssText = `
    position:fixed; top:20px; right:20px; z-index:100; display:none;
    background:rgba(0,0,0,0.75); color:white; border:1px solid #555;
    border-radius:8px; padding:8px 16px; font-size:14px; cursor:pointer;
  `;
  exitBtn.addEventListener('mouseenter', () => exitBtn.style.background = 'rgba(160,30,30,0.9)');
  exitBtn.addEventListener('mouseleave', () => exitBtn.style.background = 'rgba(0,0,0,0.75)');
  exitBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('exit-street-view')));
  document.body.appendChild(exitBtn);

  // ── Crosshair ──────────────────────────────────────────────────────────────
  const crosshair = document.createElement('div');
  crosshair.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    width:20px; height:20px; pointer-events:none; z-index:96; display:none;
  `;
  crosshair.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20">
    <line x1="10" y1="2"  x2="10" y2="8"  stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="10" y1="12" x2="10" y2="18" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="2"  y1="10" x2="8"  y2="10" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="12" y1="10" x2="18" y2="10" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.7"/>
  </svg>`;
  document.body.appendChild(crosshair);

  // ── Per-frame update ───────────────────────────────────────────────────────
  function update() {
    if (!active) return;
    camera.position.set(cube.position.x, cube.position.y + 1.6, cube.position.z);
  }

  // ── Enter / exit ───────────────────────────────────────────────────────────
  function enter() {
    active     = true;
    isDragging = false;
    hasDragged = false;
    controls.enabled = false;
    cube.visible     = false;

    camera.position.set(cube.position.x, cube.position.y + 1.6, cube.position.z);
    yaw = 0; pitch = 0;
    applyLook();

    // Hide 3D arrows — HTML d-pad handles movement instead
    for (const { arrow, labelSprite } of arrowCircle.arrows) {
      arrow.visible       = false;
      labelSprite.visible = false;
    }

    exitBtn.style.display   = 'block';
    hud.style.display       = 'block';
    crosshair.style.display = 'block';

    updateNearestSong();
  }

  function exit() {
    active     = false;
    isDragging = false;
    controls.enabled = true;
    cube.visible     = true;
    document.body.style.cursor = '';

    // Let arrowCircle.updatePositions() re-show arrows next frame
    for (const { arrow, labelSprite } of arrowCircle.arrows) {
      arrow.visible       = true;
      labelSprite.visible = true;
    }

    stopAudio();
    exitBtn.style.display    = 'none';
    hud.style.display        = 'none';
    nowPlaying.style.display = 'none';
    crosshair.style.display  = 'none';

    for (const s of spheres) {
      s.material.opacity     = 1;
      s.material.transparent = false;
      s.scale.setScalar(1);
    }
  }

  function onArrowMoved() { updateNearestSong(); }

  return { enter, exit, update, onArrowMoved, isActive: () => active };
}