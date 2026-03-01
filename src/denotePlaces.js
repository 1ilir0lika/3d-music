import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { getMappedAxisFeatures } from './ui.js';

export const spheres = [];
let lastAxisRanges = null; // declared here, assigned in normalizePositions

// ── Cluster colours ────────────────────────────────────────────────────────────
const CLUSTER_COLORS = [
  0xe74c3c, // red
  0x3498db, // blue
  0x2ecc71, // green
  0xf39c12, // orange
  0x9b59b6, // purple
  0x1abc9c, // teal
  0xe67e22, // dark orange
  0xe91e8c, // pink
];
const NUM_CLUSTERS = 6;

// ── Feature keys used for clustering (full feature vector, not just visible axes)
const CLUSTER_FEATURES = [
  'danceability', 'energy', 'valence', 'acousticness',
  'instrumentalness', 'liveness', 'speechiness', 'tempo', 'popularity'
];

// ── K-means (pure JS, runs once on load) ───────────────────────────────────────
function normalizeClusterFeatures(tracks) {
  return tracks.map(t => {
    const f = t.audio_features ?? {};
    const pop = (t.popularity ?? 50) / 100;
    return CLUSTER_FEATURES.map(key => {
      if (key === 'popularity') return pop;
      if (key === 'tempo') return Math.min((f[key] ?? 120) / 200, 1);
      return f[key] ?? 0;
    });
  });
}

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function kmeans(vectors, k, iterations = 60) {
  const centroids = [];
  const used = new Set();
  let idx = Math.floor(Math.random() * vectors.length);
  centroids.push([...vectors[idx]]);
  used.add(idx);

  while (centroids.length < k) {
    const distances = vectors.map((v, i) => {
      if (used.has(i)) return 0;
      return Math.min(...centroids.map(c => euclidean(v, c))) ** 2;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < distances.length; i++) {
      rand -= distances[i];
      if (rand <= 0 && !used.has(i)) {
        centroids.push([...vectors[i]]);
        used.add(i);
        break;
      }
    }
  }

  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclidean(vectors[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => new Array(vectors[0].length).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < vectors.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < vectors[i].length; j++) sums[c][j] += vectors[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) centroids[c] = sums[c].map(v => v / counts[c]);
    }
  }

  return assignments;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export async function denotePlaces(scene, camera, renderer, jsonUrl = 'data/playlist_chosic_data.json', openTopPanel) {
  const group = new THREE.Group();
  const bubbleGroup = new THREE.Group();
  scene.add(group);
  scene.add(bubbleGroup);

  const hoverLabel = createHoverLabel();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredObject = null;

  const response = await fetch(jsonUrl);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();

  // Cluster on full feature vector once
  const clusterVectors = normalizeClusterFeatures(
    data.map(t => ({ audio_features: t.audio_features, popularity: t.track_info?.popularity }))
  );
  const assignments = kmeans(clusterVectors, NUM_CLUSTERS);
  console.log(`✅ K-means done: ${NUM_CLUSTERS} clusters over ${data.length} tracks`);

  window.addEventListener('mousemove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  });

  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseClick = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const closeBtn = document.getElementById('close-panel');
    const topPanel = document.getElementById('top-panel');
    if (closeBtn && topPanel && !closeBtn.dataset.listenerAdded) {
      closeBtn.addEventListener('click', () => topPanel.classList.add('hidden'));
      closeBtn.dataset.listenerAdded = 'true';
    }
    raycaster.setFromCamera(mouseClick, camera);
    const intersects = raycaster.intersectObjects(group.children, true);
    const clicked = intersects.find(i => i.object.userData.title);
    if (clicked) openTopPanel(clicked.object.userData);
  });

  try {
    function renderSpheres() {
      const axes = getMappedAxisFeatures();
      const parsed = parseTrackFeatures(data, axes, assignments);
      const mapped = normalizePositions(parsed, 25, axes);

      group.clear();
      spheres.length = 0;

      mapped.forEach(({ x, y, z, popularity, title, artist, album, albumCoverUrl, preview_url, audio_features, clusterIndex }) => {
        const radius = mapToRange(popularity ?? 50, 0, 100, 0.1, 0.6);
        const color = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length];
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshStandardMaterial({ color })
        );
        sphere.position.set(x, y, z);
        sphere.userData = { title, artist, album, popularity, albumCoverUrl, preview_url, audio_features, clusterIndex };
        group.add(sphere);
        spheres.push(sphere);
      });

      renderBubbles(mapped);
      console.log(`✅ Placed ${mapped.length} spheres`);
    }

    function renderBubbles(mapped) {
      bubbleGroup.clear();

      const clusterPoints = Array.from({ length: NUM_CLUSTERS }, () => []);
      mapped.forEach(({ x, y, z, clusterIndex }) => {
        clusterPoints[clusterIndex].push(new THREE.Vector3(x, y, z));
      });

      clusterPoints.forEach((points, ci) => {
        if (points.length < 4) return; // convex hull needs at least 4 non-coplanar points

        const color = new THREE.Color(CLUSTER_COLORS[ci % CLUSTER_COLORS.length]);

        // Expand points slightly outward from centroid so hull wraps loosely
        const centroid = points.reduce((acc, p) => acc.clone().add(p), new THREE.Vector3()).divideScalar(points.length);
        const expanded = points.map(p => {
          const dir = p.clone().sub(centroid).normalize();
          return p.clone().addScaledVector(dir, 3.0); // padding in world units
        });

        let geometry;
        try {
          geometry = new ConvexGeometry(expanded);
        } catch (e) {
          console.warn(`Cluster ${ci} convex hull failed, skipping`, e);
          return;
        }

        // Filled translucent shell
        const fill = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.07,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        bubbleGroup.add(fill);

        // Wireframe outline on top
        const outline = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            wireframe: true,
            depthWrite: false,
          })
        );
        bubbleGroup.add(outline);
      });
    }

    // Store bubble meshes for per-frame scaling
    const bubbleMeshes = [];

    const _renderBubbles = renderBubbles;
    function renderBubblesTracked(mapped) {
      bubbleMeshes.length = 0;
      _renderBubbles(mapped);
      // collect refs after render
      bubbleGroup.children.forEach(m => bubbleMeshes.push(m));
    }

    // patch renderSpheres to use tracked version
    const _renderSpheres = renderSpheres;

    renderSpheres();

    return {
      updateBubbles: () => {
        const dist = camera.position.length();
        // zoomed in (dist~10): nearly invisible; zoomed out (dist~80): fully visible
        const t = Math.min(Math.max((dist - 8) / 60, 0), 1);
        const opacity_fill = 0.02 + t * 0.10;
        const opacity_wire = 0.05 + t * 0.20;

        bubbleGroup.children.forEach((mesh, i) => {
          if (mesh.material) {
            mesh.material.opacity = i % 2 === 0 ? opacity_fill : opacity_wire;
          }
        });
      },
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
      refreshSpheres: renderSpheres,
      toggleBubbles: (visible) => {
        bubbleGroup.visible = visible;
      },
    };

  } catch (err) {
    console.error('❌ Failed to load or parse data:', err);
    return { updateLabels: () => {}, refreshSpheres: () => {} };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseTrackFeatures(data, axes, assignments) {
  return data
    .map((track, i) => {
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
      const featureVal = (key) => key === 'popularity' ? (popularity / 100) : (f[key] ?? 0);

      return {
        x: featureVal(axes.x),
        y: featureVal(axes.y),
        z: featureVal(axes.z),
        popularity,
        title,
        artist,
        album,
        albumCoverUrl,
        preview_url,
        audio_features: f,
        clusterIndex: assignments[i] ?? 0,
      };
    })
    .filter(Boolean);
}

function normalizePositions(data, totalRange = 25, axes) {
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

  // Store ranges keyed by FEATURE NAME so the UI can always look up by feature
  if (axes) {
    lastAxisRanges = {
      byFeature: {
        [axes.x]: { min: min.x, max: max.x },
        [axes.y]: { min: min.y, max: max.y },
        [axes.z]: { min: min.z, max: max.z },
      },
      totalRange,
    };
  }

  return data.map(p => ({
    ...p,
    x: mapToRange(p.x, min.x, max.x, -totalRange, totalRange),
    y: mapToRange(p.y, min.y, max.y, -totalRange, totalRange),
    z: mapToRange(p.z, min.z, max.z, -totalRange, totalRange),
  }));
}

function mapToRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return (outMin + outMax) / 2;
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
    display: 'none',
  });
  document.body.appendChild(div);
  return div;
}