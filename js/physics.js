/* js/physics.js — Ball physics, collision, stone scatter */

const Physics = (() => {

  // Simple 2D ball state
  function createBall(x, y, vx, vy, owner) {
    return { x, y, prevX: x, prevY: y, vx, vy, owner, active: true, trail: [] };
  }

  function stepBall(ball, gravity) {
    if (!ball.active) return;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    // Store trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 18) ball.trail.shift();
    ball.vy += gravity;
    ball.x += ball.vx;
    ball.y += ball.vy;
  }

  // Returns true if two circles overlap
  function circlesOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }

  function segmentCircleOverlap(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lengthSq)) : 0;
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    return circlesOverlap(nearX, nearY, 0, cx, cy, radius);
  }

  // AABB vs circle
  function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < cr * cr;
  }

  // Scatter stones from impact
  function scatterStones(stones, impactX, impactY, strength) {
    stones.forEach(s => {
      if (s.placed || s.collected) return;
      const dx = s.x - impactX, dy = s.y - impactY;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (strength * 4) / (dist * 0.2 + 1);
      s.vx = (dx / dist) * force * (0.6 + Math.random() * 0.8);
      s.vy = (dy / dist) * force * (0.6 + Math.random() * 0.8) - Math.random() * 3;
      s.spin = (Math.random() - 0.5) * 0.3;
      s.fallen = true;
    });
  }

  // Update a scattered stone's physics
  function stepStone(stone, groundY, friction) {
    if (!stone.fallen) return;
    stone.vy += 0.35; // gravity for stone
    stone.x += stone.vx;
    stone.y += stone.vy;
    stone.angle = (stone.angle || 0) + (stone.spin || 0);
    // Ground bounce
    if (stone.y >= groundY) {
      stone.y = groundY;
      stone.vy *= -0.25;
      stone.vx *= (friction || 0.78);
      stone.spin *= 0.6;
      if (Math.abs(stone.vy) < 0.5) stone.vy = 0;
      if (Math.abs(stone.vx) < 0.3) stone.vx = 0;
    }
    // Side walls
    if (stone.x < 20) { stone.x = 20; stone.vx *= -0.3; }
    if (stone.x > (stone.canvasW || 800) - 20) { stone.x = (stone.canvasW || 800) - 20; stone.vx *= -0.3; }
  }

  // Distance util
  function dist(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  // Compute throw velocity toward target with a parabolic arc
  function computeThrow(fromX, fromY, toX, toY, speed) {
    const dx = toX - fromX, dy = toY - fromY;
    const d = Math.sqrt(dx * dx + dy * dy);
    const t = d / speed;
    const vx = dx / t;
    const vy = dy / t - 0.5 * CONFIG.GRAVITY * t;
    return { vx, vy };
  }

  return { createBall, stepBall, circlesOverlap, segmentCircleOverlap, rectCircle, scatterStones, stepStone, dist, computeThrow };
})();
