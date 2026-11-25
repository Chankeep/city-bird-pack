(() => {
  'use strict';

  const width = 320;
  const height = 396;
  const ranks = { common: 0, rare: 1, holo: 2, ultra: 3, secret: 4 };
  const restingLights = [[.41, .46], [.59, .42], [.54, .49], [.62, .44], [.55, .56]];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const images = new Map();

  const vertexSource = `
    attribute vec2 aCorner;
    varying mediump vec2 vUV;
    void main() {
      vUV = vec2(aCorner.x, 1.0 - aCorner.y) * .5 + vec2(.5, 0.0);
      gl_Position = vec4(aCorner, 0.0, 1.0);
    }`;

  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    varying mediump vec2 vUV;
    uniform sampler2D uCard;
    uniform sampler2D uSubject;
    uniform sampler2D uEngraving;
    uniform sampler2D uScatter;
    uniform sampler2D uFoilGrain;
    uniform vec3 uLight;
    uniform vec2 uTilt;
    uniform vec4 uArt;
    uniform float uHasSubject;
    uniform float uRank;
    uniform float uTime;
    uniform float uSeed;
    uniform vec4 uMeteor;

    const vec2 cardSize = vec2(320.0, 396.0);
    const vec3 warm = vec3(1.0, .95, .84);
    const vec3 cool = vec3(.79, .91, 1.0);

    float gaussian(float distance) { return exp(-.5 * distance * distance); }

    vec3 spectrum(float phase) {
      vec3 hue = .5 + .5 * cos(6.283185 * (phase + vec3(0.0, -.333333, .333333)));
      return .52 + .48 * hue;
    }

    vec3 screen(vec3 color, vec3 light) {
      return color + (1.0 - color) * clamp(light, 0.0, 1.0);
    }

    vec2 hash(vec2 cell) {
      vec3 p = fract(vec3(cell.xyx) * vec3(.1031, .1030, .0973));
      p += dot(p, p.yzx + 33.33);
      return fract((p.xx + p.yz) * p.zy);
    }

    vec3 stars(vec2 uv, float count, vec2 sizes, float brightness, vec2 cloud, vec2 secondCloud) {
      vec2 field = uv * count;
      vec2 cell = floor(field);
      vec2 key = cell + vec2(uSeed, uSeed * .37 + count * 1.9);
      vec2 variation = hash(key + vec2(23.7, 17.9));
      vec2 center = (cell + .5) / count;
      vec2 nearCloud = (center - cloud) * vec2(1.85, 3.1);
      vec2 farCloud = (center - secondCloud) * vec2(3.4, 2.0);
      float cluster = max(1.0 - dot(nearCloud, nearCloud), 0.0) * .54
                    + max(1.0 - dot(farCloud, farCloud), 0.0) * .35;
      if (variation.x > min(.90, .19 + cluster)) return vec3(0.0);

      vec2 seed = hash(key);
      vec2 p = abs(fract(field) - mix(vec2(.20), vec2(.80), seed));
      float size = mix(sizes.x, sizes.y, variation.y * variation.y);
      float radius = length(p) / size;
      float core = 1.0 - smoothstep(.18, 1.0, radius);
      float halo = max(1.0 - radius / 3.05, 0.0);
      float ray = max(1.0 - min(p.x, p.y) / (size * .22), 0.0)
                * max(1.0 - max(p.x, p.y) / (size * 3.4), 0.0);
      float phase = uTime * mix(.5, 2.6, seed.x) + seed.y * 6.283185;
      float pulse = mix(.32 + seed.x * .32, 1.0, .5 + .5 * sin(phase));
      vec3 tint = mix(cool, warm, seed.y * seed.y);
      tint = mix(tint, vec3(.91, .73, 1.0), smoothstep(.70, .99, seed.x) * .36);
      float flare = smoothstep(.58, .97, variation.y) * .55;
      return tint * brightness * pulse * (core + halo * .23 + ray * flare);
    }

    vec3 meteor(vec2 art) {
      float progress = uMeteor.w;
      if (progress < 0.0) return vec3(0.0);
      vec2 direction = vec2(cos(uMeteor.z), sin(uMeteor.z));
      vec2 offset = art - uMeteor.xy;
      float behind = -dot(offset, direction);
      float across = dot(offset, vec2(-direction.y, direction.x));
      float tailLength = mix(.12, .24, fract(uMeteor.z * 3.14));
      float position = 1.0 - clamp(behind / tailLength, 0.0, 1.0);
      float taper = mix(.0017, .0048, position);
      float trail = step(0.0, behind) * position * position;
      float thread = trail * gaussian(across / taper);
      float glow = trail * gaussian(across / (taper * 3.4));
      float head = gaussian(length(offset) / .0041);
      float fade = smoothstep(0.0, .13, progress) * (1.0 - smoothstep(.52, 1.0, progress));
      vec3 tint = mix(vec3(.45, .78, 1.0), vec3(.91, .73, 1.0), fract(uMeteor.z * 8.37));
      return (vec3(.90, .97, 1.0) * head * .98 + tint * (thread * .68 + glow * .23)) * fade;
    }

    vec3 cosmos(vec2 art) {
      float slow = uTime * .008;
      vec2 look = (uLight.xy - .5) * .075;
      vec2 p = art - look;
      vec2 origin = hash(vec2(uSeed, 2.0));
      vec2 cluster = mix(vec2(.12, .23), vec2(.88, .78), origin);
      vec2 secondCluster = mix(vec2(.15, .17), vec2(.85, .86), fract(origin.yx + vec2(.50, .38)));
      vec2 a = p - cluster - vec2(sin(slow * 1.8), cos(slow * 1.2)) * .13;
      vec2 b = p - secondCluster - vec2(cos(slow * 1.3), sin(slow * 1.6)) * .11;
      vec2 lane = vec2(dot(a, vec2(.82, -.57)), dot(a, vec2(.57, .82)));
      vec2 veil = vec2(dot(b, vec2(.89, .46)), dot(b, vec2(-.46, .89)));
      // Slowly rolling dust lanes leave gaps between the bright clouds.
      float ripple = sin(lane.x * 18.0 + origin.y * 9.0 + slow) * .045;
      float dust = gaussian(lane.x * 4.0) * gaussian((lane.y + ripple) * 10.0);
      float haze = gaussian(veil.x * 3.6) * gaussian((veil.y - ripple * .8) * 7.9);
      float clouds = .73 + .27 * sin((p.x - p.y) * 20.0 + sin(p.x * 24.0) * .70 + slow * 2.0);
      vec3 light = vec3(.09, .26, .45) * dust * clouds + vec3(.34, .12, .40) * haze;
      light += vec3(.06, .14, .24) * gaussian(lane.x * 2.6) * gaussian(lane.y * 4.2) * .42;

      vec2 drift = vec2(-slow, slow * .62);
      light += stars(art - look * .19 + drift * .29, 21.0, vec2(.012, .055), .45, secondCluster, cluster);
      light += stars(art - look * .44 + drift * .47, 13.0, vec2(.013, .053), .69, cluster, secondCluster);
      light += stars(p + drift * .75, 8.0, vec2(.016, .055), .88, secondCluster, cluster);
      light += stars(art - look * 1.18 + drift * 1.15, 5.0, vec2(.024, .069), 1.16, cluster, secondCluster);
      return light + meteor(art);
    }

    vec3 secretSweeps(vec2 pixel, float flash) {
      // The two original 133-degree patterns use different widths and travel in opposite directions.
      vec2 direction = vec2(.731354, .681998);
      vec2 widths = cardSize.x * vec2(3.0, 1.95);
      vec2 lengths = direction.x * widths + direction.y * cardSize.y;
      float phase = dot(uLight.xy - .5, vec2(.26, .08));
      vec2 offsets = (widths - cardSize.x) * (vec2(.5) + vec2(phase, -phase));
      vec2 projected = dot(pixel, direction) + offsets * direction.x;
      vec2 bands = mod(projected + 1.5, lengths * vec2(.12, .125)) - (lengths * vec2(.03, .033) + 1.5);
      float cold = gaussian(bands.x / 12.0) * .76;
      float light = gaussian(bands.y / 9.0) * .66;
      vec3 coldTint = mix(vec3(.45, .88, 1.0), vec3(.70, .52, 1.0), smoothstep(-9.0, 15.0, bands.x));
      coldTint = mix(coldTint, vec3(.85, .98, 1.0), gaussian(bands.x / 6.0) * .85);
      vec3 warmTint = mix(vec3(.69, .96, .82), vec3(1.0, .57, .88), smoothstep(-10.0, 15.0, bands.y));
      warmTint = mix(warmTint, vec3(1.0, .93, .77), gaussian(bands.y / 5.6) * .88);
      return (coldTint * cold + warmTint * light * (1.0 - cold)) * (.28 + flash * .26);
    }

    float roundedDistance(vec2 point, vec2 halfSize, float radius) {
      vec2 side = abs(point) - (halfSize - radius);
      return length(max(side, 0.0)) + min(max(side.x, side.y), 0.0) - radius;
    }

    vec3 secretFrame(vec3 color, vec2 pixel, float artMask, float flash) {
      vec2 normal = vec2(.906308, .422618);
      float phase = dot(pixel, normal) / dot(cardSize, normal) / .72;
      float key = dot(uLight.xy - .5, vec2(.34, .22)) + dot(uTilt, vec2(.005, -.006));
      float hue = fract(phase - key) * 4.0;
      // The broad holographic substrate is separate from the white surface sweeps.
      vec3 foil = vec3(.24, .94, 1.0) * max(1.0 - min(hue, 4.0 - hue), 0.0);
      foil += vec3(.48, .40, 1.0) * max(1.0 - abs(hue - 1.0), 0.0);
      foil += vec3(1.0, .37, .83) * max(1.0 - abs(hue - 2.0), 0.0);
      foil += vec3(.37, 1.0, .77) * max(1.0 - abs(hue - 3.0), 0.0);
      float inkCover = 1.0 - smoothstep(.48, .85, dot(color, vec3(.2126, .7152, .0722)));
      float exposed = (1.0 - artMask) * inkCover;
      vec3 iridescent = min(color / (1.0 - foil * .86), 1.0);
      color = mix(color, iridescent, exposed * (.35 + flash * .13));
      color = screen(color, foil * exposed * (.13 + flash * .06));

      float edge = roundedDistance(pixel - cardSize * .5, cardSize * .5, 18.0);
      float rim = 1.0 - smoothstep(.45, 2.65, abs(edge + 2.0));
      float foilEdge = 1.0 - smoothstep(1.0, 10.0, -edge);
      float projected = dot(pixel, vec2(.69, -.72)) * .012 - key * 2.0;
      vec2 facets = fract(vec2(projected, -projected * .71 + key * .63)) - vec2(.5, .5);
      float streak = gaussian(facets.x * 8.0) * .80 + gaussian(facets.y * 11.5) * .38;
      float groove = .62 + .38 * gaussian((fract(dot(pixel, vec2(.24, .19))) - .5) * 4.7);
      vec3 spectral = spectrum(projected * .77 - key + .13);
      vec3 diffraction = mix(foil, spectral, .69) * groove * streak;
      color = screen(color, diffraction * exposed * (.10 + foilEdge * .32 + flash * .09));
      vec3 edgeTint = mix(foil, diffraction + vec3(.32, .40, .48), .61);
      return screen(color, edgeTint * rim * (.44 + flash * .19));
    }

    vec3 secretPrism(float phase) {
      float hue = fract(phase * 2.0) * 5.0;
      vec3 prism = vec3(1.0, .46, .73) * max(1.0 - min(hue, 5.0 - hue), 0.0);
      prism += vec3(1.0, .88, .50) * max(1.0 - abs(hue - 1.0), 0.0);
      prism += vec3(.42, .97, .83) * max(1.0 - abs(hue - 2.0), 0.0);
      prism += vec3(.33, .80, 1.0) * max(1.0 - abs(hue - 3.0), 0.0);
      return prism + vec3(.67, .51, 1.0) * max(1.0 - abs(hue - 4.0), 0.0);
    }

    float secretEngraving(vec2 art, vec2 offset) {
      // The first 256-square atlas panel contains the dense inner feather contours.
      vec2 uv = clamp(art - offset / 384.0, .002, .998) * vec2(.4, .8);
      return texture2D(uEngraving, uv).a;
    }

    vec3 secretEmboss(vec3 color, vec2 art, float bird, float flash) {
      vec2 look = (uLight.xy * cardSize - uArt.xy) / uArt.zw;
      vec2 shift = look - .5;
      float tilt = dot(shift, vec2(.72, .28));
      vec2 axis = vec2(1.867, 1.852);
      float position = dot(art + vec2(.35, .15), axis) / dot(axis, axis);
      float travel = tilt * 1.45 * dot(vec2(1.0, .45), axis) / dot(axis, axis);

      float luma = dot(color, vec3(.2126, .7152, .0722));
      float shadow = 1.0 - smoothstep(.27, .67, luma);

      float groove = secretEngraving(art, -shift * 1.8 + vec2(.4, .85));
      float foil = secretEngraving(art, shift * .6 - vec2(0.0, .2));
      float gleam = secretEngraving(art, shift * 1.1 - vec2(.2, .45));
      vec3 grooveTint = mix(vec3(.10, .07, .22), vec3(.18, .10, .29), (art.x + art.y) * .5);
      color = mix(color, color * grooveTint, groove * bird * .48);

      vec3 foilTint = mix(secretPrism(position - travel), vec3(.92, .89, 1.0), .17);
      vec3 shineTint = secretPrism(position + travel);
      color = mix(color, foilTint, foil * bird * .62);
      float beam = dot(art, vec2(.927184, .374607)) - (.5 + tilt) * 1.301791;
      float glint = gaussian(beam / .114) * .72;
      float featherLine = pow(max(foil, gleam * .82), .72) * bird;
      float edgeLight = .24 + shadow * .16 + gaussian(beam / .145) * (.15 + flash * .10);
      color = screen(color, mix(foilTint, shineTint, .45) * featherLine * edgeLight);
      return screen(color, (shineTint * .23 + vec3(.96, .91, 1.0) * glint) * gleam * bird);
    }

    vec3 birdFill(vec3 color, float bird, float flash) {
      float luma = dot(color, vec3(.2126, .7152, .0722));
      float shadow = 1.0 - smoothstep(.27, .88, luma);
      float softLight = 1.0 - smoothstep(.32, .88, flash);
      float grazingFill = uRank > 2.5 && uRank < 3.5 ? .025 : .052;
      float fill = shadow * bird * (uRank < .5 ? .075 : .063 + grazingFill * softLight);
      return screen(color, vec3(1.0, .985, .958) * fill);
    }

    void main() {
      vec4 base = texture2D(uCard, vUV);
      vec2 pixel = vUV * cardSize;
      vec2 art = (pixel - uArt.xy) / uArt.zw;
      vec2 nearest = clamp(art, .0016, .9984);
      vec2 corner = max(abs((art - .5) * uArt.zw) - (uArt.zw * .5 - 11.0), 0.0);
      float artMask = 1.0 - smoothstep(10.5, 11.5, length(corner));
      float bird = texture2D(uSubject, nearest).a * artMask;
      vec2 offset = pixel - uLight.xy * cardSize;
      vec2 lens = offset / vec2(170.0, 190.0);
      float ambient = exp(-1.6 * dot(lens, lens));
      float flash = uLight.z;

      if (uRank < .5) {
        vec3 matte = base.rgb * (.963 + .066 * ambient) + warm * ambient * .026;
        gl_FragColor = vec4(birdFill(matte, bird, flash), base.a);
        return;
      }

      float angle = radians(22.0 + uTilt.y * .82 + uTilt.x * .31);
      vec2 normal = vec2(cos(angle), sin(angle));
      vec2 tangent = vec2(-normal.y, normal.x);
      float across = dot(offset, normal);
      float along = dot(offset, tangent);
      float curve = along / 240.0;
      float reflection = across + (curve * curve - .32) * (4.0 + uTilt.y * .42);
      float lobe = gaussian(reflection / 90.0);
      float tube = gaussian(along / 175.0);
      float core = (gaussian((reflection + 31.0) / 15.0) * .71 +
        gaussian((reflection + 7.0) / 5.6) * .26) * (.34 + .66 * tube);
      float phase = (reflection + along * .16) / 198.0 + dot(uTilt, vec2(-.012, .018));
      float gratingPhase = (art.x * 296.0 - art.y * (39.0 + art.y * 80.0)) / 6.9;
      float grating = max(1.0 - abs(fract(gratingPhase) - .5) * 4.3, 0.0) * bird;
      vec3 color = base.rgb;

      if (uRank < 1.5) {
        vec3 pearl = mix(vec3(.43, .36, .89), vec3(.50, .86, .91), smoothstep(-68.0, 64.0, reflection));
        color = screen(color, pearl * lobe * (.13 + flash * .14));
        color = screen(color, mix(cool, vec3(.95, .84, 1.0), grating) *
          bird * lobe * (.047 + .14 * grating));
        color = screen(color, mix(cool, warm, .34) * (core * (.31 + .20 * flash) + ambient * .041));
      } else if (uRank < 2.5) {
        vec3 prism = spectrum(phase + .39);
        vec4 facets = texture2D(uScatter, vUV);
        float split = gaussian((reflection - 8.0) / 11.0);
        vec3 diffracted = prism * (lobe * (.11 + flash * .12) + split * .15);
        diffracted += spectrum(phase + art.y * .21) * bird * (.043 + lobe * .14 + grating * split * .15);
        color = screen(color, diffracted + facets.rgb * facets.a * ambient * (.13 + .20 * flash));
        color = screen(color, cool * (core * (.20 + .20 * flash) + ambient * .045));
      } else if (uRank < 3.5) {
        const vec2 sweepNormal = vec2(.927184, .374607);
        float sweepSpan = dot(cardSize, sweepNormal);
        float sweepPosition = dot(pixel, sweepNormal);
        float sweepTravel = dot(uLight.xy * cardSize, sweepNormal) - sweepSpan * .5;
        float primary = sweepPosition - sweepSpan * .33 - sweepTravel * .42;
        float secondary = sweepPosition - sweepSpan * .67 - sweepTravel * .22;
        float rightFalloff = mix(.76, 1.0, dot(vUV, vec2(.47, .53)));
        float rightGain = mix(.39, .54, smoothstep(.16, .74, .5 + sweepTravel / sweepSpan));
        float whiteSweep = gaussian(primary / 21.0) * .78 + gaussian(primary / 7.0) * .22;
        float goldSweep = gaussian(secondary / 24.0) * .81 + gaussian(secondary / 8.0) * .19;
        vec3 clear = vec3(1.0, .97, .90) * whiteSweep * (.38 + .18 * flash);
        clear += vec3(1.0, .87, .67) * goldSweep * rightGain * rightFalloff;

        // The gold panel places light in the feather grooves and around the silhouette.
        vec2 goldPlate = vec2(.5 + nearest.x * .5, nearest.y);
        float stamp = texture2D(uEngraving, goldPlate).a;
        float stampedGroove = stamp * (2.25 - 1.25 * stamp);
        float stampTravel = dot(offset, sweepNormal);
        float stampWidth = dot(uArt.zw, sweepNormal) * .22;
        float stampShine = gaussian((stampTravel + 3.0) / (stampWidth * .43));
        vec3 stampColor = mix(vec3(.78, .47, .17), vec3(1.0, .94, .66), stampShine);

        float metalAngle = radians(36.0 + uTilt.y * 1.65 + uTilt.x * .75);
        vec2 metalNormal = vec2(cos(metalAngle), sin(metalAngle));
        float metalTravel = dot(pixel - cardSize * .5, metalNormal) / (dot(cardSize, metalNormal) * 1.48);
        float metalDistance = metalTravel - (uTilt.y * .95 - uTilt.x * .70) * .01;
        float falloff = abs(metalDistance) / (metalDistance < 0.0 ? .32 : .29);
        vec3 metal = mix(vec3(.55, .37, .19), vec3(.79, .59, .34), 1.0 - smoothstep(.28, 1.0, falloff));
        metal = mix(metal, vec3(1.0, .94, .79), 1.0 - smoothstep(0.0, .60, falloff));
        float exposedMetal = (1.0 - artMask) * smoothstep(.18, .46, dot(color, vec3(.2126, .7152, .0722)));
        vec3 printTint = min(color / vec3(.718, .537, .325), vec3(1.34));
        color = mix(color, metal * printTint, exposedMetal);
        color = screen(color, stampColor * stampedGroove * artMask * (.19 + .68 * stampShine));
        color = screen(color, clear * (artMask + exposedMetal));
      } else {
        vec4 facets = texture2D(uScatter, vUV);
        // If the subject texture is unavailable, protect the flattened art window.
        float protectedArea = mix(artMask, bird, uHasSubject);
        float visibleSky = artMask - protectedArea;
        if (visibleSky > .005) {
          color = screen(color, cosmos(art) * visibleSky * .86);
        }
        float windowPhase = dot(art, vec2(.52, .25)) - dot(uLight.xy - .5, vec2(.32, .29));
        color = screen(color, secretPrism(windowPhase) * visibleSky * (.036 + .032 * flash));
        color = secretFrame(color, pixel, artMask, flash);
        color = secretEmboss(color, art, bird, flash);
        vec2 plate = art * uArt.zw - uArt.zw * .5;
        float stamp = roundedDistance(plate, uArt.zw * .5 - 4.0, 5.0);
        float lip = (1.0 - smoothstep(.3, 1.5, abs(stamp))) * artMask;
        vec3 plateTint = mix(vec3(.78, .98, .93), vec3(1.0, .82, .69), vUV.y);
        color = screen(color, plateTint * lip * .60);
        vec3 sweep = secretSweeps(pixel, flash);
        float grain = texture2D(uFoilGrain, fract(pixel / 84.0)).a;
        vec3 sparkle = vec3(.77, .88, 1.0) * grain * (.16 + flash * .10 + max(sweep.r, sweep.b) * .18);
        vec3 surfaceLight = sweep + sparkle + facets.rgb * facets.a * ambient * (.14 + .24 * flash);
        color = screen(color, surfaceLight * (1.0 - protectedArea));
      }

      gl_FragColor = vec4(birdFill(color, bird, flash), base.a);
    }`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  function loadImage(source) {
    if (!source) return Promise.resolve(null);
    let pending = images.get(source);
    if (!pending) {
      pending = new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = source;
      });
    }
    images.delete(source);
    images.set(source, pending);
    if (images.size > 14) images.delete(images.keys().next().value);
    return pending;
  }

  function makeTexture(gl, image) {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Card texture unavailable');
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Card texture upload failed');
      return texture;
    } catch (error) {
      gl.deleteTexture(texture);
      throw error;
    }
  }

  function createMeteor(start) {
    const fromLeft = Math.random() < .5;
    const lowerLane = Math.random() < .42;
    const diagonal = (.18 + Math.random() * .41) * (lowerLane ? -1 : 1);
    const angle = fromLeft ? diagonal : Math.PI - diagonal;
    const x = fromLeft ? .06 + Math.random() * .17 : .94 - Math.random() * .17;
    const y = lowerLane ? .77 + Math.random() * .15 : .07 + Math.random() * .14;
    const travel = .46 + Math.random() * .24;
    return {
      start, x, y, angle,
      dx: Math.cos(angle) * travel,
      dy: Math.sin(angle) * travel,
      duration: .52 + Math.random() * .32
    };
  }

  function setMeteor(gl, location, face, animate) {
    if (face.rank !== ranks.secret) return;
    if (!animate) {
      face.meteor = null;
      gl.uniform4f(location, 0, 0, 0, -1);
      return;
    }

    if (!face.meteor) face.meteor = createMeteor(face.clock + .8 + Math.random() * 1.7);
    let event = face.meteor;
    if (face.clock >= event.start + event.duration) {
      event = face.meteor = createMeteor(face.clock + 2.35 + Math.random() * 3.65);
    }

    const progress = (face.clock - event.start) / event.duration;
    const x = event.x + Math.max(0, progress) * event.dx;
    const y = event.y + Math.max(0, progress) * event.dy;
    gl.uniform4f(location, x, y, event.angle, progress);
  }

  function createEngine() {
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const gl = source.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false
    });
    if (!gl) return null;

    const faces = new Set();
    const sharedImages = new Map();
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const surfaceLimit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE));
    let maxScale = Math.max(1, Math.floor(Math.min(3, viewport[0] / width, viewport[1] / height,
      surfaceLimit / width, surfaceLimit / height)));
    let resources = null;
    let frame = 0;

    function initialize() {
      const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      if (vertex && fragment && program) {
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
      }
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
        if (program) gl.deleteProgram(program);
        return false;
      }

      const quad = gl.createBuffer();
      if (!quad) {
        gl.deleteProgram(program);
        return false;
      }
      let empty;
      try {
        empty = makeTexture(gl, null);
      } catch (_) {
        gl.deleteBuffer(quad);
        gl.deleteProgram(program);
        return false;
      }

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const corner = gl.getAttribLocation(program, 'aCorner');
      gl.enableVertexAttribArray(corner);
      gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, width, height);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const uniforms = {};
      ['Light', 'Tilt', 'Art', 'HasSubject', 'Rank', 'Time', 'Seed', 'Meteor'].forEach(name => {
        uniforms[name] = gl.getUniformLocation(program, 'u' + name);
      });
      ['Card', 'Subject', 'Engraving', 'Scatter', 'FoilGrain'].forEach((name, unit) => {
        gl.uniform1i(gl.getUniformLocation(program, 'u' + name), unit);
      });
      resources = { empty, uniforms, materials: {} };
      sharedImages.forEach(uploadMaterial);
      return true;
    }

    function uploadMaterial(image, name) {
      try {
        resources.materials[name] = makeTexture(gl, image);
      } catch (_) { /* The card still renders if a finishing texture is unavailable. */ }
    }

    function queue() {
      if (!frame && resources && !document.hidden) frame = requestAnimationFrame(paint);
    }

    function bindTexture(texture, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture || resources.empty);
    }

    function upload(face) {
      face.textures = [];
      face.textures.push(makeTexture(gl, face.artwork.canvas));
      if (face.artwork.subject) face.textures[1] = makeTexture(gl, face.artwork.subject);
      if (face.engraving) face.textures[2] = makeTexture(gl, face.engraving);
    }

    function releaseDetail(face) {
      if (face.detail && resources) gl.deleteTexture(face.detail.texture);
      face.detail = null;
    }

    function detailScale(face) {
      if (!face.detailed || typeof face.artwork.rasterize !== 'function') return 1;
      return Math.max(1, Math.min(maxScale, Math.ceil(face.displayWidth * (window.devicePixelRatio || 1) / width)));
    }

    function prepareDetail(face) {
      const scale = detailScale(face);
      if (scale === 1 || scale === face.failedScale) {
        releaseDetail(face);
        return null;
      }
      if (face.detail && face.detail.scale === scale) return face.detail;

      // The shared buffer grows for inspection. Grid faces use its lower-left viewport.
      if (source.width < width * scale) {
        source.width = width * scale;
        source.height = height * scale;
        if (gl.drawingBufferWidth < source.width || gl.drawingBufferHeight < source.height) {
          source.width = width;
          source.height = height;
          maxScale = 1;
          releaseDetail(face);
          return null;
        }
      }
      try {
        const texture = makeTexture(gl, face.artwork.rasterize(scale));
        releaseDetail(face);
        face.detail = { scale, texture };
        return face.detail;
      } catch (_) {
        face.failedScale = scale;
        releaseDetail(face);
        return null;
      }
    }

    function render(face, now, animate) {
      const { canvas, context, artwork, pose, rank, seed } = face;
      if (!face.textures) upload(face);
      const detail = prepareDetail(face);
      const scale = detail ? detail.scale : 1;
      const outputWidth = width * scale;
      const outputHeight = height * scale;
      if (animate && face.lastAnimation) face.clock += Math.min(100, now - face.lastAnimation) / 1000;
      face.lastAnimation = animate ? now : 0;

      const { uniforms, materials } = resources;
      const [card, subject, engraving] = face.textures;
      bindTexture(detail ? detail.texture : card, 0);
      bindTexture(subject, 1);
      bindTexture(engraving, 2);
      bindTexture(materials.scatter, 3);
      bindTexture(materials.foilGrain, 4);
      gl.uniform3f(uniforms.Light, pose.x, pose.y, pose.flash);
      gl.uniform2f(uniforms.Tilt, pose.tiltX, pose.tiltY);
      gl.uniform4f(uniforms.Art, artwork.art.x, artwork.art.y, artwork.art.width, artwork.art.height);
      gl.uniform1f(uniforms.HasSubject, subject ? 1 : 0);
      gl.uniform1f(uniforms.Rank, rank);
      gl.uniform1f(uniforms.Time, face.clock);
      gl.uniform1f(uniforms.Seed, seed);
      setMeteor(gl, uniforms.Meteor, face, animate);
      gl.viewport(0, 0, outputWidth, outputHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Copy this finished face before issuing the next draw to the shared buffer.
      if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        context.globalCompositeOperation = 'copy';
      }
      context.drawImage(source, 0, source.height - outputHeight, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
      if (!face.ready && !gl.isContextLost()) {
        face.host.appendChild(canvas);
        setReady(face, true);
      }
    }

    function paint(now) {
      frame = 0;
      if (!resources || gl.isContextLost()) return;
      faces.forEach(face => {
        if (!face.artwork || !face.card.isConnected) return;
        const animate = face.rank === ranks.secret && face.inspecting && !reducedMotion.matches;
        if (!face.dirty && (!animate || now - face.lastAnimation < 32)) {
          if (animate) queue();
          return;
        }
        try {
          render(face, now, animate);
          face.dirty = false;
          if (animate) queue();
        } catch (_) {
          if (!gl.isContextLost()) release(face);
        }
      });
    }

    function setReady(face, ready) {
      if (face.ready === ready) return;
      face.ready = ready;
      if (ready) face.card.dataset.webglFace = 'ready';
      else {
        face.canvas.remove();
        delete face.card.dataset.webglFace;
      }
      face.card.dispatchEvent(new Event('birdwebglchange'));
    }

    function release(face) {
      if (!faces.delete(face)) return;
      face.closed = true;
      releaseDetail(face);
      if (resources && face.textures) face.textures.forEach(texture => gl.deleteTexture(texture));
      face.textures = face.artwork = face.engraving = null;
      setReady(face, false);
    }

    if (!initialize()) return null;

    Object.entries({ scatter: 'holo-scatter.png', foilGrain: 'foil-grain.png' }).forEach(([name, file]) => {
      loadImage('./assets/textures/' + file).then(image => {
        if (!image) return;
        sharedImages.set(name, image);
        if (resources) uploadMaterial(image, name);
        faces.forEach(face => { face.dirty = true; });
        queue();
      });
    });

    source.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      resources = null;
      faces.forEach(face => {
        face.detail = null;
        face.failedScale = 0;
        face.textures = null;
        face.lastAnimation = 0;
        setReady(face, false);
      });
    });
    source.addEventListener('webglcontextrestored', () => {
      if (!initialize()) return;
      faces.forEach(face => { face.dirty = true; });
      queue();
    });
    document.addEventListener('visibilitychange', queue);
    reducedMotion.addListener(() => {
      faces.forEach(face => {
        if (face.rank === ranks.secret && face.inspecting) face.dirty = true;
      });
      queue();
    });

    return {
      add(face, data) {
        faces.add(face);
        const source = data.subject && data.subject.replace(/subject-(\d{3})\.webp$/, 'engraving-$1.webp');
        const needsEngraving = source !== data.subject && face.rank >= ranks.ultra;
        Promise.all([window.loadBirdArtwork(data), loadImage(needsEngraving ? source : null)]).then(([artwork, engraving]) => {
          if (!faces.has(face)) return;
          if (!artwork || !artwork.canvas || !artwork.art) {
            release(face);
            return;
          }
          face.artwork = artwork;
          face.engraving = engraving;
          queue();
        }).catch(() => release(face));
      },
      queue,
      releaseDetail,
      release
    };
  }

  let engine;
  window.attachBirdWebGL = function attachBirdWebGL(card, host, surface, data) {
    if (!window.loadBirdArtwork || !(data.rank in ranks)) return null;
    if (engine === undefined) {
      try { engine = createEngine(); } catch (_) { engine = null; }
    }
    if (!engine) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'bird-webgl-face';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) return null;
    // A single paint replaces the complete canvas, including the transparent corners.
    context.globalCompositeOperation = 'copy';
    const rank = ranks[data.rank];
    const seed = Number.parseInt(data.serial, 10) || 19;
    const [x, y] = restingLights[rank];
    const face = {
      card, host, canvas, context, rank, seed, ready: false, dirty: true,
      inspecting: false, detailed: false, detail: null, failedScale: 0, displayWidth: width,
      clock: .9 + seed * .013, lastAnimation: 0,
      pose: { x, y, flash: .30, tiltX: 0, tiltY: 0 }
    };
    engine.add(face, data);
    return {
      update(pose) {
        if (face.closed) return;
        face.pose = { x: pose.x, y: pose.y, flash: pose.flash, tiltX: pose.tiltX || 0, tiltY: pose.tiltY || 0 };
        face.dirty = true;
        engine.queue();
      },
      setDisplayWidth(displayWidth) {
        if (face.closed || !displayWidth || face.displayWidth === displayWidth) return;
        face.displayWidth = displayWidth;
        if (!face.detailed) return;
        face.dirty = true;
        engine.queue();
      },
      setInspectMode(active, detailed = active) {
        if (face.closed || (face.inspecting === active && face.detailed === detailed)) return;
        if (face.inspecting !== active) face.lastAnimation = 0;
        face.inspecting = active;
        face.detailed = detailed;
        if (!detailed) engine.releaseDetail(face);
        face.dirty = true;
        engine.queue();
      },
      release() { engine.release(face); }
    };
  };
})();
