import * as THREE from 'three';

export const axisLabels = {
  bpm: ['Slow', 'Fast'],
  danceability: ['Listen', 'Dance'],
  energy: ['Mellow', 'Intense'],
  valence: ['Sad', 'Happy'],
  acousticness: ['Synthetic', 'Acoustic'],
  instrumentalness: ['Vocals', 'Instrumental'],
  liveness: ['Studio', 'Live'],
  speechiness: ['Musical', 'Spoken'],
  // Add more if needed
};


export function setupUI({ arrowCircle, cube, scene,renderer,camera, labelRefs,controls  }) {
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
  
    const { title, artist, album, albumCoverUrl, preview_url } = trackData;
  
    panelContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        ${albumCoverUrl ? `<img src="${albumCoverUrl}" alt="Album Cover" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px;">` : ''}
        <div style="flex: 1;">
          <div style="font-weight: bold; font-size: 16px;">${title || 'Unknown'}</div>
          <div style="color: #ccc;">${artist || 'Unknown'}</div>
          <div style="font-size: 13px; color: #aaa;">${album || 'Unknown'}</div>
          ${preview_url ? `<audio controls src="${preview_url}" style="margin-top: 8px; width: 100%;"></audio>` : '<div style="margin-top: 8px;">(No preview available)</div>'}
        </div>
      </div>
    `;
  
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
    const btn2d = document.getElementById('2d');

    btn2d.addEventListener('click', () => {
      // ⬆️ Move camera directly overhead
      camera.position.set(0, 50, 0);
      camera.lookAt(0, 0, 0);
      
      // 🚫 Disable orbit controls
      controls.enabled = false;
      console.log(labelRefs)
      // ❌ Hide Progressive & Conservative labels
      if (labelRefs.up) labelRefs.up.visible = false;
      if (labelRefs.down) labelRefs.down.visible = false;
    });

    const btn3d = document.getElementById('3d');

    btn3d.addEventListener('click', () => {
      camera.position.set(5, 7, 10);
      camera.lookAt(0, 0.5, 0);
      controls.target.set(0, 0.5, 0);
      controls.enabled = true;
      controls.update();
      // Show labels again
      if (labelRefs.up) labelRefs.up.visible = true;
      if (labelRefs.down) labelRefs.down.visible = true;
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
