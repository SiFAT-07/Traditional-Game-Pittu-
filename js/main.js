/* js/main.js — Entry point */

(function () {
  'use strict';

  window.addEventListener('DOMContentLoaded', () => {
    // Initialize audio context (will be activated on first user interaction)
    Audio.init();

    // Initialize UI event bindings
    UI.init();

    // Initialize game engine (canvas binding, resize listener)
    const canvas = document.getElementById('game-canvas');
    Game.init(canvas);

    // Handle visibility change (pause when tab hidden)
    document.addEventListener('visibilitychange', () => {
      const gs = Game.getGS();
      if (!gs) return;
      if (document.hidden && !gs.paused && gs.state !== 'MENU') {
        Game.togglePause();
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      Renderer.resize();
      // If game running, reset canvas-dependent positions
      const gs = Game.getGS();
      if (gs && gs.state !== 'MENU') {
        const { W, H } = Renderer.getSize();
        gs.W = W; gs.H = H;
        gs.stackX = W * CONFIG.STACK_X_FRAC;
        gs.stackY = H * CONFIG.STACK_Y_FRAC;
        gs.throwFrom = { x: W * CONFIG.HUMAN_THROW_X_FRAC, y: H * CONFIG.HUMAN_THROW_Y_FRAC };
        gs.cpuThrowPos = { x: W * CONFIG.CPU_THROW_X_FRAC, y: H * CONFIG.CPU_THROW_Y_FRAC };
      }
    });

    console.log('পিট্টু গেম লোড হয়েছে! খেলা শুরু করুন।');
  });
})();
