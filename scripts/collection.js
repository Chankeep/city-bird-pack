(() => {
  'use strict';

  const storageKey = 'city-birds.collection.v2';
  const legacyStorageKey = 'city-birds.collection.v1';
  const minimumVersion = 9460;

  function buildVersion(launch) {
    const value = launch && launch.miniToolEnv && launch.miniToolEnv.buildVersion;
    return /^[1-9]\d{6,}$/.test(String(value)) && Number.isSafeInteger(Number(value))
      ? Math.floor(Number(value) / 1000) : null;
  }

  async function readContainer() {
    const sdk = window.xhs;
    const api = sdk && sdk.miniTool;
    if (!api) return null;
    let version = buildVersion(sdk.launchOptions);
    if (version === null && typeof api.getLaunchOptions === 'function') {
      version = buildVersion(await api.getLaunchOptions());
    }
    return version === null ? null : { api, version };
  }

  let container;
  window.getBirdContainer = function getBirdContainer() {
    if (!container) container = readContainer();
    return container;
  };

  const allRanks = ['common', 'rare', 'holo', 'ultra', 'secret'];
  const legacyRanks = ['common', 'common', 'common', 'common', 'common', 'rare', 'rare', 'rare', 'holo', 'holo', 'ultra', 'secret'];
  const rankLabels = { common: '普通', rare: '稀有', holo: '全息稀有', ultra: '史诗', secret: '隐藏' };

  window.createBirdCollection = function createBirdCollection(packs, stage, inspectCard) {
    const catalog = document.querySelector('.catalog');
    const toggle = document.querySelector('.catalog-toggle');
    const toggleLabel = toggle.querySelector('.catalog-toggle-label') || toggle;
    const packPicker = document.querySelector('.pack-picker');
    const filters = catalog.querySelector('.catalog-filters');
    const grid = catalog.querySelector('.catalog-grid');
    const storageNote = catalog.querySelector('.catalog-storage');
    const uniqueValue = catalog.querySelector('[data-stat="unique"]');
    const packsValue = catalog.querySelector('[data-stat="packs"]');
    const variantsValue = catalog.querySelector('[data-stat="variants"]');
    const percentValue = catalog.querySelector('[data-stat="percent"]');
    const progressFill = catalog.querySelector('.catalog-progress-fill');
    const birds = packs.reduce((all, pack) => all.concat(pack.birds), []);
    const rankCounts = Object.create(null);
    let selected = packs[0];
    let storage = null;
    let writes = Promise.resolve();

    function getRankCounts(serial) {
      const entry = rankCounts[serial];
      if (!entry) return {};
      return Object.assign({}, entry);
    }

    function getCount(serial) {
      const entry = rankCounts[serial];
      if (!entry) return 0;
      let sum = 0;
      for (let i = 0; i < allRanks.length; i += 1) {
        sum += entry[allRanks[i]] || 0;
      }
      return sum;
    }

    function getBestRank(serial) {
      const entry = rankCounts[serial];
      if (!entry) return 'common';
      for (let i = allRanks.length - 1; i >= 0; i -= 1) {
        if (entry[allRanks[i]] > 0) return allRanks[i];
      }
      return 'common';
    }

    function storageStatus(message) {
      storageNote.textContent = message;
      storageNote.hidden = !message;
    }

    async function readStorage() {
      const bridge = await window.getBirdContainer();
      if (!bridge || bridge.version < minimumVersion) return null;
      const { api } = bridge;
      if (typeof api.getStorage !== 'function' || typeof api.setStorage !== 'function') return null;
      let result = await api.getStorage({ key: storageKey });
      let stored = result && result.data;
      if (stored) return { api, saved: JSON.parse(stored), isV2: true };
      result = await api.getStorage({ key: legacyStorageKey });
      stored = result && result.data;
      return { api, saved: stored ? JSON.parse(stored) : null, isV2: false };
    }

    async function restore() {
      let timer;
      try {
        const started = await Promise.race([
          readStorage(), new Promise((resolve) => { timer = setTimeout(() => resolve(null), 1600); })
        ]);
        if (!started) {
          storageStatus('当前环境仅记录本次打开期间的收藏。');
          return;
        }
        if (started.saved) {
          packs.forEach((pack) => {
            pack.birds.forEach((bird, idx) => {
              const raw = started.saved[bird.serial];
              if (!raw) return;
              if (started.isV2 && typeof raw === 'object') {
                const entry = {};
                allRanks.forEach((r) => {
                  const n = raw[r];
                  if (Number.isSafeInteger(n) && n > 0 && n < 1000000000) entry[r] = n;
                });
                if (Object.keys(entry).length) rankCounts[bird.serial] = entry;
              } else if (Number.isSafeInteger(raw) && raw > 0 && raw < 1000000000) {
                const fallbackRank = legacyRanks[idx] || 'common';
                const entry = {};
                entry[fallbackRank] = raw;
                rankCounts[bird.serial] = entry;
              }
            });
          });
        }
        storage = started.api;
      } catch (error) {
        storageStatus('暂时无法读取存档，本次收藏仍会记录。');
      } finally {
        clearTimeout(timer);
        updateStats();
        toggle.disabled = false;
      }
    }

    function updateStats() {
      let distinct = 0;
      let total = 0;
      let variants = 0;
      birds.forEach((bird) => {
        const entry = rankCounts[bird.serial];
        if (!entry) return;
        let birdTotal = 0;
        for (let i = 0; i < allRanks.length; i += 1) {
          const n = entry[allRanks[i]] || 0;
          if (n > 0) {
            birdTotal += n;
            variants += 1;
          }
        }
        if (birdTotal > 0) {
          distinct += 1;
          total += birdTotal;
        }
      });
      const ratio = distinct + '/' + birds.length;
      const pct = birds.length ? Math.round((distinct / birds.length) * 100) : 0;
      if (catalog.hidden) toggleLabel.textContent = '图鉴 ' + ratio;
      uniqueValue.textContent = ratio;
      packsValue.textContent = String(Math.floor(total / 5));
      if (variantsValue) variantsValue.textContent = variants + '/' + (birds.length * allRanks.length);
      if (percentValue) percentValue.textContent = pct + '%';
      if (progressFill) progressFill.style.width = pct + '%';
    }

    function tile(bird, index, pack) {
      const item = document.createElement('li');
      const count = getCount(bird.serial);
      const bestRank = getBestRank(bird.serial);
      const entry = rankCounts[bird.serial] || {};
      item.className = 'catalog-tile';
      item.dataset.rank = count ? bestRank : 'common';
      let contents = item;
      if (count) {
        contents = document.createElement('button');
        contents.className = 'catalog-tile-open';
        contents.type = 'button';
        contents.setAttribute('aria-haspopup', 'dialog');
        contents.setAttribute('aria-label', bird.name + '，最高 ' + rankLabels[bestRank] + '，已收藏 ' + count + ' 张，点按放大查看');
        contents.addEventListener('click', () => inspectCard(bird, bestRank, contents, pack));
        item.appendChild(contents);
      }

      const thumb = document.createElement('span');
      thumb.className = 'catalog-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      contents.appendChild(thumb);
      if (count) {
        thumb.style.backgroundImage = 'url("' + bird.image + '")';
        thumb.style.backgroundSize = bird.size;
        thumb.style.backgroundPosition = bird.position;
        const badge = document.createElement('span');
        badge.className = 'catalog-copies-badge';
        badge.textContent = '×' + count;
        thumb.appendChild(badge);
      } else {
        item.dataset.locked = '';
        const serial = document.createElement('span');
        serial.className = 'catalog-locked-serial';
        serial.textContent = 'No.' + bird.serial;
        thumb.appendChild(serial);
      }

      const footer = document.createElement('span');
      footer.className = 'catalog-tile-footer';
      const title = document.createElement('span');
      title.className = 'catalog-bird';
      title.textContent = count ? bird.name : '未收录';
      footer.appendChild(title);
      contents.appendChild(footer);

      const pips = document.createElement('span');
      pips.className = 'catalog-rank-pips';
      pips.setAttribute('aria-hidden', 'true');
      allRanks.forEach((r) => {
        const pip = document.createElement('span');
        pip.className = 'catalog-rank-pip';
        pip.dataset.rank = r;
        if (entry[r] > 0) pip.dataset.unlocked = '';
        pips.appendChild(pip);
      });
      contents.appendChild(pips);

      return item;
    }

    const shortPackNames = { city: '屋顶街巷', garden: '城市花园', dusk: '暮色水岸' };

    function showPack(pack) {
      selected = pack;
      grid.textContent = '';
      const items = document.createDocumentFragment();
      pack.birds.forEach((bird, index) => items.appendChild(tile(bird, index, pack)));
      grid.appendChild(items);
      entries.forEach(({ item, option }) => {
        const collected = item.birds.filter((bird) => getCount(bird.serial) > 0).length;
        const displayName = shortPackNames[item.id] || item.name;
        option.textContent = displayName + ' ' + collected + '/' + item.birds.length;
        option.setAttribute('aria-pressed', String(item === pack));
      });
    }

    const entries = packs.map((item) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.addEventListener('click', () => showPack(item));
      filters.appendChild(option);
      return { item, option };
    });

    toggle.addEventListener('click', () => {
      const visible = catalog.hidden;
      if (visible && stage.dataset.phase === 'sealed' && stage.querySelector('.pack-handle').disabled) return;
      catalog.hidden = !visible;
      stage.hidden = visible;
      packPicker.hidden = visible;
      toggle.setAttribute('aria-expanded', String(visible));
      if (visible) {
        toggleLabel.textContent = '返回开包';
        const activePack = packs.find((item) => item.id === stage.dataset.pack);
        showPack(activePack || selected);
      } else {
        updateStats();
      }
    });

    function record(cards) {
      const drawn = cards.map((card) => {
        const r = card.rank || 'common';
        const entry = rankCounts[card.serial] || (rankCounts[card.serial] = {});
        const prevRankCount = entry[r] || 0;
        entry[r] = prevRankCount + 1;
        return Object.assign({}, card, {
          isNew: prevRankCount === 0,
          copies: getCount(card.serial),
          rankCounts: getRankCounts(card.serial)
        });
      });
      updateStats();
      if (storage) {
        const data = JSON.stringify(rankCounts);
        writes = writes.then(() => storage.setStorage({ key: storageKey, data })).then(() => storageStatus(''), () => {
          storageStatus('本次存档未写入，收藏仍保留在当前页面。');
        });
      }
      return drawn;
    }

    return { ready: restore(), record, getCount, getRankCounts, setBusy: (busy) => { toggle.disabled = busy; } };
  };
})();
