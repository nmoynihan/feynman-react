/**
 * TikZ-Feynman import module.
 *
 * Supported subset
 * ----------------
 * The parser handles a useful subset of tikz-feynman syntax.
 *
 * Vertices (\\vertex command inside \\begin{feynman}):
 *   \\vertex (id) at (x, y);
 *   \\vertex [dot] (id) at (x, y);
 *   \\vertex [blob] (id) at (x, y);
 *   \\vertex [crossed dot] (id) at (x, y);
 *   \\vertex [dot, label={text}] (id) at (x, y);
 *   \\vertex [blob, minimum size=Xcm] (id) at (x, y);
 *
 * Edges (inside \\diagram* { ... }):
 *   (from) -- [style, options] (to),
 *   Supported styles: plain, fermion, anti fermion, scalar, ghost, photon, gluon, graviton
 *   Supported options: bend left=N, bend right=N, edge label={text}, edge label'={text},
 *                      momentum={text}, momentum'={text}
 *
 * Shapes (standard TikZ outside \\begin{feynman}):
 *   \\draw[fill=color, draw=color] (x,y) circle (r);
 *   \\draw[fill=color] (x,y) ellipse (rx and ry);
 *   \\draw[dashed] (x,y) circle (r);
 *   \\filldraw[fill=color] (x,y) circle (r);
 *   \\draw[pattern=north east lines] (x,y) circle (r);
 *
 * Coordinate system:
 *   Coordinates are assumed to be in cm. They are multiplied by 60 to get
 *   diagram units (inverse of the export scale). Pure numbers without units
 *   are treated as cm.
 *
 * Limitations
 * -----------
 * - Only a single diagram per file is parsed (the first \\begin{feynman}...\\end{feynman}).
 * - Complex TikZ macros, loops, and conditionals are not supported.
 * - Curved paths other than bend left/right are not supported.
 * - Only axis-aligned patterns are imported (north east lines → hatch).
 * - Partial parses: if a vertex or edge cannot be fully parsed it is silently skipped.
 * - Labels with complex LaTeX inside options may fail; plain text and $...$ are fine.
 */

import type { Diagram, DiagramShape, Edge, EdgeType, Label, ShapeFillStyle, Vertex, VertexKind } from "../types";

/** Coordinate scale: cm → diagram units (inverse of export scale). */
const SCALE = 60;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseNum(s: string): number {
  // Remove trailing unit suffix (cm, pt, mm, em, ex, in, ...)
  return parseFloat(s.replace(/[a-z]+$/i, ""));
}

