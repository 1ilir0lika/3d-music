import Chart from 'chart.js/auto'; // ⬅️ keep at the top
import * as THREE from 'three';
import {spheres } from './denotePlaces';
import { switchTo2D } from './switch2d';
import { normalize } from 'three/src/math/MathUtils.js';
export const axisLabels = {
  tempo: ['Slow', 'Fast'],
  danceability: ['Listen', 'Dance'],
  energy: ['Mellow', 'Intense'],
  valence: ['Sad', 'Happy'],
  acousticness: ['Synthetic', 'Acoustic'],
  instrumentalness: ['Vocals', 'Instrumental'],
  liveness: ['Studio', 'Live'],
  speechiness: ['Musical', 'Spoken'],
  popularity: ['Niche', 'Popular'],
};

export let porcamadonna=false;

export function setupUI({ arrowCircle, cube, scene,renderer,camera, labelRefs,controls  }) {
  
function normalizeFeatures(features) {
  if (!features || typeof features !== 'object') return {}; // return empty object safely

  const normalized = {};
  for (const [key, value] of Object.entries(features)) {
    if (value == null) continue;
    switch (key) {
      case 'tempo':
        normalized[key] = Math.min(value / 200, 1);
        break;
      case 'popularity':
        normalized[key] = value / 100;
        break;
      default:
        normalized[key] = value;
    }
  }
  return normalized;
}

  // DOM elements
  const sidepanel = document.getElementById('sidepanel');
  const toggleBtn = document.getElementById('toggle-btn');
  const topPanel = document.getElementById('top-panel');
  const closePanelBtn = document.getElementById('close-panel');
  const panelContent = document.getElementById('panel-content');

  // Toggle sidepanel
  toggleBtn.textContent = '☰ Settings';
  toggleBtn.addEventListener('click', () => {
    sidepanel.classList.toggle('open');
  });

  // Close top panel on clicking close button
  if (closePanelBtn && topPanel) {
    closePanelBtn.addEventListener('click', () => {
      topPanel.classList.add('hidden');
      toggleBtn.classList.remove('button-shifted'); // Move button up
    });
  }
  // Function to open top panel with content (call when clicking spheres)
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

  if (openTopPanel.chartInstance) {
    openTopPanel.chartInstance.destroy();
  }
  const popularityRaw = parseFloat(trackData.popularity);
  let normalized_features = normalizeFeatures({
    ...trackData.audio_features,
    popularity: isNaN(popularityRaw) ? 0 : popularityRaw
  });
  console.log('trackData.popularity raw:', trackData.popularity);
  console.log('normalized_features:', normalized_features);
  const featureKeys = Object.keys(axisLabels);
  const labels = featureKeys.map(f => axisLabels[f][1]);
  const data = featureKeys.map(f => normalized_features?.[f] ?? 0);

  openTopPanel.chartInstance = new Chart(radarCanvas, {
    type: 'radar',
    data: {
      labels, // labels exist but won't be shown
      datasets: [{
        label: 'Track Profile',
        data,
        fill: true,
        backgroundColor: 'rgba(0, 150, 255, 0.25)',
        borderColor: 'rgba(0, 150, 255, 1)',
        pointBackgroundColor: 'rgba(0, 150, 255, 1)',
        pointBorderColor: '#fff'
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: { display: false },      // hide numbers
          pointLabels: { display: false }, // hide axis labels
          grid: { color: 'rgba(200,200,200,0.3)' },
          angleLines: { color: 'rgba(200,200,200,0.3)' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Click to expand chart with labels
  radarCanvas.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top:0; left:0; width:100%; height:100%;
      background: rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    `;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${displaySize}px`;
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
          pointBorderColor: '#fff'
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          r: {
            min: 0,
            max: 1,
            ticks: { color: 'white' },
            pointLabels: { color: 'white', font: { size: 14 } },
            grid: { color: 'rgba(200,200,200,0.3)' },
            angleLines: { color: 'rgba(200,200,200,0.3)' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });

    modal.addEventListener('click', () => modal.remove());
  });

  topPanel.classList.remove('hidden');
  toggleBtn.classList.add('button-shifted');
}


  
  const featureOptions = [
    'danceability',
    'energy',
    'valence',
    'tempo',
    'instrumentalness',
    'speechiness',
    'acousticness',
    'liveness',
    'popularity'
  ];
  // To have the selections for the axes
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
  // Stats display
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = 'color:white;margin-top:10px;font-family:monospace';
  sidepanel.appendChild(statsDiv);

  const displayLabels = ['N', 'E', 'UP'];

  function updateStats() {
    const stats = arrowCircle.labelStats;
    statsDiv.innerHTML = displayLabels.map(l => {
      const opp = { N: 'S', E: 'W', UP: 'DOWN' }[l];
      return `${l}: ${stats[l] - (stats[opp] || 0)}`;
    }).join('<br>');
  }

  // Toggle buttons for labels, arrows, cube
  function setupToggleButtons() {
    const toggleLabelsBtn = document.getElementById('toggle-labels');
    const toggleArrowsBtn = document.getElementById('toggle-arrows');
    const toggleCubeBtn = document.getElementById('toggle-cube');

    let labelsVisible = true;
    let arrowsVisible = true;
    let cubeInScene = true;

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
      if (cubeInScene) {
        scene.remove(cube);
      } else {
        scene.add(cube);
      }
      cubeInScene = !cubeInScene;
      toggleCubeBtn.textContent = cubeInScene ? 'Hide Cube' : 'Show Cube';
    });
    const toggleBubblesBtn = document.getElementById('toggle-bubbles');
    let bubblesVisible = true;
    toggleBubblesBtn?.addEventListener('click', () => {
      bubblesVisible = !bubblesVisible;
      // toggleBubbles is exposed from main via a global-ish pattern — call via custom event
      window.dispatchEvent(new CustomEvent('toggle-bubbles', { detail: bubblesVisible }));
      toggleBubblesBtn.textContent = bubblesVisible ? 'Hide Regions' : 'Show Regions';
    });

    const btn2d = document.getElementById('2d');

    btn2d.addEventListener('click', () => {
      // ⬆️ Move camera directly overhead
      camera.position.set(0, 50, 0);
      camera.lookAt(0, 0, 0);
      switchTo2D(spheres);
      // 🚫 Disable orbit controls
      controls.enabled = false;
      console.log(spheres)
      console.log(labelRefs)
      // ❌ Hide Progressive & Conservative labels
      if (labelRefs.up) labelRefs.up.visible = false;
      if (labelRefs.down) labelRefs.down.visible = false;
      porcamadonna=true;
    });

    const btn3d = document.getElementById('3d');

    btn3d.addEventListener('click', () => {
      camera.position.set(5, 7, 10);
      camera.lookAt(0, 0.5, 0);
      controls.target.set(0, 0.5, 0);
      controls.enabled = true;
      controls.update();
      switchTo3D(spheres);
      // Show labels again
      if (labelRefs.up) labelRefs.up.visible = true;
      if (labelRefs.down) labelRefs.down.visible = true;
      porcamadonna=false;
    });
  }

  // Create and manage the floating hover label div
  const hoverLabel = document.createElement('div');
  hoverLabel.style.position = 'absolute';
  hoverLabel.style.background = 'rgba(0, 0, 0, 0.75)';
  hoverLabel.style.color = '#fff';
  hoverLabel.style.padding = '4px 8px';
  hoverLabel.style.borderRadius = '4px';
  hoverLabel.style.pointerEvents = 'none';
  hoverLabel.style.fontSize = '14px';
  hoverLabel.style.display = 'none';
  document.body.appendChild(hoverLabel);

  let hoveredObject = null;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  });
  
  // Function to update hover label position and content — call inside animation loop
  function updateHoverLabel() {
    raycaster.setFromCamera(mouse, arrowCircle.camera || null); // camera must be passed in arrowCircle or otherwise provided
    const intersects = raycaster.intersectObjects(scene.children, true);

    const found = intersects.find(i => i.object.userData.title);
    if (found && found.object !== hoveredObject) {
      hoveredObject = found.object;
      const { title = '', album = '', artist = '' } = hoveredObject.userData;

      // Build label text safely
      const labelParts = [title];
      if (artist && artist !== title) labelParts.push(artist);
      if (album && album !== title && album !== artist) labelParts.push(`(${album})`);

      hoverLabel.innerText = labelParts.join(' — ');
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
      hoverLabel.style.top = `${y + 8}px`;
    }
  }

function switchTo3D() {
  spheres.forEach(sphere => {
    if (sphere.userData.originalY !== undefined) {
      sphere.position.y = sphere.userData.originalY;
    }
  });
}
  return {
    updateStats,
    setupToggleButtons,
    updateHoverLabel,
    openTopPanel,
  };
}
export function getMappedAxisFeatures() {
  return {
    x: document.getElementById('axis-x').value,
    y: document.getElementById('axis-y').value,
    z: document.getElementById('axis-z').value
  };
}