/* js/renderer.js — All canvas drawing */

const Renderer = (() => {
  let canvas, ctx, W, H;

  // Particle system
  const particles = [];

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    W = canvas.width = canvas.offsetWidth || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || window.innerHeight;
  }

  function getSize() { return { W, H }; }

  /* ---- Particles ---- */
  function spawnParticles(x, y, count, colorFn) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, decay: 0.025 + Math.random() * 0.03,
        size: 3 + Math.random() * 5,
        color: colorFn ? colorFn(i) : '#c8a87a',
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /* ---- Background ---- */
  function drawBackground(stackX, stackY) {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#b8e4f5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.45);

    // Clouds
    drawCloud(W * 0.15, H * 0.08, 70, 28);
    drawCloud(W * 0.6, H * 0.12, 55, 22);
    drawCloud(W * 0.82, H * 0.06, 45, 18);

    // Ground
    const gnd = ctx.createLinearGradient(0, H * 0.45, 0, H);
    gnd.addColorStop(0, '#5da832');
    gnd.addColorStop(0.3, '#4a8c28');
    gnd.addColorStop(1, '#3a7020');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);

    // Dirt area around center
    ctx.save();
    ctx.globalAlpha = 0.6;
    const dirtGrad = ctx.createRadialGradient(stackX, stackY + 8, 0, stackX, stackY, 100);
    dirtGrad.addColorStop(0, '#c8a87a');
    dirtGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = dirtGrad;
    ctx.beginPath();
    ctx.ellipse(stackX, stackY + 10, 110, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Boundary circle
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(stackX, stackY + 10, W * 0.38, H * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Trees left
    drawTree(W * 0.05, H * 0.46, 28, 65);
    drawTree(W * 0.08, H * 0.47, 22, 50);
    // Trees right
    drawTree(W * 0.93, H * 0.46, 25, 60);
    drawTree(W * 0.90, H * 0.47, 20, 50);

    // Ground texture lines
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#2e6010';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const gy = H * 0.5 + i * H * 0.07;
      ctx.moveTo(0, gy); ctx.lineTo(W, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCloud(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - w * 0.35, y + 4, w * 0.55, h * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y + 6, w * 0.5, h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTree(x, y, r, h) {
    ctx.save();
    // Trunk
    ctx.fillStyle = '#6b3d14';
    ctx.fillRect(x - 5, y - 12, 10, 40);
    // Foliage layers
    const colors = ['#2e8b2e', '#33a633', '#27762a'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y - h * 0.25 - i * h * 0.22, r * (1 - i * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- Stack Zone ---- */
  function drawStackZone(sx, sy, radius) {
    ctx.save();
    ctx.strokeStyle = CONFIG.COLOR.stackZoneBorder;
    ctx.fillStyle = CONFIG.COLOR.stackZone;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ---- Stones ---- */
  const STONE_COLORS = [
    '#9e8e6e', '#b0a080', '#8a7a5a', '#a89878', '#c0b090', '#7a6a4a', '#d0c0a0'
  ];
  const STONE_DARK = [
    '#7a6a4e', '#8c7c60', '#665a3a', '#847460', '#9c8e6c', '#5e4e2a', '#a89c7c'
  ];

  function drawStoneStack(stones, stackX, stackY) {
    // Draw the stacked stones (not fallen)
    const stacked = stones.filter(s => !s.fallen && !s.collected && s.placed !== true);
    stacked.forEach(s => {
      drawStoneAt(s.x, s.y, s.w, s.h, s.angle || 0, s.idx, s.highlight);
    });
  }

  function drawScatteredStones(stones) {
    stones.forEach(s => {
      if (s.fallen && !s.collected) {
        drawStoneAt(s.x, s.y, s.w, s.h, s.angle || 0, s.idx, s.highlight);
      }
    });
  }

  function drawPlacedStones(stones) {
    stones.forEach(s => {
      if (s.placed) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        drawStoneAt(s.x, s.y, s.w, s.h, s.angle || 0, s.idx, false);
        ctx.restore();
      }
    });
  }

  function drawHeldStones(stones, players) {
    stones.forEach(s => {
      if (!s.collected || !s.heldBy) return;
      const holder = players.find(p => p.team === s.heldBy && p.holdingStone);
      if (!holder) return;
      drawStoneAt(holder.x + (holder.team === 'human' ? 16 : -16), holder.y + 4, s.w, s.h, 0, s.idx, true);
    });
  }

  function drawStoneAt(x, y, w, h, angle, idx, highlight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, w * 0.5 + 2, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stone body
    const base = STONE_COLORS[idx % STONE_COLORS.length];
    const dark = STONE_DARK[idx % STONE_DARK.length];
    const grad = ctx.createLinearGradient(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5);
    grad.addColorStop(0, lighten(base, 20));
    grad.addColorStop(0.4, base);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    // Rounded irregular polygon for flat stone feel
    flatStone(ctx, 0, 0, w, h, idx);
    ctx.fill();
    // Highlight sheen
    if (highlight) {
      ctx.fillStyle = 'rgba(255,255,150,0.4)';
      ctx.beginPath();
      flatStone(ctx, 0, 0, w, h, idx);
      ctx.fill();
    }
    // Edge detail
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    flatStone(ctx, 0, 0, w, h, idx);
    ctx.stroke();
    ctx.restore();
  }

  // Draw an irregular flat-stone polygon
  function flatStone(ctx, cx, cy, w, h, seed) {
    const pts = 7;
    const offsets = [0, 0.12, -0.08, 0.1, -0.1, 0.08, -0.05]; // seeded wobble
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const r = (seed % 3 === 0 ? w : w * 0.9 + offsets[i] * w * 0.5);
      const rx = w * 0.5 + (seed % 2) * w * 0.05;
      const ry = h * 0.5;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function lighten(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  /* ---- Ball ---- */
  function drawBall(ball, isHuman) {
    if (!ball || !ball.active) return;
    // Trail
    ball.trail.forEach((pt, i) => {
      const alpha = (i / ball.trail.length) * 0.3;
      const r = CONFIG.BALL_RADIUS * (0.3 + i / ball.trail.length * 0.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHuman ? CONFIG.COLOR.ballHuman : CONFIG.COLOR.ballCpu;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Ball body
    ctx.save();
    const ballColor = isHuman ? CONFIG.COLOR.ballHuman : CONFIG.COLOR.ballCpu;
    const grad = ctx.createRadialGradient(
      ball.x - CONFIG.BALL_RADIUS * 0.35, ball.y - CONFIG.BALL_RADIUS * 0.35,
      CONFIG.BALL_RADIUS * 0.1,
      ball.x, ball.y, CONFIG.BALL_RADIUS
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.4, ballColor);
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    ctx.shadowColor = ballColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, CONFIG.BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // Tennis seam lines
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, CONFIG.BALL_RADIUS * 0.6, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, CONFIG.BALL_RADIUS * 0.6, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- Trajectory Preview ---- */
  function drawTrajectory(fromX, fromY, vx, vy, steps) {
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(255,240,80,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let px = fromX, py = fromY, pvx = vx, pvy = vy;
    ctx.moveTo(px, py);
    for (let i = 0; i < (steps || 25); i++) {
      pvy += CONFIG.GRAVITY;
      px += pvx; py += pvy;
      if (py > H) break;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow head at last point
    ctx.fillStyle = 'rgba(255,240,80,0.7)';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---- Player Characters ---- */
  function drawPlayer(p) {
    if (p.hidden) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    const alpha = p.hit ? 0.35 : (p.celebrating ? 1 : 1);
    ctx.globalAlpha = alpha;

    const isHuman = p.team === 'human';
    const bodyColor = isHuman ? '#e8734a' : '#4a73c8';
    const shirtColor = isHuman ? '#ffe878' : '#ff8a8a';
    const skinColor = '#f5c5a0';
    const scale = p.scale || 1;
    ctx.scale(scale * (p.facing < 0 ? -1 : 1), scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#3a2a1a';
    const legSway = Math.sin(p.walkCycle || 0) * 4;
    ctx.fillRect(-8, 14, 7, 16 + legSway * 0.3);
    ctx.fillRect(1, 14, 7, 16 - legSway * 0.3);

    // Body/shirt
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    const bx = -10, by = -4, bw = 20, bh = 20, br = 4;
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();
    // Collar
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-4, -4, 8, 5);

    // Arms
    const armSwing = Math.sin((p.walkCycle || 0) + Math.PI) * 6;
    if (p.throwing) {
      // Throw pose
      ctx.fillStyle = skinColor;
      ctx.save();
      ctx.translate(isHuman ? 12 : -12, -2);
      ctx.rotate(isHuman ? -0.8 : 0.8);
      ctx.fillRect(-4, -16, 7, 16);
      ctx.restore();
    } else {
      ctx.fillStyle = skinColor;
      ctx.fillRect(isHuman ? 10 : -17, 0 + armSwing, 7, 12);
      ctx.fillRect(isHuman ? -17 : 10, 0 - armSwing, 7, 12);
    }

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -14, 12, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.arc(0, -20, 10, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-4, -14, 2, 0, Math.PI * 2);
    ctx.arc(4, -14, 2, 0, Math.PI * 2);
    ctx.fill();

    // Smile or worried expression
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (p.celebrating) {
      ctx.arc(0, -11, 4, 0, Math.PI);
    } else if (p.hit) {
      ctx.arc(0, -9, 3, Math.PI, 0);
    } else {
      ctx.arc(0, -11, 3, 0, Math.PI);
    }
    ctx.stroke();

    // Held stone indicator
    if (p.holdingStone) {
      ctx.fillStyle = '#9e8e6e';
      ctx.beginPath();
      ctx.ellipse(isHuman ? 16 : -16, 4, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash effect
    if (p.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${p.hitFlash})`;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Name tag (small)
    if (!p.hit) {
      ctx.save();
      ctx.fillStyle = isHuman ? 'rgba(255,232,120,0.85)' : 'rgba(255,138,138,0.85)';
      ctx.font = 'bold 10px Hind Siliguri, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y - 42 * (p.scale || 1));
      ctx.restore();
    }
  }

  /* ---- Aim indicator ---- */
  function drawAimIndicator(fromX, fromY, targetX, targetY) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,80,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cross-hair at target
    ctx.strokeStyle = 'rgba(255,80,80,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(targetX - 20, targetY); ctx.lineTo(targetX + 20, targetY);
    ctx.moveTo(targetX, targetY - 20); ctx.lineTo(targetX, targetY + 20);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- Throw position marker ---- */
  function drawThrowMarker(x, y, isHuman) {
    ctx.save();
    ctx.strokeStyle = isHuman ? 'rgba(255,232,120,0.8)' : 'rgba(255,138,138,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.BALL_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = isHuman ? 'rgba(255,232,120,0.15)' : 'rgba(255,138,138,0.15)';
    ctx.fill();
    ctx.fillStyle = isHuman ? 'rgba(255,232,120,0.85)' : 'rgba(255,138,138,0.85)';
    ctx.font = 'bold 10px Hind Siliguri, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isHuman ? 'তোমার দল' : 'CPU', x, y - 26);
    ctx.restore();
  }

  /* ---- Placed stone preview ---- */
  function drawStonePlacePreview(x, y) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#c8a87a';
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---- Screen shake ---- */
  let shakeX = 0, shakeY = 0, shakeMag = 0;
  function shake(mag) { shakeMag = mag; }
  function updateShake() {
    if (shakeMag > 0.2) {
      shakeX = (Math.random() - 0.5) * shakeMag * 2;
      shakeY = (Math.random() - 0.5) * shakeMag * 2;
      shakeMag *= 0.8;
    } else {
      shakeX = shakeY = shakeMag = 0;
    }
  }

  /* ---- HUD overlays ---- */
  function drawHUDOverlay(gs) {
    // Draw round attempts dots
    if (gs.state !== 'MENU') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W / 2 - 50, H - 36, 100, 24);
      ctx.restore();
    }
  }

  /* ---- Master render ---- */
  function render(gs) {
    updateShake();
    updateParticles();

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);

    drawBackground(gs.stackX, gs.stackY);
    drawStackZone(gs.stackX, gs.stackY, CONFIG.STACK_ZONE_RADIUS);

    // Draw placed stones
    drawPlacedStones(gs.stones);
    drawHeldStones(gs.stones, [...gs.humanPlayers, ...gs.cpuPlayers]);

    // Draw stacked stones
    if (!gs.knocked) {
      drawStoneStack(gs.stones, gs.stackX, gs.stackY);
    } else {
      drawScatteredStones(gs.stones);
    }

    // Draw players (bottom layers first)
    [...gs.humanPlayers, ...gs.cpuPlayers]
      .sort((a, b) => a.y - b.y)
      .forEach(p => drawPlayer(p));

    // Trajectory preview
    if (gs.aiming && gs.aimVx !== undefined && gs.attackingTeam === 'human') {
      drawTrajectory(gs.throwFrom.x, gs.throwFrom.y, gs.aimVx, gs.aimVy, 30);
    }

    // Aim indicator line (human attacker only)
    if (gs.state === 'AIMING' && gs.mouseX && gs.attackingTeam === 'human') {
      drawAimIndicator(gs.throwFrom.x, gs.throwFrom.y, gs.mouseX, gs.mouseY);
    }
    if (gs.state === 'REBUILDING' && gs.attackingTeam === 'cpu' && !gs.ball && gs.mouseX) {
      drawAimIndicator(gs.throwFrom.x, gs.throwFrom.y, gs.mouseX, gs.mouseY);
    }

    // Throw position marker
    if ((gs.state === 'AIMING' || gs.state === 'REBUILDING') && gs.throwFrom) {
      drawThrowMarker(gs.throwFrom.x, gs.throwFrom.y, gs.attackingTeam === 'human');
    }

    // Stone placement preview
    if (gs.state === 'REBUILDING' && gs.heldStone !== null && gs.mouseX) {
      drawStonePlacePreview(gs.mouseX, gs.mouseY);
    }

    // Balls
    if (gs.ball) drawBall(gs.ball, gs.ball.owner === 'human');

    drawParticles();

    ctx.restore();
  }

  return {
    init, resize, getSize,
    render,
    spawnParticles, updateParticles, drawParticles,
    drawBall, drawBackground, drawStoneStack, drawScatteredStones,
    shake,
  };
})();
