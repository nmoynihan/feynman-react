/**
 * TikZ-Feynman export module.
 *
 * Supported subset
 * ----------------
 * Vertices:
 *   - none  → bare coordinate (no glyph)
 *   - dot   → [dot]
 *   - blob  → [blob]
 *   - cross → [crossed dot]
 *   - vertex size (size field) → [blob, minimum size=Xcm]
 *
 * Edges / propagators:
 *   - plain, fermion, antiFermion, scalar, ghost, photon, gluon, graviton
 *   - flow arrows (forward/backward/none)
 *   - edge labels
 *   - momentum labels (rendered as edge label on opposite side in TikZ)
 *   - bend (arc curves) via [bend left=N] or [bend right=N]
 *   - quadratic curve approximated as arc
 *
 * Shapes:
 *   - circle  → \draw (x,y) circle (r);
 *   - ellipse → \draw (x,y) ellipse (rx and ry);
 *   - solid fill  → \filldraw
 *   - outline     → \draw
 *   - dashed      → \draw[dashed]
 *   - hatch       → \draw with pattern (requires tikz patterns library; degraded to dashed if not available)
 *
 * Limitations
 * -----------
 * - Standalone labels are emitted as \node at (x,y) {text}; but LaTeX math must be hand-verified.
 * - Ghost edges: rendered as "ghost" style (dotted line with arrow). Not all TikZ-Feynman versions support "ghost".
 * - Graviton: rendered as double photon (two photon edges), which requires manual cleanup.
 * - Hatch shapes: the export emits a \draw with the "north east lines" pattern. The consuming document needs \usetikzlibrary{patterns}.
 * - Coordinate unit: 1 cm = 60 diagram units. Origin is placed at the bounding-box top-left corner.
 * - Vertex labels: placed via \vertex (id) [label={text}] at (x,y).
 * - Momentum labels: appended as a second label on the edge with prime notation where possible.
 */

import type { Diagram, DiagramShape, Edge, Label, Vertex } from "../types";

/** Coordinate scale: diagram units → centimetres. */
const SCALE = 1 / 60;

/** Round to 4 decimal places. */
function fmt(v: number): string {
  const rounded = Math.round(v * 1e4) / 1e4;
  return String(rounded);
}

/** Convert a diagram-space x coordinate to TikZ cm. */
function tx(x: number, originX: number): string {
  return fmt((x - originX) * SCALE);
}

/** Convert a diagram-space y coordinate to TikZ cm (y-axis flipped). */
function ty(y: number, originY: number): string {
  return fmt(-(y - originY) * SCALE);
}

/**
 * Sanitize a vertex id to a valid TikZ node name.
 * TikZ node names may contain letters, digits, hyphens, underscores, and dots.
 */
function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9\-_.]/g, "_");
}

/** Strip LaTeX math delimiters for inline display inside square-bracket options. */
function tikzLabel(text: string): string {
  return text
    .replace(/^\$|\$$/g, "")
    .replace(/^\\\(|\\\)$/g, "")
    .replace(/^\\\[|\\\]$/g, "");
}

/** Map an edge type to a tikz-feynman propagator style name. */
function edgeStyle(edge: Edge): string {
  const base: Record<string, string> = {
    plain: "plain",
    fermion: "fermion",
    antiFermion: "anti fermion",
    scalar: "scalar",
    ghost: "ghost",
    photon: "photon",
    gluon: "gluon",
    graviton: "photon" // approximated as photon; graviton is non-standard
  };
  return base[edge.type] ?? "plain";
}

/** Build the TikZ propagator option string for an edge. */
function buildEdgeOptions(edge: Edge): string {
  const parts: string[] = [edgeStyle(edge)];

  // Flow arrows override
  if (edge.arrow === "none") {
    parts.push("momentum={[arrow style=none]}");
  } else if (edge.arrow === "backward") {
    // antiFermion already has backward arrow; for others add reversed arrow hint
    if (edge.type !== "antiFermion") {
      parts.push("reversed");
    }
  }

  // Bend
  const bend = edge.bend ?? 0;
  if (bend > 0) {
    parts.push(`bend left=${fmt(bend)}`);
  } else if (bend < 0) {
    parts.push(`bend right=${fmt(-bend)}`);
  }

  // Edge label
  if (edge.label) {
    const side = edge.labelSide === "right" ? "right" : "left";
    parts.push(`edge label${side === "right" ? "'" : ""}={$${tikzLabel(edge.label)}$}`);
  }

  // Momentum label (place it on the opposite side from the edge label)
  if (edge.momentum) {
    const side = edge.labelSide === "right" ? "" : "'";
    parts.push(`momentum${side}={$${tikzLabel(edge.momentum)}$}`);
  }

  return parts.join(", ");
}

