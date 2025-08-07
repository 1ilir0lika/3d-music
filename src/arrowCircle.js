import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

const ARROW_LAYER = 1;
const LABEL_LAYER = 2;

export function createArrowCircle(scene, cube, camera,renderer, onArrowClick) {
  const arrows = []; // { arrow, labelSprite }
  const labelStats = {};
  let hoveredArrow = null;

  const labels = ['N', 'E', 'S', 'W', 'UP', 'DOWN'];
  const opposites = {
    N: 'S', E: 'W', S: 'N', W: 'E',
    UP: 'DOWN', DOWN: 'UP'
  };

  const arrowLength = 1.2;
  const arrowHeight = 0.8;
  const arrowColor = 0x999999;
  const offset = 2;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function createTextSprite(text) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1, 1, 1);
    sprite.layers.set(LABEL_LAYER);
    sprite.renderOrder = 1000;

    return sprite;
  }

  function createArrowMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(arrowLength * 0.6, arrowHeight * 0.5);
    shape.lineTo(arrowLength * 0.6, arrowHeight * 0.2);
    shape.lineTo(arrowLength, arrowHeight * 0.2);
    shape.lineTo(arrowLength, -arrowHeight * 0.2);
    shape.lineTo(arrowLength * 0.6, -arrowHeight * 0.2);
    shape.lineTo(arrowLength * 0.6, -arrowHeight * 0.5);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshStandardMaterial({
      color: arrowColor,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      emissive: new THREE.Color(0x000000)
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.layers.set(ARROW_LAYER);
    mesh.renderOrder = 999;

    return mesh;
  }

  function applyHoverStyle(arrow) {
    arrow.material.emissive.setHex(0x555555);
  }

  function resetArrowStyle(arrow) {
    arrow.material.emissive.setHex(0x000000);
  }

  function animateClick(arrow) {
    const originalScale = arrow.scale.clone();
    const targetScale = originalScale.clone().multiplyScalar(0.8);
    new TWEEN.Tween(arrow.scale)
      .to(targetScale, 100)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onComplete(() => {
        new TWEEN.Tween(arrow.scale)
          .to(originalScale, 100)
          .easing(TWEEN.Easing.Quadratic.Out)
          .start();
      })
      .start();
  }

  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.set(ARROW_LAYER);

    const intersects = raycaster.intersectObjects(arrows.map(a => a.arrow));
    if (intersects.length > 0) {
      if (hoveredArrow !== intersects[0].object) {
        if (hoveredArrow) resetArrowStyle(hoveredArrow);
        hoveredArrow = intersects[0].object;
        applyHoverStyle(hoveredArrow);
      }
    } else {
      if (hoveredArrow) resetArrowStyle(hoveredArrow);
      hoveredArrow = null;
    }
  }

  function onClick() {
    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.set(ARROW_LAYER);

    const intersects = raycaster.intersectObjects(arrows.map(a => a.arrow));
    if (intersects.length > 0) {
      const arrow = intersects[0].object;
      const label = arrow.userData.label;
      const direction = arrow.userData.moveDirection;

      const opposite = opposites[label];
      labelStats[label] += 0.5;
      if (labelStats[opposite] !== undefined) {
        labelStats[opposite] -= 0.5;
      }

      animateClick(arrow);

      if (onArrowClick) onArrowClick(direction, label);
    }
  }

  const directions = [
    { label: 'N',    vector: [ 0,  0,  -1], rotation: [ Math.PI / 2, 0, Math.PI / 2    ] },
    { label: 'E',    vector: [ 1,  0,   0], rotation: [ -Math.PI / 2, 0, Math.PI       ] },
    { label: 'S',    vector: [ 0,  0,   1], rotation: [ -Math.PI / 2, 0, Math.PI / 2   ] },
    { label: 'W',    vector: [-1,  0,   0], rotation: [ -Math.PI / 2, Math.PI, Math.PI ] },
    { label: 'UP',   vector: [ 0,  1,   0], rotation: [ 0, 0, -Math.PI / 2             ] },
    { label: 'DOWN', vector: [ 0, -1,   0], rotation: [ 0, 0, Math.PI / 2              ] }
  ];

  for (const { label, vector, rotation } of directions) {
    const dir = new THREE.Vector3(...vector).normalize();
    const arrow = createArrowMesh();
    arrow.rotation.set(...rotation);
    arrow.userData = { moveDirection: dir, label };

    const offsetVec = dir.clone().multiplyScalar(offset);
    const pos = cube.position.clone().add(offsetVec);
    arrow.position.copy(pos);

    const labelSprite = createTextSprite(label);
    const labelOffset = dir.clone().multiplyScalar(1.3).add(new THREE.Vector3(0, 0.5, 0));
    labelSprite.position.copy(cube.position.clone().add(labelOffset));

    scene.add(arrow);
    scene.add(labelSprite);

    arrows.push({ arrow, labelSprite });
    labelStats[label] = 0;
  }

  return {
    arrows,
    labelStats,
  
    handleMouseMove: onMouseMove,
    handleClick: onClick,
  
    updatePositions() {
      for (const { arrow, labelSprite } of arrows) {
        const dir = arrow.userData.moveDirection;
        const offsetVec = dir.clone().multiplyScalar(offset);
        const pos = cube.position.clone().add(offsetVec);
        arrow.position.copy(pos);
  
        const labelOffset = dir.clone().multiplyScalar(1.3).add(new THREE.Vector3(0, 0.5, 0));
        labelSprite.position.copy(cube.position.clone().add(labelOffset));
      }
    },
  
    update() {
      TWEEN.update();
    },
  
    toggleLabels(isVisible) {
      for (const { labelSprite } of arrows) {
        if (isVisible) {
          if (!scene.children.includes(labelSprite)) scene.add(labelSprite);
        } else {
          scene.remove(labelSprite);
        }
      }
    },
  
    toggleArrows(isVisible) {
      for (const { arrow } of arrows) {
        if (isVisible) {
          if (!scene.children.includes(arrow)) scene.add(arrow);
          arrow.layers.set(ARROW_LAYER); // Reapply layer
          scene.add(arrow);
        } else {
          scene.remove(arrow);
        }
      }
    }
  };
}  