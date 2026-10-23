/* js/game.js — Core game state machine, round management, physics integration */

const Game = (() => {
  /* =============================================
     GAME STATE ENUM
  ============================================= */
  const STATE = {
    MENU: 'MENU',
    INTRO: 'INTRO',
    AIMING: 'AIMING',
    BALL_THROWN: 'BALL_THROWN',
    STONES_SCATTERED: 'STONES_SCATTERED',
    REBUILDING: 'REBUILDING',
    DEFENDER_THROW: 'DEFENDER_THROW',
    ROUND_END: 'ROUND_END',
    MATCH_END: 'MATCH_END',
    PAUSED: 'PAUSED',
  };

  /* =============================================
     INTERNAL STATE
  ============================================= */
  let gs = null; // game state object
  let prevState = null;
  let animFrame = null;
  let lastTime = 0;
  let shakeQueue = 0;

  /* =============================================
     INITIALIZATION
  ============================================= */
  function init(canvasEl) {
    Renderer.init(canvasEl);
    bindCanvasEvents(canvasEl);
    bindMobileControls();
    document.getElementById('defend-throw-btn').addEventListener('click', () => {
      if (!gs || gs.paused || gs.state !== STATE.REBUILDING || gs.attackingTeam !== 'cpu' ||
          (gs.ball && gs.ball.active)) return;
      Audio.resume();
      const target = gs.cpuPlayers.find(p => !p.hit);
      humanDefendThrow(target ? target.x : gs.stackX, target ? target.y : gs.stackY);
    });
  }

  function startMatch() {
    // Cancel any running loop
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

    const { W, H } = Renderer.getSize();
    const stackX = W * CONFIG.STACK_X_FRAC;
    const stackY = H * CONFIG.STACK_Y_FRAC;

    gs = {
      state: STATE.AIMING,
      paused: false,
      attackingTeam: 'human', // first attacker
      defendingTeam: 'cpu',
      humanScore: 0,
      cpuScore: 0,
      round: 1,
      attempts: 0,
      maxAttempts: CONFIG.MAX_ATTEMPTS,
      knocked: false,
      roundOver: false,
      ball: null,
      W, H,
      stackX, stackY,
      stones: buildStones(stackX, stackY, W),
      humanPlayers: buildPlayers('human', W, H),
      cpuPlayers: buildPlayers('cpu', W, H),
      throwFrom: { x: W * CONFIG.HUMAN_THROW_X_FRAC, y: H * CONFIG.HUMAN_THROW_Y_FRAC },
      cpuThrowPos: { x: W * CONFIG.CPU_THROW_X_FRAC, y: H * CONFIG.CPU_THROW_Y_FRAC },
      mouseX: 0, mouseY: 0,
      aiming: false, aimVx: 0, aimVy: 0,
      heldStone: null,
      pendingStone: null,
      controlledPlayerIdx: 0,
      keys: {},
      cameraX: 0,
      cameraY: 0,
      defenderThrowPending: false,
      defenderCooldown: 0,
      statusMsg: 'লক্ষ্য ঠিক করো ও বল ছোড়ো!',
      turnIndicator: 'তোমার পালা — আক্রমণ',
    };

    AI.reset();
    updateHUD();
    changeState(STATE.AIMING);
    loop(performance.now());
  }

  /* =============================================
     STONE BUILDER
  ============================================= */
  function buildStones(sx, sy, W) {
    // 7 flat stones stacked in a pyramid-like pile
    // Layer arrangement: 3 on bottom, 2 middle, 2 top
    const layout = [
      { x: -18, y: 10 },
      { x:   0, y: 10 },
      { x:  18, y: 10 },
      { x: -10, y:  0 },
      { x:  10, y:  0 },
      { x:  -5, y: -10 },
      { x:   5, y: -10 },
    ];
    return layout.map((off, i) => ({
      idx: i,
      x: sx + off.x, y: sy + off.y,
      ox: sx + off.x, oy: sy + off.y, // original position
      w: 22 + (i % 3) * 3,
      h: 10 + (i % 2) * 2,
      angle: (i % 3 - 1) * 0.08,
      vx: 0, vy: 0, spin: 0,
      fallen: false, collected: false, placed: false,
      heldBy: null,
      highlight: false,
      canvasW: W,
    }));
  }

  /* =============================================
     PLAYER BUILDER
  ============================================= */
  function buildPlayers(team, W, H) {
    const count = CONFIG.HUMAN_PLAYERS;
    const isHuman = team === 'human';
    const names = isHuman
      ? ['রাফি', 'সামি', 'তুহিন']
      : ['CPU১', 'CPU২', 'CPU৩'];

    // Positions spread on their side of the field
    const baseX = isHuman ? W * 0.22 : W * 0.78;
    const baseY = H * 0.65;
    return Array.from({ length: count }, (_, i) => ({
      idx: i,
      team,
      name: names[i],
      x: baseX + (i - 1) * 55,
      y: baseY + (i % 2) * 28,
      targetX: null, targetY: null,
      hit: false,
      alive: true,
      eliminated: false,
      hidden: false,
      celebrating: false,
      throwing: false,
      holdingStone: false,
      walkCycle: i * 1.5,
      scale: 0.85 + i * 0.04,
      hitFlash: 0,
      facing: isHuman ? 1 : -1,
    }));
  }

  /* =============================================
     STATE MACHINE
  ============================================= */
  function changeState(newState) {
    prevState = gs.state;
    gs.state = newState;
    gs.stateTime = 0;
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) {
      gameScreen.classList.toggle('defending',
        newState === STATE.REBUILDING && gs.attackingTeam === 'cpu');
    }

    switch (newState) {
      case STATE.AIMING:
        if (gs.attackingTeam === 'human') {
          gs.statusMsg = 'লক্ষ্য ঠিক করো ও বল ছোড়ো!';
          gs.turnIndicator = `তোমার পালা — আক্রমণ (চেষ্টা: ${gs.attempts + 1}/${gs.maxAttempts})`;
          document.getElementById('aim-hint').style.display = 'block';
        } else {
          gs.statusMsg = 'কম্পিউটার লক্ষ্য ঠিক করছে...';
          gs.turnIndicator = 'কম্পিউটারের পালা — আক্রমণ';
          document.getElementById('aim-hint').style.display = 'none';
          AI.resetAttack();
        }
        updateHUD();
        break;

      case STATE.BALL_THROWN:
        document.getElementById('aim-hint').style.display = 'none';
        gs.statusMsg = 'বল উড়ছে...';
        break;

      case STATE.STONES_SCATTERED:
        gs.ball = null;
        gs.knocked = true;
        gs.statusMsg = 'দারুণ! সাতটি পাথর পড়ে গেছে!';
        Renderer.shake(14);
        Audio.sfx.hit();
        spawnStoneParticles();
        // Transition to rebuilding after short delay
        gs.scatterTimer = 90; // ~1.5s at 60fps
        break;

      case STATE.REBUILDING:
        if (gs.attackingTeam === 'human') {
          gs.statusMsg = 'এবার পাথরগুলো সাজাও!';
          gs.turnIndicator = 'পাথর সাজাও — কম্পিউটার রক্ষা করছে!';
          document.getElementById('aim-hint').textContent = 'পাথরে ট্যাপ করো, তারপর সেখানে দৌড়াও';
          document.getElementById('aim-hint').style.display = 'block';
        } else {
          gs.statusMsg = 'কম্পিউটার পাথর সাজাচ্ছে...';
          gs.turnIndicator = 'তোমার পালা — CPU-কে বল ছুড়ে থামাও!';
          document.getElementById('aim-hint').textContent = 'CPU খেলোয়াড়কে লক্ষ্য করে ক্লিক করো / বল ছোড়ো';
          document.getElementById('aim-hint').style.display = 'block';
          AI.resetRebuild();
          AI.resetDefend();
        }
        gs.defenderCooldown = 80;
        gs.heldStone = null;
        updateHUD();
        break;

      case STATE.ROUND_END:
        gs.aiming = false;
        gs.heldStone = null;
        document.getElementById('aim-hint').style.display = 'none';
        break;

      case STATE.MATCH_END:
        break;

      case STATE.PAUSED:
        break;
    }
  }

  /* =============================================
     MAIN GAME LOOP
  ============================================= */
  function loop(timestamp) {
    animFrame = requestAnimationFrame(loop);
    const dt = Math.min(timestamp - lastTime, 50); // cap dt to avoid spiral-of-death
    lastTime = timestamp;

    if (!gs || gs.state === STATE.MENU) return;
    if (gs.paused) {
      Renderer.render(gs);
      return;
    }

    update(dt);
    Renderer.render(gs);
  }

  function update(dt) {
    gs.stateTime = (gs.stateTime || 0) + dt;

    updateHumanMovement(dt);
    updateCpuMovement(dt);

    // Update walk animations and generic targets
    [...gs.humanPlayers, ...gs.cpuPlayers].forEach(p => {
      const moving = p.targetX !== null && !p.hit;
      p.walkCycle += moving ? 0.08 : 0.025;
      if (p.hitFlash > 0) p.hitFlash -= 0.05;
      // Move toward target
      if (p.targetX !== null) {
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const spd = p.team === 'cpu'
          ? CONFIG.DIFFICULTY[SETTINGS.difficulty].cpuMoveSpeed
          : CONFIG.PLAYER_SPEED;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          p.x += (dx / Math.max(1, Math.sqrt(dx * dx + dy * dy))) * spd;
          p.y += (dy / Math.max(1, Math.sqrt(dx * dx + dy * dy))) * spd;
          if (dx) p.facing = dx > 0 ? 1 : -1;
        } else {
          p.targetX = null; p.targetY = null;
        }
      }
      constrainPlayer(p);
    });

    const thrower = gs.humanPlayers.find(p => p.idx === gs.controlledPlayerIdx && !p.hit)
      || gs.humanPlayers.find(p => !p.hit);
    if (thrower && gs.attackingTeam === 'human' && gs.state === STATE.AIMING) {
      gs.throwFrom.x = thrower.x;
      gs.throwFrom.y = thrower.y;
    }
    if (thrower && gs.attackingTeam === 'cpu' && gs.state === STATE.REBUILDING) {
      gs.throwFrom.x = thrower.x;
      gs.throwFrom.y = thrower.y;
    }
    if (gs.pendingStone !== null) {
      const stone = gs.stones.find(s => s.idx === gs.pendingStone);
      const player = gs.humanPlayers.find(p => p.idx === gs.controlledPlayerIdx && !p.hit)
        || gs.humanPlayers.find(p => !p.hit);
      if (stone && player && Physics.dist(player.x, player.y, stone.x, stone.y) < 28) {
        stone.collected = true;
        stone.heldBy = 'human';
        stone.fallen = false;
        gs.heldStone = stone.idx;
        gs.pendingStone = null;
        player.holdingStone = true;
        Audio.sfx.pickStone();
        showToast('পাথর তুলে নিলে!');
        updateHUD();
      }
    }

    // State-specific updates
    switch (gs.state) {
      case STATE.AIMING:
        updateAiming(dt);
        break;
      case STATE.BALL_THROWN:
        updateBallInFlight(dt);
        break;
      case STATE.STONES_SCATTERED:
        updateStonesScattered(dt);
        break;
      case STATE.REBUILDING:
        updateRebuilding(dt);
        break;
      case STATE.ROUND_END:
        // Handled by overlay
        break;
    }

    function updateHumanMovement(dt) {
      const player = gs && gs.humanPlayers.find(p => p.idx === gs.controlledPlayerIdx && !p.hit);
      if (!player) return;
      const keys = gs.keys || {};
      let dx = 0, dy = 0;
      if (keys.w || keys.arrowup) dy -= 1;
      if (keys.s || keys.arrowdown) dy += 1;
      if (keys.a || keys.arrowleft) dx -= 1;
      if (keys.d || keys.arrowright) dx += 1;
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        player.targetX = null;
        player.targetY = null;
        player.x += dx / length * CONFIG.PLAYER_SPEED * Math.min(2, dt / 16.67);
        player.y += dy / length * CONFIG.PLAYER_SPEED * Math.min(2, dt / 16.67);
        if (dx) player.facing = dx > 0 ? 1 : -1;
        player.walkCycle += 0.18;
      }
    }

    function updateCpuMovement(dt) {
      if (!gs) return;
      const alive = gs.cpuPlayers.filter(p => !p.hit);
      if (gs.state === STATE.REBUILDING && gs.attackingTeam === 'cpu') {
        // AI module assigns a worker target; the remaining defenders patrol the stack.
        alive.slice(1).forEach((p, i) => {
          if (p.targetX === null) {
            p.targetX = gs.stackX + (i ? 65 : -65);
            p.targetY = gs.stackY + 45;
          }
        });
      } else if (gs.knocked) {
        alive.forEach((p, i) => {
          if (p.targetX === null) {
            p.targetX = gs.stackX + (i - 1) * 75;
            p.targetY = gs.stackY + 100 + i * 18;
          }
        });
      }
    }

    function constrainPlayer(p) {
      const margin = CONFIG.FIELD_MARGIN;
      p.x = Math.max(margin, Math.min(gs.W - margin, p.x));
      p.y = Math.max(gs.H * 0.46, Math.min(gs.H - margin, p.y));
    }

    // Update scattered stone physics
    gs.stones.forEach(s => {
      if (s.fallen && !s.collected) {
        Physics.stepStone(s, gs.H * 0.85, 0.78);
        s.canvasW = gs.W;
      }
    });
  }

  function updateAiming(dt) {
    // Update trajectory preview for human player
    if (gs.attackingTeam === 'human' && gs.mouseX && gs.mouseY) {
      const from = gs.throwFrom;
      const speed = 17;
      const v = Physics.computeThrow(from.x, from.y, gs.mouseX, gs.mouseY, speed);
      gs.aimVx = v.vx; gs.aimVy = v.vy;
      gs.aiming = true;
    }

    if (gs.attackingTeam === 'cpu') {
      AI.update(gs, dt, {
        onThrow: (vx, vy) => {
          gs.ball = Physics.createBall(
            gs.cpuThrowPos.x, gs.cpuThrowPos.y, vx, vy, 'cpu'
          );
          gs.cpuPlayers[0].throwing = true;
          Audio.sfx.throw();
          gs.attempts++;
          changeState(STATE.BALL_THROWN);
          setTimeout(() => { if (gs.cpuPlayers[0]) gs.cpuPlayers[0].throwing = false; }, 500);
        },
      });
    }
  }

  function updateBallInFlight(dt) {
    if (!gs.ball || !gs.ball.active) {
      handleBallDone();
      return;
    }

    Physics.stepBall(gs.ball, CONFIG.GRAVITY);

    // Check ball vs stone stack
    if (!gs.knocked) {
      let hitAny = false;
      gs.stones.forEach(s => {
        if (s.fallen || s.collected) return;
        if (Physics.segmentCircleOverlap(
          gs.ball.prevX, gs.ball.prevY, gs.ball.x, gs.ball.y,
          s.x, s.y, CONFIG.BALL_RADIUS + (s.w + s.h) / 4 + 4
        )) {
          hitAny = true;
        }
      });
      if (hitAny) {
        Physics.scatterStones(gs.stones, gs.ball.x, gs.ball.y, 5);
        gs.ball.active = false;
        gs.attempts = 0;
        changeState(STATE.STONES_SCATTERED);
        return;
      }
    }

    // Check ball vs human players (defender throw)
    if (gs.knocked && gs.attackingTeam === 'human' && gs.ball.owner === 'cpu') {
      gs.humanPlayers.forEach(p => {
        if (!gs.ball || !gs.ball.active || p.hit || p.hidden) return;
        if (Physics.segmentCircleOverlap(
          gs.ball.prevX, gs.ball.prevY, gs.ball.x, gs.ball.y,
          p.x, p.y, CONFIG.BALL_RADIUS + 10
        )) {
          hitPlayer(p);
          if (gs.ball) gs.ball.active = false;
        }
      });
    }

    // Check ball vs cpu players (human defends)
    if (gs.knocked && gs.attackingTeam === 'cpu' && gs.ball.owner === 'human') {
      gs.cpuPlayers.forEach(p => {
        if (!gs.ball || !gs.ball.active || p.hit || p.hidden) return;
        if (Physics.segmentCircleOverlap(
          gs.ball.prevX, gs.ball.prevY, gs.ball.x, gs.ball.y,
          p.x, p.y, CONFIG.BALL_RADIUS + 10
        )) {
          hitPlayer(p);
          if (gs.ball) gs.ball.active = false;
          gs.statusMsg = 'CPU খেলোয়াড় আউট!';
        }
      });
    }

    if (!gs.ball) return;

    // Ball out of bounds
    const { W, H } = gs;
    if (gs.ball.x < -50 || gs.ball.x > W + 50 || gs.ball.y > H + 80) {
      gs.ball.active = false;
      handleBallDone();
    }
  }

  function handleBallDone() {
    gs.ball = null;
    if (gs.knocked) {
      // Ball was a defender throw — go back to rebuilding
      checkRoundCondition();
      if (gs.state !== STATE.ROUND_END && gs.state !== STATE.MATCH_END) {
        changeState(STATE.REBUILDING);
      }
      const next = gs.humanPlayers.find(player => !player.hit && player.alive);
      if (next) {
        gs.controlledPlayerIdx = next.idx;
        gs.throwFrom.x = next.x;
        gs.throwFrom.y = next.y;
        showToast(`${next.name} এখন খেলবে — দৌড়াও ও পাথর সাজাও!`);
      }
    } else {
      p.alive = false;
      p.eliminated = true;
      // Attacking ball missed (attempts already incremented at throw time)
      if (gs.attempts >= gs.maxAttempts) {
        gs.statusMsg = 'সব চেষ্টা শেষ! পালা বদল হচ্ছে...';
        updateHUD();
        setTimeout(() => {
          if (!gs) return;
          switchTeams();
          nextRound();
        }, 1500);
      } else {
        Audio.sfx.miss();
        gs.statusMsg = `বল মিস! আবার চেষ্টা করো (${gs.attempts}/${gs.maxAttempts})`;
        updateHUD();
        changeState(STATE.AIMING);
      }
    }
  }

  function updateStonesScattered(dt) {
    gs.scatterTimer = (gs.scatterTimer || 0) - 1;
    if (gs.scatterTimer <= 0) {
      changeState(STATE.REBUILDING);
    }
  }

  function updateRebuilding(dt) {
    // Decrement defender cooldown
    if (gs.defenderCooldown > 0) gs.defenderCooldown--;

    // Human rebuilds, CPU defends
    if (gs.attackingTeam === 'human') {
      // AI defender throws periodically
      if (gs.defenderCooldown <= 0 && !gs.ball) {
        AI.update(gs, dt, {
          onDefenderThrow: (vx, vy, thrower) => {
            gs.ball = Physics.createBall(thrower.x, thrower.y, vx, vy, 'cpu');
            thrower.throwing = true;
            Audio.sfx.throw();
            gs.statusMsg = 'সাবধান! কম্পিউটার বল ছুড়ছে!';
            changeState(STATE.BALL_THROWN);
            setTimeout(() => {
              if (thrower) thrower.throwing = false;
            }, 400);
            const diff = CONFIG.DIFFICULTY[SETTINGS.difficulty];
            gs.defenderCooldown = Math.floor((diff.cpuReactionMs / 16) * 2 + 60);
          },
        });
      }
    }

    // CPU rebuilds, human defends
    if (gs.attackingTeam === 'cpu') {
      AI.update(gs, dt, {
        onPickStone: (idx) => {
          const stone = gs.stones.find(s => s.idx === idx);
          if (stone && stone.fallen && !stone.collected) {
            stone.collected = true;
            stone.heldBy = 'cpu';
            stone.fallen = false;
            Audio.sfx.pickStone();
            const worker = gs.cpuPlayers.find(p => !p.hit);
            if (worker) worker.holdingStone = true;
            updateHUD();
          }
        },
        onPlaceStone: (idx, tx, ty) => {
          const stone = gs.stones.find(s => s.idx === idx && s.heldBy === 'cpu');
          if (stone) {
            stone.collected = false;
            stone.heldBy = null;
            stone.fallen = false;
            stone.placed = true;
            stone.x = tx; stone.y = ty;
            stone.vx = 0; stone.vy = 0;
            Audio.sfx.placeStone();
            const worker = gs.cpuPlayers.find(p => p.holdingStone);
            if (worker) worker.holdingStone = false;
            updateHUD();
          }
          checkRebuildComplete();
        },
      });
    }

    // Human defending CPU: allow human to throw ball (handled by input)
    checkRoundCondition();
  }

  /* =============================================
     STONE COLLECTION & PLACEMENT (human action)
  ============================================= */
  function humanPickStone(mouseX, mouseY) {
    if (gs.state !== STATE.REBUILDING) return false;
    if (gs.attackingTeam !== 'human') return false;
    if (!gs.humanPlayers.some(p => p.alive && !p.hit)) return false;
    if (gs.heldStone !== null || gs.pendingStone !== null) return false;

    // Find nearest fallen stone to click
    let best = null, bestDist = 40;
    gs.stones.forEach(s => {
      if (!s.fallen || s.collected || s.idx === gs.pendingStone) return;
      const d = Physics.dist(mouseX, mouseY, s.x, s.y);
      if (d < bestDist) { bestDist = d; best = s; }
    });

    if (best) {
      gs.pendingStone = best.idx;
      const player = gs.humanPlayers.find(p => p.idx === 0 && !p.hit);
      if (player) {
        player.targetX = best.x;
        player.targetY = best.y;
      }
      Audio.sfx.pickStone();
      showToast('পাথরের কাছে দৌড়াও!');
      updateHUD();
      return true;
    }
    return false;
  }

  function humanPlaceStone(mouseX, mouseY) {
    if (gs.state !== STATE.REBUILDING) return false;
    if (gs.attackingTeam !== 'human') return false;
    if (!gs.humanPlayers.some(p => p.alive && !p.hit)) return false;
    if (gs.heldStone === null) return false;

    // Must be within stack zone
    const d = Physics.dist(mouseX, mouseY, gs.stackX, gs.stackY);
    if (d > CONFIG.STACK_ZONE_RADIUS + 20) {
      showToast('এখানে রাখা যাবে না! মাঝখানে রাখো।');
      return false;
    }

    const stone = gs.stones.find(s => s.idx === gs.heldStone);
    if (stone) {
      stone.collected = false;
      stone.heldBy = null;
      stone.fallen = false;
      stone.placed = true;
      stone.x = mouseX;
      stone.y = mouseY;
      gs.heldStone = null;
      Audio.sfx.placeStone();
      const player = gs.humanPlayers.find(p => p.holdingStone);
      if (player) player.holdingStone = false;
      updateHUD();
      checkRebuildComplete();
    }
    return true;
  }

  /* =============================================
     ROUND CONDITION CHECKS
  ============================================= */
  function checkRebuildComplete() {
    const allPlaced = gs.stones.every(s => s.placed);
    if (allPlaced) {
      // Attacker wins round!
      Audio.sfx.roundWin();
      if (gs.attackingTeam === 'human') {
        gs.statusMsg = 'সব পাথর সাজানো সম্পন্ন! তুমি রাউন্ড জিতেছ!';
        gs.humanScore++;
      } else {
        gs.statusMsg = 'কম্পিউটার পাথর সাজিয়েছে! CPU রাউন্ড জিতেছে!';
        gs.cpuScore++;
      }
      // Celebration
      gs.humanPlayers.forEach(p => { p.celebrating = true; });
      gs.cpuPlayers.forEach(p => { p.celebrating = true; });
      setTimeout(() => endRound(gs.attackingTeam === 'human' ? 'human' : 'cpu', 'rebuild'), 400);
    }
  }

  function checkRoundCondition() {
    if (gs.state === STATE.ROUND_END || gs.state === STATE.MATCH_END) return;

    // Check if all attackers eliminated
    if (gs.attackingTeam === 'human') {
      const activeHumans = gs.humanPlayers.filter(p => !p.hit);
      if (!activeHumans.length) {
        Audio.sfx.roundLose();
        gs.cpuScore++;
        gs.statusMsg = 'তোমার সব খেলোয়াড় আউট! কম্পিউটার রাউন্ড জিতেছে।';
        endRound('cpu', 'eliminated');
      }
    } else {
      const activeCPU = gs.cpuPlayers.filter(p => !p.hit);
      if (!activeCPU.length) {
        Audio.sfx.roundWin();
        gs.humanScore++;
        gs.statusMsg = 'CPU-র সব খেলোয়াড় আউট! তুমি রাউন্ড জিতেছ!';
        endRound('human', 'eliminated');
      }
    }
  }

  function hitPlayer(p) {
    p.hit = true;
    p.hitFlash = 1;
    p.celebrating = false;
    Audio.sfx.playerHit();
    if (p.team === 'human') {
      p.alive = false;
      p.eliminated = true;
      gs.statusMsg = 'তোমার খেলোয়াড় বলের আঘাতে আউট হয়েছে!';
      gs.pendingStone = null;
      // Drop held stone
      if (gs.heldStone !== null) {
        const stone = gs.stones.find(s => s.idx === gs.heldStone);
        if (stone) {
          stone.collected = false;
          stone.heldBy = null;
          stone.fallen = true;
          stone.vy = -1;
          stone.vx = (Math.random() - 0.5) * 3;
          gs.heldStone = null;
          gs.pendingStone = null;
        }
        p.holdingStone = false;
      }
      const next = gs.humanPlayers.find(player => !player.hit && player.alive);
      if (next) {
        gs.controlledPlayerIdx = next.idx;
        gs.throwFrom.x = next.x;
        gs.throwFrom.y = next.y;
        showToast(`${next.name} এখন খেলবে — দৌড়াও ও পাথর সাজাও!`);
      }
    } else {
      // CPU player hit — drop any held stone
      const heldByThis = gs.stones.find(s => s.heldBy === 'cpu');
      if (heldByThis) {
        heldByThis.collected = false;
        heldByThis.heldBy = null;
        heldByThis.fallen = true;
        heldByThis.vy = -1;
        heldByThis.vx = (Math.random() - 0.5) * 3;
        p.holdingStone = false;
        AI.resetRebuild();
      }
    }
    updateHUD();
    showToast(p.team === 'human' ? `${p.name} আউট!` : `${p.name} আউট!`);
    checkRoundCondition();
  }

  function endRound(winner, reason) {
    if (gs.state === STATE.ROUND_END || gs.state === STATE.MATCH_END) return;
    gs.ball = null;
    changeState(STATE.ROUND_END);
    updateHUD();

    // Check match end
    if (gs.humanScore >= SETTINGS.matchLength) {
      setTimeout(() => endMatch('human'), 300);
    } else if (gs.cpuScore >= SETTINGS.matchLength) {
      setTimeout(() => endMatch('cpu'), 300);
    } else {
      UI.showRoundResult(winner, reason, gs.humanScore, gs.cpuScore);
    }
  }

  function endMatch(winner) {
    changeState(STATE.MATCH_END);
    Audio.sfx[winner === 'human' ? 'matchWin' : 'matchLose']();
    UI.showMatchResult(winner, gs.humanScore, gs.cpuScore);
  }

  /* =============================================
     NEXT ROUND
  ============================================= */
  function nextRound() {
    const { W, H } = Renderer.getSize();
    const stackX = W * CONFIG.STACK_X_FRAC;
    const stackY = H * CONFIG.STACK_Y_FRAC;
    gs.round++;
    gs.stones = buildStones(stackX, stackY, W);
    gs.knocked = false;
    gs.ball = null;
    gs.heldStone = null;
    gs.pendingStone = null;
    gs.controlledPlayerIdx = 0;
    gs.attempts = 0;
    gs.humanPlayers.forEach(p => {
      p.hit = false; p.alive = true; p.eliminated = false; p.celebrating = false; p.throwing = false;
      p.holdingStone = false; p.hitFlash = 0;
    });
    gs.cpuPlayers.forEach(p => {
      p.hit = false; p.alive = true; p.eliminated = false; p.celebrating = false; p.throwing = false;
      p.holdingStone = false; p.hitFlash = 0;
    });
    gs.throwFrom = { x: W * CONFIG.HUMAN_THROW_X_FRAC, y: H * CONFIG.HUMAN_THROW_Y_FRAC };
    gs.cpuThrowPos = { x: W * CONFIG.CPU_THROW_X_FRAC, y: H * CONFIG.CPU_THROW_Y_FRAC };
    AI.reset();
    updateHUD();
    changeState(STATE.AIMING);
  }

  function switchTeams() {
    const tmp = gs.attackingTeam;
    gs.attackingTeam = gs.defendingTeam;
    gs.defendingTeam = tmp;
  }

  /* =============================================
     HUMAN INPUT
  ============================================= */
  function bindCanvasEvents(canvas) {
    // Mouse
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      gs && (gs.mouseX = e.clientX - r.left, gs.mouseY = e.clientY - r.top);
    });
    canvas.addEventListener('click', e => {
      if (!gs || gs.paused) return;
      Audio.resume();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      handleClick(mx, my);
    });

    // Touch
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (!gs || gs.paused) return;
      Audio.resume();
      const r = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const mx = t.clientX - r.left, my = t.clientY - r.top;
      gs.mouseX = mx; gs.mouseY = my;
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!gs || gs.paused) return;
      const r = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const mx = t.clientX - r.left, my = t.clientY - r.top;
      handleClick(mx, my);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!gs) return;
      const r = canvas.getBoundingClientRect();
      const t = e.touches[0];
      gs.mouseX = t.clientX - r.left;
      gs.mouseY = t.clientY - r.top;
    }, { passive: false });

    // Keyboard
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (gs) gs.keys[key] = true;
        e.preventDefault();
      }
      if ((e.code === 'Space' || e.key === 'Enter') && gs && gs.state === STATE.REBUILDING &&
          gs.attackingTeam === 'cpu' && (!gs.ball || !gs.ball.active)) {
        e.preventDefault();
        const target = gs.cpuPlayers.find(p => !p.hit);
        humanDefendThrow(target ? target.x : gs.stackX, target ? target.y : gs.stackY);
      }

      if (e.key === 'p' || e.key === 'P') togglePause();
    });
    window.addEventListener('keyup', e => {
      if (gs) delete gs.keys[e.key.toLowerCase()];
    });
  }

  function bindMobileControls() {
    document.querySelectorAll('#mobile-controls [data-key]').forEach(button => {
      const key = button.dataset.key;
      const set = (value, event) => {
        event.preventDefault();
        if (gs) gs.keys[key] = value;
      };
      button.addEventListener('pointerdown', e => set(true, e));
      button.addEventListener('pointerup', e => set(false, e));
      button.addEventListener('pointercancel', e => set(false, e));
      button.addEventListener('pointerleave', e => set(false, e));
    });
  }

  function handleClick(mx, my) {
    if (!gs || gs.state === STATE.MENU || gs.state === STATE.ROUND_END || gs.state === STATE.MATCH_END) return;

    if (gs.state === STATE.AIMING && gs.attackingTeam === 'human') {
      humanThrow(mx, my);
      return;
    }

    if (gs.state === STATE.REBUILDING && gs.attackingTeam === 'human') {
      if (gs.heldStone !== null) {
        humanPlaceStone(mx, my);
      } else {
        humanPickStone(mx, my);
      }
      return;
    }

    // Human defends during CPU rebuild: throw ball at CPU player
    if (gs.state === STATE.REBUILDING && gs.attackingTeam === 'cpu' &&
        (!gs.ball || !gs.ball.active)) {
      humanDefendThrow(mx, my);
    }
  }

  function humanThrow(mx, my) {
    const from = gs.throwFrom;
    const speed = 17;
    const v = Physics.computeThrow(from.x, from.y, mx, my, speed);
    gs.ball = Physics.createBall(from.x, from.y, v.vx, v.vy, 'human');
    gs.humanPlayers[0].throwing = true;
    Audio.sfx.throw();
    gs.attempts++;
    changeState(STATE.BALL_THROWN);
    setTimeout(() => { if (gs.humanPlayers[0]) gs.humanPlayers[0].throwing = false; }, 500);
  }

  function humanDefendThrow(mx, my) {
    if (!gs || gs.state !== STATE.REBUILDING || gs.attackingTeam !== 'cpu' ||
        (gs.ball && gs.ball.active)) return;
    const thrower = gs.humanPlayers.find(p => !p.hit);
    if (!thrower) return;
    const speed = 16;
    const v = Physics.computeThrow(thrower.x, thrower.y, mx, my, speed);
    gs.ball = Physics.createBall(thrower.x, thrower.y, v.vx, v.vy, 'human');
    thrower.throwing = true;
    Audio.sfx.throw();
    changeState(STATE.BALL_THROWN);
    setTimeout(() => { if (thrower) thrower.throwing = false; }, 400);
    gs.statusMsg = 'বল ছুড়েছ! CPU খেলোয়াড়কে লাগাও!';
    document.getElementById('aim-hint').textContent = 'বল উড়ছে... CPU-কে আঘাত করো!';
  }

  /* =============================================
     PAUSE / RESUME
  ============================================= */
  function togglePause() {
    if (!gs) return;
    gs.paused = !gs.paused;
    document.getElementById('overlay-pause').style.display = gs.paused ? 'flex' : 'none';
    document.getElementById('btn-pause').textContent = gs.paused ? '▶' : '⏸';
  }

  function resume() {
    gs.paused = false;
    document.getElementById('overlay-pause').style.display = 'none';
    document.getElementById('btn-pause').textContent = '⏸';
  }

  function restart() {
    if (animFrame) cancelAnimationFrame(animFrame);
    startMatch();
  }

  function stopLoop() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    gs = null;
  }

  /* =============================================
     HUD UPDATE
  ============================================= */
  function updateHUD() {
    if (!gs) return;
    document.getElementById('score-human').textContent = toBengaliNum(gs.humanScore);
    document.getElementById('score-cpu').textContent = toBengaliNum(gs.cpuScore);
    document.getElementById('status-msg').textContent = gs.statusMsg || '';
    document.getElementById('turn-indicator').textContent = gs.turnIndicator || '';

    // Stones remaining
    const remaining = gs.stones.filter(s => !s.placed).length;
    const total = gs.stones.length;
    if (gs.knocked) {
      document.getElementById('stones-left').textContent =
        `পাথর বাকি: ${toBengaliNum(remaining)}/${toBengaliNum(total)}`;
    } else {
      document.getElementById('stones-left').textContent = '';
    }

    // Player dots
    renderPlayerDots('human-players-hud', gs.humanPlayers);
    renderPlayerDots('cpu-players-hud', gs.cpuPlayers);
  }

  function renderPlayerDots(id, players) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    players.forEach(p => {
      const dot = document.createElement('div');
      dot.className = 'player-dot' + (p.hit ? ' out' : '');
      el.appendChild(dot);
    });
  }

  /* =============================================
     UTILITIES
  ============================================= */
  function spawnStoneParticles() {
    if (!gs) return;
    Renderer.spawnParticles(gs.stackX, gs.stackY, 30, (i) => {
      const dustColors = ['#c8a87a', '#a08860', '#d4b88a', '#8a7050'];
      return dustColors[i % dustColors.length];
    });
  }

  const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBengaliNum(n) {
    return String(n).replace(/[0-9]/g, d => BANGLA_DIGITS[+d]);
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'fadeInOut 2.5s ease forwards';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 2600);
  }

  function getGS() { return gs; }
  function getSTATES() { return STATE; }

  return {
    init, startMatch, nextRound, switchTeams,
    togglePause, resume, restart, stopLoop,
    updateHUD, showToast, toBengaliNum,
    getGS, getSTATES,
  };
})();