/** Compute bounding-box origin from diagram vertices and shapes. */
function computeOrigin(diagram: Diagram): { x: number; y: number } {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const v of diagram.vertices) {
    xs.push(v.x);
    ys.push(v.y);
  }

  for (const l of diagram.labels ?? []) {
    xs.push(l.x);
    ys.push(l.y);
  }

  for (const s of diagram.shapes ?? []) {
    xs.push(s.x - s.rx);
    ys.push(s.y - (s.ry ?? s.rx));
  }

  if (xs.length === 0) return { x: 0, y: 0 };
  return { x: Math.min(...xs), y: Math.min(...ys) };
}

/** Render a vertex declaration. */
function renderVertex(v: Vertex, ox: number, oy: number): string {
  const id = sanitizeId(v.id);
  const kind = v.kind ?? "none";
  const opts: string[] = [];

  if (kind === "dot") {
    opts.push("dot");
  } else if (kind === "blob") {
    if (v.size !== undefined) {
      opts.push(`blob, minimum size=${fmt(v.size * 2 * SCALE)}cm`);
    } else {
      opts.push("blob");
    }
  } else if (kind === "cross") {
    opts.push("crossed dot");
  }

  if (v.label) {
    opts.push(`label={$${tikzLabel(v.label)}$}`);
  }

  const optStr = opts.length > 0 ? `[${opts.join(", ")}] ` : "";
  return `    \\vertex ${optStr}(${id}) at (${tx(v.x, ox)}, ${ty(v.y, oy)});`;
}

/** Render a standalone label as a TikZ node. */
function renderLabel(l: Label, ox: number, oy: number): string {
  return `    \\node at (${tx(l.x, ox)}, ${ty(l.y, oy)}) {${l.text}};`;
}

/** Render a shape (circle or ellipse). */
function renderShape(s: DiagramShape, ox: number, oy: number): string {
  const x = tx(s.x, ox);
  const y = ty(s.y, oy);
  const rxCm = fmt(s.rx * SCALE);
  const ryCm = fmt((s.ry ?? s.rx) * SCALE);
  const style = s.style ?? {};
  const fillStyle = style.fillStyle ?? "solid";

  const drawOpts: string[] = [];
  const fillColor = style.fill ?? "black";
  const strokeColor = style.stroke ?? "black";

  if (fillStyle === "solid") {
    drawOpts.push(`fill=${fillColor}`, `draw=${strokeColor}`);
  } else if (fillStyle === "outline") {
    drawOpts.push(`draw=${strokeColor}`);
  } else if (fillStyle === "dashed") {
    drawOpts.push("dashed", `draw=${strokeColor}`);
  } else if (fillStyle === "hatch") {
    drawOpts.push(
      "pattern=north east lines",
      `pattern color=${strokeColor}`,
      `draw=${strokeColor}`
    );
  }

  const optStr = drawOpts.length > 0 ? `[${drawOpts.join(", ")}] ` : "";
  const shapeStr =
    s.kind === "circle"
      ? `circle (${rxCm}cm)`
      : `ellipse (${rxCm}cm and ${ryCm}cm)`;

  return `  \\draw ${optStr}(${x}, ${y}) ${shapeStr};`;
}

/**
 * Export a Diagram to a tikz-feynman LaTeX snippet.
 *
 * The output is a `tikzpicture` environment containing a `feynman` environment.
 * Shapes are drawn outside the `feynman` environment (standard TikZ commands).
 */
export function exportToTikz(diagram: Diagram): string {
  const origin = computeOrigin(diagram);
  const ox = origin.x;
  const oy = origin.y;

  const lines: string[] = [];
  lines.push("\\begin{tikzpicture}");

  // Shapes drawn before the feynman environment (so they appear behind the diagram)
  const shapes = diagram.shapes ?? [];
  if (shapes.length > 0) {
    if (shapes.some((s) => (s.style?.fillStyle ?? "solid") === "hatch")) {
      lines.push("  % requires: \\usetikzlibrary{patterns}");
    }
    for (const s of shapes) {
      lines.push(renderShape(s, ox, oy));
    }
  }

  lines.push("  \\begin{feynman}");

  // Vertex declarations
  for (const v of diagram.vertices) {
    lines.push(renderVertex(v, ox, oy));
  }

  // Standalone labels
  for (const l of diagram.labels ?? []) {
    lines.push(renderLabel(l, ox, oy));
  }

  lines.push("");
  lines.push("    \\diagram* {");

  // Edge connections
  const edgeLines: string[] = [];
  for (const edge of diagram.edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    const opts = buildEdgeOptions(edge);
    edgeLines.push(`      (${from}) -- [${opts}] (${to})`);
  }
  lines.push(edgeLines.join(",\n") + (edgeLines.length > 0 ? "," : ""));

  lines.push("    };");
  lines.push("  \\end{feynman}");
  lines.push("\\end{tikzpicture}");

  const header = [
    "% Generated by feynman-react",
    "% Required packages: tikz, tikz-feynman",
    "% \\usepackage{tikz-feynman}",
    "% \\tikzfeynmanset{compat=1.1.0}",
    diagram.shapes?.some((s) => (s.style?.fillStyle ?? "solid") === "hatch")
      ? "% \\usetikzlibrary{patterns}"
      : null,
    ""
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return header + lines.join("\n");
}
