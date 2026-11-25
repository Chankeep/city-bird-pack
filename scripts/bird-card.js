(() => {
  'use strict';

  const browser = window.navigator;
  const platform = browser.userAgentData && browser.userAgentData.platform;
  const android = /Android/i.test(browser.userAgent) || platform === 'Android' ||
    (/^Linux a(?:rm|arch)/i.test(browser.platform) && browser.maxTouchPoints > 0 && !/CrOS/i.test(browser.userAgent));
  if (android) document.documentElement.classList.add('android-card-rendering');

  const labels = { common: '普通', rare: '稀有', holo: '全息稀有', ultra: '史诗', secret: '隐藏' };
  const rankGlyphs = { common: '·', rare: '◆', holo: '✦', ultra: '❖', secret: '✧' };
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const beamX = Math.sin(112 * Math.PI / 180);
  const beamY = -Math.cos(112 * Math.PI / 180);
  const restingLights = { common: [.41, .46], rare: [.59, .42], holo: [.54, .49], ultra: [.62, .44], secret: [.55, .56] };
  const stillTilt = { x: 0, y: 0 };
  const refreshOptics = new WeakMap();

  ['contextmenu', 'selectstart', 'dragstart'].forEach(type => {
    document.addEventListener(type, event => {
      if (event.target.closest && event.target.closest('.bird-card, .bird-card-back, .catalog-tile-open')) {
        event.preventDefault();
      }
    }, true);
  });

  function layer(className) {
    const span = document.createElement('span');
    span.className = className;
    return span;
  }

  function addSpan(parent, className, content) {
    const span = layer(className);
    if (content) span.textContent = content;
    parent.appendChild(span);
    return span;
  }

  function addCardLight(surface, rank) {
    if (rank === 'common') return null;
    const ambient = layer('bird-ambient');
    const light = layer('bird-idle-light');
    const clearcoat = surface.querySelector('.clearcoat');
    ambient.setAttribute('aria-hidden', 'true');
    ambient.appendChild(light);
    surface.insertBefore(ambient, clearcoat.nextSibling);

    if (rank === 'holo' || rank === 'secret') {
      const scatterWindow = layer('bird-idle-scatter');
      scatterWindow.appendChild(layer('bird-scatter-texture'));
      light.appendChild(scatterWindow);

      const direct = layer('bird-direct-scatter');
      direct.setAttribute('aria-hidden', 'true');
      surface.insertBefore(direct, ambient.nextSibling);
    }
    return light;
  }

  window.createBirdCard = function createBirdCard(data, { mode, initialPose, onOpen } = {}) {
    let isDetail = mode === 'inspect';
    let inTransit = false;
    const card = document.createElement('button');
    card.className = 'bird-card';
    card.type = 'button';
    card.dataset.rank = data.rank;
    card.setAttribute('aria-label', data.name + '，' + labels[data.rank] + (data.isNew ? '，本次新收录' : '') +
      (isDetail ? '，点按切换反光' : '，点按放大查看'));
    if (!isDetail) card.setAttribute('aria-haspopup', 'dialog');
    const face = addSpan(card, 'bird-card-face');
    const swayLayer = addSpan(face, 'bird-card-sway');
    const tiltLayer = addSpan(swayLayer, 'bird-card-tilt');
    const surface = addSpan(tiltLayer, 'bird-surface');
    let sway = null;
    if (data.subject) {
      card.dataset.hasMatte = '';
    }
    const metal = addSpan(surface, 'metal');
    metal.setAttribute('aria-hidden', 'true');
    const metalReflection = data.rank === 'ultra' ? addSpan(metal, 'metal-reflection') : null;
    addSpan(surface, 'bevel').setAttribute('aria-hidden', 'true');
    const art = addSpan(surface, 'bird-art');
    art.setAttribute('aria-hidden', 'true');
    const scene = addSpan(art, 'scene');
    scene.style.backgroundImage = 'url("' + data.image + '")';
    scene.style.backgroundSize = data.size;
    scene.style.backgroundPosition = data.position;
    const subject = addSpan(art, 'subject');
    if (data.subject) {
      subject.style.backgroundImage = 'url("' + data.subject + '")';
    }
    const windowFoil = addSpan(art, 'window-foil');
    let paintDetail = null;
    let detailsEnabled = false;
    addSpan(surface, 'foil').setAttribute('aria-hidden', 'true');
    const clearcoat = addSpan(surface, 'clearcoat');
    clearcoat.setAttribute('aria-hidden', 'true');

    const caption = addSpan(surface, 'bird-caption');
    addSpan(caption, 'bird-name', data.name);
    const metadata = addSpan(caption, 'bird-meta');
    addSpan(metadata, 'bird-serial', data.serial + ' / 036');
    const glyph = rankGlyphs[data.rank] || '·';
    addSpan(metadata, 'bird-rank', glyph + ' ' + labels[data.rank]);

    if (data.isNew) addSpan(surface, 'bird-new', '新收录').setAttribute('aria-hidden', 'true');
    const idleLight = addCardLight(surface, data.rank);
    const inspectorLight = android
      ? (data.rank === 'ultra' ? clearcoat : idleLight || windowFoil)
      : null;
    if (inspectorLight) inspectorLight.classList.add('bird-inspector-light');
    const webGLFace = window.attachBirdWebGL
      ? window.attachBirdWebGL(card, tiltLayer, surface, data)
      : null;

    const lightRest = restingLights[data.rank] || restingLights.common;
    const neutral = { x: lightRest[0], y: lightRest[1], tiltX: 0, tiltY: 0, shiftX: 0, shiftY: 0, flash: .30, lift: 0 };
    const optics = { width: 320, height: 396, left: 12, top: 12, artSize: 296 };
    let geometry;
    let press;
    let dragged = false;
    let inspected = false;
    let lastPointerUp = -Infinity;
    let lightTimer = 0;
    let lastLightAt = -Infinity;
    let nextLight = null;
    let paintedLight = null;
    let ambientTilt = stillTilt;
    let centeringForDock = false;
    let dockingTilt = null;

    function measure() {
      const bounds = card.getBoundingClientRect();
      geometry = { x: bounds.left + window.scrollX, y: bounds.top + window.scrollY, width: bounds.width, height: bounds.height };
    }

    function setCardWidth(width) {
      if (width) card.style.setProperty('--card-scale', String(width / optics.width));
      if (webGLFace) webGLFace.setDisplayWidth(width);
      geometry = null;
    }
    function scheduleLight() {
      if (lightTimer) return;
      const delay = 32 - (performance.now() - lastLightAt);
      if (delay > 0) lightTimer = window.setTimeout(paintLight, delay);
      else paintLight();
    }
    function paintInspectorPose(pose, tilt, projected) {
      const cx = optics.width * .5;
      const cy = optics.height * .5;
      const x = cx + pose.shiftX + tilt.y * 1.5;
      const y = cy + pose.shiftY + pose.lift - tilt.x * 1.5;
      const tiltX = pose.tiltX + tilt.x;
      const tiltY = pose.tiltY + tilt.y;
      const rotation = projected
        ? 'perspective(760px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)'
        : 'skew(' + (tiltX * .23).toFixed(2) + 'deg,' + (tiltY * .21).toFixed(2) + 'deg)';
      face.style.setProperty('--inspect-pose', 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) +
        'px) ' + rotation + ' translate(' + -cx + 'px,' + -cy + 'px)');
    }
    function paintWebGLPose(pose) {
      if (!android || !isDetail || card.dataset.webglFace !== 'ready') return;
      const tilt = dockingTilt || (inTransit ? stillTilt : ambientTilt);
      paintInspectorPose(pose, tilt, true);
    }
    function setAmbientTilt(tiltXDeg, tiltYDeg) {
      const nx = Number.isFinite(tiltXDeg) ? tiltXDeg : 0;
      const ny = Number.isFinite(tiltYDeg) ? tiltYDeg : 0;
      if (Math.abs(nx - ambientTilt.x) < .03 && Math.abs(ny - ambientTilt.y) < .03) return;
      ambientTilt = { x: nx, y: ny };
      if (inTransit) return;
      paintWebGLPose(nextLight || neutral);
      scheduleLight();
    }
    function onSwayOptics(sx, sy) {
      if (!centeringForDock) setAmbientTilt(-sy * 6.1, sx * 7.0);
    }
    function paintLight(refreshArtwork) {
      lightTimer = 0;
      lastLightAt = performance.now();
      const pose = nextLight || neutral;
      const useAmbient = !inTransit || centeringForDock;
      const atx = useAmbient ? ambientTilt.x : 0;
      const aty = useAmbient ? ambientTilt.y : 0;
      const effective = {
        x: clamp(pose.x + aty * .042),
        y: clamp(pose.y - atx * .042),
        tiltX: pose.tiltX + atx,
        tiltY: pose.tiltY + aty,
        flash: clamp(pose.flash + Math.hypot(atx, aty) * .045)
      };
      const useInspectorLight = inspectorLight && isDetail;
      const useWebGL = card.dataset.webglFace === 'ready';
      const hasArtwork = Boolean(paintedLight);
      paintedLight = effective;
      if (webGLFace) webGLFace.update(effective);
      if (useInspectorLight) {
        if (!useWebGL) {
          paintInspectorPose(pose, { x: atx, y: aty }, false);
          inspectorLight.style.left = ((effective.x - neutral.x) * optics.width * .46).toFixed(1) + 'px';
          inspectorLight.style.top = ((effective.y - neutral.y) * optics.height * .30).toFixed(1) + 'px';
        }
        if (hasArtwork && !refreshArtwork) return;
      }
      if (useWebGL && !refreshArtwork) return;
      const artwork = useInspectorLight ? neutral : effective;
      const { x: effX, y: effY, tiltX: effTiltX, tiltY: effTiltY, flash: effFlash } = artwork;
      const px = effX * optics.width;
      const py = effY * optics.height;
      const reflectionDistance = px * beamX + py * beamY;
      const ax = px - optics.left;
      const ay = py - optics.top;
      const shadowX = (-effTiltY * .9).toFixed(1) + 'px';
      const shadowY = (14 + effTiltX * .7).toFixed(1) + 'px';
      surface.style.setProperty('--sx', px.toFixed(2) + 'px');
      surface.style.setProperty('--sy', py.toFixed(2) + 'px');
      surface.style.setProperty('--window-x', ax.toFixed(2) + 'px');
      surface.style.setProperty('--window-y', ay.toFixed(2) + 'px');
      surface.style.setProperty('--reflect-distance', reflectionDistance.toFixed(2) + 'px');
      surface.style.setProperty('--window-distance', (ax * beamX + ay * beamY).toFixed(2) + 'px');
      surface.style.setProperty('--light-x', (effX * 100).toFixed(2) + '%');
      surface.style.setProperty('--light-y', (effY * 100).toFixed(2) + '%');
      surface.style.setProperty('--flash', effFlash.toFixed(3));
      surface.style.setProperty('--shadow-x', shadowX);
      surface.style.setProperty('--shadow-y', shadowY);
      if (metalReflection) {
        const progress = reflectionDistance / (optics.width * beamX + optics.height * beamY);
        const fade = clamp((progress - .16) / .58);
        const rightLight = .35 + .18 * fade * fade * (3 - 2 * fade);
        const angle = 126 + effTiltY * 1.65 + effTiltX * .75;
        const focus = 50 + effTiltY * .95 - effTiltX * .70;
        surface.style.setProperty('--epic-right-light', rightLight.toFixed(3));
        surface.style.setProperty('--epic-metal-angle', angle.toFixed(2) + 'deg');
        surface.style.setProperty('--epic-metal-focus', focus.toFixed(2) + '%');
      }
      if (paintDetail) paintDetail(ax / optics.artSize, ay / optics.artSize);
    }

    function paint(pose) {
      if (android) {
        // A single perspective transform rotates the already-composited canvas.
        paintWebGLPose(pose);
      } else {
        tiltLayer.style.setProperty('--tilt-x', pose.tiltX.toFixed(2) + 'deg');
        tiltLayer.style.setProperty('--tilt-y', pose.tiltY.toFixed(2) + 'deg');
        tiltLayer.style.setProperty('--shift-x', pose.shiftX.toFixed(2) + 'px');
        tiltLayer.style.setProperty('--shift-y', pose.shiftY.toFixed(2) + 'px');
        tiltLayer.style.setProperty('--lift', pose.lift.toFixed(2) + 'px');
      }

      // The grid samples ambient tilt separately from pointer motion.
      if (card.dataset.gridOptics === 'composited' && !isDetail) return;
      nextLight = pose;
      if (lightTimer) return;
      if (!centeringForDock && paintedLight && ['x', 'y', 'tiltX', 'tiltY', 'flash'].every(key => paintedLight[key] === pose[key])) return;
      scheduleLight();
    }
    const motion = window.createCardMotion(neutral, paint);
    if (initialPose) motion.setPose(initialPose);
    function redraw() {
      setCardWidth(card.offsetWidth);
    }
    refreshOptics.set(card, redraw);
    requestAnimationFrame(redraw);

    function moveTo(x, y, gripping = false) {
      motion.track({
        x, y, tiltX: (.5 - y) * 13, tiltY: (x - .5) * 16,
        shiftX: gripping ? (x - .5) * 10 : 0,
        shiftY: gripping ? (y - .5) * 12 : 0,
        flash: .44 + Math.hypot(x - .5, y - .5) * .77, lift: gripping ? -7 : -4
      });
    }
    function track(event) {
      if (!geometry) measure();
      if (geometry.width && geometry.height) {
        moveTo(clamp((event.pageX - geometry.x) / geometry.width), clamp((event.pageY - geometry.y) / geometry.height), Boolean(press));
      }
    }
    function rest() {
      if (inTransit) return;
      inspected = false;
      motion.rest();
    }

    card.setCardWidth = setCardWidth;
    card.setAmbientTilt = setAmbientTilt;
    function syncDOMDetailMotion() {
      if (paintDetail && paintDetail.setActive) {
        paintDetail.setActive(isDetail && !inTransit && !android && card.dataset.webglFace !== 'ready');
      }
    }
    function enableDOMDetails() {
      if (!detailsEnabled || !card.isConnected || card.dataset.webglFace === 'ready') return;
      if (!paintDetail && data.rank !== 'common' && window.attachBirdDetail) {
        paintDetail = window.attachBirdDetail(card, art, data);
      }
      syncDOMDetailMotion();
      window.clearTimeout(lightTimer);
      paintLight(true);
    }
    card.enableDetails = function enableDetails() {
      detailsEnabled = true;
      enableDOMDetails();
    };
    if (webGLFace) card.addEventListener('birdwebglchange', () => {
      if (card.dataset.webglFace === 'ready') {
        paintWebGLPose(motion.getPose());
        syncDOMDetailMotion();
      } else {
        enableDOMDetails();
      }
    });
    card.releaseDetails = function releaseDetails() {
      detailsEnabled = false;
      if (webGLFace) webGLFace.release();
      if (paintDetail && paintDetail.stop) paintDetail.stop();
      window.clearTimeout(lightTimer);
      lightTimer = 0;
      if (sway) sway.stop();
      motion.hold();
    };
    card.getCardPose = motion.getPose;
    card.centerInspectSway = (duration, gridTilt = { x: 0, y: 0 }) => {
      const from = ambientTilt;
      centeringForDock = true;
      dockingTilt = from;
      if (sway) sway.center(duration);
      motion.center(duration, amount => {
        ambientTilt = {
          x: from.x + (gridTilt.x - from.x) * amount,
          y: from.y + (gridTilt.y - from.y) * amount
        };
        // End with a flat face at the destination while its light matches the grid.
        dockingTilt = { x: from.x * (1 - amount), y: from.y * (1 - amount) };
      });
    };
    card.setInspectMode = function setInspectMode(active, moving) {
      isDetail = active;
      inTransit = moving;
      if (webGLFace) webGLFace.setInspectMode(active && !moving, active);
      press = null;
      dragged = false;
      inspected = false;
      lastPointerUp = -Infinity;
      geometry = null;
      if (moving) motion.hold();
      if (!active) {
        if (inspectorLight) {
          face.style.removeProperty('--inspect-pose');
          inspectorLight.style.removeProperty('left');
          inspectorLight.style.removeProperty('top');
        }
        if (sway) sway.stop();
        if (!centeringForDock) ambientTilt = stillTilt;
        centeringForDock = false;
        dockingTilt = null;
        scheduleLight();
      } else if (moving) {
        if (sway) sway.suspend(true);
      } else {
        if (!sway) sway = window.createInspectSway(swayLayer, android ? null : metalReflection, onSwayOptics, android);
        sway.suspend(false);
        sway.start();
        paintWebGLPose(motion.getPose());
      }
      syncDOMDetailMotion();
      if (active) card.removeAttribute('aria-haspopup');
      else card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-label', data.name + '，' + labels[data.rank] + (data.isNew ? '，本次新收录' : '') +
        (active ? '，点按切换反光' : '，点按放大查看'));
    };

    card.addEventListener('pointerenter', (event) => {
      if (card.disabled || inTransit || event.pointerType !== 'mouse') return;
      if (isDetail && sway) sway.suspend(true);
      measure();
      motion.enter();
      track(event);
    });
    card.addEventListener('pointermove', (event) => {
      if (card.disabled || inTransit) return;
      if (press && press.id === event.pointerId) {
        if (Math.hypot(event.pageX - press.x, event.pageY - press.y) > 6) {
          dragged = true;
        }
      }
      if (event.pointerType !== 'mouse' && (!press || press.id !== event.pointerId || (!isDetail && !dragged))) return;
      track(event);
    }, { passive: true });
    card.addEventListener('pointerleave', (event) => {
      if (press && press.id === event.pointerId && (!card.hasPointerCapture || !card.hasPointerCapture(event.pointerId))) {
        press = null;
        if (sway) sway.suspend(false);
      }
      if (event.pointerType === 'mouse') {
        if (isDetail && sway) sway.suspend(false);
        rest();
      }
    });
    card.addEventListener('pointerdown', (event) => {
      if (card.disabled || inTransit || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      dragged = false;
      measure();
      press = { id: event.pointerId, x: event.pageX, y: event.pageY };
      if (isDetail) {
        inspected = false;
        motion.enter(true);
        track(event);
        if (sway) sway.suspend(true);
        if (card.setPointerCapture) {
          try { card.setPointerCapture(event.pointerId); } catch (_) { /* Pointer may already be gone. */ }
        }
      }
    });
    card.addEventListener('pointerup', (event) => {
      if (!press || press.id !== event.pointerId) return;
      press = null;
      if (sway) sway.suspend(false);
      if (isDetail) {
        lastPointerUp = performance.now();
        if (event.pointerType === 'mouse') {
          motion.enter(true);
          track(event);
        } else {
          motion.release();
        }
      } else if (dragged && event.pointerType !== 'mouse') {
        rest();
      }
    });
    function cancelPress(event) {
      if (!press || press.id !== event.pointerId) return;
      dragged = false;
      press = null;
      if (sway) sway.suspend(false);
      rest();
    }
    card.addEventListener('pointercancel', cancelPress);
    card.addEventListener('lostpointercapture', cancelPress);
    card.addEventListener('blur', rest);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') lastPointerUp = -Infinity;
    });
    card.addEventListener('click', (event) => {
      if (inTransit) return;
      const moved = dragged;
      dragged = false;
      if (moved && event.detail !== 0) return;
      if (!isDetail) {
        if (onOpen) onOpen(card);
        return;
      }
      if (event.detail !== 0 || performance.now() - lastPointerUp < 500) return;
      if (inspected) { rest(); return; }
      measure();
      inspected = true;
      motion.enter(true);
      moveTo(.76, .33);
    });
    return card;
  };

  window.addEventListener('resize', () => {
    document.querySelectorAll('.bird-card').forEach((card) => {
      const fn = refreshOptics.get(card);
      if (fn) fn();
    });
  });

})();
