import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

const ARROW_LAYER = 1;
const LABEL_LAYER = 2;

export function createArrowCircle(scene, cube, camera, renderer, onArrowClick) {
  const arrows = [];
  const labelStats = {};
  let hoveredArrow = null;

  const arrowLength = 1.2;
  const arrowHeight = 0.8;
  const arrowColor  = 0x999999;
  const offset      = 2;

  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();

  // The 6 directions, each linked to an axis slot (x+, x-, y+, y-, z+, z-)
  // Labels start empty — updateLabels() fills them from the dropdowns
  const directions = [
    { slot: 'x+', vector: [ 1,  0,  0], rotation: [-Math.PI/2, 0, Math.PI      ] },
    { slot: 'x-', vector: [-1,  0,  0], rotation: [-Math.PI/2, Math.PI, Math.PI] },
    { slot: 'y+', vector: [ 0,  1,  0], rotation: [ 0, 0, -Math.PI/2           ] },
    { slot: 'y-', vector: [ 0, -1,  0], rotation: [ 0, 0,  Math.PI/2           ] },
    { slot: 'z+', vector: [ 0,  0,  1], rotation: [-Math.PI/2, 0, Math.PI/2    ] },
    { slot: 'z-', vector: [ 0,  0, -1], rotation: [ Math.PI/2, 0, Math.PI/2    ] },
  ];

  // ── Sprite helper ──────────────────────────────────────────────────────────
  function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1, 1, 1);
    sprite.layers.set(LABEL_LAYER);
    sprite.renderOrder = 1000;
    return sprite;
  }

  function setSpritText(sprite, text) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
    sprite.material.map.dispose();
    sprite.material.map = new THREE.CanvasTexture(canvas);
    sprite.material.needsUpdate = true;
  }

  // ── Arrow mesh ─────────────────────────────────────────────────────────────
  function createArrowMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(arrowLength * 0.6,  arrowHeight * 0.5);
    shape.lineTo(arrowLength * 0.6,  arrowHeight * 0.2);
    shape.lineTo(arrowLength,        arrowHeight * 0.2);
    shape.lineTo(arrowLength,       -arrowHeight * 0.2);
    shape.lineTo(arrowLength * 0.6, -arrowHeight * 0.2);
    shape.lineTo(arrowLength * 0.6, -arrowHeight * 0.5);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color: arrowColor, side: THREE.DoubleSide,
      depthTest: false, depthWrite: false,
      transparent: true, emissive: new THREE.Color(0x000000)
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.layers.set(ARROW_LAYER);
    mesh.renderOrder = 999;
    return mesh;
  }

  // ── Build arrows ───────────────────────────────────────────────────────────
  for (const { slot, vector, rotation } of directions) {
    const dir    = new THREE.Vector3(...vector).normalize();
    const arrow  = createArrowMesh();
    arrow.rotation.set(...rotation);
    arrow.userData = { moveDirection: dir, slot, label: '' };

    const pos = cube.position.clone().addScaledVector(dir, offset);
    arrow.position.copy(pos);

    const labelSprite = createTextSprite('');
    const labelPos = cube.position.clone().addScaledVector(dir, offset + 1.3).add(new THREE.Vector3(0, 0.5, 0));
    labelSprite.position.copy(labelPos);

    scene.add(arrow);
    scene.add(labelSprite);
    arrows.push({ arrow, labelSprite, slot });
    labelStats[slot] = 0;
  }

  // ── Sync labels from axis dropdowns ───────────────────────────────────────
  // axisLabels: { feature: [lowLabel, highLabel] }
  // axes: { x: 'tempo', y: 'energy', z: 'valence' }
  function syncLabels(axes, axisLabels) {
    for (const { arrow, labelSprite, slot } of arrows) {
      const axis     = slot[0];           // 'x', 'y', 'z'
      const polarity = slot[1];           // '+' or '-'
      const feature  = axes[axis];        // e.g. 'tempo'
      const poles    = axisLabels[feature]; // ['Slow', 'Fast']
      const label    = poles ? (polarity === '+' ? poles[1] : poles[0]) : slot;

      arrow.userData.label = label;
      setSpritText(labelSprite, label);

      // Update stats key
      if (!(label in labelStats)) labelStats[label] = labelStats[slot] ?? 0;
    }
  }

  // ── Hover / click ──────────────────────────────────────────────────────────
  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.set(ARROW_LAYER);

    const hits = raycaster.intersectObjects(arrows.map(a => a.arrow));
    if (hits.length > 0) {
      if (hoveredArrow !== hits[0].object) {
        if (hoveredArrow) hoveredArrow.material.emissive.setHex(0x000000);
        hoveredArrow = hits[0].object;
        hoveredArrow.material.emissive.setHex(0x555555);
      }
    } else {
      if (hoveredArrow) hoveredArrow.material.emissive.setHex(0x000000);
      hoveredArrow = null;
    }
  }

  function onClick() {
    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.set(ARROW_LAYER);
    const hits = raycaster.intersectObjects(arrows.map(a => a.arrow));
    if (hits.length > 0) {
      const arrow     = hits[0].object;
      const direction = arrow.userData.moveDirection;
      const label     = arrow.userData.label;

      const originalScale = arrow.scale.clone();
      new TWEEN.Tween(arrow.scale)
        .to(originalScale.clone().multiplyScalar(0.8), 100)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => {
          new TWEEN.Tween(arrow.scale).to(originalScale, 100)
            .easing(TWEEN.Easing.Quadratic.Out).start();
        }).start();

      if (onArrowClick) onArrowClick(direction, label);
    }
  }

  return {
    arrows,
    labelStats,
    handleMouseMove: onMouseMove,
    handleClick: onClick,
    syncLabels,

    updatePositions() {
      const LIMIT = 24; // scene is ±25, hide arrow when already at edge

      for (const { arrow, labelSprite } of arrows) {
        const dir  = arrow.userData.moveDirection;

        // Check if moving one step further in this direction would exceed the limit
        const next = cube.position.clone().addScaledVector(dir, 2.5);
        const atEdge = Math.abs(next.x) > LIMIT
                    || Math.abs(next.y) > LIMIT
                    || Math.abs(next.z) > LIMIT;

        const visible = !atEdge;
        arrow.visible       = visible;
        labelSprite.visible = visible;

        if (visible) {
          arrow.position.copy(cube.position).addScaledVector(dir, offset);
          labelSprite.position.copy(cube.position)
            .addScaledVector(dir, offset + 1.3)
            .add(new THREE.Vector3(0, 0.5, 0));
        }
      }
    },

    update() { TWEEN.update(); },

    toggleLabels(isVisible) {
      for (const { labelSprite } of arrows) {
        if (isVisible) { if (!scene.children.includes(labelSprite)) scene.add(labelSprite); }
        else scene.remove(labelSprite);
      }
    },

    toggleArrows(isVisible) {
      for (const { arrow } of arrows) {
        if (isVisible) {
          if (!scene.children.includes(arrow)) scene.add(arrow);
          arrow.layers.set(ARROW_LAYER);
        } else scene.remove(arrow);
      }
    }
  };
}