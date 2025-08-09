import * as THREE from 'three';
import { getMappedAxisFeatures } from './ui.js';

export const spheres=[]

export async function denotePlaces(scene, camera, renderer, jsonUrl = 'data/playlist_chosic_data.json',openTopPanel) {
  const group = new THREE.Group();
  scene.add(group);


  const hoverLabel = createHoverLabel();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredObject = null;
  let rawData = []; 
  const response = await fetch(jsonUrl);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  rawData = await response.json(); // ✅ assign to rawData
  const axes = getMappedAxisFeatures(); // ✅ get user axis choice
  const parsed = parseTrackFeatures(rawData, axes); // ✅ pass it
  const mapped = normalizePositions(parsed, 25);

  // Track mouse position relative to renderer
  window.addEventListener('mousemove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  });

  // Handle click on renderer to open top panel with metadata
  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseClick = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Setup close button listener once
    const closeBtn = document.getElementById('close-panel');
    const topPanel = document.getElementById('top-panel');
    if (closeBtn && topPanel && !closeBtn.dataset.listenerAdded) {
      closeBtn.addEventListener('click', () => topPanel.classList.add('hidden'));
      closeBtn.dataset.listenerAdded = 'true';
    }

    raycaster.setFromCamera(mouseClick, camera);
    const intersects = raycaster.intersectObjects(group.children, true);
    const clicked = intersects.find(i => i.object.userData.title);
    if (clicked) {
      console.log('🎵 Opening panel with data:',clicked.object.userData);
      openTopPanel(clicked.object.userData);
    }
    
  }
  );

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    function renderSpheres() {
      const axes = getMappedAxisFeatures();
      const parsed = parseTrackFeatures(data, axes);
      const mapped = normalizePositions(parsed, 25);
    
      group.clear(); // remove all old spheres
      mapped.forEach(({ x, y, z, popularity, title, artist, album, albumCoverUrl, preview_url }) => {
        const radius = mapToRange(popularity ?? 50, 0, 100, 0.1, 0.6);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xff4444 })
        );
        sphere.position.set(x, y, z);
        sphere.userData = { title, artist, album, popularity, albumCoverUrl, preview_url };
        group.add(sphere);
        spheres.push(sphere)
      });
    console.log(`✅ Placed ${mapped.length} normalized spheres`);
    }
     renderSpheres();
     return {
      updateLabels: () => {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(group.children, true);
        const found = intersects.find(i => i.object.userData.title);
    
        if (found && found.object !== hoveredObject) {
          hoveredObject = found.object;
          const { title = '', artist = '', album = '' } = hoveredObject.userData;
    
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
          const screenPos = hoveredObject.position.clone().project(camera);
          const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
          hoverLabel.style.left = `${x + 8}px`;
          hoverLabel.style.top = `${y + 8}px`;
        }
      },
      refreshSpheres: renderSpheres // ✅ add it here!
    };
    
  } catch (err) {
    console.error('❌ Failed to load or parse data:', err);
    return {
      updateLabels: () => {
        // fallback
      },
      refreshSpheres: renderSpheres // ✅ but only on error
    };
}

function parseTrackFeatures(data, axes) {
  return data
    .map(track => {
      const f = track.audio_features;
      const info = track.track_info;
      if (!f || !info) return null;

      const popularity = info.popularity ?? 50;
      const title = info.name ?? 'Unknown';
      const artist = Array.isArray(info.artists) && info.artists.length > 0
        ? info.artists.map(a => a.name).join(', ')
        : 'Unknown';
      const album = info.album?.name ?? 'Unknown';
      const albumCoverUrl = info.album?.image_large || info.album?.image_default || '';
      const preview_url = info.preview_url || '';

      return {
        x: f[axes.x] ?? 0,
        y: f[axes.y] ?? 0,
        z: f[axes.z] ?? 0,
        popularity,
        title,
        artist,
        album,
        albumCoverUrl,
        preview_url
      };
    })
    .filter(Boolean);
}


function normalizePositions(data, totalRange = 25) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  data.forEach(({ x, y, z }) => {
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
  });

  return data.map(p => ({
      ...p,
      x: mapToRange(p.x, min.x, max.x, -totalRange, totalRange),
      y: mapToRange(p.y, min.y, max.y, -totalRange, totalRange),
      z: mapToRange(p.z, min.z, max.z, -totalRange, totalRange)
    }));
}

function mapToRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax);
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function createHoverLabel() {
  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'absolute',
    background: 'rgba(0, 0, 0, 0.75)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    pointerEvents: 'none',
    fontSize: '14px',
    display: 'none'
  });
  document.body.appendChild(div);
  return div;
}
}
