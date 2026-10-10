import {defaults, extractMask, prepareEcho, focusFromMask} from './engine.mjs?v=1.0.0';
import {presets, parseRecipe, scaleMask} from './recipe.mjs?v=1.0.0';
import {createRenderer} from './renderer.mjs?v=1.0.0';
const renderAsync = createRenderer();
const $ = id => document.getElementById(id);
const preview = $('preview'), ctx = preview.getContext('2d', {willReadFrequently: true});
let config = {...defaults}, image, sourceName = 'Generic avatar · sample image', source, mask, echo;
let showOriginal = false, focusing = false, painting = false, brushMode = 'erase';
let renderTimer, toastTimer, paintingPointer = null, manualMask = false, imageGeneration = 0;
let drawGeneration = 0, drawing = false, redrawPending = false, recipeGeneration = 0, exporting = false;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const pause = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
function dimensions(maxSide) {
  if (config.framing === 'square') return [maxSide, maxSide];
  const ratio = image.naturalWidth / image.naturalHeight;
  return ratio >= 1 ? [maxSide, Math.max(1, Math.round(maxSide / ratio))] : [Math.max(1, Math.round(maxSide * ratio)), maxSide];
}
function prepareSource(maxSide) {
  const [w, h] = dimensions(maxSide), c = canvas(w, h), cctx = c.getContext('2d', {willReadFrequently: true});
  const iw = image.naturalWidth, ih = image.naturalHeight;
  if (config.framing === 'square') {
    const side = Math.min(iw, ih);
    // Center crop; output and overlay always use this identical source transform.
    cctx.drawImage(image, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, w, h);
  } else cctx.drawImage(image, 0, 0, w, h);
  return {w, h, data: cctx.getImageData(0, 0, w, h).data};
}
function rebuild({focus = false} = {}) {
  if (!image) return;
  const maxSide = Math.min(760, Math.max(image.naturalWidth, image.naturalHeight));
  source = prepareSource(maxSide);
  mask = extractMask(source.data, source.w, source.h, config.maskMode, config.tolerance);
  echo = prepareEcho(source.data, mask, source.w, source.h, config.smoothness); manualMask = false;
  if (focus) { const f = focusFromMask(mask, source.w, source.h); config.focusX = .5 + (f.focusX - .5) * config.subjectScale / 100; config.focusY = 1 + (f.focusY - 1) * config.subjectScale / 100; }
  preview.width = source.w; preview.height = source.h;
  $('imageInfo').textContent = `${image.naturalWidth} × ${image.naturalHeight} source · ${config.framing === 'square' ? 'square crop' : 'original frame'}`;
  syncUI(); schedule();
}
function syncUI() {
  for (const key of ['copies', 'growth', 'subjectScale', 'spread', 'energy', 'lines', 'smoothness', 'definition', 'fracture', 'protection', 'focusSize', 'tolerance']) {
    $(key).value = config[key]; $(key + 'Value').textContent = config[key];
  }
  for (const key of ['maskMode', 'background', 'framing']) $(key).value = config[key];
  $('seedInput').value = config.seed; $('seedDisplay').textContent = String(config.seed).padStart(6, '0');
  $('paletteName').textContent = config.palette[0].toUpperCase() + config.palette.slice(1);
  for (const b of document.querySelectorAll('[data-style]')) b.setAttribute('aria-pressed', b.dataset.style === config.style);
  for (const b of document.querySelectorAll('[data-palette]')) b.setAttribute('aria-pressed', b.dataset.palette === config.palette);
  $('toleranceLabel').hidden = config.maskMode !== 'auto';
}
function draw() {
  const generation = ++drawGeneration;
  if (!source) return;
  const {w, h, data} = source;
  if (painting) {
    const d = new Uint8ClampedArray(data);
    for (let p = 0; p < w * h; p++) if (mask[p] < .5) {
      d[p * 4] = d[p * 4] * .5 + 255 * .5; d[p * 4 + 1] *= .5; d[p * 4 + 2] = d[p * 4 + 2] * .5 + 105 * .5;
    }
    ctx.putImageData(new ImageData(d, w, h), 0, 0);
  } else if (showOriginal) ctx.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  else {
    if (drawing) { redrawPending = true; return; }
    drawing = true; redrawPending = false; $('busy').hidden = false;
    renderAsync({data, w, h, mask, echo, config: {...config}}).then(pixels => {
      if (generation !== drawGeneration) return;
      ctx.putImageData(new ImageData(pixels, w, h), 0, 0); paintFocus();
    }).catch(error => { if (generation === drawGeneration) toast(error.message); }).finally(() => {
      drawing = false; $('busy').hidden = !exporting;
      if (redrawPending) { redrawPending = false; draw(); }
    });
    return;
  }
  paintFocus();
}
function paintFocus() {
  const {w, h} = source;
  if (focusing) {
    const r = config.focusSize / 100 * Math.min(w, h);
    ctx.save(); ctx.beginPath(); ctx.ellipse(config.focusX * w, config.focusY * h, r, r * .93, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#d9ff63'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.restore();
  }
}
function schedule() { clearTimeout(renderTimer); renderTimer = setTimeout(() => { try { draw(); } catch (e) { console.error(e); toast('Couldn’t render this image. Try a smaller image.'); } }, 70); }
function loadImage(url, name, revoke = false) {
  const generation = ++imageGeneration;
  return new Promise((resolve, reject) => {
    const next = new Image(); next.onload = () => {
      if (revoke) URL.revokeObjectURL(url);
      if (generation !== imageGeneration) { resolve(); return; }
      image = next; $('exportButton').disabled = exporting; sourceName = name; $('filename').textContent = name; setPainting(false); showOriginal = false;
      $('compareButton').setAttribute('aria-pressed', false); $('compareButton').textContent = 'Show original';
      rebuild({focus: true}); resolve();
    }; next.onerror = () => { if (revoke) URL.revokeObjectURL(url); reject(new Error('This image format could not be opened. Use PNG, JPG, or WebP.')); }; next.src = url;
  });
}
async function fileUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Choose an image file: PNG, JPG, or WebP.'); return; }
  if (file.size > 40 * 1024 * 1024) { toast('Choose an image smaller than 40 MB.'); return; }
  try { await loadImage(URL.createObjectURL(file), file.name, true); toast('Image loaded. Make it yours.'); } catch (e) { toast(e.message); }
}
$('uploadButton').onclick = () => $('fileInput').click();
$('fileInput').onchange = e => { fileUpload(e.target.files[0]); e.target.value = ''; };
let dragDepth = 0;
for (const event of ['dragenter', 'dragover', 'dragleave', 'drop']) document.addEventListener(event, e => {
  if (!e.dataTransfer?.types.includes('Files')) return; e.preventDefault();
  if (event === 'dragenter') { dragDepth++; $('dropMessage').hidden = false; }
  if (event === 'dragleave' && --dragDepth <= 0) { dragDepth = 0; $('dropMessage').hidden = true; }
  if (event === 'drop') { dragDepth = 0; $('dropMessage').hidden = true; fileUpload(e.dataTransfer.files[0]); }
});
for (const key of ['copies', 'growth', 'subjectScale', 'spread', 'energy', 'lines', 'definition', 'fracture', 'protection', 'focusSize']) $(key).oninput = e => {
  const before = config.subjectScale; config[key] = Number(e.target.value); $(key + 'Value').textContent = config[key];
  if (key === 'subjectScale') { config.focusX = .5 + (config.focusX - .5) * config.subjectScale / before; config.focusY = 1 + (config.focusY - 1) * config.subjectScale / before; }
  schedule();
};
$('smoothness').oninput = e => {
  config.smoothness = Number(e.target.value); $('smoothnessValue').textContent = config.smoothness;
  if (source) echo = prepareEcho(source.data, mask, source.w, source.h, config.smoothness);
  schedule();
};
$('tolerance').oninput = e => { config.tolerance = Number(e.target.value); rebuild(); };
$('maskMode').onchange = e => { config.maskMode = e.target.value; rebuild({focus: true}); };
$('framing').onchange = e => { config.framing = e.target.value; rebuild({focus: true}); };
$('background').onchange = e => { config.background = e.target.value; schedule(); };
$('seedInput').onchange = e => { config.seed = Math.max(0, Math.min(4294967295, Number(e.target.value) || 0)) >>> 0; syncUI(); schedule(); };
for (const b of document.querySelectorAll('[data-palette]')) b.onclick = () => { config.palette = b.dataset.palette; syncUI(); schedule(); };
for (const b of document.querySelectorAll('[data-style]')) b.onclick = () => { Object.assign(config, presets[b.dataset.style], {style: b.dataset.style}); syncUI(); schedule(); };
$('variationButton').onclick = () => { config.seed = crypto.getRandomValues(new Uint32Array(1))[0]; syncUI(); schedule(); };
$('resetButton').onclick = () => { config = {...defaults}; setPainting(false); focusing = false; preview.classList.remove('focusing'); $('focusButton').setAttribute('aria-pressed', false); rebuild({focus: true}); toast('Effect settings reset.'); };
$('compareButton').onclick = () => { if (painting) setPainting(false); showOriginal = !showOriginal; $('compareButton').setAttribute('aria-pressed', showOriginal); $('compareButton').textContent = showOriginal ? 'Show effect' : 'Show original'; draw(); };
$('focusButton').onclick = () => { if (painting) setPainting(false); focusing = !focusing; preview.classList.toggle('focusing', focusing); $('focusButton').setAttribute('aria-pressed', focusing); if (focusing) { preview.focus(); toast('Click to place focus, or use arrow keys and Enter.'); } draw(); };
preview.onkeydown = e => {
  if (!focusing) return;
  const delta = e.shiftKey ? .05 : .01;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault(); config.focusX = Math.max(0, Math.min(1, config.focusX + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0)));
    config.focusY = Math.max(0, Math.min(1, config.focusY + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0))); draw();
  } else if (['Enter', 'Escape'].includes(e.key)) { focusing = false; preview.classList.remove('focusing'); $('focusButton').setAttribute('aria-pressed', false); draw(); $('focusButton').focus(); }
};
function setPainting(active) {
  painting = active; paintingPointer = null; preview.classList.toggle('painting', active); $('maskBar').hidden = !active;
  if (active) { focusing = false; showOriginal = false; preview.classList.remove('focusing'); $('focusButton').setAttribute('aria-pressed', false); $('compareButton').setAttribute('aria-pressed', false); $('compareButton').textContent = 'Show original'; }
  if (!active && source && manualMask) echo = prepareEcho(source.data, mask, source.w, source.h, config.smoothness);
  schedule();
}
$('refineButton').onclick = () => { setPainting(!painting); if (painting) toast('Pink marks the removed background. Paint to keep or erase.'); };
$('doneMask').onclick = () => setPainting(false);
$('keepBrush').onclick = () => { brushMode = 'keep'; $('keepBrush').setAttribute('aria-pressed', true); $('eraseBrush').setAttribute('aria-pressed', false); };
$('eraseBrush').onclick = () => { brushMode = 'erase'; $('keepBrush').setAttribute('aria-pressed', false); $('eraseBrush').setAttribute('aria-pressed', true); };
$('resetMask').onclick = () => rebuild();
function point(e) { const r = preview.getBoundingClientRect(); return {x: (e.clientX - r.left) / r.width * source.w, y: (e.clientY - r.top) / r.height * source.h}; }
let lastBrushPoint;
function brushAt(x, y) {
  const radius = Number($('brushSize').value) / 760 * Math.max(source.w, source.h);
  const minX = Math.max(0, Math.floor(x - radius)), maxX = Math.min(source.w - 1, Math.ceil(x + radius));
  const minY = Math.max(0, Math.floor(y - radius)), maxY = Math.min(source.h - 1, Math.ceil(y + radius));
  for (let yy = minY; yy <= maxY; yy++) for (let xx = minX; xx <= maxX; xx++) if (Math.hypot(xx - x, yy - y) <= radius) mask[yy * source.w + xx] = brushMode === 'keep' ? source.data[(yy * source.w + xx) * 4 + 3] / 255 : 0;
  manualMask = true;
}
preview.onpointerdown = e => {
  if (!source) return; const p = point(e);
  if (focusing) { config.focusX = p.x / source.w; config.focusY = p.y / source.h; focusing = false; preview.classList.remove('focusing'); $('focusButton').setAttribute('aria-pressed', false); draw(); toast('Protected area placed.'); }
  else if (painting) { e.preventDefault(); paintingPointer = e.pointerId; preview.setPointerCapture(e.pointerId); lastBrushPoint = p; brushAt(p.x, p.y); draw(); }
};
preview.onpointermove = e => {
  if (!painting || paintingPointer !== e.pointerId) return; const p = point(e);
  const steps = Math.ceil(Math.hypot(p.x - lastBrushPoint.x, p.y - lastBrushPoint.y) / 4);
  for (let i = 1; i <= Math.max(1, steps); i++) brushAt(lastBrushPoint.x + (p.x - lastBrushPoint.x) * i / Math.max(1, steps), lastBrushPoint.y + (p.y - lastBrushPoint.y) * i / Math.max(1, steps));
  lastBrushPoint = p; draw();
};
preview.onpointerup = preview.onpointercancel = () => { paintingPointer = null; };
function download(blob, filename) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
const slug = () => sourceName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) || 'image';
$('exportButton').onclick = async () => {
  if (!image || !source) return; const b = $('exportButton'); b.disabled = true; b.textContent = 'Preparing PNG…'; exporting = true; $('busy').hidden = false;
  try {
    if (painting) setPainting(false);
    const settings = {...config}, exportSlug = slug(), kind = $('exportType').value;
    const s = prepareSource(Number($('exportSize').value));
    // Scale the actual preview mask; preserve manual refinements and preview isolation exactly.
    const exportMask = scaleMask(mask, source.w, source.h, s.w, s.h);
    await pause();
    const pixels = await renderAsync({...s, mask: exportMask, config: settings, kind: kind === 'composition' ? 'output' : kind});
    const c = canvas(s.w, s.h);
    c.getContext('2d').putImageData(new ImageData(pixels, s.w, s.h), 0, 0);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG export failed. Try a smaller export size.');
    download(blob, `${exportSlug}-prism-${settings.seed}${kind === 'overlay' ? '-overlay' : kind === 'subject' ? '-subject' : ''}.png`);
    toast(kind === 'overlay' ? 'Transparent after-images downloaded.' : kind === 'subject' ? 'Foreground subject layer downloaded.' : 'Finished image downloaded.');
  } catch (e) { console.error(e); toast(e.message || 'Couldn’t export. Try a smaller export size.'); }
  finally { b.disabled = false; b.textContent = '↓ Download PNG'; exporting = false; $('busy').hidden = !drawing; }
};
$('saveRecipe').onclick = () => {
  if (!source) return;
  const c = canvas(source.w, source.h), d = new Uint8ClampedArray(source.w * source.h * 4);
  for (let p = 0; p < mask.length; p++) { d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = mask[p] * 255; d[p * 4 + 3] = 255; }
  c.getContext('2d').putImageData(new ImageData(d, source.w, source.h), 0, 0);
  const recipe = {format: 'prism-echo', version: 3, config, sourceName, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight,
    mask: {width: source.w, height: source.h, png: c.toDataURL('image/png')}, exportSize: Number($('exportSize').value)};
  download(new Blob([JSON.stringify(recipe, null, 2)], {type: 'application/json'}), `${slug()}-prism-${config.seed}.json`); toast('Recipe saved. Keep the original source image with it.');
};
$('loadRecipe').onclick = () => $('recipeInput').click();
$('recipeInput').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const currentImage = imageGeneration, currentRecipe = ++recipeGeneration;
  try {
    if (!image) throw new Error('Upload the source image before loading its recipe.');
    if (file.size > 8 * 1024 * 1024) throw new Error('This recipe is too large.');
    const recipe = parseRecipe(await file.text());
    const matches = image.naturalWidth === recipe.sourceWidth && image.naturalHeight === recipe.sourceHeight;
    let maskImage;
    if (recipe.mask && matches) {
      maskImage = new Image();
      await new Promise((resolve, reject) => {
        maskImage.onload = resolve;
        maskImage.onerror = () => reject(new Error('This recipe mask could not be opened.'));
        maskImage.src = recipe.mask.png;
      });
      if (maskImage.naturalWidth !== recipe.mask.width || maskImage.naturalHeight !== recipe.mask.height) {
        throw new Error('Recipe mask dimensions do not match.');
      }
    }
    if (currentRecipe !== recipeGeneration) return;
    if (currentImage !== imageGeneration) throw new Error('The image changed. Load the recipe again.');
    config = recipe.config; setPainting(false); rebuild();
    $('exportSize').value = recipe.exportSize;
    if (maskImage) {
      const c = canvas(source.w, source.h), mctx = c.getContext('2d'); mctx.drawImage(maskImage, 0, 0, source.w, source.h);
      const md = mctx.getImageData(0, 0, source.w, source.h).data;
      for (let p = 0; p < mask.length; p++) mask[p] = md[p * 4] / 255;
      manualMask = true; echo = prepareEcho(source.data, mask, source.w, source.h, config.smoothness);
    }
    syncUI(); schedule();
    toast(matches && recipe.sourceName === sourceName ? 'Recipe restored.' : 'Recipe loaded. Use its original source image to repeat the exact result.');
  } catch (e) { toast(e.message || 'This recipe could not be opened.'); }
};
$('helpButton').onclick = () => $('helpDialog').showModal(); $('closeHelp').onclick = () => $('helpDialog').close();
$('helpDialog').onclick = e => { if (e.target === $('helpDialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } };
async function loadDemo() {
  const generation = imageGeneration;
  try {
    const response = await fetch('./demo.json');
    if (!response.ok) throw new Error('Upload an image to begin.');
    const demo = await response.json();
    const url = new URL(demo.image, location.href);
    if (url.origin !== location.origin) throw new Error('The demo must be a bundled local image.');
    if (generation !== imageGeneration) return;
    await loadImage(url.href, demo.name || 'Sample image');
  } catch (e) { $('imageInfo').textContent = 'Upload an image to begin'; toast(e.message); }
}
$('demoButton').onclick = loadDemo;
$('exportButton').disabled = true;
syncUI(); loadDemo();
