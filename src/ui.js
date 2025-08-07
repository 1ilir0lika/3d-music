import * as THREE from 'three';

export function setupUI({ arrowCircle, cube, scene,renderer }) {
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
  function openTopPanel(text) {
    console.log('toggleBtn:', toggleBtn);
    if (!topPanel || !panelContent) return;
    panelContent.textContent = text;
    topPanel.classList.remove('hidden');
    console.log("bbbbbbb")
    toggleBtn.classList.add('button-shifted');  // Shift button down
  }
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
