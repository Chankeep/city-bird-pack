(() => {
  'use strict';

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enterTime = 315;
  const closeTime = 255;
  const fadeTime = 160;
  const documentRoot = document.documentElement;
  const rankLabels = { common: '普通', rare: '稀有', holo: '全息稀有', ultra: '史诗', secret: '隐藏' };
  const rankShortLabels = { common: '普通', rare: '稀有', holo: '全息', ultra: '史诗', secret: '隐藏' };
  const allRanks = ['common', 'rare', 'holo', 'ultra', 'secret'];

  function measureSource(source) {
    if (!source || !documentRoot.contains(source)) return null;
    const markers = ['tl', 'tr', 'bl'].map(position => {
      const marker = document.createElement('span');
      marker.className = 'card-inspector-corner card-inspector-corner--' + position;
      source.appendChild(marker);
      return marker;
    });
    const bounds = source.getBoundingClientRect();
    const points = markers.map(marker => marker.getBoundingClientRect());
    markers.forEach(marker => marker.remove());
    if (!bounds.width || !bounds.height || bounds.left < 0 || bounds.top < 0 ||
        bounds.right > window.innerWidth || bounds.bottom > window.innerHeight) return null;
    return points;
  }

  function anchorTransform([tl, tr, bl], focus) {
    const values = [(tr.left - tl.left) / focus.width, (tr.top - tl.top) / focus.width,
      (bl.left - tl.left) / focus.height, (bl.top - tl.top) / focus.height,
      tl.left - focus.left, tl.top - focus.top];
    return 'matrix(' + values.map(n => n.toFixed(4)).join(',') + ')';
  }

  function lockPage() {
    const { style } = documentRoot;
    const { overflow, paddingRight } = style;
    const scrollbarWidth = window.innerWidth - documentRoot.clientWidth;
    if (scrollbarWidth > 0) {
      const padding = Number.parseFloat(getComputedStyle(documentRoot).paddingRight) || 0;
      style.paddingRight = (padding + scrollbarWidth) + 'px';
    }
    style.overflow = 'hidden';
    return () => {
      style.overflow = overflow;
      style.paddingRight = paddingRight;
    };
  }

  function hideBackground(panel) {
    const others = Array.from(panel.parentElement.children).filter((item) => item !== panel);
    const hidden = others.map((item) => {
      const ariaHidden = item.getAttribute('aria-hidden');
      const inert = item.hasAttribute('inert');
      item.setAttribute('aria-hidden', 'true');
      if ('inert' in item) item.inert = true;
      return { item, ariaHidden, inert };
    });
    return () => {
      hidden.forEach(({ item, ariaHidden, inert }) => {
        if (ariaHidden === null) item.removeAttribute('aria-hidden');
        else item.setAttribute('aria-hidden', ariaHidden);
        if (!inert && 'inert' in item) item.inert = false;
      });
    };
  }

  window.createBirdInspector = function createBirdInspector({ panel, focal, makeCard, onClose }) {
    const closeButton = panel.querySelector('.card-inspector-close');
    const scrim = panel.querySelector('.card-inspector-scrim');
    const packLabel = panel.querySelector('.inspector-pack');
    const rankLabel = panel.querySelector('.inspector-rank');
    const copiesLabel = panel.querySelector('.inspector-copies');
    const rankBar = panel.querySelector('.inspector-rank-bar');
    let view = null;
    let activeCard = null;
    let currentData = null;
    let origin = null;
    let placeholder = null;
    let restoreFocus = null;
    let unlockPage = null;
    let restoreBackground = null;
    let timer = 0;
    let frame = 0;

    function isOpen() { return !panel.hidden; }

    function restoreCard() {
      if (!placeholder) return;
      if (placeholder.parentNode) {
        const width = placeholder.offsetWidth;
        placeholder.parentNode.replaceChild(origin, placeholder);
        origin.setCardWidth(width);
        origin.setInspectMode(false, false);
      } else {
        origin.releaseDetails();
      }
      placeholder = null;
    }

    function isRankUnlocked(rank) {
      if (!currentData) return false;
      const map = currentData.rankCounts || {};
      if (map[rank] > 0) return true;
      return rank === currentData.rank;
    }

    function syncRankMeta(rank) {
      panel.dataset.rank = rank || 'common';
      if (rankLabel) rankLabel.textContent = rankLabels[rank] || '普通';
      if (copiesLabel && currentData) {
        const map = currentData.rankCounts || {};
        const rankCount = map[rank] || 0;
        const totalCopies = currentData.copies && currentData.copies > 0 ? currentData.copies : 1;
        copiesLabel.textContent = rankCount > 0 ? ('该档 ×' + rankCount) : ('已收录 ×' + totalCopies);
      }
      if (rankBar) {
        const buttons = rankBar.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i += 1) {
          buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.rank === rank));
        }
      }
    }

    function switchRank(nextRank) {
      if (!panel.classList.contains('is-settled') || !currentData) return;
      if (!isRankUnlocked(nextRank)) return;
      if (panel.dataset.rank === nextRank) return;
      const pose = activeCard.getCardPose();
      activeCard.setInspectMode(false, true);
      if (activeCard !== origin) activeCard.releaseDetails();
      const nextData = Object.assign({}, currentData, { rank: nextRank, isNew: nextRank === currentData.rank && currentData.isNew });
      const card = placeholder && nextRank === currentData.rank ? origin : makeCard(nextData, 'inspect', pose);
      activeCard = card;
      view.textContent = '';
      view.appendChild(card);
      card.setCardWidth(focal.clientWidth);
      card.enableDetails();
      card.setInspectMode(true, false);
      syncRankMeta(nextRank);
    }

    function renderRankBar(activeRank, rankCounts) {
      if (!rankBar) return;
      rankBar.textContent = '';
      const map = rankCounts || {};
      allRanks.forEach((r) => {
        const unlocked = (map[r] > 0) || r === activeRank;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inspector-rank-btn';
        btn.dataset.rank = r;
        btn.setAttribute('aria-pressed', String(r === activeRank));
        if (unlocked) {
          btn.dataset.unlocked = '';
          btn.addEventListener('click', () => switchRank(r));
        } else {
          btn.disabled = true;
          btn.setAttribute('aria-label', rankShortLabels[r] + '（未解锁）');
        }
        btn.textContent = rankShortLabels[r];
        rankBar.appendChild(btn);
      });
    }

    function open(data, source) {
      if (isOpen()) return false;
      currentData = data;
      origin = source || null;
      restoreFocus = origin || document.activeElement;
      const quiet = motionPreference.matches;
      const fromGrid = origin && origin.classList.contains('bird-card');
      const from = fromGrid && !quiet ? measureSource(origin) : null;
      const card = fromGrid ? origin : makeCard(data, 'inspect');
      activeCard = card;
      card.setInspectMode(true, true);
      if (fromGrid) {
        origin.classList.add('is-inspected');
        placeholder = document.createElement('span');
        placeholder.className = 'card-inspector-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        origin.parentNode.replaceChild(placeholder, origin);
      }
      unlockPage = lockPage();

      if (packLabel) packLabel.textContent = data.packName || '城市飞鸟';
      renderRankBar(data.rank || 'common', data.rankCounts);
      syncRankMeta(data.rank || 'common');

      view = document.createElement('div');
      view.className = 'card-inspector-view';
      if (from) view.style.transition = 'none';
      view.appendChild(card);
      focal.appendChild(view);
      panel.hidden = false;
      panel.classList.toggle('is-travelling', Boolean(from));
      const focus = focal.getBoundingClientRect();
      card.setCardWidth(focus.width);
      if (from) view.style.transform = anchorTransform(from, focus);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          panel.classList.add('is-visible');
          view.style.transition = '';
          view.style.transform = 'none';
          if (!fromGrid) card.enableDetails();
          timer = window.setTimeout(() => {
            panel.classList.remove('is-travelling');
            panel.classList.add('is-settled');
            card.setInspectMode(true, false);
          }, from ? enterTime : fadeTime);
        });
      });

      closeButton.focus({ preventScroll: true });
      restoreBackground = hideBackground(panel);
      return true;
    }

    function close(fromKeyboard) {
      if (!isOpen() || panel.classList.contains('is-closing')) return false;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      activeCard.setInspectMode(true, true);
      if (onClose) onClose();
      const canDock = panel.classList.contains('is-visible') && !motionPreference.matches && placeholder && activeCard === origin;
      const to = canDock ? measureSource(placeholder) : null;
      panel.classList.remove('is-settled', 'is-travelling', 'is-visible');
      panel.classList.add('is-closing');
      view.style.transition = '';
      function finishClose() {
        if (activeCard !== origin) activeCard.releaseDetails();
        restoreCard();
        panel.hidden = true;
        panel.classList.remove('is-closing', 'is-docking');
        panel.removeAttribute('data-rank');
        if (view && view.parentNode === focal) focal.removeChild(view);
        restoreBackground();
        unlockPage();
        if (fromKeyboard && restoreFocus && documentRoot.contains(restoreFocus)) {
          restoreFocus.focus({ preventScroll: true });
        }
        const returnedCard = origin;
        view = activeCard = currentData = origin = restoreFocus = null;
        if (returnedCard) requestAnimationFrame(() => {
          if (origin !== returnedCard) returnedCard.classList.remove('is-inspected');
        });
      }

      if (to) {
        function handOff() {
          window.clearTimeout(timer);
          view.removeEventListener('transitionend', onDockEnd);
          restoreCard();
          // Paint the returned face before releasing the inspector's composited layers.
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(finishClose);
          });
        }
        function onDockEnd(event) {
          if (event.target === view && event.propertyName === 'transform') handOff();
        }
        view.addEventListener('transitionend', onDockEnd);
        panel.classList.add('is-docking');
        view.style.transform = anchorTransform(to, focal.getBoundingClientRect());
        const gridTilt = activeCard.getGridAmbientTilt && activeCard.getGridAmbientTilt(closeTime);
        activeCard.centerInspectSway(closeTime - 10, gridTilt);
        timer = window.setTimeout(handOff, closeTime + 150);
      } else {
        timer = window.setTimeout(finishClose, fadeTime);
      }
      return true;
    }

    closeButton.addEventListener('click', (event) => close(event.detail === 0));
    panel.addEventListener('click', (event) => {
      if (event.target === scrim || event.target === panel) close(false);
    });
    document.addEventListener('keydown', (event) => {
      if (!isOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(panel.querySelectorAll('button:not([disabled])')).filter(button =>
        panel.classList.contains('is-settled') || button === closeButton);
      const active = document.activeElement;
      const start = targets[0];
      const end = targets[targets.length - 1];
      if (!targets.includes(active) || (event.shiftKey ? active === start : active === end)) {
        event.preventDefault();
        (event.shiftKey ? end : start).focus();
      }
    }, true);

    return { open, close, isOpen };
  };
})();
