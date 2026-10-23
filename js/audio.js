/* js/audio.js — Web Audio API sound generation */

const Audio = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { ctx = null; }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setEnabled(v) { enabled = v; }

  // --- Primitive synth helpers ---
  function playTone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.3, decay = 0.1, delay = 0 } = {}) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t); osc.stop(t + duration + 0.05);
  }

  function playNoise({ duration = 0.15, gain = 0.25, decay = 0.1, delay = 0, filter = null } = {}) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + delay;
    const bufLen = ctx.sampleRate * (duration + 0.05);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq || 400;
      src.connect(f); f.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(ctx.destination);
    src.start(t); src.stop(t + duration + 0.05);
  }

  // --- Named SFX ---
  const SFX = {
    throw() {
      playTone({ freq: 200, type: 'sawtooth', duration: 0.12, gain: 0.15 });
      playNoise({ duration: 0.1, gain: 0.12, filter: { type: 'highpass', freq: 800 } });
    },
    hit() {
      // Thump + stones scatter noise
      playNoise({ duration: 0.25, gain: 0.4, filter: { type: 'lowpass', freq: 300 } });
      playTone({ freq: 120, type: 'triangle', duration: 0.2, gain: 0.3 });
      // Scattered rattles
      for (let i = 0; i < 4; i++) {
        playNoise({ duration: 0.08, gain: 0.15, delay: 0.05 + i * 0.04,
          filter: { type: 'bandpass', freq: 200 + i * 60 } });
      }
    },
    miss() {
      playTone({ freq: 350, type: 'sine', duration: 0.15, gain: 0.15 });
      playTone({ freq: 280, type: 'sine', duration: 0.15, gain: 0.1, delay: 0.08 });
    },
    pickStone() {
      playTone({ freq: 600, type: 'triangle', duration: 0.08, gain: 0.2 });
    },
    placeStone() {
      playNoise({ duration: 0.06, gain: 0.2, filter: { type: 'lowpass', freq: 500 } });
      playTone({ freq: 500, type: 'triangle', duration: 0.06, gain: 0.15 });
    },
    playerHit() {
      playTone({ freq: 440, type: 'sine', duration: 0.08, gain: 0.3 });
      playTone({ freq: 220, type: 'sine', duration: 0.2, gain: 0.25, delay: 0.07 });
    },
    roundWin() {
      [523, 659, 784, 1047].forEach((f, i) => playTone({ freq: f, type: 'triangle', duration: 0.18, gain: 0.3, delay: i * 0.12 }));
    },
    roundLose() {
      [523, 392, 349, 294].forEach((f, i) => playTone({ freq: f, type: 'sine', duration: 0.2, gain: 0.25, delay: i * 0.12 }));
    },
    matchWin() {
      const melody = [523, 659, 784, 659, 784, 1047];
      melody.forEach((f, i) => playTone({ freq: f, type: 'triangle', duration: 0.22, gain: 0.35, delay: i * 0.14 }));
    },
    matchLose() {
      [440, 392, 349, 294].forEach((f, i) => playTone({ freq: f, type: 'sine', duration: 0.25, gain: 0.25, delay: i * 0.16 }));
    },
    uiClick() {
      playTone({ freq: 880, type: 'sine', duration: 0.06, gain: 0.12 });
    },
  };

  return { init, resume, setEnabled, sfx: SFX };
})();