function nextId(prefix: string, taken: Set<string>): string {
  let i = 1;
  while (taken.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

/** Strip outer $...$ or \(...\) delimiters, returning raw LaTeX. */
function wrapMath(text: string): string {
  const t = text.trim();
  if ((t.startsWith("$") && t.endsWith("$")) || (t.startsWith("\\(") && t.endsWith("\\)"))) {
    return t;
  }
  return `$${t}$`;
}

/** Extract the content of balanced braces starting at `start` in `src`. */
function extractBraceContent(src: string, start: number): { content: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 0;
  let i = start;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return { content: src.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

/** Extract the content of balanced square brackets starting at `start`. */
function extractBracketContent(src: string, start: number): { content: string; end: number } | null {
  if (src[start] !== "[") return null;
  let depth = 0;
  let i = start;
  while (i < src.length) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) return { content: src.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

/** Extract the content of balanced parentheses starting at `start`. */
function extractParenContent(src: string, start: number): { content: string; end: number } | null {
  if (src[start] !== "(") return null;
  let depth = 0;
  let i = start;
  while (i < src.length) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return { content: src.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Option string parsing
// ---------------------------------------------------------------------------

/**
 * Split a TikZ key=value option string on commas while respecting braces.
 * e.g. "fermion, edge label={$e^-$}, bend left=30" → ["fermion", "edge label={$e^-$}", "bend left=30"]
 */
function splitOptions(opts: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] === "{" || opts[i] === "[" || opts[i] === "(") depth++;
    else if (opts[i] === "}" || opts[i] === "]" || opts[i] === ")") depth--;
    else if (opts[i] === "," && depth === 0) {
      result.push(opts.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = opts.slice(start).trim();
  if (last) result.push(last);
  return result;
}

interface ParsedOptions {
  styles: string[];
  kvs: Record<string, string>;
}

function parseOptions(raw: string): ParsedOptions {
  const parts = splitOptions(raw);
  const styles: string[] = [];
  const kvs: Record<string, string> = {};

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      styles.push(part.toLowerCase().replace(/\s+/g, " ").trim());
    } else {
      const key = part.slice(0, eqIdx).toLowerCase().replace(/\s+/g, " ").trim();
      const val = part.slice(eqIdx + 1).trim();
      kvs[key] = val.startsWith("{") ? val.slice(1, -1) : val;
    }
  }

  return { styles, kvs };
}

// ---------------------------------------------------------------------------
// Vertex parsing
// ---------------------------------------------------------------------------

/** Default separation for relative placement (≈1.5 cm in diagram units). */
const DEFAULT_SEP = 90;

interface VertexEntry {
  /** Node id in TikZ */
  id: string;
  opts: ParsedOptions;
  /** Absolute coordinates (cm * SCALE), if `at (x,y)` was present. */
  absCoord: { x: number; y: number } | null;
  /** Inline label text (from `{...}` after the node name). */
  inlineLabel: string | null;
}

/**
 * Parse a \\vertex statement into a VertexEntry.
 * Handles both:
 *   \\vertex [opts] (id) at (x, y) {label};
 *   \\vertex [opts] (id) {label};   ← relative or unlabelled placement
 */
function parseVertexEntry(stmt: string): VertexEntry | null {
  let rest = stmt.replace(/^\\vertex\s*/, "");

  // Optional options block [...]
  let opts: ParsedOptions = { styles: [], kvs: {} };
  if (rest.startsWith("[")) {
    const br = extractBracketContent(rest, 0);
    if (!br) return null;
    opts = parseOptions(br.content);
    rest = rest.slice(br.end).trim();
  }

  // Node name
  if (!rest.startsWith("(")) return null;
  const idParen = extractParenContent(rest, 0);
  if (!idParen) return null;
  const id = idParen.content.trim();
  if (!id) return null;
  rest = rest.slice(idParen.end).trim();

  // Optional inline label {text}
  let inlineLabel: string | null = null;
  if (rest.startsWith("{")) {
    const brace = extractBraceContent(rest, 0);
    if (brace) {
      inlineLabel = brace.content.trim() || null;
      rest = rest.slice(brace.end).trim();
    }
  }

  // Optional "at (x, y)"
  let absCoord: { x: number; y: number } | null = null;
  if (rest.startsWith("at")) {
    rest = rest.slice(2).trim();
    if (rest.startsWith("(")) {
      const coordParen = extractParenContent(rest, 0);
      if (coordParen) {
        const parts = coordParen.content.split(",");
        if (parts.length >= 2) {
          absCoord = {
            x: parseNum(parts[0]!.trim()) * SCALE,
            y: -parseNum(parts[1]!.trim()) * SCALE
          };
        }
      }
    }
  }

  return { id, opts, absCoord, inlineLabel };
}

/**
 * Resolve all vertex positions given a list of VertexEntry objects.
 * Vertices with `at (x,y)` are placed first; relative placements
 * (`[right=of a]`, `[above right=of b]`, etc.) are resolved iteratively.
 */
function resolvePositions(entries: VertexEntry[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Absolute placements
  for (const e of entries) {
    if (e.absCoord) positions.set(e.id, e.absCoord);
  }

  // Relative placements: iterate until no more can be resolved
  const relDirections: Record<string, { dx: number; dy: number }> = {
    right:         { dx:  1,      dy:  0      },
    left:          { dx: -1,      dy:  0      },
    above:         { dx:  0,      dy: -1      },
    below:         { dx:  0,      dy:  1      },
    "above right": { dx:  0.707,  dy: -0.707  },
    "below right": { dx:  0.707,  dy:  0.707  },
    "above left":  { dx: -0.707,  dy: -0.707  },
    "below left":  { dx: -0.707,  dy:  0.707  }
  };

  for (let pass = 0; pass < entries.length; pass++) {
    let resolved = 0;
    for (const e of entries) {
      if (positions.has(e.id)) continue;
      for (const [dirKey, delta] of Object.entries(relDirections)) {
        const val = e.opts.kvs[dirKey];
        if (!val) continue;
        // Expect "of <refId>" — optionally with a distance like "2cm of a"
        const match = val.match(/(?:\S+\s+)?of\s+(\S+)/);
        if (!match) continue;
        const refId = match[1]!;
        const refPos = positions.get(refId);
        if (!refPos) continue;
        positions.set(e.id, {
          x: refPos.x + delta.dx * DEFAULT_SEP,
          y: refPos.y + delta.dy * DEFAULT_SEP
        });
        resolved++;
        break;
      }
    }
    if (resolved === 0) break;
  }

  return positions;
}

/**
 * Convert a VertexEntry + resolved position into a Diagram Vertex.
 */
function entryToVertex(entry: VertexEntry, pos: { x: number; y: number }): Vertex {
  const { id, opts, inlineLabel } = entry;

  let kind: VertexKind = "none";
  if (opts.styles.includes("dot")) kind = "dot";
  else if (opts.styles.includes("blob")) kind = "blob";
  else if (opts.styles.includes("crossed dot") || opts.styles.includes("cross")) kind = "cross";

  let size: number | undefined;
  const minSize = opts.kvs["minimum size"];
  if (minSize !== undefined) {
    size = parseNum(minSize) * SCALE / 2;
  }

  // Label from options or inline braces
  const labelRaw = opts.kvs["label"] ?? (inlineLabel ?? undefined);
  const label = labelRaw ? wrapMath(labelRaw.replace(/^\$|\$$/g, "").trim()) : undefined;

  const vertex: Vertex = { id, x: pos.x, y: pos.y, kind };
  if (label) vertex.label = label;
  if (size !== undefined) vertex.size = size;
  return vertex;
}

// ---------------------------------------------------------------------------
// Edge parsing
// ---------------------------------------------------------------------------

const STYLE_MAP: Record<string, EdgeType> = {
  plain: "plain",
  fermion: "fermion",
  "anti fermion": "antiFermion",
  antifermion: "antiFermion",
  scalar: "scalar",
  ghost: "ghost",
  photon: "photon",
  boson: "photon",       // tikz-feynman alias for photon
  gluon: "gluon",
  graviton: "graviton",
  // common aliases
  dashed: "scalar",
  dotted: "ghost"
};

interface ParsedEdge {
  from: string;
  to: string;
  edgeType: EdgeType;
  bend: number;
  label?: string;
  momentum?: string;
  labelSide?: "left" | "right";
}

function parseEdge(raw: string): ParsedEdge | null {
  // raw is like: (from) -- [opts] (to)
  // or: (from) -- (to)  (no options)
  const arrowIdx = raw.indexOf("--");
  if (arrowIdx === -1) return null;

  const fromStr = raw.slice(0, arrowIdx).trim();
  const afterArrow = raw.slice(arrowIdx + 2).trim();

  if (!fromStr.startsWith("(")) return null;
  const fromParen = extractParenContent(fromStr, 0);
  if (!fromParen) return null;
  const from = fromParen.content.trim();

  let rest = afterArrow;
  let opts: ParsedOptions = { styles: [], kvs: {} };

  if (rest.startsWith("[")) {
    const br = extractBracketContent(rest, 0);
    if (!br) return null;
    opts = parseOptions(br.content);
    rest = rest.slice(br.end).trim();
  }

  if (!rest.startsWith("(")) return null;
  const toParen = extractParenContent(rest, 0);
  if (!toParen) return null;
  const to = toParen.content.trim();

  // Determine edge type
  let edgeType: EdgeType = "plain";
  for (const style of opts.styles) {
    const mapped = STYLE_MAP[style];
    if (mapped) {
      edgeType = mapped;
      break;
    }
  }

  // Bend
  let bend = 0;
  if (opts.kvs["bend left"] !== undefined) {
    bend = parseNum(opts.kvs["bend left"]!);
  } else if (opts.kvs["bend right"] !== undefined) {
    bend = -parseNum(opts.kvs["bend right"]!);
  }

  // Labels
  const edgeLabel = opts.kvs["edge label"] ?? opts.kvs["edge label'"];
  const labelSide: "left" | "right" = opts.kvs["edge label'"] !== undefined ? "right" : "left";
  const momentumRaw = opts.kvs["momentum"] ?? opts.kvs["momentum'"];

  const result: ParsedEdge = { from, to, edgeType, bend, labelSide };
  if (edgeLabel) result.label = wrapMath(edgeLabel);
  if (momentumRaw) result.momentum = wrapMath(momentumRaw);
  return result;
}

// ---------------------------------------------------------------------------
// Shape parsing
// ---------------------------------------------------------------------------

/**
 * Parse a \\draw or \\filldraw shape command.
 * Handles:
 *   \draw[opts] (x,y) circle (r);
 *   \draw[opts] (x,y) ellipse (rx and ry);
 */
function parseShape(line: string, takenIds: Set<string>, ox: number, oy: number): DiagramShape | null {
  let rest = line.replace(/^\\(?:filldraw|draw)\s*/, "");
  let opts: ParsedOptions = { styles: [], kvs: {} };

  if (rest.startsWith("[")) {
    const br = extractBracketContent(rest, 0);
    if (!br) return null;
    opts = parseOptions(br.content);
    rest = rest.slice(br.end).trim();
  }

  // Centre coordinate
  if (!rest.startsWith("(")) return null;
  const centParen = extractParenContent(rest, 0);
  if (!centParen) return null;
  const coordParts = centParen.content.split(",");
  if (coordParts.length < 2) return null;
  const x = parseNum(coordParts[0]!.trim()) * SCALE + ox;
  const y = -parseNum(coordParts[1]!.trim()) * SCALE + oy;
  rest = rest.slice(centParen.end).trim();

  // Determine shape kind
  let kind: "circle" | "ellipse" | null = null;
  let rx = 20;
  let ry = 20;

  if (rest.startsWith("circle")) {
    kind = "circle";
    rest = rest.slice("circle".length).trim();
    if (rest.startsWith("(")) {
      const rParen = extractParenContent(rest, 0);
      if (rParen) rx = ry = parseNum(rParen.content) * SCALE;
    }
  } else if (rest.startsWith("ellipse")) {
    kind = "ellipse";
    rest = rest.slice("ellipse".length).trim();
    if (rest.startsWith("(")) {
      const rParen = extractParenContent(rest, 0);
      if (rParen) {
        const andIdx = rParen.content.toLowerCase().indexOf(" and ");
        if (andIdx !== -1) {
          rx = parseNum(rParen.content.slice(0, andIdx).trim()) * SCALE;
          ry = parseNum(rParen.content.slice(andIdx + 5).trim()) * SCALE;
        }
      }
    }
  }

  if (!kind) return null;

  // Fill style
  let fillStyle: ShapeFillStyle = "outline";
  const fillVal = opts.kvs["fill"];
  const drawVal = opts.kvs["draw"];
  const patternVal = opts.kvs["pattern"];
  const isDashed = opts.styles.includes("dashed");
  const isFillDraw = line.trimStart().startsWith("\\filldraw");

  if (patternVal?.includes("lines") || patternVal?.includes("grid") || patternVal?.includes("dots")) {
    fillStyle = "hatch";
  } else if (isDashed) {
    fillStyle = "dashed";
  } else if (fillVal || isFillDraw) {
    fillStyle = "solid";
  }

  const id = nextId("shape", takenIds);
  takenIds.add(id);

  const shapeStyle: DiagramShape["style"] = { fillStyle };
  if (fillVal && fillVal !== "none") shapeStyle.fill = fillVal;
  if (drawVal && drawVal !== "none") shapeStyle.stroke = drawVal;

  const shape: DiagramShape = { id, kind, x, y, rx };
  if (kind === "ellipse" && ry !== rx) shape.ry = ry;
  if (Object.keys(shapeStyle).length > 0) shape.style = shapeStyle;

  return shape;
}

// ---------------------------------------------------------------------------
// Feynman block extraction
// ---------------------------------------------------------------------------

function extractFeynmanBlock(src: string): string | null {
  const beginIdx = src.indexOf("\\begin{feynman}");
  const endIdx = src.indexOf("\\end{feynman}");
  if (beginIdx === -1 || endIdx === -1) return null;
  return src.slice(beginIdx + "\\begin{feynman}".length, endIdx);
}

function extractDiagramBlock(feynmanBlock: string): string | null {
  const beginIdx = feynmanBlock.indexOf("\\diagram");
  if (beginIdx === -1) return null;
  // Find the opening brace
  const braceIdx = feynmanBlock.indexOf("{", beginIdx);
  if (braceIdx === -1) return null;
  const braceContent = extractBraceContent(feynmanBlock, braceIdx);
  if (!braceContent) return null;
  return braceContent.content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ImportResult {
  diagram: Diagram;
  warnings: string[];
}

/**
 * Parse a tikz-feynman LaTeX snippet and produce a Diagram.
 *
 * The import is best-effort: unrecognised constructs are skipped and
 * a warning is added to the result's `warnings` array.
 */
export function importFromTikz(source: string): ImportResult {
  const warnings: string[] = [];

  // Strip comments
  const stripped = source.replace(/%[^\n]*/g, "");

  // Extract feynman block (if present)
  const feynmanBlock = extractFeynmanBlock(stripped);

  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const labels: Label[] = [];
  const shapes: DiagramShape[] = [];

  const takenVertexIds = new Set<string>();
  const takenEdgeIds = new Set<string>();
  const takenLabelIds = new Set<string>();
  const takenShapeIds = new Set<string>();

  // Offset from diagram coordinate (starts at 0; shapes refer to the raw tikz coordinates × SCALE)
  const shapeOx = 0;
  const shapeOy = 0;

  // --- Parse shapes from outside the feynman block ---
  const outerBlock = feynmanBlock !== null
    ? stripped.replace("\\begin{feynman}" + feynmanBlock + "\\end{feynman}", "")
    : stripped;

  for (const line of outerBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("\\draw") || trimmed.startsWith("\\filldraw")) {
      const shape = parseShape(trimmed, takenShapeIds, shapeOx, shapeOy);
      if (shape) {
        shapes.push(shape);
      } else {
        warnings.push(`Could not parse shape: ${trimmed.slice(0, 60)}`);
      }
    }
  }

  if (feynmanBlock !== null) {
    // --- Parse vertices (two-pass: collect entries, then resolve relative positions) ---
    // Match any \vertex statement (with or without `at (x,y)`), terminated by `;`
    const vertexRe = /\\vertex\b[^;]*/g;
    let m: RegExpExecArray | null;
    const vertexEntries: VertexEntry[] = [];

    while ((m = vertexRe.exec(feynmanBlock)) !== null) {
      const entry = parseVertexEntry(m[0]);
      if (entry && !takenVertexIds.has(entry.id)) {
        takenVertexIds.add(entry.id);
        vertexEntries.push(entry);
      }
    }

    const positions = resolvePositions(vertexEntries);

    for (const entry of vertexEntries) {
      const pos = positions.get(entry.id);
      if (pos) {
        vertices.push(entryToVertex(entry, pos));
      } else {
        warnings.push(`Could not resolve position for vertex (${entry.id}); skipped.`);
      }
    }

    // --- Parse nodes as standalone labels ---
    const nodeRe = /\\node\s*(?:\[[^\]]*\]\s*)?\s*at\s*\(([^)]+)\)\s*\{([^}]*)\}/g;
    while ((m = nodeRe.exec(feynmanBlock)) !== null) {
      const coords = m[1]!.split(",");
      if (coords.length >= 2) {
        const x = parseNum(coords[0]!.trim()) * SCALE;
        const y = -parseNum(coords[1]!.trim()) * SCALE;
        const id = nextId("label", takenLabelIds);
        takenLabelIds.add(id);
        labels.push({ id, x, y, text: m[2]!.trim() });
      }
    }

    // --- Parse edges from \\diagram* block ---
    const diagBlock = extractDiagramBlock(feynmanBlock);
    if (diagBlock) {
      // Split on commas at top level (not inside braces/brackets/parens)
      const edgeChunks = splitOptions(diagBlock);
      for (const chunk of edgeChunks) {
        const trimmed = chunk.trim();
        if (!trimmed || !trimmed.includes("--")) continue;
        const parsed = parseEdge(trimmed);
        if (parsed) {
          const edgeId = nextId("e", takenEdgeIds);
          takenEdgeIds.add(edgeId);
          const edge: Edge = {
            id: edgeId,
            from: parsed.from,
            to: parsed.to,
            type: parsed.edgeType
          };
          if (parsed.bend !== 0) {
            edge.bend = parsed.bend;
            edge.curve = "arc";
          }
          if (parsed.label) edge.label = parsed.label;
          if (parsed.momentum) edge.momentum = parsed.momentum;
          if (parsed.labelSide) edge.labelSide = parsed.labelSide;
          edges.push(edge);
        } else {
          warnings.push(`Could not parse edge: ${trimmed.slice(0, 60)}`);
        }
      }
    } else if (feynmanBlock !== null) {
      warnings.push("No \\diagram* block found inside \\begin{feynman}");
    }
  } else {
    warnings.push("No \\begin{feynman}...\\end{feynman} block found; only shapes were parsed.");
  }

  // Validate edges: remove references to missing vertex ids
  const vertexIds = new Set(vertices.map((v) => v.id));
  const validEdges = edges.filter((edge) => {
    const ok = vertexIds.has(edge.from) && vertexIds.has(edge.to);
    if (!ok) {
      warnings.push(`Edge ${edge.id} references unknown vertex (${edge.from} or ${edge.to}); skipped.`);
    }
    return ok;
  });

  const diagram: Diagram = { vertices, edges: validEdges };
  if (labels.length > 0) diagram.labels = labels;
  if (shapes.length > 0) diagram.shapes = shapes;

  return { diagram, warnings };
}
