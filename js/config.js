/* js/config.js — Game configuration & difficulty parameters */

const CONFIG = {
  // Canvas & Physics
  TARGET_FPS: 60,
  GRAVITY: 0.4,
  BALL_RADIUS: 12,
  STONE_COUNT: 7,

  // Stone stack geometry
  STACK_LAYERS: [
    { count: 1, y_offset: 0 },   // bottom: 3
    { count: 2, y_offset: 0 },
    { count: 2, y_offset: 0 },
    { count: 2, y_offset: 0 },   // actually we use flat stones differently
  ],

  // Play-area fractions
  STACK_X_FRAC: 0.5,
  STACK_Y_FRAC: 0.58,

  // Player positions (as fraction of canvas)
  HUMAN_THROW_X_FRAC: 0.12,
  HUMAN_THROW_Y_FRAC: 0.72,
  CPU_THROW_X_FRAC: 0.88,
  CPU_THROW_Y_FRAC: 0.28,

  // Human player characters on field
  HUMAN_PLAYERS: 3,
  CPU_PLAYERS: 3,

  // Ball throw power
  MIN_POWER: 12,
  MAX_POWER: 22,
  PLAYER_SPEED: 4.2,
  AI_SPEED: 2.7,
  PLAYER_RADIUS: 22,
  FIELD_MARGIN: 32,

  // Max attempts per attack turn
  MAX_ATTEMPTS: 3,

  // Rebuilding: placement zone radius
  STACK_ZONE_RADIUS: 38,

  // Difficulty presets
  DIFFICULTY: {
    easy: {
      cpuThrowAccuracy: 0.45,   // fraction of perfect aim
      cpuReactionMs: 1800,
      cpuRebuildSpeed: 0.6,
      cpuDefendAccuracy: 0.40,
      cpuMissChance: 0.55,
      cpuMoveSpeed: 2.1,
    },
    medium: {
      cpuThrowAccuracy: 0.70,
      cpuReactionMs: 1100,
      cpuRebuildSpeed: 1.0,
      cpuDefendAccuracy: 0.62,
      cpuMissChance: 0.35,
      cpuMoveSpeed: 2.7,
    },
    hard: {
      cpuThrowAccuracy: 0.90,
      cpuReactionMs: 550,
      cpuRebuildSpeed: 1.5,
      cpuDefendAccuracy: 0.80,
      cpuMissChance: 0.18,
      cpuMoveSpeed: 3.3,
    },
  },

  // Colors
  COLOR: {
    grass: '#4a8c28',
    grassDark: '#3a7020',
    dirt: '#c8a87a',
    sky: '#87ceeb',
    stackZone: 'rgba(255,240,100,0.25)',
    stackZoneBorder: 'rgba(255,220,50,0.8)',
    ballHuman: '#ccff44',
    ballCpu: '#ff6644',
    stoneBase: '#9e8e6e',
    humanTeam: '#ffe878',
    cpuTeam: '#ff8a8a',
  },
};

// Mutable game settings (changed by UI)
const SETTINGS = {
  difficulty: 'easy',
  matchLength: 5,
  soundOn: true,
};
