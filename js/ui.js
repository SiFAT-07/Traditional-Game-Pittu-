/* js/ui.js — Menu, overlay, and panel management */

const UI = (() => {

  function init() {
    // Screen navigation
    bindMenuButtons();
    bindSettingsButtons();
    bindGameButtons();
    bindOverlayButtons();
    bindOptionGroups();
  }

  /* ---- Screen transitions ---- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  /* ---- Main menu ---- */
  function bindMenuButtons() {
    document.getElementById('btn-play').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Audio.resume();
      showScreen('screen-game');
      Game.startMatch();
    });

    document.getElementById('btn-howto').addEventListener('click', () => {
      Audio.sfx.uiClick();
      showScreen('screen-howto');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      Audio.sfx.uiClick();
      showScreen('screen-settings');
    });

    document.getElementById('btn-howto-back').addEventListener('click', () => {
      Audio.sfx.uiClick();
      showScreen('screen-menu');
    });

    document.getElementById('btn-settings-back').addEventListener('click', () => {
      Audio.sfx.uiClick();
      showScreen('screen-menu');
    });
  }

  /* ---- Settings ---- */
  function bindSettingsButtons() {
    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle');
    soundBtn.addEventListener('click', () => {
      Audio.sfx.uiClick();
      SETTINGS.soundOn = !SETTINGS.soundOn;
      Audio.setEnabled(SETTINGS.soundOn);
      soundBtn.textContent = SETTINGS.soundOn ? '🔊 চালু' : '🔇 বন্ধ';
      soundBtn.classList.toggle('active', SETTINGS.soundOn);
    });
    // Set initial state
    soundBtn.classList.toggle('active', SETTINGS.soundOn);
  }

  function bindOptionGroups() {
    // Difficulty
    document.querySelectorAll('#difficulty-group .btn-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-group .btn-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SETTINGS.difficulty = btn.dataset.val;
        Audio.sfx.uiClick();
      });
    });

    // Match length
    document.querySelectorAll('#matchlen-group .btn-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#matchlen-group .btn-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SETTINGS.matchLength = parseInt(btn.dataset.val);
        Audio.sfx.uiClick();
      });
    });
  }

  /* ---- Game controls ---- */
  function bindGameButtons() {
    document.getElementById('btn-pause').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Game.togglePause();
    });
  }

  /* ---- Overlay buttons ---- */
  function bindOverlayButtons() {
    // Pause overlay
    document.getElementById('btn-resume').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Game.resume();
    });

    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Game.resume();
      hideOverlay('overlay-pause');
      Game.restart();
    });

    document.getElementById('btn-menu-pause').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Game.stopLoop();
      hideOverlay('overlay-pause');
      hideOverlay('overlay-round');
      hideOverlay('overlay-match');
      showScreen('screen-menu');
    });

    // Round result
    document.getElementById('btn-continue').addEventListener('click', () => {
      Audio.sfx.uiClick();
      hideOverlay('overlay-round');
      Game.switchTeams();
      Game.nextRound();
    });

    // Match result
    document.getElementById('btn-play-again').addEventListener('click', () => {
      Audio.sfx.uiClick();
      hideOverlay('overlay-match');
      Game.restart();
    });

    document.getElementById('btn-menu-match').addEventListener('click', () => {
      Audio.sfx.uiClick();
      Game.stopLoop();
      hideOverlay('overlay-match');
      showScreen('screen-menu');
    });
  }

  /* ---- Round result overlay ---- */
  function showRoundResult(winner, reason, humanScore, cpuScore) {
    const overlay = document.getElementById('overlay-round');
    const icon = document.getElementById('round-icon');
    const title = document.getElementById('round-title');
    const desc = document.getElementById('round-desc');
    const sh = document.getElementById('round-score-h');
    const sc = document.getElementById('round-score-c');

    const bn = Game.toBengaliNum;

    if (winner === 'human') {
      icon.textContent = '🎉';
      title.textContent = 'এই রাউন্ডে তুমি জিতেছ!';
      title.style.color = '#ffe878';
      desc.textContent = reason === 'rebuild'
        ? 'সব পাথর সাজানো সম্পন্ন করেছ — অভিনন্দন!'
        : 'কম্পিউটারের সব খেলোয়াড় আউট হয়েছে!';
    } else {
      icon.textContent = '😔';
      title.textContent = 'কম্পিউটার এই রাউন্ডে জিতেছে!';
      title.style.color = '#ff8a8a';
      desc.textContent = reason === 'rebuild'
        ? 'কম্পিউটার আগে পাথর সাজিয়ে ফেলেছে!'
        : 'তোমার সব খেলোয়াড় আউট হয়েছে!';
    }

    sh.textContent = bn(humanScore);
    sc.textContent = bn(cpuScore);
    overlay.style.display = 'flex';
  }

  /* ---- Match result overlay ---- */
  function showMatchResult(winner, humanScore, cpuScore) {
    const overlay = document.getElementById('overlay-match');
    const icon = document.getElementById('match-icon');
    const title = document.getElementById('match-title');
    const desc = document.getElementById('match-desc');
    const fh = document.getElementById('fs-h');
    const fc = document.getElementById('fs-c');
    const bn = Game.toBengaliNum;

    if (winner === 'human') {
      icon.textContent = '🏆';
      title.textContent = 'অভিনন্দন! তুমি ম্যাচ জিতেছ!';
      title.style.color = '#ffe878';
      desc.textContent = 'তুমি দারুণ খেলেছ! পিট্টুর চ্যাম্পিয়ন তুমি!';
    } else {
      icon.textContent = '💪';
      title.textContent = 'কম্পিউটার ম্যাচ জিতেছে।';
      title.style.color = '#ff8a8a';
      desc.textContent = 'হাল ছেড়ো না! আবার চেষ্টা করো।';
    }

    fh.textContent = bn(humanScore);
    fc.textContent = bn(cpuScore);
    overlay.style.display = 'flex';
  }

  function hideOverlay(id) {
    document.getElementById(id).style.display = 'none';
  }

  return { init, showScreen, showRoundResult, showMatchResult, hideOverlay };
})();
