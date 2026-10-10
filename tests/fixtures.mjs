export function portrait(w = 128, h = 128) {
  const data = new Uint8ClampedArray(w * h * 4), mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, j = p * 4;
    const inside = Math.hypot((x / w - .5) / .24, (y / h - .43) / .30) < 1 ||
      (y > h * .65 && x > w * .28 && x < w * .72);
    const value = inside ? 70 + ((x * 19 + y * 31) % 90) : 245;
    data.set([value, value + (inside ? 20 : 0), value + (inside ? 8 : 0), 255], j);
    mask[p] = inside ? 1 : 0;
  }
  return {data, mask, w, h};
}
