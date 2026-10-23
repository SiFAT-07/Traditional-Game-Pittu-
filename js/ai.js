/* js/ai.js — Computer opponent FSM */

const AI = (() => {
  // AI state
  let aiState = 'IDLE';
  let timer = 0;
  let targetStoneIdx = -1;
  let targetPlayerIdx = -1;
  let phase = null; // 'attack' | 'defend' | 'rebuild'

  const STATES = {
    IDLE: 'IDLE',
    THINKING: 'THINKING',
    MOVING: 'MOVING',
    AIMING: 'AIMING',
    THROWING: 'THROWING',
    REBUILDING: 'REBUILDING',
    WAITING: 'WAITING',
  };

  function getDiff() {
    return CONFIG.DIFFICULTY[SETTINGS.difficulty];
  }

  function reset() {
    aiState = STATES.IDLE;
    timer = 0;
    targetStoneIdx = -1;
    targetPlayerIdx = -1;
    phase = null;
  }

  /* =============================================
     AI UPDATE — called once per frame when AI active
     gs = game state reference (mutable)
     callbacks = { onThrow(vx,vy), onPickStone(idx), onPlaceStone(idx,x,y), onAiHit() }
  ============================================= */
  function update(gs, dt, callbacks) {
    if (!gs || gs.paused) return;

    const diff = getDiff();
    timer -= dt;

    // AI attacks (throwing phase)
    if (gs.state === 'AIMING' && gs.attackingTeam === 'cpu') {
      handleAttack(gs, diff, callbacks, dt);
      return;
    }

    // AI defends (human is rebuilding)
    if (gs.state === 'REBUILDING' && gs.attackingTeam === 'human') {
      handleDefend(gs, diff, callbacks, dt);
      return;
    }

    // AI rebuilds (cpu is rebuilding)
    if (gs.state === 'REBUILDING' && gs.attackingTeam === 'cpu') {
      handleRebuild(gs, diff, callbacks, dt);
      return;
    }

    if (gs.state === 'BALL_THROWN' && gs.attackingTeam === 'cpu') {
      // Wait for ball to resolve
      aiState = STATES.WAITING;
      return;
    }
  }

  /* ---- AI Attacks ---- */
  let attackTimer = 0;
  function handleAttack(gs, diff, callbacks, dt) {
    if (aiState !== STATES.AIMING && aiState !== STATES.THROWING) {
      aiState = STATES.AIMING;
      // reaction delay
      attackTimer = diff.cpuReactionMs;
    }

    attackTimer -= dt;
    if (attackTimer > 0) return;

    // Choose target: center of stone stack, with accuracy noise
    const stackX = gs.stackX;
    const stackY = gs.stackY;
    const noise = (1 - diff.cpuThrowAccuracy);

    // Random miss chance
    if (Math.random() < diff.cpuMissChance && gs.attempts > 0) {
      // Intentional miss
      const missX = stackX + (Math.random() - 0.5) * 200;
      const missY = stackY + (Math.random() - 0.5) * 120;
      throwAt(gs, missX, missY, callbacks);
    } else {
      const targetX = stackX + (Math.random() - 0.5) * noise * 120;
      const targetY = stackY + (Math.random() - 0.5) * noise * 60;
      throwAt(gs, targetX, targetY, callbacks);
    }

    aiState = STATES.THROWING;
    attackTimer = 99999; // reset so we don't fire again this state
  }

  function throwAt(gs, tx, ty, callbacks) {
    // Compute velocity
    const from = gs.cpuThrowPos;
    const speed = 16 + Math.random() * 3;
    const v = Physics.computeThrow(from.x, from.y, tx, ty, speed);
    callbacks.onThrow(v.vx, v.vy);
    aiState = STATES.WAITING;
  }

  /* ---- AI Defends ---- */
  let defendTimer = 0;
  let defendTarget = null;
  function handleDefend(gs, diff, callbacks, dt) {
    if (gs.ball && gs.ball.active) return; // ball already in flight

    if (aiState !== STATES.WAITING && aiState !== STATES.AIMING) {
      aiState = STATES.AIMING;
      defendTimer = diff.cpuReactionMs * 0.9;
      // Choose target: active human player nearest to stack
      const active = gs.humanPlayers.filter(p => !p.hit && !p.hidden);
      if (!active.length) return;
      active.sort((a, b) =>
        Physics.dist(a.x, a.y, gs.stackX, gs.stackY) -
        Physics.dist(b.x, b.y, gs.stackX, gs.stackY)
      );
      defendTarget = active[0];
    }

    defendTimer -= dt;
    if (defendTimer > 0) return;
    if (!defendTarget || defendTarget.hit) {
      // Re-pick
      aiState = STATES.IDLE;
      return;
    }

    const thrower = gs.cpuPlayers.find(p => !p.hit);
    if (!thrower) return;

    // Aim at target with noise
    const noise = (1 - diff.cpuDefendAccuracy);
    const predictedX = defendTarget.x + (defendTarget.targetX !== null
      ? (defendTarget.targetX - defendTarget.x) * 5 : 0);
    const predictedY = defendTarget.y + (defendTarget.targetY !== null
      ? (defendTarget.targetY - defendTarget.y) * 5 : 0);
    const intentionalMiss = Math.random() < diff.cpuMissChance * 0.55;
    const spread = intentionalMiss ? 220 : 150;
    const aimDx = predictedX - gs.cpuPlayers.find(p => !p.hit).x;
    const aimDy = predictedY - gs.cpuPlayers.find(p => !p.hit).y;
    const aimLength = Math.max(1, Math.hypot(aimDx, aimDy));
    const perpendicularX = -aimDy / aimLength;
    const perpendicularY = aimDx / aimLength;
    const missOffset = intentionalMiss ? (Math.random() < 0.5 ? -1 : 1) * 260 : 0;
    const tx = intentionalMiss
      ? predictedX + (Math.random() - 0.5) * 220
      : predictedX + perpendicularX * missOffset + (Math.random() - 0.5) * noise * spread;
    const ty = intentionalMiss
      ? gs.H * 0.46 - 120
      : predictedY + perpendicularY * missOffset + (Math.random() - 0.5) * noise * spread * 0.6;

    const speed = 14 + Math.random() * 4;
    const v = Physics.computeThrow(thrower.x, thrower.y, tx, ty, speed);
    callbacks.onDefenderThrow(v.vx, v.vy, thrower);

    aiState = STATES.WAITING;
    defendTimer = (diff.cpuReactionMs * 1.5) + 800; // cooldown before next throw
  }

  /* ---- AI Rebuilds ---- */
  let rebuildTimer = 0;
  let rebuildStoneIdx = -1;
  let rebuildPhase = 'pick'; // 'pick' | 'move_to_stone' | 'place'
  let rebuildWorker = null;

  function handleRebuild(gs, diff, callbacks, dt) {
    rebuildTimer -= dt * diff.cpuRebuildSpeed;
    if (rebuildTimer > 0) return;

    if (rebuildPhase === 'pick') {
      // Find next stone to collect
      const stone = gs.stones.find(s => s.fallen && !s.collected && !s.placed);
      if (!stone) {
        // All stones picked up — try to place
        rebuildPhase = 'place';
        rebuildTimer = diff.cpuReactionMs * 0.5;
        return;
      }
      rebuildStoneIdx = stone.idx;
      rebuildPhase = 'move_to_stone';
      rebuildTimer = diff.cpuReactionMs * 0.8;
      // Move a CPU character toward the stone
      rebuildWorker = gs.cpuPlayers.find(p => !p.hit);
      if (rebuildWorker) {
        rebuildWorker.targetX = stone.x;
        rebuildWorker.targetY = stone.y;
      }
    } else if (rebuildPhase === 'move_to_stone') {
      // Simulate moving and picking
      const stone = gs.stones.find(s => s.idx === rebuildStoneIdx);
      if (!stone || stone.collected) { rebuildPhase = 'pick'; return; }
      if (!rebuildWorker || Physics.dist(rebuildWorker.x, rebuildWorker.y, stone.x, stone.y) > 30) {
        if (rebuildWorker) {
          rebuildWorker.targetX = stone.x;
          rebuildWorker.targetY = stone.y;
        }
        rebuildTimer = 120;
        return;
      }
      callbacks.onPickStone(rebuildStoneIdx);
      rebuildPhase = 'place';
      rebuildTimer = diff.cpuReactionMs * 0.25;
    } else if (rebuildPhase === 'place') {
      // Carry the stone to the stack before placing it.
      const stone = gs.stones.find(s => s.idx === rebuildStoneIdx && s.collected);
      if (!stone) {
        // Look for any collected stone
        const held = gs.stones.find(s => s.collected && s.heldBy === 'cpu');
        if (held) {
          rebuildStoneIdx = held.idx;
        } else {
          rebuildPhase = 'pick';
          rebuildTimer = diff.cpuReactionMs * 0.3;
          return;
        }
      }
      if (!rebuildWorker || Physics.dist(rebuildWorker.x, rebuildWorker.y, gs.stackX, gs.stackY) > 38) {
        if (rebuildWorker) {
          rebuildWorker.targetX = gs.stackX;
          rebuildWorker.targetY = gs.stackY;
        }
        rebuildTimer = 120;
        return;
      }
      // Small offset for each placed stone
      const offset = getStackOffset(gs.stones.filter(s => s.placed).length);
      callbacks.onPlaceStone(rebuildStoneIdx, gs.stackX + offset.x, gs.stackY + offset.y);
      rebuildPhase = 'pick';
      rebuildTimer = diff.cpuReactionMs * 0.35;
      rebuildStoneIdx = -1;
    }
  }

  // Reset rebuild state
  function resetRebuild() {
    rebuildTimer = 0;
    rebuildStoneIdx = -1;
    rebuildPhase = 'pick';
    rebuildWorker = null;
  }

  // Generate stack position for nth placed stone
  function getStackOffset(n) {
    // Simple layered stack arrangement
    const layer = [
      { x: -12, y: 6 },
      { x: 0, y: 6 },
      { x: 12, y: 6 },
      { x: -8, y: -2 },
      { x: 8, y: -2 },
      { x: -4, y: -10 },
      { x: 4, y: -10 },
    ];
    return layer[n % layer.length] || { x: 0, y: 0 };
  }

  function setAiState(s) { aiState = s; }
  function getAiState() { return aiState; }

  // Reset defend timer (called when ball is thrown and a new defend cycle starts)
  function resetDefend() {
    aiState = STATES.IDLE;
    defendTimer = 0;
    defendTarget = null;
  }

  function resetAttack() {
    aiState = STATES.IDLE;
    attackTimer = 0;
  }

  return {
    update, reset, resetRebuild, resetDefend, resetAttack,
    getAiState, setAiState, getStackOffset,
    STATES,
  };
})();
