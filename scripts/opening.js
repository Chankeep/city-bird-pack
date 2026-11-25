(() => {
  'use strict';

  const packs = window.birdPacks;
  if (!packs || !window.createPackTear || !window.createPackReveal || !window.createCardMotion ||
      !window.createPackMotion || !window.createBirdCard || !window.createBirdCollection || !window.createBirdInspector) return;

  const labels = { common: '普通', rare: '稀有', holo: '全息稀有', ultra: '史诗', secret: '隐藏' };
  const packTaglines = {
    city: '屋顶街巷 · 青瓦暖阳间的城市羽影',
    garden: '城市花园 · 枝头花影里的灵动羽色',
    dusk: '暮色水岸 · 晚风微光下的栖息精灵'
  };
  const packThemeColors = {
    city: '#0b1311',
    garden: '#150e15',
    dusk: '#0a0f1d'
  };
  const rankList = ['common', 'rare', 'holo', 'ultra', 'secret'];
  const outerRankWeights = [
    { rank: 'common', weight: 56 },
    { rank: 'rare', weight: 26 },
    { rank: 'holo', weight: 13 },
    { rank: 'ultra', weight: 4 },
    { rank: 'secret', weight: 1 }
  ];
  const heroRankWeights = [
    { rank: 'rare', weight: 32 },
    { rank: 'holo', weight: 38 },
    { rank: 'ultra', weight: 22 },
    { rank: 'secret', weight: 8 }
  ];

  const stage = document.querySelector('.stage');
  const packPosition = stage.querySelector('.pack-position');
  const pack = stage.querySelector('.pack');
  const handle = pack.querySelector('.pack-handle');
  const openButton = stage.querySelector('.open-pack');
  const flipAllButton = stage.querySelector('.flip-all');
  const resetButton = stage.querySelector('.reset-pack');
  const status = stage.querySelector('[role="status"]');
  const tagline = document.querySelector('.pack-tagline');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const options = Array.from(document.querySelectorAll('.pack-picker button'));
  const inspectorPanel = document.querySelector('.card-inspector');

  // Procedural Web Audio sound effects (no audio files). Silent if Web Audio is unavailable.
  const audio = window.createBirdAudio ? window.createBirdAudio() : null;
  const soundToggle = document.querySelector('.sound-toggle');
  function sfx(name, arg) {
    if (!audio || typeof audio[name] !== 'function') return;
    try { audio[name](arg); } catch (_) { /* Sound is optional. */ }
  }
  function syncSoundToggle() {
    if (!soundToggle) return;
    const on = !(audio && audio.isMuted());
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.setAttribute('aria-label', '音效：' + (on ? '开' : '关'));
  }
  if (soundToggle) {
    if (!audio || !audio.supported) {
      soundToggle.hidden = true;
    } else {
      soundToggle.addEventListener('click', () => {
        audio.toggleMuted();
        syncSoundToggle();
      });
    }
  }
  // Browsers/WebViews only allow audio after a user gesture; create/resume the context on the first touch.
  ['pointerdown', 'touchstart', 'keydown'].forEach((type) => {
    document.addEventListener(type, () => sfx('unlock'), { capture: true, passive: true });
  });

  const rankOrder = { common: 0, rare: 1, holo: 2, ultra: 3, secret: 4 };
  const vibrationToggle = stage.querySelector('.vibration-toggle');
  const vibrationKey = 'city-birds.vibration.v1';
  const vibrationMinVersion = 9500;
  let vibrationApi = null;
  let vibrationEnabled = true;
  let vibrationStorage = false;
  let vibrationWrites = Promise.resolve();

  function vibrate(type) {
    if (!vibrationEnabled || !vibrationApi) return;
    try { Promise.resolve(vibrationApi.vibrateShort({ type })).catch(() => {}); } catch (_) { /* Native feedback is optional. */ }
  }

  function syncVibrationToggle() {
    vibrationToggle.setAttribute('aria-pressed', String(vibrationEnabled));
    vibrationToggle.title = vibrationEnabled ? '关闭震动' : '开启震动';
  }

  async function loadVibrationPreference(api) {
    if (typeof api.getStorage !== 'function' || typeof api.setStorage !== 'function') return;
    let timeout;
    try {
      const result = await Promise.race([
        api.getStorage({ key: vibrationKey }),
        new Promise(resolve => { timeout = setTimeout(() => resolve(null), 1600); })
      ]);
      if (!result) return;
      if (result.data !== null && result.data !== undefined) {
        const saved = JSON.parse(result.data);
        if (typeof saved !== 'boolean') return;
        vibrationEnabled = saved;
      }
      vibrationStorage = true;
    } catch (_) {
      // Keep the session setting when Storage is unavailable.
    } finally {
      clearTimeout(timeout);
    }
  }

  async function prepareVibration() {
    const bridge = await window.getBirdContainer();
    if (!bridge || bridge.version < vibrationMinVersion || typeof bridge.api.vibrateShort !== 'function') return;
    await loadVibrationPreference(bridge.api);
    vibrationApi = bridge.api;
    if (!vibrationToggle) return;
    vibrationToggle.disabled = false;
    syncVibrationToggle();
    vibrationToggle.addEventListener('click', () => {
      vibrationEnabled = !vibrationEnabled;
      syncVibrationToggle();
      const message = vibrationEnabled ? '震动已开启' : '震动已关闭';
      status.textContent = message + (vibrationStorage ? '' : '，仅本次有效');
      if (!vibrationStorage) return;
      const data = JSON.stringify(vibrationEnabled);
      vibrationWrites = vibrationWrites.then(async () => {
        const result = await vibrationApi.setStorage({ key: vibrationKey, data });
        if (!result || result.errMsg !== 'setStorage:ok') throw new Error('Vibration preference was not saved.');
      }).catch(() => {
        if (status.textContent === message) status.textContent = message + '，设置暂未保存';
      });
    });
  }
  prepareVibration().catch(() => {});

  function findPackName(serial) {
    for (let i = 0; i < packs.length; i += 1) {
      const p = packs[i];
      for (let j = 0; j < p.birds.length; j += 1) {
        if (p.birds[j].serial === serial) return p.name;
      }
    }
    return selection.name;
  }

  const inspector = window.createBirdInspector({
    panel: inspectorPanel,
    focal: inspectorPanel.querySelector('.card-inspector-focus'),
    makeCard,
    onClose() { sfx('playInspectClose'); }
  });
  const openInspector = (data, source) => {
    if (inspector.open(data, source)) sfx('playInspectOpen');
  };

  const collection = window.createBirdCollection(packs, stage, (bird, bestRank, source, sourcePack) => {
    const enriched = Object.assign({
      rank: bestRank || 'common',
      packName: sourcePack ? sourcePack.name : findPackName(bird.serial),
      copies: collection.getCount(bird.serial),
      rankCounts: collection.getRankCounts(bird.serial)
    }, bird);
    openInspector(enriched, source);
  });

  let selection = packs[0];
  let focusAfterReveal = false;
  let switchAnimTimer = 0;

  function rollWeightedRank(table) {
    let total = 0;
    for (let i = 0; i < table.length; i += 1) total += table[i].weight;
    let cursor = Math.random() * total;
    for (let i = 0; i < table.length; i += 1) {
      cursor -= table[i].weight;
      if (cursor <= 0) return table[i].rank;
    }
    return table[table.length - 1].rank;
  }

  function pickUniqueBirds(birds, count) {
    const pool = birds.slice();
    const chosen = [];
    while (chosen.length < count && pool.length) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool.splice(idx, 1)[0]);
    }
    return chosen;
  }

  function drawCards() {
    const picked = pickUniqueBirds(selection.birds, 5);
    const slotRanks = [
      rollWeightedRank(outerRankWeights),
      rollWeightedRank(outerRankWeights),
      rollWeightedRank(heroRankWeights),
      rollWeightedRank(outerRankWeights),
      rollWeightedRank(outerRankWeights)
    ];
    return picked.map((bird, slot) => Object.assign({
      rank: slotRanks[slot],
      packName: selection.name
    }, bird));
  }

  function makeCard(data, mode, initialPose) {
    return window.createBirdCard(data, {
      mode,
      initialPose,
      onOpen(card) {
        const enriched = Object.assign({}, data, {
          packName: data.packName || findPackName(data.serial),
          copies: collection.getCount(data.serial),
          rankCounts: collection.getRankCounts(data.serial)
        });
        openInspector(enriched, card);
      }
    });
  }

  function setPhase(phase) {
    stage.dataset.phase = phase;
    openButton.hidden = phase !== 'sealed';
    flipAllButton.hidden = phase !== 'dealt';
    resetButton.hidden = phase !== 'revealed';
    options.forEach((option) => { option.disabled = phase === 'opening'; });
    collection.setBusy(phase === 'opening');
  }

  const reveal = window.createPackReveal({
    stage,
    mouth: stage.querySelector('.pack-mouth'),
    row: stage.querySelector('.pack-results'),
    light: stage.querySelector('.pack-light'),
    makeCard,
    onDealt() {
      setPhase('dealt');
      status.textContent = '五张鸟卡已弹出，点按或横划翻开查看';
      if (focusAfterReveal) flipAllButton.focus();
    },
    onFlip(card) {
      sfx('playCardFlip', card.rank);
      if (card.rank === 'ultra' || card.rank === 'secret') {
        vibrate('medium');
      } else if (card.rank === 'holo' || card.rank === 'rare') {
        vibrate('light');
      }
      status.textContent = '翻开 ' + card.name + '，' + labels[card.rank] + (card.isNew ? '，新收录' : '');
    },
    onReady(cards) {
      setPhase('revealed');
      status.textContent = '已全部翻开：' + cards.map((card) => card.name + ' ' + labels[card.rank] + (card.isNew ? ' 新收录' : '')).join('、');
      if (focusAfterReveal) resetButton.focus();
    }
  });

  const packMotion = window.createPackMotion({ stage, pack, handle });
  const tear = window.createPackTear({
    stage, pack, handle, onOpen: startReveal,
    onTick(amount) { sfx('playTearTick', amount); }
  });

  const preloaded = new Set();
  function preloadImage(source) {
    if (!source || preloaded.has(source)) return;
    preloaded.add(source);
    const image = new Image();
    image.src = source;
    if (typeof image.decode === 'function') {
      image.decode().catch(() => {});
    }
  }

  function startReveal() {
    if (stage.dataset.phase !== 'sealed') return;
    focusAfterReveal = focusAfterReveal || document.activeElement === openButton;
    setPhase('opening');
    vibrate('light');
    const drawn = collection.record(drawCards());
    drawn.forEach((card) => {
      preloadImage(card.image);
      if (card.subject) preloadImage(card.subject);
      if ((card.rank === 'ultra' || card.rank === 'secret') && window.preloadBirdEngraving) {
        window.preloadBirdEngraving(card.subject);
      }
    });
    const top = drawn.reduce((best, card) => (rankOrder[card.rank] > rankOrder[best] ? card.rank : best), 'common');
    sfx('playPackOpen', top);
    reveal.play(drawn);
  }

  function select(next, animateSwitch) {
    selection = next;
    focusAfterReveal = false;
    document.body.dataset.pack = next.id;
    stage.dataset.pack = next.id;
    if (tagline && packTaglines[next.id]) tagline.textContent = packTaglines[next.id];
    if (themeMeta && packThemeColors[next.id]) themeMeta.setAttribute('content', packThemeColors[next.id]);
    const packUrl = './assets/packs/pack-' + next.id + '.webp';
    pack.style.setProperty('--pack-image', 'url("' + packUrl + '")');
    tear.setPackImage(packUrl);
    pack.style.setProperty('--seam', (next.seam * 100) + '%');
    options.forEach((option) => option.setAttribute('aria-pressed', String(option.dataset.pack === next.id)));
    reveal.reset();
    tear.reset();
    packMotion.reset();
    setPhase('sealed');
    status.textContent = '';
    if (animateSwitch) sfx('playPackSwitch');

    if (animateSwitch && packPosition) {
      window.clearTimeout(switchAnimTimer);
      packPosition.classList.remove('is-switching');
      packPosition.getBoundingClientRect();
      packPosition.classList.add('is-switching');
      switchAnimTimer = window.setTimeout(() => {
        packPosition.classList.remove('is-switching');
      }, 380);
    }

    requestAnimationFrame(() => {
      packs.forEach((item) => preloadImage('./assets/packs/pack-' + item.id + '.webp'));
      next.birds.forEach((bird) => preloadImage(bird.image));
    });
  }

  options.forEach((option) => option.addEventListener('click', () => {
    const next = packs.find((item) => item.id === option.dataset.pack);
    if (next && (next !== selection || stage.dataset.phase === 'revealed' || stage.dataset.phase === 'dealt')) {
      select(next, true);
    }
  }));
  handle.addEventListener('click', (event) => {
    if (event.detail === 0 && document.activeElement === handle) focusAfterReveal = true;
  }, true);
  openButton.addEventListener('click', tear.open);
  flipAllButton.addEventListener('click', () => {
    focusAfterReveal = focusAfterReveal || document.activeElement === flipAllButton;
    reveal.flipAll();
  });
  resetButton.addEventListener('click', () => { select(selection, true); openButton.focus(); });
  async function avoidContainerMenu() {
    const sdk = window.xhs;
    const api = sdk && sdk.miniTool;
    if (!api || typeof api.getWindowInfo !== 'function') return;
    const main = stage.parentElement;
    try {
      const info = await api.getWindowInfo();
      const boxes = Object.values(info && info.menuButtons || {});
      const bottom = boxes.reduce((value, box) => box && Number.isFinite(box.bottom) ? Math.max(value, box.bottom) : value, 0);
      if (bottom > 0) main.style.setProperty('--container-heading-top', Math.ceil(bottom + 10) + 'px');
      else main.style.removeProperty('--container-heading-top');
    } catch (error) { /* The safe-area padding remains available. */ }
  }

  let menuResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(menuResizeTimer);
    menuResizeTimer = setTimeout(avoidContainerMenu, 140);
  });
  avoidContainerMenu();
  collection.ready.then(() => {
    select(selection, false);
    openButton.disabled = false;
  });
})();
