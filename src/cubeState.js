// cubeState.js
// The cube's "true" position is a feature vector, not raw XYZ.
// World space is ±25 units mapping to feature values 0→1.

export const FEATURE_KEYS = [
  'danceability',
  'energy',
  'valence',
  'tempo',
  'instrumentalness',
  'speechiness',
  'acousticness',
  'liveness',
  'popularity',
];

// Default starting values (mid-range for everything)
export const cubeFeatures = Object.fromEntries(
  FEATURE_KEYS.map(k => [k, 0.5])
);

const WORLD_RANGE = 25; // world coords go from -25 to +25

/** Feature value [0,1] → world coordinate [-25, 25] */
export function featureToWorld(value) {
  return (value - 0.5) * 2 * WORLD_RANGE;
}

/** World coordinate [-25, 25] → feature value [0, 1] */
export function worldToFeature(coord) {
  return Math.max(0, Math.min(1, coord / (2 * WORLD_RANGE) + 0.5));
}

/**
 * Sync cube mesh position from the current feature vector + axis mapping.
 * Call this whenever axes change OR a feature value changes.
 */
export function syncCubePosition(cubeMesh, axes) {
  cubeMesh.position.x = featureToWorld(cubeFeatures[axes.x] ?? 0.5);
  cubeMesh.position.y = featureToWorld(cubeFeatures[axes.y] ?? 0.5);
  cubeMesh.position.z = featureToWorld(cubeFeatures[axes.z] ?? 0.5);
}

/**
 * Read cube's current world position back into cubeFeatures.
 * Call this after any move that bypasses moveCubeAlongFeature (e.g. street view).
 */
export function syncFeaturesFromWorld(cubeMesh, axes) {
  cubeFeatures[axes.x] = worldToFeature(cubeMesh.position.x);
  cubeFeatures[axes.y] = worldToFeature(cubeMesh.position.y);
  cubeFeatures[axes.z] = worldToFeature(cubeMesh.position.z);
}

/**
 * Move the cube by nudging the feature that's currently on `axis` ('x'|'y'|'z')
 * by `delta` (e.g. +0.05 or -0.05), then re-sync world position.
 * Returns true if the move was legal (feature stayed in [0,1]).
 */
export function moveCubeAlongFeature(cubeMesh, axes, axis, delta) {
  const feature = axes[axis];
  if (!feature) return false;
  const next = Math.max(0, Math.min(1, (cubeFeatures[feature] ?? 0.5) + delta));
  cubeFeatures[feature] = next;
  syncCubePosition(cubeMesh, axes);
  return true;
}