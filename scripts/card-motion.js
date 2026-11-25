(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const entryDuration = 140;
  const pressDuration = 190;
  const returnDuration = 740;
  const stillPose = 'translate3d(0px, 0px, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)';

  function returnEasing(progress) {
    const offset = progress - 1;
    return 1 + 2.05 * offset * offset * offset + 1.05 * offset * offset;
  }

  window.createCardMotion = function createCardMotion(neutral, render) {
    const channels = Object.keys(neutral);
    let current = neutral;
    let request = 0;
    let pending = null;
    let entering = null;
    let returning = null;
    let releaseAfterEntry = false;
    render(neutral);

    function blend(from, to, amount) {
      const next = {};
      channels.forEach((key) => {
        next[key] = from[key] + (to[key] - from[key]) * amount;
      });
      return next;
    }

    function progress(now, start, duration) {
      return Math.min(1, Math.max(0, (now - start) / duration));
    }

    function advance(now) {
      request = 0;
      if (pending) {
        if (entering && !reducedMotion.matches) {
          const portion = progress(now, entering.start, entering.duration);
          if (portion < 1) {
            const remaining = 1 - portion;
            const easing = entering.linear ? portion : 1 - remaining * remaining * remaining;
            current = blend(entering.from, pending, easing);
            render(current);
            request = requestAnimationFrame(advance);
            return;
          }
        }
        entering = null;
        current = pending;
        pending = null;
        render(current);
        if (releaseAfterEntry) rest();
        return;
      }
      if (!returning) return;

      const { from, start, duration = returnDuration, onSample } = returning;
      const fraction = reducedMotion.matches ? 1 : progress(now, start, duration);
      const amount = onSample ? 1 - (1 - fraction) * (1 - fraction) : returnEasing(fraction);
      if (onSample) onSample(amount);
      if (fraction === 1) {
        current = neutral;
        returning = null;
        render(current);
        return;
      }

      current = blend(from, neutral, amount);
      render(current);
      request = requestAnimationFrame(advance);
    }

    function rest() {
      releaseAfterEntry = false;
      pending = null;
      entering = null;
      if (returning || current === neutral) return;
      if (reducedMotion.matches) {
        if (request) cancelAnimationFrame(request);
        request = 0;
        current = neutral;
        render(current);
        return;
      }
      returning = { from: current, start: performance.now() };
      if (!request) request = requestAnimationFrame(advance);
    }

    function hold() {
      if (request) cancelAnimationFrame(request);
      request = 0;
      pending = entering = returning = null;
      releaseAfterEntry = false;
    }

    return {
      enter(linear = false) {
        releaseAfterEntry = false;
        if (!reducedMotion.matches) {
          entering = { from: current, start: performance.now(), duration: linear ? pressDuration : entryDuration, linear };
        }
      },
      track(pose) {
        // Keep the latest sample without restarting the one-time entry easing.
        pending = pose;
        returning = null;
        if (!request) request = requestAnimationFrame(advance);
      },
      rest,
      center(duration, onSample) {
        hold();
        returning = { from: current, start: performance.now(), duration, onSample };
        request = requestAnimationFrame(advance);
      },
      release() {
        if (entering && pending && !reducedMotion.matches) releaseAfterEntry = true;
        else rest();
      },
      getPose: () => current,
      setPose(pose) {
        current = pose;
        render(current);
      },
      hold,
      redraw: () => render(current)
    };
  };

  window.createInspectSway = function createInspectSway(element, metalReflection, onOptics, sampleOnly) {
    const stillReflection = 'translate3d(0px, 0px, 0px)';
    let active = false;
    let suspended = false;
    let animation = null;
    let reflectionAnimation = null;
    let pose = stillPose;
    let reflectionPose = stillReflection;
    let heading = Math.random() * Math.PI * 2;
    let fromVec = { x: 0, y: 0 };
    let toVec = { x: 0, y: 0 };
    let curVec = { x: 0, y: 0 };
    let segDuration = 0;
    let segEaseOut = false;
    let opticsFrame = 0;
    let lastOpticsAt = -Infinity;

    function stopOpticsLoop() {
      if (opticsFrame) cancelAnimationFrame(opticsFrame);
      opticsFrame = 0;
    }

    function reportOptics(x, y) {
      curVec = { x, y };
      if (onOptics) onOptics(x, y);
    }

    function stepOptics(now) {
      opticsFrame = 0;
      if (!active || suspended || document.hidden || !animation || !segDuration) return;
      if (now - lastOpticsAt >= 30) {
        lastOpticsAt = now;
        const ct = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
        const t = Math.min(1, Math.max(0, ct / segDuration));
        const eased = segEaseOut
          ? (1 - (1 - t) * (1 - t))
          : (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        reportOptics(
          fromVec.x + (toVec.x - fromVec.x) * eased,
          fromVec.y + (toVec.y - fromVec.y) * eased
        );
      }
      opticsFrame = requestAnimationFrame(stepOptics);
    }

    function startOpticsLoop() {
      if (!onOptics || opticsFrame || !active || suspended || document.hidden || !animation) return;
      opticsFrame = requestAnimationFrame(stepOptics);
    }

    function cancelAnimations() {
      stopOpticsLoop();
      if (animation) animation.cancel();
      if (reflectionAnimation) reflectionAnimation.cancel();
      animation = null;
      reflectionAnimation = null;
      segDuration = 0;
    }

    function clearPose() {
      cancelAnimations();
      pose = stillPose;
      reflectionPose = stillReflection;
      fromVec = { x: 0, y: 0 };
      toVec = { x: 0, y: 0 };
      reportOptics(0, 0);
      element.style.removeProperty('transform');
      if (metalReflection) metalReflection.style.removeProperty('transform');
    }

    function animateStep(from, to, reflectionFrom, reflectionTo, timing) {
      animation = element.animate(sampleOnly ? [] : [{ transform: from }, { transform: to }], timing);
      if (metalReflection) {
        reflectionAnimation = metalReflection.animate([{ transform: reflectionFrom }, { transform: reflectionTo }], timing);
      }
      return animation;
    }

    function advance() {
      heading += Math.PI * (.44 + Math.random() * .42);
      const strength = .68 + Math.random() * .32;
      const x = Math.cos(heading) * strength;
      const y = Math.sin(heading) * strength;
      const roll = (Math.random() - .5) * 4.2;
      const next = 'translate3d(' + (x * 13).toFixed(2) + 'px, ' + (y * 15).toFixed(2) +
        'px, 0px) rotateX(' + (-y * 6.1).toFixed(2) + 'deg) rotateY(' + (x * 7).toFixed(2) +
        'deg) rotateZ(' + roll.toFixed(2) + 'deg)';
      const nextReflection = metalReflection ?
        'translate3d(' + (x * 24).toFixed(2) + 'px, ' + (y * 18).toFixed(2) + 'px, 0px)' : stillReflection;
      const duration = 2050 + Math.random() * 1250;
      fromVec = { x: curVec.x, y: curVec.y };
      toVec = { x, y };
      segDuration = duration;
      segEaseOut = false;
      const step = animateStep(pose, next, reflectionPose, nextReflection, {
        duration,
        easing: 'ease-in-out',
        fill: 'both'
      });
      startOpticsLoop();
      step.onfinish = () => {
        if (animation !== step) return;
        pose = next;
        if (!sampleOnly) element.style.transform = pose;
        reflectionPose = nextReflection;
        if (metalReflection) metalReflection.style.transform = reflectionPose;
        reportOptics(x, y);
        cancelAnimations();
        sync();
      };
    }

    function sync() {
      if (!active || reducedMotion.matches) {
        clearPose();
      } else if (suspended || document.hidden) {
        stopOpticsLoop();
        if (animation) animation.pause();
        if (reflectionAnimation) reflectionAnimation.pause();
      } else if (!animation) {
        advance();
      } else if (animation.playState === 'paused') {
        animation.play();
        if (reflectionAnimation) reflectionAnimation.play();
        startOpticsLoop();
      }
    }

    return {
      start() {
        if (active || typeof element.animate !== 'function') return;
        active = true;
        document.addEventListener('visibilitychange', sync);
        reducedMotion.addListener(sync);
        sync();
      },
      suspend(value) {
        suspended = value;
        if (active) sync();
      },
      center(duration) {
        if (!active || reducedMotion.matches) return;
        if (sampleOnly) {
          cancelAnimations();
          return;
        }
        const from = getComputedStyle(element).transform;
        const reflectionFrom = metalReflection ? getComputedStyle(metalReflection).transform : stillReflection;
        const prevVec = { x: curVec.x, y: curVec.y };
        clearPose();
        if (from !== 'none') {
          fromVec = prevVec;
          toVec = { x: 0, y: 0 };
          segDuration = duration;
          segEaseOut = true;
          animateStep(from, stillPose, reflectionFrom, stillReflection, {
            duration, easing: 'ease-out', fill: 'both'
          });
          startOpticsLoop();
        }
      },
      stop() {
        if (!active) return;
        active = false;
        suspended = false;
        document.removeEventListener('visibilitychange', sync);
        reducedMotion.removeListener(sync);
        clearPose();
      }
    };
  };
})();
