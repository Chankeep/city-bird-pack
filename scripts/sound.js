(() => {
  'use strict';

  const AudioCtor = window.AudioContext || window.webkitAudioContext || null;

  window.createBirdAudio = function createBirdAudio() {
    let ctx = null;
    let master = null;
    let noiseBuffer = null;
    let muted = false;
    let unlocked = false;
    let lastTearMs = -100;

    function ensureContext() {
      if (muted || !AudioCtor) return null;
      try {
        if (!ctx) {
          ctx = new AudioCtor();
          master = ctx.createGain();
          master.gain.value = 0.58;
          master.connect(ctx.destination);
          noiseBuffer = buildNoiseBuffer(ctx);
        }
        if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
          Promise.resolve(ctx.resume()).catch(() => {});
        }
        unlocked = true;
        return ctx;
      } catch (error) {
        return null;
      }
    }

    function buildNoiseBuffer(audioCtx) {
      const length = Math.floor(audioCtx.sampleRate * 0.65);
      const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        // Blend crisp white noise with slight pink smoothing for organic paper/foil foley.
        prev = prev * 0.42 + white * 0.58;
        data[i] = prev;
      }
      return buffer;
    }

    function playTone(audioCtx, opts) {
      const start = audioCtx.currentTime + (opts.delay || 0);
      const dur = opts.duration || 0.25;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(opts.freq, start);
      if (opts.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), start + dur);
      }
      const peak = opts.gain || 0.14;
      const attack = Math.min(opts.attack || 0.008, dur * 0.35);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    function playNoise(audioCtx, opts) {
      if (!noiseBuffer) return;
      const start = audioCtx.currentTime + (opts.delay || 0);
      const dur = Math.min(opts.duration || 0.08, 0.55);
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = opts.filterType || 'bandpass';
      filter.frequency.setValueAtTime(opts.freq || 2400, start);
      if (opts.endFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.endFreq), start + dur);
      }
      filter.Q.value = opts.q || 1.4;

      const gain = audioCtx.createGain();
      const peak = opts.gain || 0.12;
      const attack = Math.min(opts.attack || 0.005, dur * 0.3);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      const offset = Math.random() * Math.max(0.02, 0.58 - dur);
      src.start(start, offset, dur + 0.02);
    }

    function playChimeNote(audioCtx, freq, delay, duration, peak, detuneCents) {
      playTone(audioCtx, { type: 'sine', freq, delay, duration, gain: peak, attack: 0.009 });
      playTone(audioCtx, {
        type: 'triangle',
        freq: freq * 2 * Math.pow(2, (detuneCents || 4) / 1200),
        delay,
        duration: duration * 0.56,
        gain: peak * 0.24,
        attack: 0.006
      });
    }

    function unlock() {
      if (!unlocked || (ctx && ctx.state !== 'running')) ensureContext();
    }

    function playUiTick() {
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      playTone(audioCtx, { type: 'sine', freq: 520, endFreq: 380, duration: 0.045, gain: 0.06, attack: 0.004 });
    }

    function playPackSwitch() {
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      playNoise(audioCtx, { filterType: 'bandpass', freq: 1850, endFreq: 2600, q: 1.6, duration: 0.065, gain: 0.09 });
      playTone(audioCtx, { type: 'triangle', freq: 310, endFreq: 460, duration: 0.075, gain: 0.07, attack: 0.005 });
    }

    function playTearTick(progress) {
      const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      if (now - lastTearMs < 45) return;
      lastTearMs = now;
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      const p = Math.min(1, Math.max(0, progress || 0));
      // Crisp crinkly foil rip micro-bursts rising subtly in pitch as the seal separates.
      const baseFreq = 2500 + p * 2300 + (Math.random() - 0.5) * 420;
      playNoise(audioCtx, {
        filterType: 'bandpass',
        freq: baseFreq,
        endFreq: baseFreq * 1.25,
        q: 2.2,
        duration: 0.032 + Math.random() * 0.018,
        gain: 0.14 + p * 0.08,
        attack: 0.003
      });
      if (Math.random() < 0.55) {
        playNoise(audioCtx, {
          filterType: 'highpass',
          freq: 4600,
          q: 0.8,
          duration: 0.022,
          gain: 0.06,
          attack: 0.002
        });
      }
    }

    function playPackOpen(maxRank) {
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      // Final foil tear snap + airy reveal swell
      playNoise(audioCtx, { filterType: 'bandpass', freq: 3200, endFreq: 5200, q: 1.5, duration: 0.13, gain: 0.22, attack: 0.004 });
      playNoise(audioCtx, { filterType: 'lowpass', freq: 420, endFreq: 1950, q: 0.9, duration: 0.34, gain: 0.13, attack: 0.04, delay: 0.04 });

      // 5 brisk staggered cardstock deal flicks matching cardFlight stagger (~62ms)
      for (let i = 0; i < 5; i += 1) {
        const t = 0.11 + i * 0.062;
        playNoise(audioCtx, {
          filterType: 'bandpass',
          freq: 1450 + i * 160,
          endFreq: 950,
          q: 1.3,
          duration: 0.055,
          gain: 0.095,
          delay: t
        });
        playTone(audioCtx, {
          type: 'sine',
          freq: 260 + i * 32,
          endFreq: 180 + i * 24,
          duration: 0.06,
          gain: 0.045,
          delay: t
        });
      }

      // Subtle teaser shimmer if the pack holds an ultra or secret bird
      if (maxRank === 'secret') {
        playChimeNote(audioCtx, 659.25, 0.16, 0.55, 0.075, 5);
        playChimeNote(audioCtx, 987.77, 0.25, 0.65, 0.07, -4);
      } else if (maxRank === 'ultra') {
        playChimeNote(audioCtx, 587.33, 0.18, 0.52, 0.075, 4);
      }
    }

    function playCardFlip(rank) {
      const audioCtx = ensureContext();
      if (!audioCtx) return;

      // Crisp cardstock snap shared at the start of every flip
      playNoise(audioCtx, {
        filterType: 'bandpass',
        freq: 1750,
        endFreq: 980,
        q: 1.2,
        duration: 0.062,
        gain: 0.13,
        attack: 0.004
      });
      playTone(audioCtx, {
        type: 'triangle',
        freq: 245,
        endFreq: 145,
        duration: 0.068,
        gain: 0.08,
        attack: 0.003
      });

      if (rank === 'common') return;

      if (rank === 'rare') {
        // Crystalline amethyst two-note prism chime (E5 -> B5)
        playChimeNote(audioCtx, 659.25, 0.06, 0.36, 0.10, 4);
        playChimeNote(audioCtx, 987.77, 0.12, 0.46, 0.11, -3);
        playNoise(audioCtx, { filterType: 'highpass', freq: 4200, duration: 0.16, gain: 0.045, delay: 0.07 });
        return;
      }

      if (rank === 'holo') {
        // Shimmering aurora glass triad arpeggio (C5 -> G5 -> B5 -> E6)
        const notes = [523.25, 783.99, 987.77, 1318.51];
        notes.forEach((f, idx) => {
          playChimeNote(audioCtx, f, 0.06 + idx * 0.048, 0.56 + idx * 0.06, 0.095, idx % 2 ? 5 : -4);
        });
        playNoise(audioCtx, { filterType: 'bandpass', freq: 4600, endFreq: 6800, q: 2.0, duration: 0.28, gain: 0.055, delay: 0.09 });
        return;
      }

      if (rank === 'ultra') {
        // Copperplate Epic: warm bronze bell undertone + radiant golden major-9th fanfare
        playTone(audioCtx, { type: 'sine', freq: 196.0, endFreq: 194.5, duration: 0.95, gain: 0.13, delay: 0.07, attack: 0.014 });
        playTone(audioCtx, { type: 'triangle', freq: 293.66, duration: 0.78, gain: 0.08, delay: 0.08, attack: 0.012 });
        const fanfare = [392.0, 493.88, 587.33, 739.99, 880.0, 1174.66];
        fanfare.forEach((f, idx) => {
          playChimeNote(audioCtx, f, 0.08 + idx * 0.052, 0.72 + idx * 0.08, 0.105, idx % 2 ? 6 : -5);
        });
        playNoise(audioCtx, { filterType: 'bandpass', freq: 3800, endFreq: 6200, q: 1.8, duration: 0.42, gain: 0.065, delay: 0.12 });
        return;
      }

      // Secret: ethereal twilight swell + celestial lydian harp-chime cascade
      playTone(audioCtx, { type: 'sine', freq: 220.0, endFreq: 222.0, duration: 1.30, gain: 0.12, delay: 0.08, attack: 0.04 });
      playTone(audioCtx, { type: 'sine', freq: 329.63, duration: 1.15, gain: 0.085, delay: 0.12, attack: 0.04 });
      const cascade = [587.33, 739.99, 880.0, 1108.73, 1318.51, 1479.98, 1760.0];
      cascade.forEach((f, idx) => {
        playChimeNote(audioCtx, f, 0.10 + idx * 0.058, 0.92 + idx * 0.09, 0.095, idx % 2 ? 7 : -6);
      });
      playNoise(audioCtx, { filterType: 'bandpass', freq: 4400, endFreq: 7600, q: 1.9, duration: 0.62, gain: 0.065, delay: 0.14 });
    }

    function playInspectOpen() {
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      playTone(audioCtx, { type: 'sine', freq: 520, endFreq: 780, duration: 0.12, gain: 0.065, attack: 0.008 });
      playNoise(audioCtx, { filterType: 'bandpass', freq: 2400, duration: 0.055, gain: 0.045 });
    }

    function playInspectClose() {
      const audioCtx = ensureContext();
      if (!audioCtx) return;
      playTone(audioCtx, { type: 'sine', freq: 460, endFreq: 310, duration: 0.085, gain: 0.055, attack: 0.005 });
    }

    function setMuted(next) {
      muted = Boolean(next);
      if (master && ctx) {
        try {
          master.gain.setTargetAtTime(muted ? 0.0001 : 0.58, ctx.currentTime, 0.02);
        } catch (error) {
          master.gain.value = muted ? 0 : 0.58;
        }
      }
      if (!muted) playUiTick();
    }

    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try {
        if (document.hidden && typeof ctx.suspend === 'function') {
          Promise.resolve(ctx.suspend()).catch(() => {});
        } else if (!document.hidden && !muted && typeof ctx.resume === 'function') {
          Promise.resolve(ctx.resume()).catch(() => {});
        }
      } catch (error) { /* Ignore AudioContext lifecycle restrictions. */ }
    });

    return {
      supported: Boolean(AudioCtor),
      isMuted: () => muted,
      setMuted,
      toggleMuted() {
        setMuted(!muted);
        return muted;
      },
      unlock,
      playUiTick,
      playPackSwitch,
      playTearTick,
      playPackOpen,
      playCardFlip,
      playInspectOpen,
      playInspectClose
    };
  };
})();
