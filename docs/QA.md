# Browser release checklist

Run `npm run verify` first. Then use `npm run dev` in current Chrome, Firefox, and Safari where available. Record browser/version and device when reporting a problem.

- Initial portrait loads and the first effect appears. Help opens and closes with its button, Escape, and the backdrop.
- Upload and drag/drop PNG, JPEG, WebP, and a transparent cutout. Unsupported formats and oversized files produce readable errors.
- Move every control. New variation preserves the other controls. Reset restores defaults. Original/effect comparison works during rendering.
- Move face focus by pointer and keyboard; Shift increases arrow-key movement. Focus placement ends with Enter or Escape.
- Refine with Keep and Erase, drag continuous brush strokes, reset the mask, and finish. Export includes your manual mask edits.
- Export composition, after-images, and subject at 1024 and 2048. Try 3072 on a desktop. Inspect transparency and overlay/subject alignment in an image editor.
- Save a recipe, change controls, reload with the same source, and compare exports. Load a legacy recipe and a malformed JSON file.
- Use original framing on portrait and landscape images. Check narrow screens around 360 px, a tablet, keyboard tab order, and browser zoom at 200%.
- During a large export, controls remain responsive with module-worker support. The export matches the settings captured when Download was pressed, even if controls change later.
- Push to GitHub Pages and verify the demo asset, styles, module imports, worker, and downloads under the repository's subdirectory URL.

The 1.0.0 packaging pass passed Node verification and image-engine inspection. A fresh browser interaction run was unavailable in the packaging environment; complete this checklist on your local machine before a public release.
