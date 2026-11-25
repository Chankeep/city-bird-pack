(() => {
  'use strict';

  const segmentCount = 7;
  const openThreshold = .58;
  const edge = [0, -.34, .46, -.28, .28, -.49, .55, -.21, .17, -.39, .37, -.59, .34, -.18, .53, -.33, .25, -.15, .37, 0];
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const polygon = (points) => 'polygon(' + points.map(([x, y]) => x.toFixed(2) + '% ' + y.toFixed(2) + '%').join(',') + ')';

  window.createPackTear = function createPackTear({ stage, pack, handle, onOpen, onTick }) {
    const body = pack.querySelector('.pack-body');
    const strip = pack.querySelector('.pack-foil');
    const mouth = pack.querySelector('.pack-mouth');
    const effects = pack.querySelector('.tear-effects');
    const trail = effects.querySelector('.tear-trail');
    const tipLight = effects.querySelector('.tear-tip');
    const sparks = effects.querySelector('.tear-sparks');
    const sparkColors = ['255,252,223', '255,205,108', '136,242,224', '251,152,221'];
    const clips = window.CSS && (CSS.supports('clip-path', 'polygon(0 0, 100% 0, 0 100%)')
      || CSS.supports('-webkit-clip-path', 'polygon(0 0, 100% 0, 0 100%)'));
    const segments = Array.from({ length: segmentCount }, () => {
      const segment = document.createElement('span');
      segment.className = 'pack-foil-piece';
      segment.hidden = true;
      strip.appendChild(segment);
      return segment;
    });

    let drag = null;
    let progress = 0;
    let target = 0;
    let direction = 1;
    let seam = 9.6;
    let bend = 0;
    let frame = 0;
    let released = false;
    let opening = false;
    let ignoreClick = false;
    let sparkProgress = 0;

    function readSeam() {
      const raw = getComputedStyle(pack).getPropertyValue('--seam').trim();
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) return 9.6;
      return clamp(value < 1 && raw.indexOf('%') === -1 ? value * 100 : value, 4, 35);
    }

    function seamY(x) {
      const position = x * (edge.length - 1) / 100;
      const index = Math.min(edge.length - 2, Math.floor(position));
      return seam + edge[index] + (edge[index + 1] - edge[index]) * (position - index);
    }

    function seamBetween(start, end) {
      const points = [[start, seamY(start)]];
      edge.forEach((_, index) => {
        const x = index * 100 / (edge.length - 1);
        if (x > start && x < end) points.push([x, seamY(x)]);
      });
      points.push([end, seamY(end)]);
      return points;
    }

    function setClip(element, value) {
      element.style.webkitClipPath = value;
      element.style.clipPath = value;
    }

    function addSpark(x, y, index, burst) {
      if (sparks.childElementCount >= 24) return;
      const spark = document.createElement('span');
      spark.className = 'tear-spark';
      const spread = burst ? 1.5 : 1;
      spark.style.left = x + '%';
      spark.style.top = y + '%';
      spark.style.setProperty('--spark-dx', ((Math.random() - .42) * 76 * spread + direction * 17).toFixed(1) + 'px');
      spark.style.setProperty('--spark-dy', (-(14 + Math.random() * 61) * spread).toFixed(1) + 'px');
      spark.style.setProperty('--spark-time', Math.round(235 + Math.random() * 160) + 'ms');
      spark.style.setProperty('--spark-size', (1.5 + Math.random() * (burst ? 4 : 2.5)).toFixed(1) + 'px');
      spark.style.setProperty('--spark-color', sparkColors[index % sparkColors.length]);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
      sparks.appendChild(spark);
    }

    function paintLight(amount) {
      const position = direction > 0 ? amount * 100 : 100 - amount * 100;
      const active = amount > .003;
      pack.classList.toggle('is-tearing', active);
      if (!active) {
        sparkProgress = 0;
        return;
      }

      tipLight.style.left = position.toFixed(2) + '%';
      tipLight.style.top = seamY(position).toFixed(2) + '%';
      trail.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
      effects.style.setProperty('--tear-amount', amount.toFixed(3));
      effects.style.setProperty('--tear-live', Math.min(1, amount * 15).toFixed(2));
      const count = Math.min(6, Math.floor((amount - sparkProgress) * 29));
      if (count < 1) return;
      if (onTick) onTick(amount);
      if (!motionPreference.matches) {
        for (let i = 0; i < count; i += 1) {
          const point = amount - (amount - sparkProgress) * (count - 1 - i) / count;
          const x = direction > 0 ? point * 100 : 100 - point * 100;
          addSpark(x, seamY(x), Math.floor(point * 29), false);
        }
      }
      sparkProgress = amount;
    }

    function paint(amount) {
      progress = amount;
      const flex = motionPreference.matches ? 0 : amount;
      pack.style.setProperty('--tear-angle', (direction * flex * 3.2).toFixed(2) + 'deg');
      pack.style.setProperty('--tear-pull', (direction * flex * 5).toFixed(2) + 'px');
      pack.style.setProperty('--tear-width', (1 + flex * .031).toFixed(3));
      pack.style.setProperty('--tear-height', (1 - flex * .055).toFixed(3));
      paintLight(amount);
      if (!clips || amount <= .001) {
        setClip(body, '');
        mouth.style.opacity = '0';
        segments.forEach((segment) => { segment.hidden = true; });
        return;
      }

      const extent = amount * 100;
      const tip = direction > 0 ? extent : 100 - extent;
      const start = direction > 0 ? 0 : tip;
      const end = direction > 0 ? tip : 100;
      const exposed = seamBetween(start, end);
      const bottom = [[100, 100], [0, 100]];
      const remaining = direction > 0
        ? exposed.concat([[tip, 0], [100, 0]], bottom)
        : [[0, 0], [tip, 0]].concat(exposed, bottom);
      setClip(body, polygon(remaining));
      setClip(mouth, 'inset(0 ' + (100 - end).toFixed(2) + '% 0 ' + start.toFixed(2) + '%)');
      mouth.style.opacity = Math.min(1, amount * 6).toFixed(2);
      strip.style.setProperty('--foil-origin', tip.toFixed(2) + '% ' + seamY(tip).toFixed(2) + '%');
      strip.style.setProperty('--foil-lift', (-flex * (6 + Math.max(0, -bend) * .1)).toFixed(2) + 'px');
      strip.style.setProperty('--foil-turn', (direction * flex * (12 + clamp(-bend * .22, -5, 9))).toFixed(2) + 'deg');

      let chain = '';
      for (let step = 0; step < segmentCount; step += 1) {
        const index = direction > 0 ? segmentCount - 1 - step : step;
        const segment = segments[index];
        const low = Math.max(start, index * 100 / segmentCount - .08);
        const high = Math.min(end, (index + 1) * 100 / segmentCount + .08);
        segment.hidden = high - low < .04;
        if (segment.hidden) continue;

        const hinge = direction > 0 ? high : low;
        const curl = direction * -(8 + amount * 11 + step * .8);
        chain += 'translateX(' + hinge.toFixed(2) + '%) rotateY(' + curl.toFixed(2) +
          'deg) translateX(' + (-hinge).toFixed(2) + '%) ';
        segment.style.transform = motionPreference.matches ? 'none' : chain;
        segment.style.setProperty('--foil-glare', Math.min(.64, .17 + chain.length / 1350).toFixed(2));
        setClip(segment, polygon([[low, 0], [high, 0]].concat(seamBetween(low, high).reverse())));
      }
    }

    function cancelFrame() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function animateTo(end, milliseconds, done) {
      cancelFrame();
      if (motionPreference.matches || !clips) {
        paint(end);
        if (done) done();
        return;
      }
      const from = progress;
      const start = performance.now();
      function animate(now) {
        const portion = clamp((now - start) / milliseconds, 0, 1);
        const ease = 1 - Math.pow(1 - portion, 3);
        paint(from + (end - from) * ease);
        if (portion < 1) frame = requestAnimationFrame(animate);
        else {
          frame = 0;
          if (done) done();
        }
      }
      frame = requestAnimationFrame(animate);
    }

    function endCapture() {
      const finished = drag;
      drag = null;
      pack.classList.remove('is-grabbed');
      if (finished && typeof handle.hasPointerCapture === 'function' &&
          handle.hasPointerCapture(finished.id)) handle.releasePointerCapture(finished.id);
      return finished;
    }

    function open() {
      if (opening || released || stage.dataset.phase !== 'sealed') return;
      opening = true;
      endCapture();
      handle.disabled = true;
      pack.classList.add('is-tearing');
      seam = readSeam();
      const duration = 115 + (1 - progress) * 270;
      const separate = () => {
        opening = false;
        released = true;
        pack.style.setProperty('--tear-dir', String(direction));
        pack.classList.add('is-released');
        if (!motionPreference.matches) {
          const edge = direction > 0 ? 100 : 0;
          for (let i = 0; i < 8; i += 1) addSpark(edge, seamY(edge), i, true);
        }
        onOpen();
      };
      if (progress >= .999) separate();
      else animateTo(1, duration, separate);
    }

    function finishGesture(event, cancelled) {
      if (!drag || drag.id !== event.pointerId) return;
      const current = endCapture();
      if (current.moved) ignoreClick = true;
      if (!current.tearDirection) return;
      ignoreClick = true;
      cancelFrame();
      paint(target);
      if (!cancelled && progress >= openThreshold) {
        open();
        return;
      }
      bend = 0;
      animateTo(0, 270);
    }

    handle.addEventListener('pointerdown', (event) => {
      if (drag || opening || released || (event.pointerType === 'mouse' && event.button !== 0)) return;
      cancelFrame();
      ignoreClick = false;
      seam = readSeam();
      const bounds = pack.getBoundingClientRect();
      target = progress;
      drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        width: bounds.width, base: progress, tearDirection: progress > .008 ? direction : 0, moved: false
      };
      if (typeof handle.setPointerCapture === 'function') {
        try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      }
      pack.classList.add('is-grabbed');
    });

    window.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) >= 7 || Math.abs(dy) >= 7) drag.moved = true;
      if (!drag.tearDirection) {
        if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy)) return;
        drag.tearDirection = dx < 0 ? -1 : 1;
      }
      direction = drag.tearDirection;
      bend = clamp(dy, -41, 41);
      target = clamp(drag.base + dx * direction / Math.max(44, drag.width * .85), 0, 1);
      if (!clips) return;
      if (target >= 1) {
        ignoreClick = true;
        paint(1);
        open();
      } else if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint(target);
        });
      }
    }, { passive: true });

    window.addEventListener('pointerup', (event) => finishGesture(event, false));
    window.addEventListener('pointercancel', (event) => finishGesture(event, true));
    handle.addEventListener('lostpointercapture', (event) => finishGesture(event, true));
    handle.addEventListener('click', (event) => {
      if (event.detail !== 0 && ignoreClick) return;
      open();
    });

    function setPackImage(imageUrl) {
      const value = 'url("' + imageUrl + '")';
      body.style.backgroundImage = value;
      segments.forEach((segment) => { segment.style.backgroundImage = value; });
    }

    return {
      open,
      setPackImage,
      reset() {
        endCapture();
        cancelFrame();
        released = false;
        opening = false;
        ignoreClick = false;
        target = 0;
        bend = 0;
        direction = 1;
        sparks.textContent = '';
        seam = readSeam();
        pack.classList.remove('is-released');
        handle.disabled = false;
        paint(0);
      }
    };
  };
})();
