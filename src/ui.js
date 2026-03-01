import Chart from 'chart.js/auto';
import * as THREE from 'three';
import { spheres } from './denotePlaces';
import { switchTo2D } from './switch2d';
import { cubeFeatures, syncCubePosition } from './cubeState.js';

export const axisLabels = {
  tempo:            ['Slow',      'Fast'       ],
  danceability:     ['Listen',    'Dance'      ],
  energy:           ['Mellow',    'Intense'    ],
  valence:          ['Sad',       'Happy'      ],
  acousticness:     ['Synthetic', 'Acoustic'   ],
  instrumentalness: ['Vocals',    'Instrumental'],
  liveness:         ['Studio',    'Live'       ],
  speechiness:      ['Musical',   'Spoken'     ],
  popularity:       ['Niche',     'Popular'    ],
};

export let porcamadonna = false;

export function setupUI({ arrowCircle, cube, scene, renderer, camera, labelRefs, controls }) {

  function normalizeFeatures(features) {
    if (!features || typeof features !== 'object') return {};
    const normalized = {};
    for (const [key, value] of Object.entries(features)) {
      if (value == null) continue;
      switch (key) {
        case 'tempo':      normalized[key] = Math.min(value / 200, 1); break;
        case 'popularity': normalized[key] = value / 100; break;
        default:           normalized[key] = value;
      }
    }
    return normalized;
  }

  // ── DOM elements ────────────────────────────────────────────────────────────
  const sidepanel   = document.getElementById('sidepanel');
  const toggleBtn   = document.getElementById('toggle-btn');
  const topPanel    = document.getElementById('top-panel');
  const closePanelBtn = document.getElementById('close-panel');
  const panelContent  = document.getElementById('panel-content');

  toggleBtn.textContent = '☰ Settings';
  toggleBtn.addEventListener('click', () => sidepanel.classList.toggle('open'));

  if (closePanelBtn && topPanel) {
    closePanelBtn.addEventListener('click', () => {
      topPanel.classList.add('hidden');
      toggleBtn.classList.remove('button-shifted');
    });
  }

  // ── Top panel (track detail) ─────────────────────────────────────────────
  function openTopPanel(trackData) {
    if (!topPanel || !panelContent) return;
    const { title, artist, album, albumCoverUrl, preview_url, features } = trackData;

    panelContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        ${albumCoverUrl ? `<img src="${albumCoverUrl}" alt="Album Cover" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px;">` : ''}
        <div style="flex: 1;">
          <div style="font-weight: bold; font-size: 16px;">${title || 'Unknown'}</div>
          <div style="color: #ccc;">${artist || 'Unknown'}</div>
          <div style="font-size: 13px; color: #aaa;">${album || 'Unknown'}</div>
          ${preview_url ? `<audio controls src="${preview_url}" style="margin-top: 8px; width: 100%;"></audio>` : '<div style="margin-top: 8px;">(No preview available)</div>'}
        </div>
        <div style="flex-shrink: 0; width: 120px; height: 120px; cursor: pointer;">
          <canvas id="radarChart" width="120" height="120"></canvas>
        </div>
      </div>
    `;

    const radarCanvas = document.getElementById('radarChart');
    if (openTopPanel.chartInstance) openTopPanel.chartInstance.destroy();

    const popularityRaw = parseFloat(trackData.popularity);
    const normalized_features = normalizeFeatures({
      ...trackData.audio_features,
      popularity: isNaN(popularityRaw) ? 0 : popularityRaw,
    });

    const featureKeys = Object.keys(axisLabels);
    const labels = featureKeys.map(f => axisLabels[f][1]);
    const data   = featureKeys.map(f => normalized_features?.[f] ?? 0);

    openTopPanel.chartInstance = new Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Track Profile',
          data,
          fill: true,
          backgroundColor: 'rgba(0, 150, 255, 0.25)',
          borderColor: 'rgba(0, 150, 255, 1)',
          pointBackgroundColor: 'rgba(0, 150, 255, 1)',
          pointBorderColor: '#fff',
        }],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 1,
            ticks: { display: false },
            pointLabels: { display: false },
            grid: { color: 'rgba(200,200,200,0.3)' },
            angleLines: { color: 'rgba(200,200,200,0.3)' },
          },
        },
        plugins: { legend: { display: false } },
      },
    });

    // Click to expand with labels
    radarCanvas.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
      `;
      const dpr = window.devicePixelRatio || 1;
      const displaySize = Math.min(window.innerWidth, window.innerHeight) * 0.8;
      const canvas = document.createElement('canvas');
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = `${displaySize}px`;
      canvas.style.height = `${displaySize}px`;
      modal.appendChild(canvas);
      document.body.appendChild(modal);

      const ctxModal = canvas.getContext('2d');
      ctxModal.scale(dpr, dpr);

      new Chart(canvas, {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            label: 'Track Profile',
            data,
            fill: true,
            backgroundColor: 'rgba(0, 150, 255, 0.25)',
            borderColor: 'rgba(0, 150, 255, 1)',
            pointBackgroundColor: 'rgba(0, 150, 255, 1)',
            pointBorderColor: '#fff',
          }],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            r: {
              min: 0, max: 1,
              ticks: { color: 'white' },
              pointLabels: { color: 'white', font: { size: 14 } },
              grid: { color: 'rgba(200,200,200,0.3)' },
              angleLines: { color: 'rgba(200,200,200,0.3)' },
            },
          },
          plugins: { legend: { display: false } },
        },
      });

      modal.addEventListener('click', () => modal.remove());
    });

    topPanel.classList.remove('hidden');
    toggleBtn.classList.add('button-shifted');
  }

  // ── Axis selectors ─────────────────────────────────────────────────────────
  const featureOptions = [
    'danceability', 'energy', 'valence', 'tempo',
    'instrumentalness', 'speechiness', 'acousticness', 'liveness', 'popularity',
  ];

  function populateAxisSelectors() {
    ['x', 'y', 'z'].forEach(axis => {
      const select = document.getElementById(`axis-${axis}`);
      featureOptions.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        select.appendChild(option);
      });
    });
  }
  populateAxisSelectors();

  // ── Stats display ──────────────────────────────────────────────────────────
  // Stats now reads directly from cubeFeatures (the semantic feature vector)
  // so it always shows meaningful values regardless of axis mapping.
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = `
    color:white; margin-top:10px; font-family:monospace; font-size:12px;
    padding:6px 10px; background:rgba(255,255,255,0.05);
    border-radius:6px; line-height:2;
  `;
  sidepanel.appendChild(statsDiv);

  function updateStats() {
    const axes = getMappedAxisFeatures();

    const fmt = (feature, val) => {
      const poles = axisLabels[feature] ?? ['Min', 'Max'];
      const pct  = Math.round(val * 100);
      const fill = Math.round(val * 8);
      const bar  = '█'.repeat(fill) + '░'.repeat(8 - fill);
      return `<span style="color:#888">${poles[0]}</span> `
           + `<span style="color:#4fc3f7">${bar}</span> `
           + `<span style="color:#888">${poles[1]}</span> `
           + `<span style="color:#fff">${pct}%</span>`;
    };

    // Show the three features currently mapped to axes
    statsDiv.innerHTML =
      `<div>${fmt(axes.x, cubeFeatures[axes.x] ?? 0.5)}</div>` +
      `<div>${fmt(axes.y, cubeFeatures[axes.y] ?? 0.5)}</div>` +
      `<div>${fmt(axes.z, cubeFeatures[axes.z] ?? 0.5)}</div>`;
  }

  // ── Toggle buttons ─────────────────────────────────────────────────────────
  function setupToggleButtons() {
    const toggleLabelsBtn = document.getElementById('toggle-labels');
    const toggleArrowsBtn = document.getElementById('toggle-arrows');
    const toggleCubeBtn   = document.getElementById('toggle-cube');

    let labelsVisible = true;
    let arrowsVisible = true;
    let cubeInScene   = true;

    toggleLabelsBtn?.addEventListener('click', () => {
      labelsVisible = !labelsVisible;
      arrowCircle.toggleLabels(labelsVisible);
      toggleLabelsBtn.textContent = labelsVisible ? 'Hide Labels' : 'Show Labels';
    });

    toggleArrowsBtn?.addEventListener('click', () => {
      arrowsVisible = !arrowsVisible;
      arrowCircle.toggleArrows(arrowsVisible);
      toggleArrowsBtn.textContent = arrowsVisible ? 'Hide Arrows' : 'Show Arrows';
    });

    toggleCubeBtn?.addEventListener('click', () => {
      cubeInScene ? scene.remove(cube) : scene.add(cube);
      cubeInScene = !cubeInScene;
      toggleCubeBtn.textContent = cubeInScene ? 'Hide Cube' : 'Show Cube';
    });

    const streetViewBtn = document.getElementById('street-view');
    streetViewBtn?.addEventListener('click', () => {
      sidepanel.classList.remove('open');
      window.dispatchEvent(new CustomEvent('enter-street-view'));
    });

    const toggleBubblesBtn = document.getElementById('toggle-bubbles');
    let bubblesVisible = true;
    toggleBubblesBtn?.addEventListener('click', () => {
      bubblesVisible = !bubblesVisible;
      window.dispatchEvent(new CustomEvent('toggle-bubbles', { detail: bubblesVisible }));
      toggleBubblesBtn.textContent = bubblesVisible ? 'Hide Regions' : 'Show Regions';
    });

    const btn2d = document.getElementById('2d');
    btn2d.addEventListener('click', () => {
      camera.position.set(0, 50, 0);
      camera.lookAt(0, 0, 0);
      switchTo2D(spheres);
      controls.enabled = false;
      if (labelRefs.up)   labelRefs.up.visible   = false;
      if (labelRefs.down) labelRefs.down.visible = false;
      porcamadonna = true;
    });

    const btn3d = document.getElementById('3d');
    btn3d.addEventListener('click', () => {
      camera.position.set(5, 7, 10);
      camera.lookAt(0, 0.5, 0);
      controls.target.set(0, 0.5, 0);
      controls.enabled = true;
      controls.update();
      switchTo3D(spheres);
      if (labelRefs.up)   labelRefs.up.visible   = true;
      if (labelRefs.down) labelRefs.down.visible = true;
      porcamadonna = false;
    });
  }

  // ── Hover label ────────────────────────────────────────────────────────────
  const hoverLabel = document.createElement('div');
  hoverLabel.style.cssText = `
    position:absolute; background:rgba(0,0,0,0.75); color:#fff;
    padding:4px 8px; border-radius:4px; pointer-events:none;
    font-size:14px; display:none;
  `;
  document.body.appendChild(hoverLabel);

  let hoveredObject = null;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  });

  function updateHoverLabel() {
    raycaster.setFromCamera(mouse, arrowCircle.camera || null);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const found = intersects.find(i => i.object.userData.title);

    if (found && found.object !== hoveredObject) {
      hoveredObject = found.object;
      const { title = '', album = '', artist = '' } = hoveredObject.userData;
      const parts = [title];
      if (artist && artist !== title) parts.push(artist);
      if (album  && album  !== title && album !== artist) parts.push(`(${album})`);
      hoverLabel.innerText = parts.join(' — ');
      hoverLabel.style.display = 'block';
    } else if (!found) {
      hoveredObject = null;
      hoverLabel.style.display = 'none';
    }

    if (hoveredObject) {
      const screenPos = hoveredObject.position.clone().project(arrowCircle.camera || null);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
      hoverLabel.style.left = `${x + 8}px`;
      hoverLabel.style.top  = `${y + 8}px`;
    }
  }

  function switchTo3D() {
    spheres.forEach(sphere => {
      if (sphere.userData.originalY !== undefined)
        sphere.position.y = sphere.userData.originalY;
    });
  }

  return { updateStats, setupToggleButtons, updateHoverLabel, openTopPanel };
}

export function getMappedAxisFeatures() {
  return {
    x: document.getElementById('axis-x').value,
    y: document.getElementById('axis-y').value,
    z: document.getElementById('axis-z').value,
  };
}