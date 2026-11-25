(() => {
  'use strict';

  const width = 320;
  const height = 396;
  const art = Object.freeze({ x: 12, y: 12, width: 296, height: 296 });
  const font = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  const images = new Map();
  const palettes = {
    common: {
      label: '· 普通',
      body: [156, [[0, '#f4f2ea'], [.50, '#e5e2d6'], [1, '#d5d1c3']]],
      rim: '#8f8a7c',
      ink: '#2a2b26',
      subInk: '#57584e',
      rule: 'rgba(48, 46, 38, .14)',
      pill: 'rgba(48, 46, 38, .07)',
      pillBorder: 'rgba(48, 46, 38, .15)',
      sceneFilter: 'contrast(1.04) brightness(1.01)'
    },
    rare: {
      label: '◆ 稀有',
      body: [140, [[0, '#b09bd3'], [.18, '#4b366c'], [.37, '#594782'], [.63, '#2a214c'], [.83, '#4c3464'], [1, '#39254c']]],
      rim: '#3a2954',
      pill: 'rgba(255, 255, 255, .14)',
      pillBorder: 'rgba(255, 255, 255, .24)',
      sceneFilter: 'saturate(.92) brightness(.90)',
      sceneTint: [150, [[0, 'rgba(68, 46, 108, .18)'], [1, 'rgba(46, 26, 78, .16)']]],
      sceneGlow: [.42, .34, .64, 'rgba(206, 178, 252, .22)']
    },
    holo: {
      label: '✦ 全息稀有',
      body: [140, [[0, '#aae3e4'], [.18, '#3d7b9c'], [.42, '#3e5294'], [.59, '#202e60'], [.79, '#5c65a4'], [1, '#3a3a6a']]],
      rim: '#2e567a',
      pill: 'rgba(132, 244, 240, .18)',
      pillBorder: 'rgba(168, 250, 248, .36)',
      sceneFilter: 'grayscale(.28) brightness(.72)',
      sceneTint: [145, [[0, 'rgba(70, 83, 139, .42)'], [.56, 'rgba(40, 51, 97, .29)'], [1, 'rgba(18, 30, 95, .64)']]],
      sceneGlow: [.71, .19, .63, 'rgba(92, 208, 226, .40)'],
      subjectFilter: 'contrast(1.06) drop-shadow(1px 2px 3px rgba(18, 26, 44, .52))'
    },
    ultra: {
      label: '❖ 史诗',
      body: '#b78953',
      rim: '#9b6127',
      ink: '#342107',
      subInk: '#3b2809',
      rule: 'rgba(74, 46, 10, .20)',
      pill: 'rgba(74, 46, 10, .14)',
      pillBorder: 'rgba(112, 68, 16, .26)',
      sceneFilter: 'sepia(.66) saturate(.86) brightness(.60)',
      sceneTint: [145, [[0, 'rgba(111, 69, 48, .12)'], [1, 'rgba(43, 22, 17, .26)']]],
      sceneGlow: [.76, .17, .53, 'rgba(255, 206, 102, .19)']
    },
    secret: {
      label: '✧ 隐藏',
      body: [135, [[0, '#2b3778'], [.26, '#111534'], [.52, '#341d5e'], [.76, '#122344'], [1, '#523a7e']]],
      rim: '#6d78cc',
      pill: [135, [[0, 'rgba(110, 224, 244, .26)'], [.52, 'rgba(168, 128, 252, .30)'], [1, 'rgba(248, 152, 214, .26)']]],
      pillBorder: 'rgba(196, 222, 255, .58)',
      sceneFilter: 'saturate(.78) contrast(1.06) brightness(.52)',
      sceneTint: [155, [[0, 'rgba(10, 14, 44, .68)'], [.52, 'rgba(24, 14, 54, .56)'], [1, 'rgba(10, 24, 48, .70)']]]
    }
  };

  function loadImage(url) {
    let loaded = images.get(url);
    if (loaded) images.delete(url);
    else {
      loaded = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load bird artwork: ' + url));
        image.src = url;
      });
      loaded.catch(() => {
        if (images.get(url) === loaded) images.delete(url);
      });
    }
    images.set(url, loaded);
    if (images.size > 18) images.delete(images.keys().next().value);
    return loaded;
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function material(ctx, paint, x, y, w, h) {
    if (typeof paint === 'string') return paint;

    const [angle, stops] = paint;
    const dx = Math.sin(angle * Math.PI / 180);
    const dy = -Math.cos(angle * Math.PI / 180);
    const travel = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const gradient = ctx.createLinearGradient(cx - dx * travel, cy - dy * travel, cx + dx * travel, cy + dy * travel);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  function drawScene(ctx, scene, data) {
    const [scaleX, scaleY] = data.size.split(/\s+/).map(value => parseFloat(value) / 100);
    const [positionX, positionY] = data.position.split(/\s+/).map(value => parseFloat(value) / 100);
    const sourceWidth = scene.naturalWidth / scaleX;
    const sourceHeight = scene.naturalHeight / scaleY;
    // CSS percentage positioning offsets the overlap between the sprite and its window.
    const sourceX = (scene.naturalWidth - sourceWidth) * positionX;
    const sourceY = (scene.naturalHeight - sourceHeight) * positionY;
    ctx.drawImage(scene, sourceX, sourceY, sourceWidth, sourceHeight, art.x, art.y, art.width, art.height);
  }

  function drawArt(ctx, data, scene, subject, palette, epicRays) {
    const { x, y, width: w, height: h } = art;
    ctx.save();
    roundedRect(ctx, x, y, w, h, 11);
    ctx.clip();
    ctx.fillStyle = '#3d2a33';
    ctx.fillRect(x, y, w, h);
    ctx.filter = subject || data.rank === 'common' ? palette.sceneFilter : 'none';
    drawScene(ctx, scene, data);
    ctx.filter = 'none';

    if (subject && palette.sceneTint) {
      ctx.fillStyle = material(ctx, palette.sceneTint, x, y, w, h);
      ctx.fillRect(x, y, w, h);
      if (epicRays) {
        ctx.globalAlpha = .14;
        ctx.drawImage(epicRays, x, y, w, h);
        ctx.globalAlpha = 1;
      }
      if (palette.sceneGlow) {
        const [nx, ny, reach, color] = palette.sceneGlow;
        const cx = x + w * nx;
        const cy = y + h * ny;
        const farthest = Math.hypot(Math.max(nx, 1 - nx) * w, Math.max(ny, 1 - ny) * h);
        const tint = ctx.createRadialGradient(cx, cy, 0, cx, cy, farthest * reach);
        tint.addColorStop(0, color);
        tint.addColorStop(1, 'transparent');
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, w, h);
      }
      ctx.filter = palette.subjectFilter || 'none';
      ctx.drawImage(subject, x, y, w, h);
    }

    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(20, 26, 30, .44)';
    roundedRect(ctx, x - .5, y - .5, w + 1, h + 1, 11.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .23)';
    roundedRect(ctx, x + .5, y + .5, w - 1, h - 1, 10.5);
    ctx.stroke();
    if (data.rank === 'ultra') {
      const inset = 3.5;
      ctx.strokeStyle = 'rgba(92, 46, 12, .52)';
      roundedRect(ctx, x + inset, y + inset + 1, w - inset * 2, h - inset * 2, 5);
      ctx.stroke();
      const plate = ctx.createLinearGradient(x, y, x, y + h);
      plate.addColorStop(0, 'rgba(255, 248, 216, .72)');
      plate.addColorStop(.52, 'rgba(255, 224, 146, .58)');
      plate.addColorStop(1, 'rgba(255, 238, 184, .44)');
      ctx.strokeStyle = plate;
      roundedRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 5);
      ctx.stroke();
    }
  }

  function drawCaption(ctx, data, palette) {
    ctx.fillStyle = palette.rule || 'rgba(255, 250, 255, .18)';
    ctx.fillRect(12, 318, 296, 1);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.ink || '#fffdf4';
    ctx.font = '700 24px ' + font;
    ctx.fillText(data.name, 12, 342, 296);

    const subInk = palette.subInk || '#efeafc';
    ctx.fillStyle = subInk;
    ctx.font = '400 13px ' + font;
    ctx.globalAlpha = .84;
    ctx.fillText(data.serial + ' / 036', 12, 371);
    ctx.globalAlpha = 1;

    ctx.font = '700 11px ' + font;
    const pillWidth = Math.ceil(ctx.measureText(palette.label).width) + 17;
    const pillX = 308 - pillWidth;
    roundedRect(ctx, pillX + .5, 361.5, pillWidth - 1, 18, 9);
    ctx.fillStyle = material(ctx, palette.pill, pillX, 361, pillWidth, 19);
    ctx.fill();
    ctx.strokeStyle = palette.pillBorder;
    ctx.stroke();
    ctx.fillStyle = subInk;
    ctx.fillText(palette.label, pillX + 8, 371);
  }

  function drawNewBadge(ctx, scale) {
    const label = '新收录';
    ctx.font = '800 11px ' + font;
    const pillWidth = Math.ceil(ctx.measureText(label).width) + 20;
    const x = 300 - pillWidth;
    roundedRect(ctx, x + .5, 20.5, pillWidth - 1, 21, 10.5);
    ctx.fillStyle = material(ctx, [135, [[0, '#fff1c6'], [1, '#f5c874']]], x, 20, pillWidth, 22);
    ctx.shadowColor = 'rgba(18, 10, 4, .44)';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 3 * scale;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 252, 236, .75)';
    ctx.stroke();
    ctx.fillStyle = '#362208';
    ctx.fillText(label, x + 10, 31);
  }

  function rasterizeArtwork(data, palette, scene, subject, epicRays, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.scale(scale, scale);

    roundedRect(ctx, 0, 0, width, height, 18);
    ctx.fillStyle = palette.rim;
    ctx.fill();
    roundedRect(ctx, 0, 0, width - 1, height - 2, 18);
    ctx.fillStyle = material(ctx, palette.body, 0, 0, width, height);
    ctx.fill();
    roundedRect(ctx, 1.5, 1.5, width - 4, height - 5, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, .34)';
    ctx.stroke();
    drawArt(ctx, data, scene, subject, palette, epicRays);
    drawCaption(ctx, data, palette);
    if (data.isNew) drawNewBadge(ctx, scale);
    return canvas;
  }

  window.loadBirdArtwork = async function loadBirdArtwork(data) {
    const palette = palettes[data.rank] || palettes.common;
    const subjectReady = data.subject ? loadImage(data.subject).catch(() => null) : null;
    const raysReady = data.rank === 'ultra' && data.subject
      ? loadImage('./assets/textures/card-rays-ultra.png').catch(() => null)
      : null;
    const [scene, subject, epicRays] = await Promise.all([loadImage(data.image), subjectReady, raysReady]);
    const rasterize = (scale) => rasterizeArtwork(data, palette, scene, subject, epicRays, scale);
    return { canvas: rasterize(1), art, subject, rasterize };
  };
})();
