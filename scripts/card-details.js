(() => {
  'use strict';

  const beamX = Math.sin(112 * Math.PI / 180);
  const beamY = -Math.cos(112 * Math.PI / 180);

  const laserSize = 256;
  const embossSize = 384;

  const diffractionLines = new Path2D();
  for (let line = -108; line < laserSize; line += 6) {
    diffractionLines.moveTo(line, 0);
    diffractionLines.bezierCurveTo(line + 30, 71, line + 48, 128, line + 125, laserSize);
  }

  function movingBeam(context, size, center, spread, stops) {
    const radius = size * (beamX + beamY) * spread;
    const start = center - radius;
    const end = center + radius;
    const gradient = context.createLinearGradient(start * beamX, start * beamY, end * beamX, end * beamY);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  const goldEdgeStops = [
    [0, 'transparent'],
    [.24, 'rgba(213, 148, 58, .34)'],
    [.43, 'rgba(255, 219, 126, .88)'],
    [.51, 'rgba(255, 247, 205, .99)'],
    [.63, 'rgba(242, 164, 68, .71)'],
    [.84, 'rgba(188, 113, 32, .19)'],
    [1, 'transparent']
  ];

  const prismFoilBeamStops = [
    [0, 'transparent'],
    [.18, 'rgba(84, 218, 240, .58)'],
    [.36, 'rgba(148, 248, 224, .88)'],
    [.50, 'rgba(255, 248, 255, .96)'],
    [.64, 'rgba(218, 148, 255, .86)'],
    [.82, 'rgba(255, 212, 146, .56)'],
    [1, 'transparent']
  ];

  const prismGlintStops = [
    [0, 'transparent'],
    [.24, 'rgba(122, 240, 236, .44)'],
    [.44, 'rgba(226, 206, 255, .90)'],
    [.52, 'rgba(255, 252, 248, 1)'],
    [.66, 'rgba(255, 192, 226, .66)'],
    [.84, 'transparent'],
    [1, 'transparent']
  ];

  const spectrumStops = [
    [0, 'transparent'], [.18, 'rgba(165,92,247,.44)'], [.33, 'rgba(91,157,253,.67)'],
    [.46, 'rgba(83,247,207,.80)'], [.59, 'rgba(255,233,130,.78)'],
    [.74, 'rgba(242,115,185,.58)'], [1, 'transparent']
  ];
  const holoSpectrumStops = [
    [0, 'transparent'],
    [.14, 'rgba(64, 204, 252, .42)'],
    [.28, 'rgba(92, 246, 212, .68)'],
    [.44, 'rgba(255, 240, 148, .66)'],
    [.58, 'rgba(248, 134, 212, .64)'],
    [.74, 'rgba(156, 124, 255, .56)'],
    [.88, 'rgba(88, 224, 246, .34)'],
    [1, 'transparent']
  ];
  const diffractionStops = [[0, 'transparent'], [.5, 'rgba(255,251,239,.45)'], [1, 'transparent']];
  const holoDiffractionStops = [
    [0, 'transparent'],
    [.32, 'rgba(130, 248, 240, .38)'],
    [.50, 'rgba(255, 252, 244, .68)'],
    [.68, 'rgba(232, 166, 255, .40)'],
    [1, 'transparent']
  ];

  function drawEngraving(context, texture, panel, x, y, size) {
    const cell = texture.naturalHeight;
    // The original prism contour was 256px; sample it without an extra resize.
    const stamp = panel === 0 ? 256 : cell;
    context.drawImage(texture, panel * cell, 0, stamp, stamp, x, y, size, size);
  }

  function paintGoldGlints(context, texture, size, nx, ny) {
    const center = (nx * beamX + ny * beamY) * size;
    context.clearRect(0, 0, size, size);
    context.save();
    context.fillStyle = 'rgba(214, 148, 60, .26)';
    context.fillRect(0, 0, size, size);
    context.fillStyle = movingBeam(context, size, center, .22, goldEdgeStops);
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'destination-in';
    drawEngraving(context, texture, 1, 0, 0, size);
    context.restore();
  }

  /* Secret: delicate iridescent chromatic plate embossing */
  function paintPrismGroove(context, texture, size, nx, ny) {
    const ox = (.5 - nx) * 1.8 + .4;
    const oy = (.5 - ny) * 1.8 + .85;
    context.clearRect(0, 0, size, size);
    context.save();
    const shade = context.createLinearGradient(0, 0, size, size);
    shade.addColorStop(0, 'rgba(26, 18, 56, .88)');
    shade.addColorStop(.52, 'rgba(46, 26, 74, .82)');
    shade.addColorStop(1, 'rgba(20, 28, 58, .88)');
    context.fillStyle = shade;
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'destination-in';
    drawEngraving(context, texture, 0, ox, oy, size);
    context.restore();
  }

  function paintPrismFoil(context, texture, size, nx, ny) {
    const shift = nx * .72 + ny * .28;
    const ox = (nx - .5) * .6;
    const oy = (ny - .5) * .6 - .2;

    context.clearRect(0, 0, size, size);
    context.save();

    const base = context.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#5ae0d8');
    base.addColorStop(.25, '#72a8f6');
    base.addColorStop(.50, '#c87cf8');
    base.addColorStop(.75, '#f48cc8');
    base.addColorStop(1, '#f4d27c');
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);

    context.fillStyle = createTiltPrismGradient(context, size, shift, .75);
    context.fillRect(0, 0, size, size);

    context.globalCompositeOperation = 'destination-in';
    drawEngraving(context, texture, 0, ox, oy, size);
    context.restore();
  }

  function paintPrismShine(context, texture, size, nx, ny) {
    const shift = nx * .72 + ny * .28;
    const center = (shift * size) * (beamX + beamY);
    const ox = (nx - .5) * 1.1 - .2;
    const oy = (ny - .5) * 1.1 - .45;

    context.clearRect(0, 0, size, size);
    context.save();

    context.fillStyle = createTiltPrismGradient(context, size, 1 - shift, .78);
    context.fillRect(0, 0, size, size);

    context.fillStyle = movingBeam(context, size, center, .20, prismGlintStops);
    context.fillRect(0, 0, size, size);

    context.globalCompositeOperation = 'destination-in';
    drawEngraving(context, texture, 0, ox, oy, size);
    context.restore();
  }

  function createTiltPrismGradient(context, size, shift, alphaScale) {
    // Classic repeating-band holographic prism sheet that glides across the whole card on tilt (not pointer-centered)
    const span = size * 1.85;
    const offset = (shift - .5) * size * 1.45;
    const grad = context.createLinearGradient(
      -size * .35 + offset, -size * .15 + offset * .45,
      span * .82 + offset, span * .92 + offset * .45
    );
    const stops = [
      [0.00, [255, 118, 186, .46]],
      [0.10, [255, 224, 128, .50]],
      [0.20, [108, 248, 212, .54]],
      [0.30, [84, 204, 255, .52]],
      [0.40, [172, 130, 255, .50]],
      [0.50, [255, 118, 186, .46]],
      [0.60, [255, 224, 128, .50]],
      [0.70, [108, 248, 212, .54]],
      [0.80, [84, 204, 255, .52]],
      [0.90, [172, 130, 255, .50]],
      [1.00, [255, 118, 186, .46]]
    ];
    for (let i = 0; i < stops.length; i += 1) {
      const c = stops[i][1];
      grad.addColorStop(stops[i][0], 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] * alphaScale).toFixed(3) + ')');
    }
    return grad;
  }

  function paintLaser(context, mask, size, nx, ny) {
    const shift = nx * .72 + ny * .28;
    const center = (shift * size) * (beamX + beamY);
    context.clearRect(0, 0, size, size);
    context.save();
    const grad = context.createLinearGradient(
      -size * .2 + (shift - .5) * size, 0,
      size * 1.1 + (shift - .5) * size, size
    );
    grad.addColorStop(0, 'rgba(178, 146, 248, .12)');
    grad.addColorStop(.36, 'rgba(226, 206, 255, .36)');
    grad.addColorStop(.52, 'rgba(255, 252, 255, .44)');
    grad.addColorStop(.68, 'rgba(154, 228, 240, .28)');
    grad.addColorStop(1, 'rgba(178, 146, 248, .10)');
    context.fillStyle = grad;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = movingBeam(context, size, center, .22, diffractionStops);
    context.lineWidth = .75;
    context.stroke(diffractionLines);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0, size, size);
    context.restore();
  }

  function paintHoloLaser(context, mask, size, nx, ny) {
    const shift = nx * .72 + ny * .28;
    const center = (shift * size) * (beamX + beamY);
    context.clearRect(0, 0, size, size);
    context.save();

    // Clean repeating rainbow holographic bands gliding across the bird on tilt (not overexposed)
    context.fillStyle = createTiltPrismGradient(context, size, shift, .62);
    context.fillRect(0, 0, size, size);

    // Fine curved holographic diffraction grating
    context.strokeStyle = movingBeam(context, size, center, .24, holoDiffractionStops);
    context.lineWidth = .8;
    context.stroke(diffractionLines);

    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0, size, size);
    context.restore();
  }

  // Each offline stamp holds a prism contour and sparse gold glints side by side.
  // Drawing it works even when a container denies access to canvas pixels.
  const engravingImages = new Map();
  function loadEngraving(subject) {
    if (!subject) return null;
    const source = subject.replace(/subject-(\d{3})\.webp$/, 'engraving-$1.webp');
    if (source === subject) return null;
    let image = engravingImages.get(source);
    if (image) engravingImages.delete(source);
    else {
      image = new Image();
      image.addEventListener('error', () => {
        if (engravingImages.get(source) === image) engravingImages.delete(source);
      }, { once: true });
      image.src = source;
    }
    engravingImages.set(source, image);
    if (engravingImages.size > 12) engravingImages.delete(engravingImages.keys().next().value);
    return image;
  }
  window.preloadBirdEngraving = loadEngraving;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cosmosSize = 240;
  const nebulaStyles = [
    { r: .46, vx: .007, vy: -.005, c1: 'rgba(84, 232, 240, .44)', c2: 'rgba(56, 138, 224, .14)', depth: 1.0 },
    { r: .50, vx: -.006, vy: .004, c1: 'rgba(186, 114, 252, .42)', c2: 'rgba(98, 54, 186, .14)', depth: 1.2 },
    { r: .42, vx: .005, vy: .006, c1: 'rgba(248, 132, 206, .34)', c2: 'rgba(148, 56, 136, .10)', depth: .9 },
    { r: .38, vx: -.005, vy: -.006, c1: 'rgba(255, 220, 146, .28)', c2: 'rgba(168, 128, 66, .08)', depth: 1.4 }
  ];
  let nebulaSprites;

  function getNebulaSprites() {
    if (!nebulaSprites) {
      nebulaSprites = nebulaStyles.map(cloud => {
        const sprite = document.createElement('canvas');
        const radius = cloud.r * cosmosSize;
        const center = Math.ceil(radius);
        sprite.width = sprite.height = center * 2;
        const paint = sprite.getContext('2d');
        if (!paint) return null;
        const glow = paint.createRadialGradient(center, center, 0, center, center, radius);
        glow.addColorStop(0, cloud.c1);
        glow.addColorStop(.52, cloud.c2);
        glow.addColorStop(1, 'transparent');
        paint.fillStyle = glow;
        paint.fillRect(0, 0, sprite.width, sprite.height);
        return { sprite, center };
      });
    }
    return nebulaSprites;
  }

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function attachSecretCosmos(card, art, serial) {
    const canvas = document.createElement('canvas');
    canvas.className = 'bird-secret-cosmos';
    canvas.width = cosmosSize;
    canvas.height = cosmosSize;
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const subject = art.querySelector('.subject');
    if (subject) art.insertBefore(canvas, subject);
    else art.appendChild(canvas);
    const seed = Number.parseInt(serial, 10) || 19;
    const rand = seededRandom(seed * 9973 + 41);

    // Reuse the same cloud textures for every card, with species-specific positioning.
    const nebulas = getNebulaSprites().map((texture, i) => {
      const x = rand();
      const y = rand();
      return texture && Object.assign({ x, y }, nebulaStyles[i], texture);
    }).filter(Boolean);

    // 58 twinkling stars across 3 parallax depth tiers
    const starColors = [
      [255, 255, 255],
      [186, 248, 255],
      [226, 204, 255],
      [255, 238, 188],
      [255, 198, 232]
    ];
    const stars = [];
    for (let i = 0; i < 58; i += 1) {
      const layer = i < 28 ? 0 : i < 48 ? 1 : 2;
      const col = starColors[Math.floor(rand() * starColors.length)];
      stars.push({
        x: rand(),
        y: rand(),
        vx: (layer === 0 ? .004 : layer === 1 ? .009 : .015) * (.65 + rand() * .7),
        vy: -(layer === 0 ? .003 : layer === 1 ? .006 : .010) * (.65 + rand() * .7),
        radius: layer === 0 ? (.55 + rand() * .6) : layer === 1 ? (.9 + rand() * .75) : (1.3 + rand() * .95),
        phase: rand() * Math.PI * 2,
        speed: 1.2 + rand() * 2.6,
        flare: layer === 2 || (layer === 1 && rand() > .55),
        depth: layer === 0 ? .5 : layer === 1 ? 1.1 : 1.9,
        color: 'rgb(' + col.join(',') + ')'
      });
    }

    let tiltX = .5;
    let tiltY = .5;
    let rafId = 0;
    let lastDraw = null;
    let frameTime = 900 + seed * 13;
    let active = false;
    let stopped = false;

    function wrap(v) {
      const m = v % 1;
      return m < 0 ? m + 1 : m;
    }

    function drawFrame(now) {
      const t = now * .001;
      const S = cosmosSize;
      const pxShift = (tiltX - .5) * 18;
      const pyShift = (tiltY - .5) * 18;

      ctx.clearRect(0, 0, S, S);

      // 1. Slowly drifting nebula clouds
      for (let i = 0; i < nebulas.length; i += 1) {
        const n = nebulas[i];
        const cx = wrap(n.x + t * n.vx) * S + pxShift * n.depth;
        const cy = wrap(n.y + t * n.vy) * S + pyShift * n.depth;
        ctx.drawImage(n.sprite, cx - n.center, cy - n.center);
      }

      // 2. Real-time twinkling & drifting stars
      for (let i = 0; i < stars.length; i += 1) {
        const st = stars[i];
        const sx = wrap(st.x + t * st.vx) * S + pxShift * st.depth;
        const sy = wrap(st.y + t * st.vy) * S + pyShift * st.depth;
        const twinkle = .24 + .76 * (.5 + .5 * Math.sin(t * st.speed + st.phase));
        const r = st.radius * (.85 + .3 * twinkle);

        // Soft glow halo
        ctx.fillStyle = st.color;
        ctx.globalAlpha = twinkle * .34;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Crisp star core
        ctx.globalAlpha = Math.min(1, twinkle * 1.05);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // 4-point diamond sparkle flare on brighter stars
        if (st.flare && twinkle > .48) {
          const arm = r * (3.2 + twinkle * 2.4);
          ctx.strokeStyle = st.color;
          ctx.globalAlpha = twinkle * .78;
          ctx.lineWidth = .75;
          ctx.beginPath();
          ctx.moveTo(sx - arm, sy);
          ctx.lineTo(sx + arm, sy);
          ctx.moveTo(sx, sy - arm);
          ctx.lineTo(sx, sy + arm);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 3. Occasional delicate shooting star gliding diagonally across the cosmos
      const cycle = t % 6.5;
      if (cycle < .75) {
        const p = cycle / .75;
        const headX = (.15 + p * .78) * S;
        const headY = (.10 + p * .46) * S;
        const tailX = headX - 28;
        const tailY = headY - 16;
        const fade = Math.sin(p * Math.PI);
        const sg = ctx.createLinearGradient(headX, headY, tailX, tailY);
        sg.addColorStop(0, 'rgba(255, 252, 240, ' + (.92 * fade).toFixed(3) + ')');
        sg.addColorStop(.45, 'rgba(154, 242, 255, ' + (.45 * fade).toFixed(3) + ')');
        sg.addColorStop(1, 'transparent');
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    }

    function loop(now) {
      rafId = 0;
      if (!card.isConnected) {
        stop();
        return;
      }
      if (!active || document.hidden || reducedMotion.matches) return;
      if (lastDraw === null) lastDraw = now;
      const elapsed = now - lastDraw;
      if (elapsed >= 32) {
        lastDraw = now;
        frameTime += Math.min(elapsed, 100);
        drawFrame(frameTime);
      }
      rafId = requestAnimationFrame(loop);
    }

    function syncVisibility() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      lastDraw = null;
      if (active && !document.hidden && !reducedMotion.matches) rafId = requestAnimationFrame(loop);
    }

    function setActive(next) {
      if (stopped || active === next) return;
      active = next;
      if (active) {
        document.addEventListener('visibilitychange', syncVisibility);
        reducedMotion.addListener(syncVisibility);
      } else {
        document.removeEventListener('visibilitychange', syncVisibility);
        reducedMotion.removeListener(syncVisibility);
      }
      syncVisibility();
    }

    function stop() {
      setActive(false);
      stopped = true;
    }

    drawFrame(frameTime);

    return {
      update(nx, ny) {
        if (stopped) return;
        tiltX = nx;
        tiltY = ny;
      },
      setActive,
      stop
    };
  }

  window.attachBirdDetail = function attachBirdDetail(card, art, data) {
    const rank = card.dataset.rank;
    if (rank !== 'ultra' && rank !== 'secret' && rank !== 'holo' && rank !== 'rare') return null;
    if (!data.subject) return null;

    const isEmboss = rank === 'ultra' || rank === 'secret';
    const isSecret = rank === 'secret';
    const isHolo = rank === 'holo';
    const mask = isEmboss ? loadEngraving(data.subject) : new Image();
    if (!mask) return null;
    const cosmos = isSecret ? attachSecretCosmos(card, art, data.serial) : null;

    const detail = document.createElement('span');
    detail.className = 'bird-details bird-details--' + (isSecret ? 'secret' : rank === 'ultra' ? 'gold-edge' : isHolo ? 'holo' : 'laser');
    detail.setAttribute('aria-hidden', 'true');

    let nx = .56;
    let ny = .46;
    let lastX = Infinity;
    let lastY = Infinity;
    let stopped = false;
    function needsPaint() {
      if (stopped || !mask.complete || !mask.naturalWidth) return false;
      if (isEmboss && mask.naturalWidth !== mask.naturalHeight * 2) return false;
      if (Math.abs(nx - lastX) < .004 && Math.abs(ny - lastY) < .004) return false;
      if (lastX === Infinity) detail.classList.add('is-ready');
      lastX = nx;
      lastY = ny;
      return true;
    }

    function attachMask(paint) {
      if (!isEmboss || !mask.complete) mask.addEventListener('load', paint, { once: true });
      if (!isEmboss) mask.src = data.subject;
      function update(x, y) {
        if (stopped || !Number.isFinite(x) || !Number.isFinite(y)) return;
        nx = x;
        ny = y;
        if (cosmos) cosmos.update(x, y);
        paint();
      }
      update.setActive = active => { if (cosmos) cosmos.setActive(active); };
      update.stop = () => {
        stopped = true;
        mask.removeEventListener('load', paint);
        if (cosmos) cosmos.stop();
      };
      return update;
    }

    if (isSecret) {
      const grooveCanvas = document.createElement('canvas');
      grooveCanvas.className = 'bird-detail-groove';
      grooveCanvas.width = embossSize;
      grooveCanvas.height = embossSize;
      const grooveCtx = grooveCanvas.getContext('2d');

      const foilCanvas = document.createElement('canvas');
      foilCanvas.className = 'bird-detail-foil';
      foilCanvas.width = embossSize;
      foilCanvas.height = embossSize;
      const foilCtx = foilCanvas.getContext('2d');

      const shineCanvas = document.createElement('canvas');
      shineCanvas.className = 'bird-detail-shine';
      shineCanvas.width = embossSize;
      shineCanvas.height = embossSize;
      const shineCtx = shineCanvas.getContext('2d');

      if (!grooveCtx || !foilCtx || !shineCtx) {
        if (cosmos) cosmos.stop();
        return null;
      }
      detail.appendChild(grooveCanvas);
      detail.appendChild(foilCanvas);
      detail.appendChild(shineCanvas);
      art.appendChild(detail);

      const subject = new Image();
      const paint = () => {
        if (!subject.complete || !subject.naturalWidth || !needsPaint()) return;
        paintPrismGroove(grooveCtx, mask, embossSize, nx, ny);
        paintPrismFoil(foilCtx, mask, embossSize, nx, ny);
        paintPrismShine(shineCtx, mask, embossSize, nx, ny);
        [grooveCtx, foilCtx, shineCtx].forEach(context => {
          context.save();
          context.globalCompositeOperation = 'destination-in';
          context.drawImage(subject, 0, 0, embossSize, embossSize);
          context.restore();
        });
      };

      const update = attachMask(paint);
      subject.addEventListener('load', paint, { once: true });
      subject.src = data.subject;
      const stop = update.stop;
      update.stop = () => {
        subject.removeEventListener('load', paint);
        stop();
      };
      return update;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'bird-detail-shine';
    const size = rank === 'ultra' ? embossSize : laserSize;
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;

    detail.appendChild(canvas);
    art.appendChild(detail);

    const paint = () => {
      if (!needsPaint()) return;
      if (rank === 'ultra') paintGoldGlints(context, mask, size, nx, ny);
      else if (isHolo) paintHoloLaser(context, mask, size, nx, ny);
      else paintLaser(context, mask, size, nx, ny);
    };

    return attachMask(paint);
  };
})();
