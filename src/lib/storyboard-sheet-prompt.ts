// WHY: Shared @aimikoda-style master-prompt builder for single-call storyboard
// sheet generation. Used by both /api/preview/storyboard-sheet (dev sandbox)
// and /api/generate/storyboard-sheet (production, auth-protected) so the prompt
// template doesn't drift between the two.

export type SheetAnnotations = {
  body?: string;
  camera?: string;
  framing?: string;
  lighting?: string;
  vocal?: string;
  ipa?: string;
  facs?: string;
};

export type SheetScene = {
  sceneIndex: number;
  prompt: string;
  annotations?: SheetAnnotations;
};

export type SheetStyle = "rough-pencil" | "photoreal";

export type BuildSheetPromptInput = {
  scenes: SheetScene[];
  aspectRatio: "16:9" | "9:16" | "1:1";
  style: SheetStyle;
  globalContext?: string;
};

// WHY: Picks a sensible grid layout for any panel count. The model honors this
// as a strong hint when stated in prose; the actual layout in the rendered
// image may vary by ±1 row/col.
export function gridLayout(n: number): string {
  if (n <= 3) return `single row of ${n} panels`;
  if (n === 4) return "2×2 grid";
  if (n <= 6) return `2 rows of ${Math.ceil(n / 2)} panels each`;
  if (n <= 9) return "3×3 grid";
  if (n === 12) return "3 rows of 4 panels (4×3)";
  return `${Math.ceil(n / 4)} rows of 4 panels each`;
}

export function styleClause(style: SheetStyle): string {
  if (style === "rough-pencil") {
    return (
      "The actual storyboard drawings must be black and white only: rough pencil lines, " +
      "minimal detail, fast gesture drawing energy, simple anatomy construction and strong " +
      "silhouette readability. Keep the artwork lightweight, dynamic and unfinished like " +
      "early choreography previs."
    );
  }
  return (
    "Each panel is a photorealistic cinematic still — sharp focus, studio-grade color " +
    "grading, real lighting, real-world materials. Panels read as production stills, not " +
    "drawings."
  );
}

function annotationsClause(annotations?: SheetAnnotations): string {
  if (!annotations) return "";
  const parts: string[] = [];
  if (annotations.body) parts.push(`body: ${annotations.body}`);
  if (annotations.camera) parts.push(`camera: ${annotations.camera}`);
  if (annotations.framing) parts.push(`framing: ${annotations.framing}`);
  if (annotations.lighting) parts.push(`lighting: ${annotations.lighting}`);
  if (annotations.vocal) parts.push(`vocal/emotion: ${annotations.vocal}`);
  if (annotations.facs) parts.push(`face (FACS): ${annotations.facs}`);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

export function buildSheetPrompt(input: BuildSheetPromptInput): string {
  const n = input.scenes.length;
  const sorted = [...input.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);

  const header = [
    `${input.aspectRatio} cinematic storyboard sheet, ${n} numbered panels in a ${gridLayout(n)}.`,
    "Panels read left-to-right, top-to-bottom. Each panel is clearly delineated with a thin border and a small panel number label in the top-left corner.",
    styleClause(input.style),
  ].join(" ");

  const context = input.globalContext
    ? `\n\nUnifying context (every panel shares this subject, setting, and mood):\n${input.globalContext}`
    : "";

  const panels = sorted
    .map(
      (s, i) =>
        `Panel ${i + 1}: ${s.prompt.trim()}${annotationsClause(s.annotations)}.`,
    )
    .join("\n");

  // WHY: The annotation key is described so the model honors the color system
  // even though it won't render literal color arrows in photoreal style. In
  // rough-pencil style the model often draws simple colored marks per panel.
  const legend =
    "\n\nAnnotation key for any color-coded marks: red = body movement; blue = camera movement; green = framing / composition; orange = lighting direction; purple = vocal / emotional emphasis. No text overlays beyond the small panel-number labels. No timestamps, no watermark, no UI.";

  return `${header}${context}\n\nPanels:\n${panels}${legend}`;
}

export function aspectToOpenAISize(aspect: "16:9" | "9:16" | "1:1"): string {
  switch (aspect) {
    case "9:16":
      return "1024x1536";
    case "1:1":
      return "1024x1024";
    case "16:9":
    default:
      return "1536x1024";
  }
}
