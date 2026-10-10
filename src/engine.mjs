export const palettes = {
  electric: ['#ff286e', '#00e8ee', '#d9ff31', '#6358ff', '#2dfc8f'],
  spectrum: ['#ff303c', '#26ef69', '#175cff', '#ff3ee2', '#fff353'],
  dusk: ['#ff874b', '#d353ef', '#4f7bff', '#ff4269', '#8cf5dc'],
  frost: ['#26e4e5', '#87b6ff', '#b5ffda', '#7963ee', '#ff71b6']
};
export const defaults = {seed: 4815, style: 'prism', palette: 'spectrum', spread: 58,
  copies: 4, growth: 23, subjectScale: 58,
  energy: 92, lines: 38, smoothness: 82, definition: 82, fracture: 8, protection: 90, focusX: .5, focusY: .53,
  focusSize: 22, background: 'paper', maskMode: 'auto', tolerance: 30, framing: 'square'};
export function random(seed) {
  let a = Number(seed) >>> 0;
  return () => { a += 0x6D2B79F5; let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
export function extractMask(data, w, h, mode = 'auto', tolerance = 30) {
  const n = w * h, mask = new Float32Array(n);
  let hasAlpha = false;
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6000))) if (data[i * 4 + 3] < 245) hasAlpha = true;
  if (mode === 'full' || mode === 'alpha' || (hasAlpha && mode === 'auto')) {
    for (let i = 0; i < n; i++) mask[i] = data[i * 4 + 3] / 255;
    return mask;
  }
  if (mode === 'oval') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot((x / w - .5) / .40, (y / h - .56) / .57);
      mask[y * w + x] = clamp((1.02 - d) * 35) * data[(y * w + x) * 4 + 3] / 255;
    }
    return mask;
  }
  // Estimate background colors from border samples, then remove only connected regions.
  const samples = [], bins = new Map();
  const add = (x, y) => {
    const i = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4;
    if (data[i + 3] < 128) return;
    const c = [data[i], data[i + 1], data[i + 2]];
    const key = c.map(v => v >> 4).join(',');
    const b = bins.get(key) || {c: [0, 0, 0], n: 0};
    c.forEach((v, k) => b.c[k] += v); b.n++; bins.set(key, b); samples.push(c);
  };
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 70))) add(x, 0);
  for (let y = 0; y < h * .80; y += Math.max(1, Math.floor(h / 90))) { add(0, y); add(w - 1, y); }
  if (!samples.length) return extractMask(data, w, h, 'alpha');
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n);
  const anchor = sorted[0].c.map(v => v / sorted[0].n);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.sqrt(3);
  const colors = sorted.slice(0, 16).map(b => b.c.map(v => v / b.n)).filter(c => distance(c, anchor) < 62).slice(0, 9);
  const seen = new Uint8Array(n), bg = new Uint8Array(n), queue = new Uint32Array(n);
  let head = 0, tail = 0;
  const visit = p => {
    if (seen[p]) return; seen[p] = 1;
    const j = p * 4;
    let matches = data[j + 3] < 15;
    if (!matches) for (const c of colors) {
      if (Math.hypot(data[j] - c[0], data[j + 1] - c[1], data[j + 2] - c[2]) / Math.sqrt(3) < tolerance) { matches = true; break; }
    }
    if (matches) { bg[p] = 1; queue[tail++] = p; }
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % w;
    if (x) visit(p - 1); if (x < w - 1) visit(p + 1);
    if (p >= w) visit(p - w); if (p < n - w) visit(p + w);
  }
  for (let i = 0; i < n; i++) mask[i] = bg[i] ? 0 : data[i * 4 + 3] / 255;
  return mask;
}
export function focusFromMask(mask, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (mask[y * w + x] > .5) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); found = true;
  }
  return found ? {focusX: (minX + maxX) / 2 / w, focusY: (minY + (maxY - minY) * .24) / h} : {focusX: .5, focusY: .35};
}
// Separable box passes approximate a Gaussian, with radius tied to image size.
// Smoothing is applied only to echo fields; the foreground uses the source pixels.
export function blurField(input, w, h, radius, passes = 3) {
  if (radius < 1) return input.slice();
  const span = 2 * radius + 1;
  let current = input.slice(), horizontal = new Float32Array(w * h), vertical = new Float32Array(w * h);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += current[row + Math.max(0, Math.min(w - 1, k))];
      for (let x = 0; x < w; x++) {
        horizontal[row + x] = sum / span;
        sum += current[row + Math.min(w - 1, x + radius + 1)] - current[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += horizontal[Math.max(0, Math.min(h - 1, k)) * w + x];
      for (let y = 0; y < h; y++) {
        vertical[y * w + x] = sum / span;
        sum += horizontal[Math.min(h - 1, y + radius + 1) * w + x] - horizontal[Math.max(0, y - radius) * w + x];
      }
    }
    [current, vertical] = [vertical, current];
  }
  return current;
}
export function prepareEcho(data, mask, w, h, smoothness = 82) {
  const n = w * h, scale = Math.min(w, h) / 760, amount = clamp(smoothness / 100);
  const raw = new Float32Array(n);
  for (let p = 0; p < n; p++) raw[p] = (.2126 * data[p * 4] + .7152 * data[p * 4 + 1] + .0722 * data[p * 4 + 2]) / 255;
  const radius = Math.round(amount * 4 * scale);
  const luminance = blurField(raw, w, h, radius);
  const softMask = blurField(mask, w, h, Math.round(amount * 2 * scale), 2);
  if (amount > 0) for (let p = 0; p < n; p++) softMask[p] = clamp((softMask[p] - .20) / .60);
  const edges = new Float32Array(n), step = Math.max(1, Math.round(scale * 2));
  for (let y = step; y < h - step; y++) for (let x = step; x < w - step; x++) {
    const p = y * w + x;
    const gx = luminance[p + step] - luminance[p - step];
    const gy = luminance[p + step * w] - luminance[p - step * w];
    const silhouette = Math.max(Math.abs(softMask[p] - softMask[p - step]), Math.abs(softMask[p] - softMask[p - step * w]));
    edges[p] = Math.max(clamp((Math.hypot(gx, gy) - .035) * 7) * softMask[p], silhouette * .50);
  }
  // Thin the already denoised contours rather than sharpening source texture.
  const crispEdges = new Float32Array(n), offset = Math.max(1, Math.round(scale));
  for (let y = Math.max(step, offset); y < h - Math.max(step, offset); y++) for (let x = Math.max(step, offset); x < w - Math.max(step, offset); x++) {
    const p = y * w + x, e = edges[p]; if (e < .13) continue;
    const gx = luminance[p + step] - luminance[p - step], gy = luminance[p + step * w] - luminance[p - step * w];
    const ax = Math.abs(gx), ay = Math.abs(gy);
    let d;
    if (ay < ax * .4142) d = offset;
    else if (ay > ax * 2.4142) d = offset * w;
    else d = (gx * gy >= 0 ? w + 1 : w - 1) * offset;
    if (e >= edges[p - d] && e >= edges[p + d]) crispEdges[p] = clamp((e - .10) / .35);
  }
  // Remove isolated little marks; keep connected eyebrows, eyes, lips and silhouettes.
  const seen = new Uint8Array(n), queue = new Uint32Array(n), minLength = Math.max(5, Math.round(scale * scale * 5));
  for (let start = 0; start < n; start++) {
    if (seen[start] || crispEdges[start] < .05) continue;
    let head = 0, tail = 1; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const p = queue[head++], px = p % w, py = Math.floor(p / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || px + dx < 0 || px + dx >= w || py + dy < 0 || py + dy >= h) continue;
        const q = p + dy * w + dx;
        if (!seen[q] && crispEdges[q] >= .05) { seen[q] = 1; queue[tail++] = q; }
      }
    }
    if (tail < minLength) for (let k = 0; k < tail; k++) crispEdges[queue[k]] = 0;
  }
  return {luminance, mask: softMask, edges, crispEdges};
}
function sample(field, w, h, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const nx = Math.min(w - 1, ix + 1), ny = Math.min(h - 1, iy + 1);
  return field[iy * w + ix] * (1 - fx) * (1 - fy) + field[iy * w + nx] * fx * (1 - fy)
    + field[ny * w + ix] * (1 - fx) * fy + field[ny * w + nx] * fx * fy;
}
export function makeLayers(config) {
  const rng = random(config.seed), palette = (palettes[config.palette] || palettes.electric).map(hex);
  const turn = rng() * Math.PI * 2, count = config.copies ?? 4;
  const chaos = config.fracture / 100;
  return Array.from({length: count}, (_, i) => {
    const angle = turn + i * Math.PI * 2 / count + (rng() - .5) * .6;
    const bands = 7 + Math.floor(rng() * 7);
    return {color: palette[(count - 1 - i + Math.floor(config.seed % palette.length)) % palette.length],
      dx: Math.cos(turn + (rng() - .5) * .3) * (.035 + i * .040), dy: Math.sin(turn) * (.005 + i * .002),
      rotate: (rng() - .5) * .04 * chaos, scale: config.subjectScale / 100 * (1 + config.growth / 100 * (i + 1)),
      phase: rng() * 6.28, frequency: 1.5 + rng() * 3, bands,
      bandShift: Array.from({length: bands}, () => (rng() - .5) * .035 * chaos),
      cut: Array.from({length: bands}, (_, band) => band > bands * .55 && rng() < chaos * (config.style === 'fracture' ? .35 : .10))};
  });
}
export function render(data, w, h, mask, echo, config = defaults) {
  const n = w * h, over = new Float32Array(n * 4), features = new Float32Array(n * 4), output = new Uint8ClampedArray(n * 4), overlay = new Uint8ClampedArray(n * 4), subject = new Uint8ClampedArray(n * 4);
  const layers = makeLayers(config), spread = config.spread / 58, energy = config.energy / 100;
  const definition = clamp((config.definition ?? 0) / 100);
  const linePower = config.lines / 100, protect = config.protection / 100;
  const cx = config.focusX * w, cy = config.focusY * h, radius = config.focusSize / 100 * Math.min(w, h);
  const protection = new Float32Array(n);
  // Every copy shares a lower anchor. Scaling raises and enlarges each whole after-image.
  const anchorX = w * .5, anchorY = h, primaryScale = config.subjectScale / 100;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, d = Math.hypot((x - cx) / Math.max(1, radius), (y - cy) / Math.max(1, radius * .93));
    protection[p] = protect * clamp((1.32 - d) / .45);
    const sx = Math.round((x - anchorX) / primaryScale + anchorX), sy = Math.round((y - anchorY) / primaryScale + anchorY);
    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
      const sp = sy * w + sx, j = p * 4, sj = sp * 4;
      subject[j] = data[sj]; subject[j + 1] = data[sj + 1]; subject[j + 2] = data[sj + 2]; subject[j + 3] = mask[sp] * 255;
    }
  }
  if (energy > 0) for (const layer of [...layers].reverse()) {
    const cos = Math.cos(layer.rotate), sin = Math.sin(layer.rotate);
    for (let y = 0; y < h; y++) {
      const band = Math.min(layer.bands - 1, Math.floor(y / h * layer.bands));
      if (layer.cut[band]) continue;
      const drift = (Math.sin(y / h * layer.frequency * Math.PI * 2 + layer.phase) * .008 * config.fracture / 100 + layer.bandShift[band]) * spread;
      for (let x = 0; x < w; x++) {
        const tx = x - anchorX - w * (layer.dx * spread + drift), ty = y - anchorY - h * layer.dy * spread;
        const sx = (tx * cos + ty * sin) / layer.scale + anchorX;
        const sy = (-tx * sin + ty * cos) / layer.scale + anchorY;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const softM = sample(echo.mask, w, h, sx, sy);
        const sharpM = clamp((softM - .5) / (.30 - definition * .26) + .5);
        const m = softM * (1 - definition) + sharpM * definition; if (m < .02) continue;
        const p = y * w + x, j = p * 4;
        const softEdge = sample(echo.edges, w, h, sx, sy);
        const sharpEdge = sample(echo.crispEdges, w, h, sx, sy);
        const edge = (softEdge * (1 - definition) + sharpEdge * definition) * linePower;
        // Only broad, pre-smoothed features carry gently through overlapping copies.
        // Hair strands and skin texture never become a raw black outline stack.
        const fa = edge * energy * (.95 + definition * .60);
        if (fa > .001) {
          const old = features[j + 3], next = fa + old * (1 - fa);
          for (let k = 0; k < 3; k++) features[j + k] = ((layer.color[k] * .30 + .06) * fa + features[j + k] * old * (1 - fa)) / next;
          features[j + 3] = next;
        }
        const modeFill = config.style === 'echo' ? .52 : .78;
        const alpha = clamp(energy * m * (modeFill + definition * .12), 0, .9);
        if (alpha < .001) continue;
        const l = sample(echo.luminance, w, h, sx, sy);
        // Harder color planes come from denoised tones, so they don't restore hair/skin grain.
        const tone = Math.round(clamp((l - .42) * 1.35 + .42) * 6) / 6;
        const photoLight = .10 + .90 * Math.sqrt(Math.max(0, l));
        const graphicLight = .60 + .40 * tone;
        const light = (photoLight * (1 - definition) + graphicLight * definition) * (1 - edge * .32);
        const a0 = over[j + 3], a = alpha + a0 * (1 - alpha);
        for (let k = 0; k < 3; k++) {
          const c = layer.color[k] * light;
          // Bright mixed intersections, without screening the whole image against white.
          const screened = a0 ? 1 - (1 - over[j + k]) * (1 - c) : c;
          const mixed = screened * .18 + c * .82;
          over[j + k] = (c * alpha * (1 - a0) + mixed * alpha * a0 + over[j + k] * a0 * (1 - alpha)) / a;
        }
        over[j + 3] = a;
      }
    }
  }
  const bg = config.background === 'ink' ? [12, 15, 22] : [246, 245, 242];
  for (let p = 0; p < n; p++) {
    const j = p * 4, originalMask = subject[j + 3] / 255;
    const featureA = features[j + 3], oldA = over[j + 3], combinedA = featureA + oldA * (1 - featureA);
    if (combinedA > 0) for (let k = 0; k < 3; k++) over[j + k] = (features[j + k] * featureA + over[j + k] * oldA * (1 - featureA)) / combinedA;
    over[j + 3] = combinedA;
    const a = clamp(over[j + 3]) * (1 - originalMask * (.70 + protection[p] * .28));
    let ba = config.background === 'transparent' ? originalMask : 1;
    const b = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      if (config.background === 'transparent') b[k] = subject[j + k];
      else b[k] = subject[j + k] * originalMask + bg[k] * (1 - originalMask);
      overlay[j + k] = over[j + k] * 255;
    }
    overlay[j + 3] = a * 255;
    const outA = a + ba * (1 - a);
    for (let k = 0; k < 3; k++) output[j + k] = outA ? (over[j + k] * 255 * a + b[k] * ba * (1 - a)) / outA : 0;
    output[j + 3] = outA * 255;
  }
  return {output, overlay, subject};
}
