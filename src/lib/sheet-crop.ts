// WHY: Browser-side deterministic crop of a composite storyboard sheet into N
// per-panel images. The composite is one PNG showing all panels in a grid;
// downstream video gen needs a separate firstFrameUrl per scene, so we slice
// the grid by computing cell bounds from the panel count.
//
// Caveats:
//   - The model honors the requested grid layout as a hint, not a constraint.
//     If it draws 3×2 when we asked for 2×3, the crop math is off by a quadrant.
//   - The model often adds panel-number labels and beat captions in/around
//     each cell. Our naive split includes those. Acceptable for review-grade
//     storyboards; for hero ad creative regenerate the weak panel via Redo
//     (full-resolution per-panel call) before video gen.

export type GridDims = { rows: number; cols: number };

// WHY: Mirrors the prose in lib/storyboard-sheet-prompt.ts:gridLayout — keep
// the two in sync so the crop matches what we asked the model to draw.
export function gridDims(panelCount: number): GridDims {
  if (panelCount <= 3) return { rows: 1, cols: panelCount };
  if (panelCount === 4) return { rows: 2, cols: 2 };
  if (panelCount <= 6) return { rows: 2, cols: 3 };
  if (panelCount <= 9) return { rows: 3, cols: 3 };
  if (panelCount === 12) return { rows: 3, cols: 4 };
  return { rows: Math.ceil(panelCount / 4), cols: 4 };
}

export type CropOptions = {
  // WHY: Trim a small fraction from each cell edge to crop out panel-number
  // labels and inter-panel borders the model often draws. 0.02 = 2% inset.
  // Set 0 for a hard split; raise to 0.05 if your sheets have heavy frames.
  inset?: number;
  // WHY: Output mime — PNG keeps quality, JPEG saves ~5× space (the data URLs
  // are inlined in localStorage handoffs, so size matters).
  mimeType?: "image/png" | "image/jpeg";
  jpegQuality?: number;
};

const DEFAULT_OPTS: Required<CropOptions> = {
  inset: 0.02,
  mimeType: "image/jpeg",
  jpegQuality: 0.9,
};

// WHY: Loads the source URL into an Image, then for each cell draws the
// crop region to a canvas and exports a data URL. Order is left-to-right,
// top-to-bottom — same order the prompt asks the model to draw panels.
export async function cropSheetToPanels(
  sheetUrl: string,
  panelCount: number,
  options: CropOptions = {},
): Promise<string[]> {
  const { inset, mimeType, jpegQuality } = { ...DEFAULT_OPTS, ...options };
  const { rows, cols } = gridDims(panelCount);

  const img = await loadImage(sheetUrl);
  const cellW = img.naturalWidth / cols;
  const cellH = img.naturalHeight / rows;
  const insetX = cellW * inset;
  const insetY = cellH * inset;
  const cropW = cellW - 2 * insetX;
  const cropH = cellH - 2 * insetY;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropW);
  canvas.height = Math.round(cropH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const crops: string[] = [];
  for (let i = 0; i < panelCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const sx = c * cellW + insetX;
    const sy = r * cellH + insetY;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    crops.push(
      mimeType === "image/jpeg"
        ? canvas.toDataURL("image/jpeg", jpegQuality)
        : canvas.toDataURL("image/png"),
    );
  }
  return crops;
}

// WHY: Builds an OpenAI image-edit mask for one panel cell. The /v1/images/edits
// API treats fully transparent pixels as the regen region and opaque pixels as
// preserve. We draw an opaque white background over the whole sheet and punch
// a transparent rectangle over the target panel cell — only that cell will be
// rerendered when the mask is paired with the sheet image and a new prompt.
//
// Returns a PNG data URL the same dimensions as the source sheet.
export async function buildPanelMask(
  sheetUrl: string,
  panelCount: number,
  panelIndex: number,
  options: { inset?: number } = {},
): Promise<string> {
  const { inset = 0 } = options;
  const { rows, cols } = gridDims(panelCount);
  const img = await loadImage(sheetUrl);
  const cellW = img.naturalWidth / cols;
  const cellH = img.naturalHeight / rows;
  const r = Math.floor(panelIndex / cols);
  const c = panelIndex % cols;
  const insetX = cellW * inset;
  const insetY = cellH * inset;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // WHY: Opaque white background = preserve. The model needs alpha 1 here.
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // WHY: clearRect zeroes alpha — that's the regen region. Apply inset to
  // avoid disturbing inter-panel borders / labels the model drew.
  ctx.clearRect(
    c * cellW + insetX,
    r * cellH + insetY,
    cellW - 2 * insetX,
    cellH - 2 * insetY,
  );

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // WHY: Required when the source is a remote URL and we plan to read pixels
    // back via canvas. Data URLs (our common case) are same-origin so this is
    // a no-op there.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}…`));
    img.src = src;
  });
}
