'use strict';

// Shared, dependency-free traversal math. Units are map pixels for movement and tiles for camera.
const Traversal = (() => {
  const damp = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, dt));
  function velocity(x, y, tx, ty, rate, dt) {
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
    const k = d ? Math.min(1, rate * dt / d) : 0;
    return { x: x + dx * k, y: y + dy * k };
  }
  // Sweep a camera-sized volume, including the near-plane margin, from the actual look target.
  // Return a fraction of the segment; pulling in is immediate, easing out is handled by the caller.
  function cameraFraction(from, to, topAt, radius = 0.22) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(length / 0.08));
    const offsets = [[0, 0], [-radius, -radius], [-radius, radius], [radius, -radius], [radius, radius]];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = from.x + dx * t, z = from.z + dz * t, y = from.y + dy * t;
      if (offsets.some(([ox, oz]) => { const top = topAt(x + ox, z + oz, y); return top > 0 && y - radius < top; })) {
        return Math.max(0, (i - 1) / steps);
      }
    }
    return 1;
  }
  return { damp, velocity, cameraFraction };
})();
if (typeof module !== 'undefined') module.exports = Traversal;
