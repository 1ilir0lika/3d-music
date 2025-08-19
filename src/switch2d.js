export function switchTo2D(spheres) {
  spheres.forEach(sphere => {
    sphere.userData.originalY = sphere.position.y;
    sphere.position.y = 0;
  });
}