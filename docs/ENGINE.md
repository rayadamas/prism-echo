# How Prism Echo works

The original subject stays photographic. Repeated subjects are derived from the same image pixels; no generative model redraws a face.

1. **Prepare the frame.** Canvas center-crops a square or preserves the image's aspect ratio. Preview max-side is 760 pixels.
2. **Isolate the subject.** The mask uses source alpha, an oval, the full image, or simple-background border sampling and connected flood fill. Manual brush edits update that mask.
3. **Clean the echo fields.** `prepareEcho` builds luminance, soft alpha, gradients, and thin contours. A resolution-scaled low-pass filter removes fine texture. Non-maximum suppression and short-component removal keep the major contours cleaner.
4. **Make whole-subject copies.** Seeded geometry scales every copy from a shared lower-center anchor. Growth increases each copy's scale; separation and fragmentation control displacement, band offsets, and interruptions.
5. **Color the echoes.** Graphic definition firms alpha boundaries and blends denoised tones into flatter planes. The selected palette supplies the colors. Intersections blend without screening the entire picture against white.
6. **Compose and protect.** The renderer uses the source photograph and original mask for the smaller foreground. Color echoes overlap it with attenuation, including extra attenuation inside the protected region.

## Engine API

The engine has no DOM, Canvas, file I/O, or dependency on the worker. Use it with straight-alpha RGBA arrays and a mask with samples from 0 to 1.

```js
import {defaults, extractMask, prepareEcho, render} from './src/engine.mjs';

// Supply Uint8ClampedArray RGBA data, width, and height from your image decoder.
const settings = {...defaults, seed: 4815};
const mask = extractMask(data, width, height, settings.maskMode, settings.tolerance);
const echo = prepareEcho(data, mask, width, height, settings.smoothness);
const {output, overlay, subject} = render(data, width, height, mask, echo, settings);
```

All three results are aligned RGBA `Uint8ClampedArray`s. `output` is the finished composition, `overlay` contains the after-images, and `subject` contains the foreground photograph. The UI passes sanitized settings; engine callers should validate their own dimensions, array lengths, masks, and configuration.

When Smoothness or the source mask changes, rebuild echo fields. Palette, definition, seed, geometry, and protection can reuse the fields. Preview jobs receive those fields; export jobs prepare fields at the selected resolution in a module worker. Results transfer their pixel buffers back to the UI.

## Reproduction and recipes

Recipes use format `prism-echo`, version 3. Versions 1 and 2 still load. Missing Graphic definition becomes 0 for legacy soft rendering. Imported numeric controls are clamped to UI ranges, unknown properties are ignored, and masks must be embedded PNGs with declared preview-sized dimensions.

The actual preview mask is saved as an 8-bit grayscale PNG and scaled to export dimensions using nearest-neighbor sampling. Saving and restoring a feathered mask quantizes it to 8-bit alpha, which can introduce tiny differences from an unsaved in-memory mask. To reproduce a saved recipe, use the same source file, recipe, and export resolution. Filename and dimensions are hints; no source hash is stored.

## Verification

The synthetic tests check deterministic output, source-pixel preservation, smoother luminance, narrower silhouette transitions, mask behavior, recipe validation, alignment through alpha compositing, tiny/empty images, worker parity, fallback rendering, and relative static builds. They require only Node built-ins.

Browser interaction, image decoding, downloads, and rendering performance should also be checked with the [manual QA checklist](QA.md). Node tests don't replace browser checks.
