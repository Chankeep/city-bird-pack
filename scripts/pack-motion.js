(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const neutral = { rotationX: 0, rotationY: 0, glareX: 50, glareY: 34 };
  const clamp = (value) => Math.min(1, Math.max(0, value));

  window.createPackMotion = function createPackMotion({ stage, pack, handle }) {
    const tilt = pack.querySelector('.pack-tilt');
    const motion = window.createCardMotion(neutral, ({ rotationX, rotationY, glareX, glareY }) => {
      tilt.style.setProperty('--pack-hover-x', rotationX.toFixed(2) + 'deg');
      tilt.style.setProperty('--pack-hover-y', rotationY.toFixed(2) + 'deg');
      tilt.style.setProperty('--pack-glare-x', glareX.toFixed(1) + '%');
      tilt.style.setProperty('--pack-glare-y', glareY.toFixed(1) + '%');
    });
    let bounds = null;

    function measure() {
      const rect = pack.getBoundingClientRect();
      bounds = {
        left: rect.left + window.pageXOffset,
        top: rect.top + window.pageYOffset,
        width: rect.width,
        height: rect.height
      };
    }

    function releaseHover() {
      bounds = null;
      pack.classList.remove('is-hovering');
    }

    function reset() {
      releaseHover();
      motion.rest();
    }

    function canHover(event) {
      const hoverPointer = event.pointerType === 'mouse' || event.pointerType === 'pen';
      return hoverPointer && !event.buttons && !reducedMotion.matches && !document.hidden
        && stage.dataset.phase === 'sealed' && !stage.classList.contains('reveal-offscreen')
        && !pack.classList.contains('is-grabbed') && !pack.classList.contains('is-tearing')
        && !pack.classList.contains('is-released');
    }

    function track(event) {
      if (!canHover(event)) return;
      if (!bounds) {
        measure();
        if (!bounds.width || !bounds.height) {
          bounds = null;
          return;
        }
        pack.classList.add('is-hovering');
        motion.enter();
      }
      const x = clamp((event.pageX - bounds.left) / bounds.width);
      const y = clamp((event.pageY - bounds.top) / bounds.height);
      motion.track({
        rotationX: (.5 - y) * 14,
        rotationY: (x - .5) * 18,
        glareX: x * 100,
        glareY: y * 100
      });
    }

    pack.addEventListener('pointerenter', track);
    pack.addEventListener('pointermove', track, { passive: true });
    pack.addEventListener('pointerleave', reset);
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      releaseHover();
      motion.track(neutral);
    }, true);
    window.addEventListener('resize', () => { if (bounds) measure(); });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });

    return { reset };
  };
})();
