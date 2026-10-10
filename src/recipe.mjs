import {defaults, palettes} from './engine.mjs?v=1.0.0';

export const recipeVersion = 3;
export const exportSizes = [1024, 2048, 3072];
export const presets = {
  prism: {spread: 58, energy: 92, lines: 38, fracture: 8, growth: 23},
  echo: {spread: 40, energy: 83, lines: 45, fracture: 0, growth: 25},
  fracture: {spread: 76, energy: 92, lines: 45, fracture: 65, growth: 23}
};

export function safeConfig(input = {}) {
  const c = {...defaults};
  const ranges = {copies: [1, 6], growth: [0, 35], subjectScale: [40, 85], spread: [0, 100],
    energy: [0, 100], lines: [0, 100], smoothness: [0, 100], definition: [0, 100],
    fracture: [0, 100], protection: [0, 100], focusSize: [8, 45], tolerance: [5, 70], focusX: [0, 1], focusY: [0, 1]};
  // Legacy recipes predate the crisp graphic renderer.
  if (!Number.isFinite(input.definition)) c.definition = 0;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (Number.isFinite(input[key])) c[key] = Math.max(min, Math.min(max, input[key]));
  }
  if (Number.isFinite(input.seed)) c.seed = input.seed >>> 0;
  c.copies = Math.round(c.copies);
  const choices = {palette: Object.keys(palettes), style: Object.keys(presets),
    maskMode: ['auto', 'full', 'oval', 'alpha'], background: ['paper', 'ink', 'transparent'], framing: ['square', 'original']};
  for (const [key, options] of Object.entries(choices)) if (options.includes(input[key])) c[key] = input[key];
  return c;
}

export function parseRecipe(text) {
  const r = JSON.parse(text);
  if (!r || r.format !== 'prism-echo' || ![1, 2, 3].includes(r.version) ||
      !r.config || typeof r.config !== 'object' || Array.isArray(r.config)) {
    throw new Error('Choose a Prism Echo recipe JSON file.');
  }
  let mask;
  if (r.mask !== undefined) {
    const m = r.mask;
    if (!m || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 1 || m.height < 1 ||
        m.width > 760 || m.height > 760 || typeof m.png !== 'string' ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(m.png)) {
      throw new Error('This recipe contains an invalid subject mask.');
    }
    mask = {width: m.width, height: m.height, png: m.png};
  }
  return {format: 'prism-echo', version: r.version, config: safeConfig(r.config), mask,
    sourceName: typeof r.sourceName === 'string' ? r.sourceName : '',
    sourceWidth: r.sourceWidth, sourceHeight: r.sourceHeight,
    exportSize: exportSizes.includes(r.exportSize) ? r.exportSize : 2048};
}

export function scaleMask(original, ow, oh, w, h) {
  const resized = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    resized[y * w + x] = original[Math.min(oh - 1, Math.floor(y / h * oh)) * ow + Math.min(ow - 1, Math.floor(x / w * ow))];
  }
  return resized;
}
