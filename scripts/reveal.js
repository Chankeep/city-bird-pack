(() => {
  'use strict';

  const rankStyle = {
    common: {
      level: 0,
      settleMs: 640,
      tint: '230, 224, 206',
      rays: ['247, 242, 180', '159, 224, 188', '230, 214, 153']
    },
    rare: {
      level: 1,
      settleMs: 700,
      tint: '210, 162, 255',
      rays: ['222, 191, 255', '172, 148, 255', '130, 236, 234']
    },
    holo: {
      level: 2,
      settleMs: 800,
      tint: '132, 246, 238',
      rays: ['132, 246, 232', '150, 206, 255', '236, 174, 248']
    },
    ultra: {
      level: 3,
      settleMs: 920,
      tint: '255, 216, 120',
      rays: ['255, 228, 146', '246, 176, 86', '255, 244, 194', '218, 134, 58']
    },
    secret: {
      level: 4,
      settleMs: 1100,
      tint: '220, 172, 255',
      rays: ['136, 246, 234', '220, 172, 255', '255, 184, 226', '255, 232, 168']
    }
  };

  const launchDuration = 680;
  const firstLaunch = 100;
  const stagger = 62;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const px = (value) => value.toFixed(2) + 'px';
  const deg = (value) => value.toFixed(2) + 'deg';
  const ms = (value) => Math.round(value) + 'ms';
  const percent = (value) => value.toFixed(2) + '%';

  function layer(className, properties) {
    const item = document.createElement('span');
    item.className = className;
    if (properties) assign(item, properties);
    return item;
  }

  function assign(item, properties) {
    Object.keys(properties).forEach((prop) => item.style.setProperty(prop, properties[prop]));
  }

  function flash(light, point, style) {
    const rect = light.getBoundingClientRect();
    const spread = Math.min(rect.width * .48, 305);
    const rise = Math.min(rect.height * .46, 235);
    const origin = layer('reveal-origin', {
      left: px(point.x - rect.left),
      top: px(point.y - rect.top),
      '--burst-rgb': style.tint,
      '--bloom-width': px(spread * 2.48),
      '--bloom-height': px(rise * 2.10),
      '--halo-width': px(spread * .94),
      '--halo-height': px(spread * .16),
      '--slit-width': px(Math.min(rect.width * .56, 265))
    });
    origin.appendChild(layer('reveal-bloom'));
    if (!reducedMotion.matches) {
      origin.appendChild(layer('reveal-halo'));
      const rays = 7 + style.level;
      for (let i = 0; i < rays; i += 1) {
        const progress = i / (rays - 1);
        origin.appendChild(layer('reveal-ray', {
          '--ray-angle': deg(-68 + progress * 136 + randomBetween(-4, 4)),
          '--ray-length': px(rise * randomBetween(.76, 1.44)),
          '--ray-width': px(spread * randomBetween(.15, .39)),
          '--ray-rgb': style.rays[i % style.rays.length],
          '--ray-delay': ms(randomBetween(0, 85)),
          '--ray-opacity': randomBetween(.56, .95).toFixed(2)
        }));
      }
      const sparks = rect.width < 460 ? 16 : 24;
      for (let i = 0; i < sparks; i += 1) {
        const angle = Math.PI * randomBetween(-.94, -.06);
        const distance = randomBetween(.36, 1.08);
        origin.appendChild(layer('reveal-spark', {
          '--spark-angle': deg(angle * 180 / Math.PI + 90),
          '--spark-rgb': style.rays[i % style.rays.length],
          '--spark-x': px(Math.cos(angle) * spread * distance),
          '--spark-y': px(Math.sin(angle) * rise * distance - 14),
          '--spark-size': px(randomBetween(1.3, 3.3)),
          '--spark-duration': ms(randomBetween(520, 940)),
          '--spark-delay': ms(randomBetween(40, 165))
        }));
      }
      origin.appendChild(layer('reveal-slit'));
    }
    light.appendChild(origin);
  }

  function cardFlight(slot, backSlot, point, index, total) {
    const bounds = slot.getBoundingClientRect();
    const dx = point.x - bounds.left - bounds.width * .5;
    const dy = point.y - bounds.top - bounds.height * .5;
    const mid = (total - 1) / 2;
    const fan = index - mid;
    const delay = firstLaunch + index * stagger;
    const side = Math.random() < .5 ? -1 : 1;
    const tilt = randomBetween(1, 3.4);
    const turn = side * randomBetween(1.8, 4.0);
    const floatDelay = delay + launchDuration;
    const floatDuration = randomBetween(2700, 4700);
    const movement = {
      '--launch-x': px(dx),
      '--launch-y': px(dy + 10),
      '--pop-y': px(dy - Math.min(58, bounds.height * .26)),
      '--launch-roll': deg(fan * -11 + randomBetween(-2.5, 2.5)),
      '--hop-x': px(dx * -.11),
      '--hop-y': px(Math.max(-96, Math.min(-34, dy - 38))),
      '--hop-roll': deg(fan * 4.5 + randomBetween(-1.8, 1.8)),
      '--launch-delay': ms(delay),
      '--float-delay': ms(floatDelay),
      '--float-duration': ms(floatDuration),
      '--float-x': px(side * randomBetween(1.2, 3.2)),
      '--float-up': px(-randomBetween(4.0, 7.2)),
      '--float-tilt': deg(tilt),
      '--float-turn': deg(turn),
      '--float-light-x': px(turn * 13.44),
      '--float-light-y': px(-tilt * 16.632),
      '--float-roll': deg(side * randomBetween(.7, 1.6))
    };
    assign(slot, movement);
    assign(backSlot, movement);
    return { floatDelay, floatDuration, floatTilt: tilt, floatTurn: turn };
  }

  function easeInOut(t) {
    return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Exact analytical match of @keyframes draw-float (0% -> 25% -> 56% -> 79% -> 100%)
  function sampleDrawFloatTilt(spec, elapsed) {
    if (!spec || elapsed <= 0) return { x: 0, y: 0 };
    const u = (elapsed % spec.floatDuration) / spec.floatDuration;
    let kx = 0;
    let ky = 0;
    if (u < .25) {
      const e = easeInOut(u / .25);
      kx = e;
      ky = e;
    } else if (u < .56) {
      const e = easeInOut((u - .25) / .31);
      kx = 1 + (-.5 - 1) * e;
      ky = 1 + (-.8 - 1) * e;
    } else if (u < .79) {
      const e = easeInOut((u - .56) / .23);
      kx = -.5 + (0 - -.5) * e;
      ky = -.8 + (.3 - -.8) * e;
    } else {
      const e = easeInOut((u - .79) / .21);
      kx = 0;
      ky = .3 * (1 - e);
    }
    return { x: spec.floatTilt * kx, y: spec.floatTurn * ky };
  }

  function addBackAmbientFx(back, rank) {
    const style = rankStyle[rank] || rankStyle.common;
    // Rotating background sunburst rays for ultra & secret face-down cards
    if (rank === 'ultra' || rank === 'secret') {
      const raysHost = layer('card-back-rays');
      raysHost.setAttribute('aria-hidden', 'true');
      const rayCount = rank === 'secret' ? 8 : 6;
      for (let i = 0; i < rayCount; i += 1) {
        const r = layer('card-back-ray');
        r.style.transform = 'rotate(' + (i * (360 / rayCount)) + 'deg)';
        raysHost.appendChild(r);
      }
      back.appendChild(raysHost);
    }

    if (style.level < 1) return;

    const fx = layer('card-back-fx');
    fx.setAttribute('aria-hidden', 'true');

    const presets = {
      rare: [
        { x: 14, y: 16, s: 5, star: false, dur: 2.4, delay: .2 },
        { x: 86, y: 78, s: 6, star: true, dur: 2.7, delay: 1.1 }
      ],
      holo: [
        { x: 12, y: 18, s: 8, star: true, dur: 2.2, delay: 0 },
        { x: 88, y: 24, s: 4, star: false, dur: 2.0, delay: .7 },
        { x: 16, y: 82, s: 4.5, star: false, dur: 2.5, delay: 1.2 },
        { x: 86, y: 76, s: 8, star: true, dur: 2.3, delay: .4 }
      ],
      ultra: [
        { x: 10, y: 22, s: 8, star: true, dur: 2.0, delay: .1 },
        { x: 88, y: 16, s: 9, star: true, dur: 2.3, delay: .8 },
        { x: 18, y: 78, s: 5, star: false, dur: 1.9, delay: .4 },
        { x: 84, y: 74, s: 5, star: false, dur: 2.1, delay: 1.3 },
        { x: 52, y: 8, s: 7, star: true, dur: 2.2, delay: .5 }
      ],
      secret: [
        { x: 8, y: 16, s: 10, star: true, dur: 1.8, delay: 0 },
        { x: 92, y: 18, s: 9, star: true, dur: 2.0, delay: .5 },
        { x: 12, y: 84, s: 9, star: true, dur: 2.1, delay: .9 },
        { x: 90, y: 82, s: 10, star: true, dur: 1.9, delay: .3 },
        { x: 50, y: 6, s: 8, star: true, dur: 1.7, delay: 1.1 },
        { x: 24, y: 48, s: 4.5, star: false, dur: 2.2, delay: .7 },
        { x: 80, y: 52, s: 4.5, star: false, dur: 2.0, delay: 1.4 }
      ]
    };

    const items = presets[rank] || [];
    items.forEach((p, idx) => {
      fx.appendChild(layer(p.star ? 'back-mote back-mote--star' : 'back-mote', {
        '--mx': p.x + '%',
        '--my': p.y + '%',
        '--ms': p.s + 'px',
        '--mc': style.rays[idx % style.rays.length],
        '--md': p.dur + 's',
        '--mdl': (-p.delay) + 's'
      }));
    });

    back.appendChild(fx);
  }

  function makeCardBack(index, rank) {
    const back = document.createElement('button');
    back.className = 'bird-card-back';
    back.type = 'button';
    back.disabled = true;
    back.setAttribute('aria-label', '翻开第 ' + (index + 1) + ' 张鸟卡');
    back.appendChild(layer('card-back-aura')).setAttribute('aria-hidden', 'true');
    addBackAmbientFx(back, rank);

    const body = layer('card-back-body');
    body.appendChild(layer('card-back-frame')).setAttribute('aria-hidden', 'true');
    body.appendChild(layer('card-back-emblem')).setAttribute('aria-hidden', 'true');
    body.appendChild(layer('card-back-sheen')).setAttribute('aria-hidden', 'true');
    const tag = layer('card-back-tag');
    tag.textContent = '轻触翻开';
    tag.setAttribute('aria-hidden', 'true');
    body.appendChild(tag);
    back.appendChild(body);
    return back;
  }

  function spawnFlipParticles(host, count, colors, opts) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i / count) + randomBetween(-.22, .22);
      const dist = randomBetween(opts.minR, opts.maxR);
      const size = randomBetween(opts.minSize, opts.maxSize);
      const cls = opts.variant ? 'flip-particle flip-particle--' + opts.variant : 'flip-particle';
      const props = {
        '--fp-x': px(Math.cos(angle) * dist),
        '--fp-y': px(Math.sin(angle) * dist + (opts.liftY || 0)),
        '--fp-size': px(size),
        '--fp-h': px(opts.elongate ? size * 1.65 : size),
        '--fp-rgb': colors[i % colors.length],
        '--fp-dur': ms(randomBetween(opts.minDur, opts.maxDur)),
        '--fp-delay': ms(opts.baseDelay + randomBetween(0, 120)),
        '--fp-rot': deg(randomBetween(-220, 220))
      };
      host.appendChild(layer(cls, props));
    }
  }

  function triggerFlipBurst(backHost, frontHost, rank, onComplete) {
    if (reducedMotion.matches) return;
    const style = rankStyle[rank] || rankStyle.common;
    backHost.textContent = '';
    frontHost.textContent = '';
    backHost.style.setProperty('--flip-rgb', style.tint);
    frontHost.style.setProperty('--flip-rgb', style.tint);

    const clearHosts = () => {
      backHost.textContent = '';
      frontHost.textContent = '';
      onComplete();
    };

    // Tier 1: Common — quiet clean warm backglow
    if (rank === 'common') {
      backHost.appendChild(layer('flip-flash', {
        '--flash-w': '195px',
        '--flash-h': '235px',
        '--flash-dur': '480ms',
        '--flash-delay': '60ms'
      }));
      return window.setTimeout(clearHosts, 600);
    }

    // Tier 2: Rare — amethyst prism ring behind + delicate diagonal laser slash & 6 glints
    if (rank === 'rare') {
      backHost.appendChild(layer('flip-flash', { '--flash-w': '245px', '--flash-h': '295px', '--flash-dur': '580ms', '--flash-delay': '70ms' }));
      backHost.appendChild(layer('flip-ring', { '--ring-size': '162px', '--ring-rgb': style.tint, '--ring-dur': '620ms', '--ring-delay': '75ms' }));
      frontHost.appendChild(layer('flip-slash'));
      spawnFlipParticles(frontHost, 6, style.rays, {
        minR: 58, maxR: 112, minSize: 3.2, maxSize: 5.0,
        minDur: 460, maxDur: 640, baseDelay: 95
      });
      return window.setTimeout(clearHosts, 840);
    }

    // Tier 3: Holo — dual polarized aurora rings & starburst cross behind + 12 diamond stardust
    if (rank === 'holo') {
      backHost.appendChild(layer('flip-flash', { '--flash-w': '275px', '--flash-h': '325px', '--flash-dur': '680ms', '--flash-delay': '85ms' }));
      backHost.appendChild(layer('flip-ring', { '--ring-size': '172px', '--ring-rgb': '132, 246, 232', '--ring-dur': '680ms', '--ring-delay': '85ms' }));
      backHost.appendChild(layer('flip-ring', { '--ring-size': '132px', '--ring-rgb': '220, 168, 255', '--ring-dur': '740ms', '--ring-delay': '170ms' }));
      backHost.appendChild(layer('flip-cross', { '--cross-size': '240px', '--cross-rgb': '136, 246, 238', '--cross-rot': '12deg', '--cross-dur': '760ms', '--cross-delay': '100ms' }));
      spawnFlipParticles(frontHost, 12, style.rays, {
        variant: 'diamond', minR: 66, maxR: 134, minSize: 3.6, maxSize: 6.0,
        minDur: 540, maxDur: 780, baseDelay: 110
      });
      return window.setTimeout(clearHosts, 1020);
    }

    // Tier 4: Ultra (Copperplate Epic) — blazing golden bloom, 10 sunburst rays & dual cast-gold rings BEHIND card + 16 copper-gold foil flakes
    if (rank === 'ultra') {
      backHost.appendChild(layer('flip-flash', { '--flash-w': '325px', '--flash-h': '375px', '--flash-dur': '840ms', '--flash-delay': '95ms' }));
      backHost.appendChild(layer('flip-ring', { '--ring-size': '185px', '--ring-bw': '2.5px', '--ring-rgb': '255, 224, 134', '--ring-dur': '760ms', '--ring-delay': '100ms' }));
      backHost.appendChild(layer('flip-ring', { '--ring-size': '140px', '--ring-bw': '2px', '--ring-rgb': '232, 148, 62', '--ring-dur': '840ms', '--ring-delay': '195ms' }));
      const rayCount = 10;
      for (let i = 0; i < rayCount; i += 1) {
        backHost.appendChild(layer('flip-ray', {
          '--fr-angle': deg(i * (360 / rayCount) + randomBetween(-5, 5)),
          '--fr-w': px(randomBetween(22, 34)),
          '--fr-len': px(randomBetween(145, 205)),
          '--fr-rgb': style.rays[i % style.rays.length],
          '--fr-dur': ms(randomBetween(740, 900)),
          '--fr-delay': ms(100 + randomBetween(0, 60))
        }));
      }
      spawnFlipParticles(frontHost, 16, style.rays, {
        variant: 'foil', elongate: true, minR: 74, maxR: 162, minSize: 4.2, maxSize: 7.0,
        minDur: 640, maxDur: 920, baseDelay: 120, liftY: -14
      });
      return window.setTimeout(clearHosts, 1220);
    }

    // Tier 5: Secret — triple prism rings, twin crosses & 14 iridescent rays BEHIND card + 22 cosmic diamonds
    backHost.appendChild(layer('flip-flash', { '--flash-w': '360px', '--flash-h': '410px', '--flash-dur': '980ms', '--flash-delay': '140ms' }));
    backHost.appendChild(layer('flip-ring', { '--ring-size': '200px', '--ring-bw': '2.5px', '--ring-rgb': '136, 246, 234', '--ring-dur': '840ms', '--ring-delay': '120ms' }));
    backHost.appendChild(layer('flip-ring', { '--ring-size': '160px', '--ring-bw': '2px', '--ring-rgb': '224, 174, 255', '--ring-dur': '900ms', '--ring-delay': '220ms' }));
    backHost.appendChild(layer('flip-ring', { '--ring-size': '122px', '--ring-bw': '1.5px', '--ring-rgb': '255, 224, 162', '--ring-dur': '940ms', '--ring-delay': '320ms' }));
    backHost.appendChild(layer('flip-cross', { '--cross-size': '305px', '--cross-rgb': '226, 178, 255', '--cross-rot': '0deg', '--cross-dur': '940ms', '--cross-delay': '160ms' }));
    backHost.appendChild(layer('flip-cross', { '--cross-size': '245px', '--cross-rgb': '132, 246, 238', '--cross-rot': '45deg', '--cross-dur': '880ms', '--cross-delay': '230ms' }));
    const secretRays = 14;
    for (let i = 0; i < secretRays; i += 1) {
      backHost.appendChild(layer('flip-ray', {
        '--fr-angle': deg(i * (360 / secretRays) + randomBetween(-4, 4)),
        '--fr-w': px(randomBetween(20, 32)),
        '--fr-len': px(randomBetween(165, 235)),
        '--fr-rgb': style.rays[i % style.rays.length],
        '--fr-dur': ms(randomBetween(840, 1020)),
        '--fr-delay': ms(160 + randomBetween(0, 80))
      }));
    }
    spawnFlipParticles(frontHost, 22, style.rays, {
      variant: 'diamond', minR: 80, maxR: 180, minSize: 4.0, maxSize: 7.2,
      minDur: 720, maxDur: 1060, baseDelay: 170, liftY: -12
    });
    return window.setTimeout(clearHosts, 1450);
  }

  window.createPackReveal = function createPackReveal(options) {
    const { stage, mouth, row, light, makeCard, onDealt, onFlip, onReady } = options;
    const compositedGridOptics = document.documentElement.classList.contains('android-card-rendering');
    if (compositedGridOptics) row.dataset.gridOptics = 'composited';
    let readyTimer = 0;
    let lightTimer = 0;
    let spotlightTimer = 0;
    let activeBursts = 0;
    let flipTimers = [];
    let entries = [];
    let currentCards = [];
    let dealt = false;
    let swipe = null;
    let onscreen = true;
    let playStartedAt = 0;
    let floatFrame = 0;
    let nextFloatIndex = 0;

    function stopFloatOptics() {
      if (floatFrame) cancelAnimationFrame(floatFrame);
      floatFrame = 0;
    }

    function gridAmbientTilt(entry, now) {
      const elapsed = now - playStartedAt - (entry.floatSpec ? entry.floatSpec.floatDelay : 0);
      const tilt = sampleDrawFloatTilt(entry.floatSpec, elapsed);
      const flipProgress = (now - entry.flipStartedAt) / entry.flipDuration;
      if (flipProgress >= 0 && flipProgress < 1) {
        const remaining = 1 - flipProgress;
        tilt.y += remaining * remaining * 14;
      }
      return tilt;
    }

    function tickFloatOptics(now) {
      floatFrame = 0;
      // Stagger the material updates while each card keeps its own light motion.
      for (let offset = 0; offset < entries.length; offset += 1) {
        const index = (nextFloatIndex + offset) % entries.length;
        const entry = entries[index];
        if (!entry.flipped || now < entry.nextFloatSampleAt) continue;
        if (entry.button.parentNode !== entry.flipper) continue;
        if (typeof entry.button.setAmbientTilt !== 'function') continue;
        if (compositedGridOptics && entry.button.dataset.webglFace !== 'ready') continue;

        entry.nextFloatSampleAt = now + 32;
        nextFloatIndex = (index + 1) % entries.length;
        const tilt = gridAmbientTilt(entry, now);
        entry.button.setAmbientTilt(tilt.x, tilt.y);
        break;
      }
      startFloatOptics();
    }

    function startFloatOptics() {
      if (floatFrame || !entries.length || !onscreen || document.hidden || reducedMotion.matches) return;
      if (compositedGridOptics && !entries.some(entry =>
        entry.flipped && entry.button.dataset.webglFace === 'ready'
      )) return;
      floatFrame = requestAnimationFrame(tickFloatOptics);
    }

    function updateVisibility() {
      const hidden = !onscreen || document.hidden;
      stage.classList.toggle('reveal-offscreen', hidden);
      if (hidden) stopFloatOptics();
      else if (entries.some((e) => e.flipped)) startFloatOptics();
    }

    document.addEventListener('visibilitychange', updateVisibility);
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver((items) => {
        onscreen = items[0].isIntersecting;
        updateVisibility();
      }).observe(stage);
    }

    function clearFlipTimers() {
      flipTimers.forEach((id) => window.clearTimeout(id));
      flipTimers = [];
    }

    function syncGridOptics() {
      if (compositedGridOptics) {
        row.classList.toggle('has-flip-effects', activeBursts > 0 || spotlightTimer !== 0);
      }
    }

    function clearSpotlight() {
      window.clearTimeout(spotlightTimer);
      spotlightTimer = 0;
      stage.removeAttribute('data-spotlight');
      syncGridOptics();
    }

    function pulseSpotlight(rank) {
      const style = rankStyle[rank];
      if (reducedMotion.matches || !style || style.level < 1) return;
      window.clearTimeout(spotlightTimer);
      stage.setAttribute('data-spotlight', rank);
      const hold = style.level === 4 ? 1750 : style.level === 3 ? 1450 : style.level === 2 ? 1050 : 660;
      spotlightTimer = window.setTimeout(() => {
        stage.removeAttribute('data-spotlight');
        // The fade starts on a rendered frame, which may lag the hold timer.
        const spotlight = compositedGridOptics && stage.querySelector('.stage-spotlight--' + rank);
        function finishFade() {
          if (spotlight && !document.hidden && Number(getComputedStyle(spotlight).opacity) > 0) {
            spotlightTimer = window.setTimeout(finishFade, 32);
            return;
          }
          spotlightTimer = 0;
          syncGridOptics();
        }
        spotlightTimer = window.setTimeout(finishFade, 420);
      }, hold);
      syncGridOptics();
    }

    function flipEntry(entry) {
      if (!dealt || !entry || entry.flipped) return false;
      const style = rankStyle[entry.data.rank] || rankStyle.common;
      const settleDelay = reducedMotion.matches ? 20 : style.settleMs;
      entry.flipped = true;
      entry.back.disabled = true;
      entry.back.setAttribute('tabindex', '-1');
      entry.back.setAttribute('aria-hidden', 'true');
      entry.slot.classList.add('is-flipping');
      entry.lift.classList.add('is-lifting');
      entry.flipper.classList.remove('is-facedown');
      entry.flipper.classList.add('is-flipped');
      entry.detailFrame = requestAnimationFrame(() => {
        entry.detailFrame = 0;
        entry.button.enableDetails();
      });
      const burstTimer = triggerFlipBurst(entry.backFx, entry.frontFx, entry.data.rank, () => {
        activeBursts -= 1;
        syncGridOptics();
      });
      if (burstTimer) {
        activeBursts += 1;
        flipTimers.push(burstTimer);
        syncGridOptics();
      }
      pulseSpotlight(entry.data.rank);
      entry.flipStartedAt = performance.now();
      entry.flipDuration = settleDelay;
      startFloatOptics();

      const timerId = window.setTimeout(() => {
        entry.flipper.classList.add('is-settled');
        entry.lift.classList.remove('is-lifting');
        entry.slot.classList.remove('is-flipping');
        entry.button.disabled = false;
        entry.settled = true;
        if (onReady && entries.every(item => item.settled)) onReady(currentCards);
      }, settleDelay);
      flipTimers.push(timerId);

      if (onFlip) onFlip(entry.data, entry.index);

      return true;
    }

    function flipAll() {
      if (!dealt) return;
      const unflipped = entries.filter((item) => !item.flipped);
      if (!unflipped.length) return;
      // Flip outer cards first, saving the center hero slot (middle index) for the finale.
      const heroIndex = Math.floor(entries.length / 2);
      const priority = (idx) => {
        if (idx === heroIndex) return 99;
        const order = [0, 4, 1, 3];
        const pos = order.indexOf(idx);
        return pos === -1 ? idx : pos;
      };
      unflipped.sort((a, b) => priority(a.index) - priority(b.index));
      unflipped.forEach((entry, step) => {
        if (step === 0 || reducedMotion.matches) {
          flipEntry(entry);
        } else {
          const isFinale = entry.index === heroIndex && unflipped.length > 1;
          const level = (rankStyle[entry.data.rank] || rankStyle.common).level;
          const finalePause = level >= 4 ? 280 : level === 3 ? 230 : level === 2 ? 170 : 110;
          const delay = isFinale ? step * 110 + finalePause : step * 105;
          flipTimers.push(window.setTimeout(() => flipEntry(entry), delay));
        }
      });
    }

    // Horizontal swipe across cards to flip multiple cards smoothly
    row.addEventListener('pointerdown', (event) => {
      if (!dealt || !event.isPrimary) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    });

    window.addEventListener('pointermove', (event) => {
      if (!swipe || swipe.id !== event.pointerId || !dealt) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (!swipe.active) {
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
        swipe.active = true;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target) return;
      const slot = target.closest ? target.closest('.draw-slot') : null;
      if (!slot) return;
      const idx = Number(slot.dataset.slot);
      if (entries[idx] && !entries[idx].flipped) {
        flipEntry(entries[idx]);
      }
    }, { passive: true });

    function endSwipe(event) {
      if (swipe && swipe.id === event.pointerId) swipe = null;
    }
    window.addEventListener('pointerup', endSwipe);
    window.addEventListener('pointercancel', endSwipe);

    function reset() {
      stopFloatOptics();
      window.clearTimeout(readyTimer);
      window.clearTimeout(lightTimer);
      clearFlipTimers();
      activeBursts = 0;
      clearSpotlight();
      entries.forEach(entry => {
        if (entry.detailFrame) cancelAnimationFrame(entry.detailFrame);
        entry.button.releaseDetails();
      });
      dealt = false;
      swipe = null;
      nextFloatIndex = 0;
      entries = [];
      currentCards = [];
      row.hidden = true;
      row.classList.remove('is-playing');
      row.textContent = '';
      light.hidden = true;
      light.textContent = '';
    }

    function play(cards) {
      reset();
      currentCards = cards;
      const bounds = mouth.getBoundingClientRect();
      const point = { x: bounds.left + bounds.width * .5, y: bounds.top + bounds.height * .5 };
      let glow = rankStyle.common;
      const fragment = document.createDocumentFragment();

      cards.forEach((data, index) => {
        const style = rankStyle[data.rank];
        if (style && style.level > glow.level) glow = style;

        const slot = document.createElement('div');
        slot.className = 'draw-slot';
        slot.dataset.rank = data.rank;
        slot.dataset.slot = String(index);

        const flight = document.createElement('div');
        flight.className = 'draw-launch';

        const floating = document.createElement('div');
        floating.className = 'draw-float';

        const backSlot = layer('draw-backfx-slot');
        backSlot.dataset.backSlot = String(index);
        backSlot.setAttribute('aria-hidden', 'true');
        const backFlight = layer('draw-launch');
        const backFloat = layer('draw-float');
        const backFx = layer('card-flip-backfx');
        backFloat.appendChild(backFx);
        backFlight.appendChild(backFloat);
        backSlot.appendChild(backFlight);

        const lift = document.createElement('div');
        lift.className = 'card-flip-lift';

        const flipper = document.createElement('div');
        flipper.className = 'card-flipper is-facedown';

        const frontFx = document.createElement('div');
        frontFx.className = 'card-flip-frontfx';
        frontFx.setAttribute('aria-hidden', 'true');

        const back = makeCardBack(index, data.rank);
        const button = makeCard(data);
        button.disabled = true;

        flipper.appendChild(back);
        flipper.appendChild(button);
        lift.appendChild(flipper);
        floating.appendChild(lift);
        floating.appendChild(frontFx);
        flight.appendChild(floating);
        slot.appendChild(flight);
        fragment.appendChild(slot);
        fragment.appendChild(backSlot);

        const entry = {
          index, data, slot, backSlot, lift, flipper, back, button, backFx, frontFx,
          flipped: false, settled: false, nextFloatSampleAt: 0
        };
        if (compositedGridOptics) button.dataset.gridOptics = 'composited';
        button.getGridAmbientTilt = (delay = 0) =>
          compositedGridOptics && button.dataset.webglFace !== 'ready'
            ? { x: 0, y: 0 }
            : gridAmbientTilt(entry, performance.now() + delay);
        if (compositedGridOptics) button.addEventListener('birdwebglchange', startFloatOptics);
        entries.push(entry);
        back.addEventListener('click', () => flipEntry(entry));
      });

      row.appendChild(fragment);
      row.hidden = false;
      light.hidden = false;

      playStartedAt = performance.now();
      entries.forEach(entry => {
        entry.floatSpec = cardFlight(entry.slot, entry.backSlot, point, entry.index, entries.length);
      });
      flash(light, point, glow);
      row.classList.add('is-playing');

      const quiet = reducedMotion.matches;
      readyTimer = window.setTimeout(() => {
        dealt = true;
        entries.forEach((entry) => { entry.back.disabled = false; });
        if (onDealt) onDealt(cards);
      }, quiet ? 0 : firstLaunch + Math.max(0, entries.length - 1) * stagger + launchDuration);

      lightTimer = window.setTimeout(() => {
        light.hidden = true;
        light.textContent = '';
      }, quiet ? 290 : 1140);
    }

    return { play, flipAll, reset };
  };
})();
