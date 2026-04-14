import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  buildSvgScene,
  exportToTikz,
  importFromTikz,
  type ArrowDirection,
  type BuildSvgSceneOptions,
  type CurveType,
  type Diagram,
  type DiagramShape,
  type Edge,
  type EdgeType,
  type Label,
  type Point,
  type SceneHatchPattern,
  type SceneLabel,
  type ScenePath,
  type SceneShape,
  type SceneVertexGlyph,
  type ShapeFillStyle,
  type ShapeKind,
  type Vertex,
  type VertexKind,
  type ViewBox
} from "@feynman/core";
import { FeynmanSceneSvg, type LabelRenderContext } from "@feynman/react";

export type {
  ArrowDirection,
  BuildSvgSceneOptions,
  CurveType,
  Diagram,
  DiagramShape,
  Edge,
  EdgeType,
  Label,
  Point,
  ShapeFillStyle,
  ShapeKind,
  Vertex,
  VertexKind,
  ViewBox
} from "@feynman/core";
export type { LabelRenderContext } from "@feynman/react";

type EditorMode = "select";
type Selection =
  | { kind: "vertex"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "label"; id: string }
  | { kind: "shape"; id: string }
  | null;
type DragState =
  | { kind: "vertex"; id: string; extraIds: string[]; extraStarts: Record<string, Point>; pointerId: number; origin: Point; start: Point }
  | { kind: "label"; id: string; pointerId: number; origin: Point; start: Point }
  | { kind: "shape"; id: string; pointerId: number; origin: Point; start: Point }
  | null;
type MarqueeState = { pointerId: number; start: Point; current: Point } | null;
type TikzPanelMode = "import" | "export" | null;

const EDGE_TYPE_OPTIONS: EdgeType[] = ["plain", "fermion", "antiFermion", "scalar", "ghost", "photon", "gluon", "graviton"];
const VERTEX_KIND_OPTIONS: VertexKind[] = ["none", "dot", "blob", "cross", "hook"];
const SHAPE_KIND_OPTIONS: ShapeKind[] = ["circle", "ellipse"];
const SHAPE_FILL_OPTIONS: ShapeFillStyle[] = ["solid", "outline", "dashed", "hatch"];
const CURVE_OPTIONS: CurveType[] = ["line", "arc", "quadratic"];
const ARROW_OPTIONS: Array<{ value: "auto" | ArrowDirection; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "none", label: "None" }
];

const SNAP_GRID = 10;

// --- Design tokens (STYLE.md) ---
const BG       = "oklch(1.0000 0 0)";
const FG       = "oklch(0.2101 0.0318 264.6645)";
const PRIMARY  = "oklch(0.6716 0.1368 48.5130)";
const MUTED    = "oklch(0.9670 0.0029 264.5419)";
const MUTED_FG = "oklch(0.5510 0.0234 264.3637)";
const BORDER   = "oklch(0.9276 0.0058 264.5313)";
const DESTRUCT = "oklch(0.6368 0.2078 25.3313)";
const FONT     = "'Outfit', ui-sans-serif, system-ui, sans-serif";
const SHADOW   = "0px 1px 4px 0px hsl(0 0% 0% / 0.05), 0px 4px 6px -1px hsl(0 0% 0% / 0.05)";
const RING10   = "oklch(0.2101 0.0318 264.6645 / 0.1)";
// oklch primary with various alpha levels (for SVG attributes)
const P12  = "oklch(0.6716 0.1368 48.5130 / 0.12)";
const P07  = "oklch(0.6716 0.1368 48.5130 / 0.07)";
const P55  = "oklch(0.6716 0.1368 48.5130 / 0.55)";
const P60  = "oklch(0.6716 0.1368 48.5130 / 0.6)";
const P40  = "oklch(0.6716 0.1368 48.5130 / 0.4)";
const P14  = "oklch(0.6716 0.1368 48.5130 / 0.14)";
const P08  = "oklch(0.6716 0.1368 48.5130 / 0.08)";
const P10  = "oklch(0.6716 0.1368 48.5130 / 0.10)";
const P50  = "oklch(0.6716 0.1368 48.5130 / 0.5)";
// secondary (muted blue) for edge-drawing workflow indicators
const SEC70  = "oklch(0.5360 0.0398 196.0280 / 0.7)";
const SEC08  = "oklch(0.5360 0.0398 196.0280 / 0.08)";
const SEC42  = "oklch(0.5360 0.0398 196.0280 / 0.42)";

const ROOT_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  overflow: "hidden",
  background: BG,
  boxShadow: SHADOW,
  fontFamily: FONT,
  color: FG
};

const CANVAS_PANEL_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  position: "relative",
  minWidth: 0,
  minHeight: 0,
  background: BG
};

const SIDEBAR_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  borderLeft: `1px solid ${BORDER}`,
  background: MUTED,
  overflow: "hidden"
};

const HEADER_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 16px",
  borderBottom: `1px solid ${BORDER}`,
  background: BG
};

const TOOLBAR_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center"
};

const BUTTON_STYLE: CSSProperties = {
  border: `1px solid ${BORDER}`,
  background: BG,
  color: FG,
  borderRadius: 10,
  padding: "0 10px",
  height: 32,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap"
};

const ACTIVE_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: PRIMARY,
  borderColor: PRIMARY,
  color: BG
};

const DISABLED_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  opacity: 0.5,
  cursor: "default"
};

const PANEL_STYLE: CSSProperties = {
  borderRadius: 12,
  padding: "12px 14px",
  background: BG,
  boxShadow: `0 0 0 1px ${RING10}`
};

const FIELD_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 32,
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  padding: "0 10px",
  background: "transparent",
  color: FG,
  fontSize: 14
};

const LABEL_STYLE: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: MUTED_FG,
  fontWeight: 600
};

const CANVAS_SURFACE_STYLE: CSSProperties = {
  position: "relative",
  width: "100%",
  flex: 1,
  minHeight: 300
};

const STATUS_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 16px",
  borderTop: `1px solid ${BORDER}`,
  color: MUTED_FG,
  fontSize: 12,
  background: MUTED
};

export interface FeynmanDiagramEditorProps {
  value: Diagram;
  onChange: (diagram: Diagram) => void;
  width?: number | string;
  height?: number | string;
  title?: string;
  sceneOptions?: BuildSvgSceneOptions;
  labelRenderer?: (context: LabelRenderContext) => ReactNode;
  style?: CSSProperties;
  className?: string;
}

function toDimension(value: number | string | undefined, fallback: number): number | string {
  return value ?? fallback;
}

function expandViewBox(viewBox: ViewBox, padding: number): ViewBox {
  return {
    x: viewBox.x - padding,
    y: viewBox.y - padding,
    width: viewBox.width + padding * 2,
    height: viewBox.height + padding * 2
  };
}

function mergeViewBoxes(left: ViewBox, right: ViewBox): ViewBox {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function containsViewBox(outer: ViewBox, inner: ViewBox): boolean {
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
}

function intersectsViewBox(left: ViewBox, right: ViewBox): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function zoomViewBox(viewBox: ViewBox, factor: number): ViewBox {
  const nextWidth = viewBox.width * factor;
  const nextHeight = viewBox.height * factor;
  return {
    x: viewBox.x + (viewBox.width - nextWidth) / 2,
    y: viewBox.y + (viewBox.height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight
  };
}

/**
 * Convert a pointer event's client coordinates to diagram (viewBox) coordinates.
 *
 * The overlay SVG uses preserveAspectRatio="xMidYMid meet", which means the
 * viewBox content is scaled uniformly to fit inside the element and then
 * centred.  We must account for the resulting letterbox/pillarbox offsets;
 * otherwise every coordinate is wrong whenever the element aspect ratio
 * differs from the viewBox aspect ratio.
 */
function pointerToDiagramPoint(event: PointerEvent, element: SVGSVGElement, viewBox: ViewBox): Point {
  const rect = element.getBoundingClientRect();
  const elementW = Math.max(rect.width, 1);
  const elementH = Math.max(rect.height, 1);
  const vbW = Math.max(viewBox.width, 1);
  const vbH = Math.max(viewBox.height, 1);

  // xMidYMid meet: uniform scale so the whole viewBox fits, then centred
  const scale = Math.min(elementW / vbW, elementH / vbH);
  const renderedW = vbW * scale;
  const renderedH = vbH * scale;
  const offsetX = (elementW - renderedW) / 2;
  const offsetY = (elementH - renderedH) / 2;

  const x = viewBox.x + (event.clientX - rect.left - offsetX) / scale;
  const y = viewBox.y + (event.clientY - rect.top - offsetY) / scale;
  return { x, y };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

function snapCoordinate(value: number): number {
  return Math.round(value / SNAP_GRID) * SNAP_GRID;
}

function createId(existingIds: Iterable<string>, prefix: string): string {
  const taken = new Set(existingIds);
  let index = 1;
  while (taken.has(`${prefix}${index}`)) {
    index += 1;
  }
  return `${prefix}${index}`;
}

function withOptionalLabels(diagram: Diagram, labels: Label[]): Diagram {
  const nextDiagram: Diagram = { ...diagram };
  if (labels.length === 0) {
    delete nextDiagram.labels;
    return nextDiagram;
  }

  nextDiagram.labels = labels;
  return nextDiagram;
}

function normalizeOptionalText(value: string): string | null {
  return value.length > 0 ? value : null;
}

function belongsToEdge(pathId: string, edgeId: string): boolean {
  return pathId === edgeId || pathId.startsWith(`${edgeId}-`);
}

function getEdgePaths(paths: ScenePath[], edgeId: string): ScenePath[] {
  return paths.filter((path) => belongsToEdge(path.id, edgeId));
}

function estimateLabelBox(text: string, fontSize: number): { width: number; height: number } {
  const visibleLength = text.replace(/\$|\\\(|\\\)|\\\[|\\\]/g, "").length;
  return {
    width: Math.max(fontSize * 2.4, visibleLength * fontSize * 0.62 + 18),
    height: fontSize * 1.8
  };
}

function updateVertex(diagram: Diagram, vertexId: string, updater: (vertex: Vertex) => Vertex): Diagram {
  return {
    ...diagram,
    vertices: diagram.vertices.map((vertex) => (vertex.id === vertexId ? updater(vertex) : vertex))
  };
}

function updateEdge(diagram: Diagram, edgeId: string, updater: (edge: Edge) => Edge): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => (edge.id === edgeId ? updater(edge) : edge))
  };
}

function updateLabel(diagram: Diagram, labelId: string, updater: (label: Label) => Label): Diagram {
  const nextLabels = (diagram.labels ?? []).map((label) => (label.id === labelId ? updater(label) : label));
  return withOptionalLabels(diagram, nextLabels);
}

function withOptionalShapes(diagram: Diagram, shapes: DiagramShape[]): Diagram {
  const next: Diagram = { ...diagram };
  if (shapes.length === 0) {
    delete next.shapes;
  } else {
    next.shapes = shapes;
  }
  return next;
}

function updateShape(diagram: Diagram, shapeId: string, updater: (shape: DiagramShape) => DiagramShape): Diagram {
  return withOptionalShapes(diagram, (diagram.shapes ?? []).map((s) => (s.id === shapeId ? updater(s) : s)));
}

function removeSelected(diagram: Diagram, selection: Selection): Diagram {
  if (!selection) {
    return diagram;
  }

  if (selection.kind === "vertex") {
    return {
      ...diagram,
      vertices: diagram.vertices.filter((vertex) => vertex.id !== selection.id),
      edges: diagram.edges.filter((edge) => edge.from !== selection.id && edge.to !== selection.id)
    };
  }

  if (selection.kind === "edge") {
    return {
      ...diagram,
      edges: diagram.edges.filter((edge) => edge.id !== selection.id)
    };
  }

  if (selection.kind === "shape") {
    return withOptionalShapes(diagram, (diagram.shapes ?? []).filter((s) => s.id !== selection.id));
  }

  return withOptionalLabels(diagram, (diagram.labels ?? []).filter((label) => label.id !== selection.id));
}

function renameVertexInDiagram(diagram: Diagram, oldId: string, newId: string): Diagram {
  return {
    ...diagram,
    vertices: diagram.vertices.map((v) => (v.id === oldId ? { ...v, id: newId } : v)),
    edges: diagram.edges.map((e) => ({
      ...e,
      from: e.from === oldId ? newId : e.from,
      to: e.to === oldId ? newId : e.to
    }))
  };
}

function findNearestVertex(point: Point, vertices: Vertex[], viewport: ViewBox, svgEl: SVGSVGElement, excludeId?: string): Vertex | null {
  const rect = svgEl.getBoundingClientRect();
  const snapDist = 22 * viewport.width / Math.max(rect.width, 1);
  let best: Vertex | null = null;
  let bestDist = snapDist;
  for (const v of vertices) {
    if (v.id === excludeId) continue;
    const dx = v.x - point.x;
    const dy = v.y - point.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

// --- Sub-components ---

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={LABEL_STYLE}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={INPUT_STYLE} />;
}

function NumberInput({ value, onChange, step = 1 }: { value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (Number.isFinite(nextValue)) {
          onChange(nextValue);
        }
      }}
      style={INPUT_STYLE}
    />
  );
}

function SelectInput<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} style={INPUT_STYLE}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function EdgeTypePreviewSvg({ type }: { type: EdgeType }) {
  const W = 38, H = 14, mid = H / 2;

  if (type === "plain") {
    return <line x1={3} y1={mid} x2={W - 3} y2={mid} stroke="#111827" strokeWidth="2" />;
  }
  if (type === "fermion") {
    return (
      <>
        <line x1={3} y1={mid} x2={W - 3} y2={mid} stroke="#111827" strokeWidth="2" />
        <polygon points={`${W - 9},${mid - 3} ${W - 3},${mid} ${W - 9},${mid + 3}`} fill="#111827" />
      </>
    );
  }
  if (type === "antiFermion") {
    return (
      <>
        <line x1={3} y1={mid} x2={W - 3} y2={mid} stroke="#111827" strokeWidth="2" />
        <polygon points={`${10},${mid - 3} ${4},${mid} ${10},${mid + 3}`} fill="#111827" />
      </>
    );
  }
  if (type === "scalar") {
    return <line x1={3} y1={mid} x2={W - 3} y2={mid} stroke="#111827" strokeWidth="2" strokeDasharray="5 4" />;
  }
  if (type === "ghost") {
    return <line x1={3} y1={mid} x2={W - 3} y2={mid} stroke="#111827" strokeWidth="2" strokeDasharray="2 4" />;
  }
  if (type === "photon") {
    const len = W - 6;
    const pts = Array.from({ length: len + 1 }, (_, i) => `${3 + i},${mid + Math.sin((i / len) * Math.PI * 3.5) * 4}`).join(" ");
    return <polyline points={pts} fill="none" stroke="#111827" strokeWidth="1.6" />;
  }
  if (type === "gluon") {
    const len = W - 6;
    const pts = Array.from({ length: len + 1 }, (_, i) => `${3 + i},${mid + Math.sin((i / len) * Math.PI * 5) * 4.5}`).join(" ");
    return <polyline points={pts} fill="none" stroke="#111827" strokeWidth="1.6" />;
  }
  // graviton: double wave
  const len = W - 6;
  const pts1 = Array.from({ length: len + 1 }, (_, i) => `${3 + i},${mid - 2 + Math.sin((i / len) * Math.PI * 3.5) * 3}`).join(" ");
  const pts2 = Array.from({ length: len + 1 }, (_, i) => `${3 + i},${mid + 2 + Math.sin((i / len) * Math.PI * 3.5) * 3}`).join(" ");
  return (
    <>
      <polyline points={pts1} fill="none" stroke="#111827" strokeWidth="1.3" />
      <polyline points={pts2} fill="none" stroke="#111827" strokeWidth="1.3" />
    </>
  );
}

function EdgeTypeSelector({ value, onChange }: { value: EdgeType; onChange: (type: EdgeType) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
      {EDGE_TYPE_OPTIONS.map((type) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            title={type}
            onClick={() => onChange(type)}
            style={{
              border: `1px solid ${active ? P55 : BORDER}`,
              borderRadius: 8,
              background: active ? P10 : BG,
              padding: "5px 3px 3px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3
            }}
          >
            <svg width="38" height="14" viewBox="0 0 38 14">
              <EdgeTypePreviewSvg type={type} />
            </svg>
            <span style={{ fontSize: 9, color: active ? PRIMARY : MUTED_FG, fontWeight: 600, lineHeight: 1 }}>{type}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Main editor component ---

export function FeynmanDiagramEditor({
  value,
  onChange,
  width = 900,
  height = 600,
  title,
  sceneOptions,
  labelRenderer,
  style,
  className
}: FeynmanDiagramEditorProps) {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const latestDiagramRef = useRef(value);
  const latestViewportRef = useRef<ViewBox | null>(null);
  const latestOnChangeRef = useRef(onChange);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPointRef = useRef<Point | null>(null);
  const snapToGridRef = useRef(true);
  const marqueeDidDragRef = useRef(false);
  const latestMarqueeRef = useRef<MarqueeState>(null);

  // Undo / redo history (using refs to avoid re-renders on every drag flush)
  const undoStackRef = useRef<Diagram[]>([]);
  const redoStackRef = useRef<Diagram[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const [mode] = useState<EditorMode>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [newVertexKind, setNewVertexKind] = useState<VertexKind>("dot");
  const [newEdgeType, setNewEdgeType] = useState<EdgeType>("fermion");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [extraSelectedIds, setExtraSelectedIds] = useState<Set<string>>(new Set());
  const [hookSnapTargetId, setHookSnapTargetId] = useState<string | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeState>(null);
  const [newShapeKind, setNewShapeKind] = useState<ShapeKind>("circle");
  const [tikzPanel, setTikzPanel] = useState<TikzPanelMode>(null);
  const [tikzImportText, setTikzImportText] = useState("");
  const [tikzImportWarnings, setTikzImportWarnings] = useState<string[]>([]);

  const gridId = useId();
  const autoScene = useMemo(() => buildSvgScene(value, sceneOptions), [value, sceneOptions]);
  const [viewport, setViewport] = useState<ViewBox>(() => expandViewBox(autoScene.viewBox, 48));

  latestDiagramRef.current = value;
  latestViewportRef.current = viewport;
  latestOnChangeRef.current = onChange;
  snapToGridRef.current = snapToGrid;
  latestMarqueeRef.current = marqueeState;

  // Viewport auto-expand effect
  useEffect(() => {
    if (dragState) {
      return;
    }

    const nextBounds = expandViewBox(autoScene.viewBox, 48);
    setViewport((current) => {
      if (!current) {
        return nextBounds;
      }

      const currentArea = current.width * current.height;
      const nextArea = nextBounds.width * nextBounds.height;

      if (!intersectsViewBox(current, nextBounds) || currentArea > nextArea * 4) {
        return nextBounds;
      }

      if (containsViewBox(current, nextBounds)) {
        return current;
      }

      return mergeViewBoxes(current, nextBounds);
    });
  }, [autoScene.viewBox.height, autoScene.viewBox.width, autoScene.viewBox.x, autoScene.viewBox.y, dragState]);

  // Fit-to-view when the diagram identity changes completely (e.g. example switch)
  const vertexKey = value.vertices.map((v) => v.id).sort().join(",");
  const prevVertexKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prevKey = prevVertexKeyRef.current;
    prevVertexKeyRef.current = vertexKey;
    if (prevKey === null || prevKey === vertexKey || prevKey === "" || vertexKey === "") return;
    const currentIds = new Set(vertexKey.split(",").filter(Boolean));
    const prevIds = new Set(prevKey.split(",").filter(Boolean));
    const hasOverlap = [...currentIds].some((id) => prevIds.has(id));
    if (!hasOverlap) {
      setViewport(expandViewBox(autoScene.viewBox, 48));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertexKey]);

  // Clear selection if the selected item is removed
  useEffect(() => {
    if (!selection) {
      return;
    }

    if (selection.kind === "vertex" && !value.vertices.some((vertex) => vertex.id === selection.id)) {
      setSelection(null);
      setExtraSelectedIds(new Set());
      return;
    }

    if (selection.kind === "edge" && !value.edges.some((edge) => edge.id === selection.id)) {
      setSelection(null);
      return;
    }

    if (selection.kind === "label" && !(value.labels ?? []).some((label) => label.id === selection.id)) {
      setSelection(null);
    }
  }, [selection, value.edges, value.labels, value.vertices]);

  // Drag handling via RAF
  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function flushDrag() {
      dragFrameRef.current = null;
      const nextPoint = pendingDragPointRef.current;

      if (!nextPoint) {
        return;
      }

      const dx = nextPoint.x - activeDrag.origin.x;
      const dy = nextPoint.y - activeDrag.origin.y;
      const currentDiagram = latestDiagramRef.current;
      const snap = snapToGridRef.current;

      const applyCoord = (base: number, delta: number) => {
        const raw = base + delta;
        return snap ? snapCoordinate(raw) : roundCoordinate(raw);
      };

      if (activeDrag.kind === "vertex") {
        let nextDiagram = updateVertex(currentDiagram, activeDrag.id, (vertex) => ({
          ...vertex,
          x: applyCoord(activeDrag.start.x, dx),
          y: applyCoord(activeDrag.start.y, dy)
        }));
        for (const extraId of activeDrag.extraIds) {
          const extraStart = activeDrag.extraStarts[extraId];
          if (extraStart) {
            nextDiagram = updateVertex(nextDiagram, extraId, (vertex) => ({
              ...vertex,
              x: applyCoord(extraStart.x, dx),
              y: applyCoord(extraStart.y, dy)
            }));
          }
        }
        // If dragging a hook vertex, check for snap-to-real-vertex
        const draggedVertex = currentDiagram.vertices.find((v) => v.id === activeDrag.id);
        if (draggedVertex?.kind === "hook" && overlayRef.current) {
          const hookPos = {
            x: applyCoord(activeDrag.start.x, dx),
            y: applyCoord(activeDrag.start.y, dy)
          };
          const nonHookVertices = nextDiagram.vertices.filter((v) => v.id !== activeDrag.id && v.kind !== "hook");
          const snapV = findNearestVertex(hookPos, nonHookVertices, latestViewportRef.current ?? viewport, overlayRef.current, activeDrag.id);
          setHookSnapTargetId(snapV?.id ?? null);
        } else {
          setHookSnapTargetId(null);
        }
        latestOnChangeRef.current(nextDiagram);
        return;
      }

      if (activeDrag.kind === "shape") {
        latestOnChangeRef.current(
          updateShape(currentDiagram, activeDrag.id, (shape) => ({
            ...shape,
            x: applyCoord(activeDrag.start.x, dx),
            y: applyCoord(activeDrag.start.y, dy)
          }))
        );
        return;
      }

      latestOnChangeRef.current(
        updateLabel(currentDiagram, activeDrag.id, (label) => ({
          ...label,
          x: applyCoord(activeDrag.start.x, dx),
          y: applyCoord(activeDrag.start.y, dy)
        }))
      );
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId || !overlayRef.current) {
        return;
      }

      pendingDragPointRef.current = pointerToDiagramPoint(event, overlayRef.current, latestViewportRef.current ?? viewport);

      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(flushDrag);
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) {
        return;
      }

      if (overlayRef.current) {
        pendingDragPointRef.current = pointerToDiagramPoint(event, overlayRef.current, latestViewportRef.current ?? viewport);
      }

      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        flushDrag();
      }

      // Hook vertex merge: if dragging a hook onto a real (non-hook) vertex, merge them
      if (activeDrag.kind === "vertex" && overlayRef.current) {
        const currentDiagram = latestDiagramRef.current;
        const draggedV = currentDiagram.vertices.find((v) => v.id === activeDrag.id);
        if (draggedV?.kind === "hook") {
          const nonHookVertices = currentDiagram.vertices.filter((v) => v.id !== activeDrag.id && v.kind !== "hook");
          const nearV = findNearestVertex(draggedV, nonHookVertices, latestViewportRef.current ?? viewport, overlayRef.current, activeDrag.id);
          if (nearV) {
            const hookId = activeDrag.id;
            const targetId = nearV.id;
            const merged: typeof currentDiagram = {
              ...currentDiagram,
              vertices: currentDiagram.vertices.filter((v) => v.id !== hookId),
              edges: currentDiagram.edges.map((e) => ({
                ...e,
                from: e.from === hookId ? targetId : e.from,
                to: e.to === hookId ? targetId : e.to
              }))
            };
            latestOnChangeRef.current(merged);
            setHookSnapTargetId(null);
            pendingDragPointRef.current = null;
            setDragState(null);
            return;
          }
        }
      }

      setHookSnapTargetId(null);
      pendingDragPointRef.current = null;
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }

      pendingDragPointRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, viewport]);

  // Marquee (rubber-band) selection
  useEffect(() => {
    if (!marqueeState) return;
    const activePointerId = marqueeState.pointerId;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId || !overlayRef.current) return;
      const vp = latestViewportRef.current;
      if (!vp) return;
      const point = pointerToDiagramPoint(event, overlayRef.current, vp);
      setMarqueeState((prev) => (prev ? { ...prev, current: point } : null));
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId !== activePointerId) return;
      const latest = latestMarqueeRef.current;
      if (latest) {
        const vp = latestViewportRef.current;
        const rect = overlayRef.current?.getBoundingClientRect();
        const pixelsPerUnit = rect && vp ? rect.width / Math.max(vp.width, 1) : 1;
        const dx = latest.current.x - latest.start.x;
        const dy = latest.current.y - latest.start.y;
        const distPx = Math.sqrt(dx * dx + dy * dy) * pixelsPerUnit;
        if (distPx > 5) {
          marqueeDidDragRef.current = true;
          const x1 = Math.min(latest.start.x, latest.current.x);
          const y1 = Math.min(latest.start.y, latest.current.y);
          const x2 = Math.max(latest.start.x, latest.current.x);
          const y2 = Math.max(latest.start.y, latest.current.y);
          const inBox = latestDiagramRef.current.vertices.filter(
            (v) => v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2
          );
          if (inBox.length === 0) {
            setSelection(null);
            setExtraSelectedIds(new Set());
          } else {
            setSelection({ kind: "vertex", id: inBox[0]!.id });
            setExtraSelectedIds(new Set(inBox.slice(1).map((v) => v.id)));
          }
        }
      }
      setMarqueeState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marqueeState?.pointerId]);

  // --- History helpers ---

  function pushHistory(current: Diagram) {
    undoStackRef.current = [...undoStackRef.current.slice(-49), current];
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
  }

  function handleUndo() {
    if (undoStackRef.current.length === 0) return;
    const past = undoStackRef.current[undoStackRef.current.length - 1]!;
    redoStackRef.current = [value, ...redoStackRef.current.slice(0, 49)];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    onChange(past);
  }

  function handleRedo() {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[0]!;
    undoStackRef.current = [...undoStackRef.current.slice(-49), value];
    redoStackRef.current = redoStackRef.current.slice(1);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    onChange(next);
  }

  // --- Diagram mutation helpers ---

  function commit(nextDiagram: Diagram) {
    pushHistory(value);
    onChange(nextDiagram);
  }

  function appendVertex(diagram: Diagram, point: Point): { diagram: Diagram; vertexId: string } {
    const vertexId = createId(diagram.vertices.map((vertex) => vertex.id), "v");
    return {
      vertexId,
      diagram: {
        ...diagram,
        vertices: [
          ...diagram.vertices,
          {
            id: vertexId,
            x: roundCoordinate(point.x),
            y: roundCoordinate(point.y),
            kind: newVertexKind
          }
        ]
      }
    };
  }

  function appendEdge(diagram: Diagram, from: string, to: string): { diagram: Diagram; edgeId: string } {
    const edgeId = createId(diagram.edges.map((edge) => edge.id), "e");
    return {
      edgeId,
      diagram: {
        ...diagram,
        edges: [
          ...diagram.edges,
          {
            id: edgeId,
            from,
            to,
            type: newEdgeType
          }
        ]
      }
    };
  }

  function handleDuplicate() {
    if (!selection) return;

    if (selection.kind === "vertex") {
      const vertex = value.vertices.find((v) => v.id === selection.id);
      if (!vertex) return;
      const newId = createId(value.vertices.map((v) => v.id), "v");
      commit({
        ...value,
        vertices: [...value.vertices, { ...vertex, id: newId, x: vertex.x + 20, y: vertex.y + 20 }]
      });
      setSelection({ kind: "vertex", id: newId });
      setExtraSelectedIds(new Set());
    } else if (selection.kind === "label") {
      const label = (value.labels ?? []).find((l) => l.id === selection.id);
      if (!label) return;
      const newId = createId((value.labels ?? []).map((l) => l.id), "label");
      commit(withOptionalLabels(value, [...(value.labels ?? []), { ...label, id: newId, x: label.x + 20, y: label.y + 20 }]));
      setSelection({ kind: "label", id: newId });
    }
  }

  function viewportCenter(): Point {
    const vp = latestViewportRef.current ?? viewport;
    return {
      x: snapToGridRef.current ? snapCoordinate(vp.x + vp.width / 2) : roundCoordinate(vp.x + vp.width / 2),
      y: snapToGridRef.current ? snapCoordinate(vp.y + vp.height / 2) : roundCoordinate(vp.y + vp.height / 2)
    };
  }

  function handleAddVertex() {
    const pt = viewportCenter();
    const { diagram: nextDiagram, vertexId } = appendVertex(value, pt);
    commit(nextDiagram);
    setSelection({ kind: "vertex", id: vertexId });
    setExtraSelectedIds(new Set());
  }

  function handleAddEdge() {
    const pt = viewportCenter();
    const offset = 50;
    const id1 = createId(value.vertices.map((v) => v.id), "h");
    const id2 = createId([...value.vertices.map((v) => v.id), id1], "h");
    const edgeId = createId(value.edges.map((e) => e.id), "e");
    const nextDiagram: Diagram = {
      ...value,
      vertices: [
        ...value.vertices,
        { id: id1, x: roundCoordinate(pt.x - offset), y: pt.y, kind: "hook" },
        { id: id2, x: roundCoordinate(pt.x + offset), y: pt.y, kind: "hook" }
      ],
      edges: [
        ...value.edges,
        { id: edgeId, from: id1, to: id2, type: newEdgeType }
      ]
    };
    commit(nextDiagram);
    setSelection({ kind: "edge", id: edgeId });
    setExtraSelectedIds(new Set());
  }

  function handleAddLabel() {
    const pt = viewportCenter();
    const labelId = createId((value.labels ?? []).map((l) => l.id), "label");
    commit(
      withOptionalLabels(value, [
        ...(value.labels ?? []),
        { id: labelId, x: pt.x, y: pt.y, text: "Label" }
      ])
    );
    setSelection({ kind: "label", id: labelId });
  }

  function handleAddShape() {
    const pt = viewportCenter();
    const shapeId = createId((value.shapes ?? []).map((s) => s.id), "shape");
    const newShape: DiagramShape = {
      id: shapeId,
      kind: newShapeKind,
      x: pt.x,
      y: pt.y,
      rx: 30,
      ...(newShapeKind === "ellipse" ? { ry: 20 } : {})
    };
    commit(withOptionalShapes(value, [...(value.shapes ?? []), newShape]));
    setSelection({ kind: "shape", id: shapeId });
    setExtraSelectedIds(new Set());
  }

  // --- TikZ import / export ---

  function handleExportTikz() {
    const code = exportToTikz(value);
    setTikzPanel("export");
    setTikzImportText(code);
  }

  function handleOpenImportTikz() {
    setTikzImportText("");
    setTikzImportWarnings([]);
    setTikzPanel("import");
  }

  function handleApplyTikzImport() {
    const { diagram: imported, warnings } = importFromTikz(tikzImportText);
    commit(imported);
    setTikzImportWarnings(warnings);
    if (warnings.length === 0) setTikzPanel(null);
  }

  // --- SVG export helpers ---

  function exportUnwrapMath(text: string): string | null {
    const trimmed = text.trim();
    const wrappers = [
      ["\\(", "\\)"],
      ["\\[", "\\]"],
      ["$$", "$$"],
      ["$", "$"]
    ] as const;
    for (const [open, close] of wrappers) {
      if (trimmed.startsWith(open) && trimmed.endsWith(close) && trimmed.length > open.length + close.length) {
        return trimmed.slice(open.length, trimmed.length - close.length).trim();
      }
    }
    return null;
  }

  function exportEscapeTexText(text: string): string {
    return text
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([{}#$%&_])/g, "\\$1")
      .replace(/\^/g, "\\textasciicircum{}")
      .replace(/~/g, "\\textasciitilde{}")
      .replace(/\n/g, "\\\\ ");
  }

  function exportEscapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function exportRenderPath(p: ScenePath): string {
    const parts = [
      `d="${p.d}"`,
      `stroke="${p.stroke}"`,
      `stroke-width="${p.strokeWidth}"`,
      `fill="${p.fill}"`,
      p.strokeDasharray ? `stroke-dasharray="${p.strokeDasharray}"` : "",
      p.strokeLinecap ? `stroke-linecap="${p.strokeLinecap}"` : "",
      p.strokeLinejoin ? `stroke-linejoin="${p.strokeLinejoin}"` : "",
      p.markerStart ? `marker-start="${p.markerStart}"` : "",
      p.markerEnd ? `marker-end="${p.markerEnd}"` : "",
      p.opacity !== undefined && p.opacity !== 1 ? `opacity="${p.opacity}"` : ""
    ].filter(Boolean).join(" ");
    return `<path ${parts}/>`;
  }

  function exportRenderHatchPattern(p: SceneHatchPattern): string {
    return `<pattern id="${p.id}" width="${p.spacing}" height="${p.spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${p.angle})"><line x1="0" y1="0" x2="0" y2="${p.spacing}" stroke="${exportEscapeXml(p.stroke)}" stroke-width="${p.strokeWidth}"/></pattern>`;
  }

  function exportRenderShape(s: SceneShape): string {
    const attrs = [
      `fill="${exportEscapeXml(s.fill)}"`,
      `stroke="${exportEscapeXml(s.stroke)}"`,
      `stroke-width="${s.strokeWidth}"`,
      s.strokeDasharray ? `stroke-dasharray="${s.strokeDasharray}"` : "",
      s.opacity !== undefined ? `opacity="${s.opacity}"` : ""
    ].filter(Boolean).join(" ");
    const bgAttrs = `fill="${exportEscapeXml(s.backgroundFill ?? "")}" stroke="none" stroke-width="0"`;
    const bgEl = s.backgroundFill
      ? (s.kind === "circle"
          ? `<circle cx="${s.x}" cy="${s.y}" r="${s.rx}" ${bgAttrs}/>`
          : `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" ${bgAttrs}/>`)
      : "";
    const mainEl = s.kind === "circle"
      ? `<circle cx="${s.x}" cy="${s.y}" r="${s.rx}" ${attrs}/>`
      : `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`;
    return bgEl ? `<g>${bgEl}${mainEl}</g>` : mainEl;
  }

  function exportRenderVertex(v: SceneVertexGlyph): string {
    if (v.kind === "cross") {
      return `<g stroke="${v.stroke}" stroke-width="${v.strokeWidth}" stroke-linecap="round"><line x1="${v.x - v.crossSize}" y1="${v.y - v.crossSize}" x2="${v.x + v.crossSize}" y2="${v.y + v.crossSize}"/><line x1="${v.x - v.crossSize}" y1="${v.y + v.crossSize}" x2="${v.x + v.crossSize}" y2="${v.y - v.crossSize}"/></g>`;
    }
    return `<circle cx="${v.x}" cy="${v.y}" r="${v.radius}" fill="${v.fill}" stroke="${v.stroke}" stroke-width="${v.kind === "dot" ? 0 : v.strokeWidth}"/>`;
  }

  function exportRenderLabel(label: SceneLabel): string {
    type MathJaxApi = { tex2svg?: (math: string, opts?: { display?: boolean }) => HTMLElement };
    const mj = (window as any).MathJax as MathJaxApi | undefined;
    const mathContent = exportUnwrapMath(label.text);

    if (mj?.tex2svg) {
      const texSource = mathContent ?? `\\text{${exportEscapeTexText(label.text)}}`;
      try {
        const container = mj.tex2svg(texSource, { display: false });
        const mjSvg = container.querySelector
          ? (container.tagName?.toLowerCase() === "svg" ? container : container.querySelector("svg"))
          : null;
        if (mjSvg) {
          const exW = parseFloat((mjSvg as Element).getAttribute("width") ?? "0");
          const exH = parseFloat((mjSvg as Element).getAttribute("height") ?? "0");
          // 1ex ≈ 0.431em for Computer Modern; use 0.45 as a practical approximation
          const EX_PX = label.fontSize * 0.45;
          const w = exW * EX_PX;
          const h = exH * EX_PX;
          let lx = label.x;
          if (label.textAnchor === "middle") lx -= w / 2;
          else if (label.textAnchor === "end") lx -= w;
          const ly = label.y - h / 2;
          // Resize to concrete user-unit dimensions (preserving the viewBox for proper scaling)
          const origViewBox = (mjSvg as Element).getAttribute("viewBox") ?? "";
          const mjSvgEl = mjSvg as Element;
          mjSvgEl.setAttribute("width", w.toFixed(4));
          mjSvgEl.setAttribute("height", h.toFixed(4));
          if (origViewBox) mjSvgEl.setAttribute("viewBox", origViewBox);
          const inner = new XMLSerializer().serializeToString(mjSvg);
          return `<g transform="translate(${lx.toFixed(2)},${ly.toFixed(2)})" style="color:${label.color};fill:${label.color}">${inner}</g>`;
        }
      } catch {
        // fall through to text fallback
      }
    }

    // Fallback: plain SVG text element
    const fontFamily = label.fontFamily ?? "sans-serif";
    const escaped = exportEscapeXml(label.text);
    return `<text x="${label.x}" y="${label.y}" fill="${label.color}" font-size="${label.fontSize}" font-family="${exportEscapeXml(fontFamily)}" text-anchor="${label.textAnchor}" dominant-baseline="middle">${escaped}</text>`;
  }

  function handleExportSvg() {
    const exportScene = buildSvgScene(value, sceneOptions);
    const { x, y, width, height } = expandViewBox(exportScene.viewBox, 20);
    const { arrowMarkerId, hatchPatterns } = exportScene.defs;

    const titleEl = title
      ? `\n  <title>${exportEscapeXml(title)}</title>`
      : "";

    const hatchStr = hatchPatterns.map(exportRenderHatchPattern).join("\n    ");

    // Mirror the layer ordering used by FeynmanSceneSvg:
    //   back shapes + back vertices → paths → front vertices → front shapes → labels
    const backShapes = exportScene.shapes.filter((s) => !s.layer || s.layer === "back");
    const frontShapes = exportScene.shapes.filter((s) => s.layer === "front");
    const backVertices = exportScene.vertices.filter((v) => v.layer === "back");
    const frontVertices = exportScene.vertices.filter((v) => !v.layer || v.layer === "front");

    const backShapesStr = backShapes.map(exportRenderShape).join("\n    ");
    const backVerticesStr = backVertices.map(exportRenderVertex).join("\n    ");
    const pathsStr = exportScene.paths.map(exportRenderPath).join("\n    ");
    const frontVerticesStr = frontVertices.map(exportRenderVertex).join("\n    ");
    const frontShapesStr = frontShapes.map(exportRenderShape).join("\n    ");
    const labelsStr = exportScene.labels.map(exportRenderLabel).join("\n    ");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" role="img">${titleEl}
  <defs>
    <marker id="${arrowMarkerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
    </marker>
    ${hatchStr}
  </defs>
  <g>
    ${backShapesStr}
    ${backVerticesStr}
  </g>
  <g>
    ${pathsStr}
  </g>
  <g>
    ${frontVerticesStr}
  </g>
  <g>
    ${frontShapesStr}
  </g>
  <g>
    ${labelsStr}
  </g>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ?? "feynman-diagram"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Event handlers ---

  const scene = useMemo(() => ({ ...autoScene, viewBox: viewport }), [autoScene, viewport]);
  const activeLabelRenderer = dragState ? undefined : labelRenderer;
  const selectedVertex = selection?.kind === "vertex" ? value.vertices.find((vertex) => vertex.id === selection.id) ?? null : null;
  const selectedEdge = selection?.kind === "edge" ? value.edges.find((edge) => edge.id === selection.id) ?? null : null;
  const selectedLabel = selection?.kind === "label" ? (value.labels ?? []).find((label) => label.id === selection.id) ?? null : null;

  const allSelectedVertexIds: Set<string> = useMemo(() => {
    const ids = new Set(extraSelectedIds);
    if (selection?.kind === "vertex") ids.add(selection.id);
    return ids;
  }, [extraSelectedIds, selection]);

  const currentModeHint = selection
    ? `Selected ${selection.kind} ${selection.id}. Drag or edit fields in the inspector. [Del] Delete`
    : "Click to select. [A] Add vertex  [E] Add edge  [L] Add label  Shift+click for multi-select";

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!overlayRef.current) return;
    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);
    setCursorPoint(point);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (mode !== "select" || !overlayRef.current) return;
    marqueeDidDragRef.current = false;
    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);
    setMarqueeState({ pointerId: event.pointerId, start: point, current: point });
  }

  function handleCanvasPointerLeave() {
    setCursorPoint(null);
  }

  function handleCanvasClick() {
    if (marqueeDidDragRef.current) {
      marqueeDidDragRef.current = false;
      return;
    }
    // Canvas click always deselects — items are added via toolbar buttons
    setSelection(null);
    setExtraSelectedIds(new Set());
  }

  function handleVertexPointerDown(event: ReactPointerEvent<SVGCircleElement>, vertex: Vertex) {
    if (mode !== "select") {
      return;
    }

    if (!overlayRef.current) {
      return;
    }

    event.stopPropagation();
    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);

    // Gather extra selected vertices for multi-drag
    const extraIds = [...extraSelectedIds].filter((id) => id !== vertex.id);
    const extraStarts: Record<string, Point> = {};
    for (const id of extraIds) {
      const v = value.vertices.find((vx) => vx.id === id);
      if (v) extraStarts[id] = { x: v.x, y: v.y };
    }

    // Push to undo history before the drag starts
    pushHistory(value);

    setSelection({ kind: "vertex", id: vertex.id });
    setDragState({
      kind: "vertex",
      id: vertex.id,
      extraIds,
      extraStarts,
      pointerId: event.pointerId,
      origin: point,
      start: { x: vertex.x, y: vertex.y }
    });
  }

  function handleVertexClick(event: { shiftKey: boolean }, vertex: Vertex) {
    if (event.shiftKey) {
      // Shift+click: toggle this vertex into the extra selection
      setExtraSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(vertex.id)) {
          next.delete(vertex.id);
        } else {
          next.add(vertex.id);
        }
        return next;
      });
      return;
    }

    setExtraSelectedIds(new Set());
    setSelection({ kind: "vertex", id: vertex.id });
  }

  function handleLabelPointerDown(event: ReactPointerEvent<SVGRectElement>, label: Label) {
    if (mode !== "select") {
      return;
    }

    if (!overlayRef.current) {
      return;
    }

    event.stopPropagation();
    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);

    pushHistory(value);
    setSelection({ kind: "label", id: label.id });
    setDragState({ kind: "label", id: label.id, pointerId: event.pointerId, origin: point, start: { x: label.x, y: label.y } });
  }

  function handleShapePointerDown(event: ReactPointerEvent<SVGElement>, shape: DiagramShape) {
    if (mode !== "select" || !overlayRef.current) return;
    event.stopPropagation();
    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);
    pushHistory(value);
    setSelection({ kind: "shape", id: shape.id });
    setExtraSelectedIds(new Set());
    setDragState({ kind: "shape", id: shape.id, pointerId: event.pointerId, origin: point, start: { x: shape.x, y: shape.y } });
  }

  function handleEdgeClick(edgeId: string) {
    if (mode === "select") {
      setSelection({ kind: "edge", id: edgeId });
      setExtraSelectedIds(new Set());
    }
  }

  function handleDeleteSelection() {
    if (!selection) return;

    let nextDiagram = removeSelected(value, selection);
    for (const id of extraSelectedIds) {
      if (id !== selection.id) {
        nextDiagram = removeSelected(nextDiagram, { kind: "vertex", id });
      }
    }

    commit(nextDiagram);
    setSelection(null);
    setExtraSelectedIds(new Set());
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Don't fire shortcuts when focus is inside a form field
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      // Still allow Escape from form fields
      if (event.key === "Escape") {
        (event.target as HTMLElement).blur();
      }
      return;
    }

    const ctrl = event.metaKey || event.ctrlKey;

    if ((event.key === "Backspace" || event.key === "Delete") && selection) {
      event.preventDefault();
      handleDeleteSelection();
      return;
    }

    if (event.key === "Escape") {
      setSelection(null);
      setExtraSelectedIds(new Set());
      return;
    }

    // Undo / Redo
    if (ctrl && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }
    if (ctrl && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
      event.preventDefault();
      handleRedo();
      return;
    }

    // Duplicate
    if (ctrl && event.key === "d") {
      event.preventDefault();
      handleDuplicate();
      return;
    }

    // Quick-add shortcuts (no modifier)
    if (!ctrl) {
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        handleAddVertex();
        return;
      }
      if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        handleAddEdge();
        return;
      }
      if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        handleAddLabel();
        return;
      }
    }
  }

  const surfaceStyle: CSSProperties = {
    ...ROOT_STYLE,
    width: toDimension(width, 900),
    height: toDimension(height, 600),
    ...(style ?? {})
  };

  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;

  return (
    <div id="fde-root" className={className} style={surfaceStyle} onKeyDown={handleKeyDown} tabIndex={0}>
      <div id="fde-canvas-panel" style={CANVAS_PANEL_STYLE}>
        <div style={HEADER_STYLE}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: PRIMARY, fontWeight: 700 }}>
              Visual editor
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: FG }}>{title ?? "Feynman diagram editor"}</div>
          </div>

          <div style={TOOLBAR_STYLE}>
            <button
              type="button"
              title="Add vertex at canvas centre [A]"
              style={BUTTON_STYLE}
              onClick={handleAddVertex}
            >
              Add vertex
            </button>
            <button
              type="button"
              title="Add edge with hook endpoints at canvas centre [E]"
              style={BUTTON_STYLE}
              onClick={handleAddEdge}
            >
              Add edge
            </button>
            <button
              type="button"
              title="Add label at canvas centre [L]"
              style={BUTTON_STYLE}
              onClick={handleAddLabel}
            >
              Add label
            </button>
            <button
              type="button"
              title="Add shape at canvas centre"
              style={BUTTON_STYLE}
              onClick={handleAddShape}
            >
              Add shape
            </button>
            <select
              value={newShapeKind}
              onChange={(e) => setNewShapeKind(e.target.value as ShapeKind)}
              style={{ ...INPUT_STYLE, width: 80, height: 32 }}
              title="Shape kind for Add shape"
            >
              {SHAPE_KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>

            <div style={{ width: 1, height: 20, background: "rgba(26, 37, 47, 0.12)" }} />

            <button
              type="button"
              title="Undo [Ctrl+Z]"
              style={canUndo ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}
              onClick={handleUndo}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              title="Redo [Ctrl+Shift+Z]"
              style={canRedo ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}
              onClick={handleRedo}
              disabled={!canRedo}
            >
              Redo
            </button>

            <div style={{ width: 1, height: 20, background: "rgba(26, 37, 47, 0.12)" }} />

            <button
              type="button"
              title="Zoom in"
              style={BUTTON_STYLE}
              onClick={() => setViewport((current) => zoomViewBox(current, 0.85))}
            >
              Zoom in
            </button>
            <button
              type="button"
              title="Zoom out"
              style={BUTTON_STYLE}
              onClick={() => setViewport((current) => zoomViewBox(current, 1.18))}
            >
              Zoom out
            </button>
            <button
              type="button"
              title="Fit diagram to view"
              style={BUTTON_STYLE}
              onClick={() => setViewport(expandViewBox(autoScene.viewBox, 48))}
            >
              Fit
            </button>
            <button
              type="button"
              title="Snap vertex positions to the nearest 10-unit grid"
              style={snapToGrid ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE}
              onClick={() => setSnapToGrid((s) => !s)}
            >
              Snap
            </button>
            <button
              type="button"
              title="Download diagram as SVG file"
              style={BUTTON_STYLE}
              onClick={handleExportSvg}
            >
              Export SVG
            </button>
            <button
              type="button"
              title="Export as TikZ-Feynman LaTeX code"
              style={BUTTON_STYLE}
              onClick={handleExportTikz}
            >
              Export TikZ
            </button>
            <button
              type="button"
              title="Import from TikZ-Feynman LaTeX code"
              style={BUTTON_STYLE}
              onClick={handleOpenImportTikz}
            >
              Import TikZ
            </button>
          </div>
        </div>

        <div id="fde-canvas-surface" style={CANVAS_SURFACE_STYLE}>
          {/* Empty state hint */}
          {value.vertices.length === 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                color: "rgba(31, 36, 48, 0.28)",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.01em"
              }}
            >
              Press A to add a vertex, E to add an edge, or use the toolbar buttons
            </div>
          ) : null}

          <div style={{ position: "absolute", inset: 0 }}>
            <FeynmanSceneSvg
              scene={scene}
              width="100%"
              height="100%"
              {...(title ? { title } : {})}
              {...(activeLabelRenderer ? { labelRenderer: activeLabelRenderer } : {})}
              svgStyle={{ display: "block", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
            />
          </div>

          <svg
            ref={overlayRef}
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "default" }}
            onPointerDown={handleCanvasPointerDown}
            onClick={handleCanvasClick}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
            aria-hidden="true"
          >
            <defs>
              <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(31, 36, 48, 0.06)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height} fill={`url(#${gridId})`} />

            {/* Edge selection highlight */}
            {selection?.kind === "edge"
              ? getEdgePaths(scene.paths, selection.id).map((path) => (
                  <path
                    key={`highlight-${path.id}`}
                    d={path.d}
                    fill="none"
                    stroke={SEC42}
                    strokeWidth={Math.max(path.strokeWidth + 7, 8)}
                    strokeLinecap={path.strokeLinecap}
                    strokeLinejoin={path.strokeLinejoin}
                  />
                ))
              : null}

            {/* Edge hit areas */}
            {value.edges.map((edge) =>
              getEdgePaths(scene.paths, edge.id).map((path, index) => (
                <path
                  key={`hit-${edge.id}-${index}`}
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(path.strokeWidth + 14, 18)}
                  strokeLinecap={path.strokeLinecap}
                  strokeLinejoin={path.strokeLinejoin}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEdgeClick(edge.id);
                  }}
                />
              ))
            )}

            {/* Vertex overlays */}
            {value.vertices.map((vertex) => {
              const isPrimary = selection?.kind === "vertex" && selection.id === vertex.id;
              const isExtra = extraSelectedIds.has(vertex.id);
              const isSelected = isPrimary || isExtra;
              return (
                <g key={vertex.id}>
                  {isSelected ? (
                    <circle
                      cx={vertex.x}
                      cy={vertex.y}
                      r={16}
                      fill={isPrimary ? P12 : P07}
                      stroke={isPrimary ? P60 : P40}
                      strokeWidth="2"
                    />
                  ) : null}
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r={7}
                    fill={isSelected ? PRIMARY : BG}
                    stroke={isSelected ? PRIMARY : FG}
                    strokeWidth="2"
                    onPointerDown={(event) => handleVertexPointerDown(event, vertex)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleVertexClick(event.nativeEvent, vertex);
                    }}
                  />
                </g>
              );
            })}

            {/* Label hit areas */}
            {(value.labels ?? []).map((label) => {
              const isSelected = selection?.kind === "label" && selection.id === label.id;
              const box = estimateLabelBox(label.text, label.style?.fontSize ?? value.style?.fontSize ?? 16);
              return (
                <rect
                  key={label.id}
                  x={label.x - box.width / 2}
                  y={label.y - box.height / 2}
                  width={box.width}
                  height={box.height}
                  rx={10}
                  fill={isSelected ? P14 : "transparent"}
                  stroke={isSelected ? P55 : "transparent"}
                  strokeWidth="2"
                  onPointerDown={(event) => handleLabelPointerDown(event, label)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelection({ kind: "label", id: label.id });
                    setExtraSelectedIds(new Set());
                  }}
                />
              );
            })}

            {/* Hook-to-vertex snap indicator ring */}
            {hookSnapTargetId
              ? (() => {
                  const snapV = value.vertices.find((v) => v.id === hookSnapTargetId);
                  if (!snapV) return null;
                  return (
                    <circle
                      cx={snapV.x}
                      cy={snapV.y}
                      r={15}
                      fill={SEC08}
                      stroke={SEC70}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  );
                })()
              : null}

            {/* Marquee selection rectangle */}
            {marqueeState && mode === "select"
              ? (() => {
                  const x = Math.min(marqueeState.start.x, marqueeState.current.x);
                  const y = Math.min(marqueeState.start.y, marqueeState.current.y);
                  const w = Math.abs(marqueeState.current.x - marqueeState.start.x);
                  const h = Math.abs(marqueeState.current.y - marqueeState.start.y);
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={P08}
                      stroke={P50}
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                      pointerEvents="none"
                    />
                  );
                })()
              : null}

            {/* Shape hit areas and selection highlights */}
            {(value.shapes ?? []).map((shape) => {
              const isSelected = selection?.kind === "shape" && selection.id === shape.id;
              const rx = shape.rx;
              const ry = shape.ry ?? shape.rx;
              const hitProps = {
                fill: "transparent",
                stroke: "transparent",
                strokeWidth: Math.max(12, (shape.style?.strokeWidth ?? 3) + 12),
                style: { cursor: mode === "select" ? "move" : "default" } as CSSProperties,
                onPointerDown: (e: ReactPointerEvent<SVGElement>) => handleShapePointerDown(e, shape),
                onClick: (e: ReactMouseEvent) => {
                  e.stopPropagation();
                  if (mode === "select") {
                    setSelection({ kind: "shape", id: shape.id });
                    setExtraSelectedIds(new Set());
                  }
                }
              };
              return (
                <g key={shape.id}>
                  {isSelected && (
                    shape.kind === "circle"
                      ? <circle cx={shape.x} cy={shape.y} r={rx + 6} fill={P08} stroke={P55} strokeWidth="2" strokeDasharray="5 3" pointerEvents="none" />
                      : <ellipse cx={shape.x} cy={shape.y} rx={rx + 6} ry={ry + 6} fill={P08} stroke={P55} strokeWidth="2" strokeDasharray="5 3" pointerEvents="none" />
                  )}
                  {shape.kind === "circle"
                    ? <circle cx={shape.x} cy={shape.y} r={rx} {...hitProps} />
                    : <ellipse cx={shape.x} cy={shape.y} rx={rx} ry={ry} {...hitProps} />
                  }
                </g>
              );
            })}
          </svg>
        </div>

        {/* TikZ panel overlay */}
        {tikzPanel !== null && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10
          }}>
            <div style={{
              background: BG, borderRadius: 14, padding: 24, width: 560, maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 14
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: FG }}>
                  {tikzPanel === "export" ? "TikZ-Feynman export" : "TikZ-Feynman import"}
                </div>
                <button type="button" style={BUTTON_STYLE} onClick={() => setTikzPanel(null)}>Close</button>
              </div>
              <textarea
                value={tikzImportText}
                onChange={(e) => setTikzImportText(e.target.value)}
                readOnly={tikzPanel === "export"}
                rows={14}
                spellCheck={false}
                style={{
                  width: "100%", fontFamily: "monospace", fontSize: 12,
                  border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: 10, background: tikzPanel === "export" ? MUTED : BG,
                  color: FG, resize: "vertical", boxSizing: "border-box"
                }}
              />
              {tikzPanel === "export" && (
                <button
                  type="button"
                  style={BUTTON_STYLE}
                  onClick={() => { navigator.clipboard?.writeText(tikzImportText); }}
                >
                  Copy to clipboard
                </button>
              )}
              {tikzPanel === "import" && (
                <>
                  <button
                    type="button"
                    style={ACTIVE_BUTTON_STYLE}
                    onClick={handleApplyTikzImport}
                    disabled={!tikzImportText.trim()}
                  >
                    Apply import
                  </button>
                  {tikzImportWarnings.length > 0 && (
                    <div style={{ fontSize: 12, color: DESTRUCT }}>
                      {tikzImportWarnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div id="fde-status" style={STATUS_STYLE}>
          <span>{currentModeHint}</span>
          <span style={{ display: "flex", gap: 12 }}>
            {cursorPoint ? (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                x: {Math.round(cursorPoint.x)}, y: {Math.round(cursorPoint.y)}
              </span>
            ) : null}
            <span>
              {value.vertices.length} vertices · {value.edges.length} edges · {(value.labels ?? []).length} labels · {(value.shapes ?? []).length} shapes
            </span>
          </span>
        </div>
      </div>

      <aside style={SIDEBAR_STYLE}>
        <section style={PANEL_STYLE}>
          <div style={{ marginBottom: 10, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: PRIMARY, fontWeight: 700 }}>Tool defaults</div>
          <div style={FIELD_GRID_STYLE}>
            <Field label="New vertex kind">
              <SelectInput value={newVertexKind} options={VERTEX_KIND_OPTIONS} onChange={setNewVertexKind} />
            </Field>
            <Field label="New edge type">
              <SelectInput value={newEdgeType} options={EDGE_TYPE_OPTIONS} onChange={setNewEdgeType} />
            </Field>
          </div>
        </section>

        <section style={{ ...PANEL_STYLE, flex: 1, overflow: "auto" }}>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: PRIMARY, fontWeight: 700 }}>Inspector</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: FG }}>
                {selection
                  ? `${selection.kind}: ${selection.id}`
                  : allSelectedVertexIds.size > 1
                    ? `${allSelectedVertexIds.size} vertices`
                    : "No selection"}
              </div>
            </div>
            {selection ? (
              <button type="button" style={{ ...BUTTON_STYLE, color: DESTRUCT, borderColor: `oklch(0.6368 0.2078 25.3313 / 0.35)` }} onClick={handleDeleteSelection}>
                Delete
              </button>
            ) : null}
          </div>

          {!selection && allSelectedVertexIds.size <= 1 ? (
            <div style={{ display: "grid", gap: 12, color: MUTED_FG, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>This editor stays fully controlled: every drag or form edit emits a fresh canonical Diagram object through onChange.</p>
              <p style={{ margin: 0 }}>
                Use the mode buttons to add vertices, connect them with edges, and place freeform labels.
                Shift+click vertices to multi-select and drag together.
              </p>
            </div>
          ) : null}

          {/* Multi-select info */}
          {!selection && allSelectedVertexIds.size > 1 ? (
            <div style={{ display: "grid", gap: 8, color: MUTED_FG, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>Drag any selected vertex to move all {allSelectedVertexIds.size} together. Press Delete to remove them all.</p>
            </div>
          ) : null}

          {/* Vertex inspector */}
          {selectedVertex ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="id">
                <TextInput
                  value={selectedVertex.id}
                  onChange={(nextId) => {
                    const trimmed = nextId.trim();
                    if (!trimmed || trimmed === selectedVertex.id) return;
                    if (value.vertices.some((v) => v.id !== selectedVertex.id && v.id === trimmed)) return;
                    commit(renameVertexInDiagram(value, selectedVertex.id, trimmed));
                    setSelection({ kind: "vertex", id: trimmed });
                  }}
                />
              </Field>

              <div style={FIELD_GRID_STYLE}>
                <Field label="x">
                  <NumberInput value={selectedVertex.x} step={1} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, x: nextValue })))} />
                </Field>
                <Field label="y">
                  <NumberInput value={selectedVertex.y} step={1} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, y: nextValue })))} />
                </Field>
              </div>

              <div style={FIELD_GRID_STYLE}>
                <Field label="kind">
                  <SelectInput value={selectedVertex.kind ?? "none"} options={VERTEX_KIND_OPTIONS} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, kind: nextValue })))} />
                </Field>
                <Field label="glyph radius">
                  <NumberInput
                    value={selectedVertex.size ?? 0}
                    step={1}
                    onChange={(nextValue) => {
                      commit(updateVertex(value, selectedVertex.id, (vertex) => {
                        const next = { ...vertex };
                        if (nextValue > 0) next.size = nextValue; else delete next.size;
                        return next;
                      }));
                    }}
                  />
                </Field>
              </div>

              {/* Blob-specific fill options */}
              {(selectedVertex.kind ?? "none") === "blob" && (
                <>
                  <Field label="fill style">
                    <SelectInput
                      value={selectedVertex.style?.fillStyle ?? "solid"}
                      options={SHAPE_FILL_OPTIONS}
                      onChange={(v) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, style: { ...vertex.style, fillStyle: v } })))}
                    />
                  </Field>
                  {selectedVertex.style?.fillStyle === "hatch" && (
                    <Field label="background fill">
                      <TextInput
                        value={selectedVertex.style?.backgroundFill ?? ""}
                        placeholder="e.g. white or #fff"
                        onChange={(v) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({
                          ...vertex,
                          style: { ...vertex.style, backgroundFill: v || undefined }
                        })))}
                      />
                    </Field>
                  )}
                  <Field label="layer">
                    <select
                      value={selectedVertex.layer ?? "front"}
                      onChange={(e) => commit(updateVertex(value, selectedVertex.id, (vertex) => {
                        const next = { ...vertex };
                        if (e.target.value === "back") next.layer = "back"; else delete next.layer;
                        return next;
                      }))}
                      style={INPUT_STYLE}
                    >
                      <option value="front">front (default)</option>
                      <option value="back">back (under edges)</option>
                    </select>
                  </Field>
                </>
              )}

              <Field label="label">
                <TextInput
                  value={selectedVertex.label ?? ""}
                  placeholder="Optional vertex label"
                  onChange={(nextValue) => {
                    const normalized = normalizeOptionalText(nextValue);
                    commit(
                      updateVertex(value, selectedVertex.id, (vertex) => {
                        const nextVertex = { ...vertex };
                        if (normalized) {
                          nextVertex.label = normalized;
                        } else {
                          delete nextVertex.label;
                        }
                        return nextVertex;
                      })
                    );
                  }}
                />
              </Field>

              <div style={FIELD_GRID_STYLE}>
                <Field label="label offset x">
                  <NumberInput
                    value={selectedVertex.labelOffset?.x ?? 0}
                    onChange={(nextValue) =>
                      commit(
                        updateVertex(value, selectedVertex.id, (vertex) => ({
                          ...vertex,
                          labelOffset: {
                            x: nextValue,
                            y: vertex.labelOffset?.y ?? -16
                          }
                        }))
                      )
                    }
                  />
                </Field>
                <Field label="label offset y">
                  <NumberInput
                    value={selectedVertex.labelOffset?.y ?? -16}
                    onChange={(nextValue) =>
                      commit(
                        updateVertex(value, selectedVertex.id, (vertex) => ({
                          ...vertex,
                          labelOffset: {
                            x: vertex.labelOffset?.x ?? 0,
                            y: nextValue
                          }
                        }))
                      )
                    }
                  />
                </Field>
              </div>

              <button
                type="button"
                title="Duplicate vertex [Ctrl+D]"
                style={{ ...BUTTON_STYLE, width: "100%", textAlign: "center" }}
                onClick={handleDuplicate}
              >
                Duplicate
              </button>
            </div>
          ) : null}

          {/* Edge inspector */}
          {selectedEdge ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={FIELD_GRID_STYLE}>
                <Field label="from">
                  <select value={selectedEdge.from} onChange={(event) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, from: event.target.value })))} style={INPUT_STYLE}>
                    {value.vertices.map((vertex) => (
                      <option key={vertex.id} value={vertex.id}>
                        {vertex.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="to">
                  <select value={selectedEdge.to} onChange={(event) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, to: event.target.value })))} style={INPUT_STYLE}>
                    {value.vertices.map((vertex) => (
                      <option key={vertex.id} value={vertex.id}>
                        {vertex.id}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <button
                type="button"
                title="Swap the from and to vertices"
                style={{ ...BUTTON_STYLE, width: "100%", textAlign: "center" }}
                onClick={() =>
                  commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, from: edge.to, to: edge.from })))
                }
              >
                Reverse direction
              </button>

              <Field label="type">
                <EdgeTypeSelector
                  value={selectedEdge.type}
                  onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, type: nextValue })))}
                />
              </Field>

              <div style={FIELD_GRID_STYLE}>
                <Field label="curve">
                  <SelectInput value={selectedEdge.curve ?? "line"} options={CURVE_OPTIONS} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, curve: nextValue })))} />
                </Field>
                <Field label="bend">
                  <NumberInput value={selectedEdge.bend ?? 0} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, bend: nextValue })))} />
                </Field>
              </div>

              <Field label="label">
                <TextInput
                  value={selectedEdge.label ?? ""}
                  placeholder="Optional edge label"
                  onChange={(nextValue) => {
                    const normalized = normalizeOptionalText(nextValue);
                    commit(
                      updateEdge(value, selectedEdge.id, (edge) => {
                        const nextEdge = { ...edge };
                        if (normalized) {
                          nextEdge.label = normalized;
                        } else {
                          delete nextEdge.label;
                        }
                        return nextEdge;
                      })
                    );
                  }}
                />
              </Field>

              <div style={FIELD_GRID_STYLE}>
                <Field label="label offset">
                  <NumberInput value={selectedEdge.labelOffset ?? 18} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, labelOffset: nextValue })))} />
                </Field>
                <Field label="label side">
                  <select
                    value={selectedEdge.labelSide ?? "left"}
                    onChange={(event) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, labelSide: event.target.value as "left" | "right" })))}
                    style={INPUT_STYLE}
                  >
                    <option value="left">left</option>
                    <option value="right">right</option>
                  </select>
                </Field>
              </div>

              <div style={FIELD_GRID_STYLE}>
                <Field label="flow arrow">
                  <select
                    value={selectedEdge.arrow ?? "auto"}
                    onChange={(event) => {
                      const nextArrow = event.target.value as "auto" | ArrowDirection;
                      commit(
                        updateEdge(value, selectedEdge.id, (edge) => {
                          const nextEdge = { ...edge };
                          if (nextArrow === "auto") {
                            delete nextEdge.arrow;
                          } else {
                            nextEdge.arrow = nextArrow;
                          }
                          return nextEdge;
                        })
                      );
                    }}
                    style={INPUT_STYLE}
                  >
                    {ARROW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="momentum arrow">
                  <select
                    value={selectedEdge.momentumDirection ?? "forward"}
                    onChange={(event) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, momentumDirection: event.target.value as ArrowDirection })))}
                    style={INPUT_STYLE}
                  >
                    <option value="forward">forward</option>
                    <option value="backward">backward</option>
                    <option value="none">none</option>
                  </select>
                </Field>
              </div>

              <Field label="momentum label">
                <TextInput
                  value={selectedEdge.momentum ?? ""}
                  placeholder="Optional momentum"
                  onChange={(nextValue) => {
                    const normalized = normalizeOptionalText(nextValue);
                    commit(
                      updateEdge(value, selectedEdge.id, (edge) => {
                        const nextEdge = { ...edge };
                        if (normalized) {
                          nextEdge.momentum = normalized;
                        } else {
                          delete nextEdge.momentum;
                        }
                        return nextEdge;
                      })
                    );
                  }}
                />
              </Field>
            </div>
          ) : null}

          {/* Label inspector */}
          {selectedLabel ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={FIELD_GRID_STYLE}>
                <Field label="x">
                  <NumberInput value={selectedLabel.x} onChange={(nextValue) => commit(updateLabel(value, selectedLabel.id, (label) => ({ ...label, x: nextValue })))} />
                </Field>
                <Field label="y">
                  <NumberInput value={selectedLabel.y} onChange={(nextValue) => commit(updateLabel(value, selectedLabel.id, (label) => ({ ...label, y: nextValue })))} />
                </Field>
              </div>

              <Field label="text">
                <TextInput value={selectedLabel.text} onChange={(nextValue) => commit(updateLabel(value, selectedLabel.id, (label) => ({ ...label, text: nextValue || "Label" })))} />
              </Field>

              <div style={FIELD_GRID_STYLE}>
                <Field label="font size">
                  <NumberInput
                    value={selectedLabel.style?.fontSize ?? value.style?.fontSize ?? 16}
                    onChange={(nextValue) =>
                      commit(
                        updateLabel(value, selectedLabel.id, (label) => ({
                          ...label,
                          style: {
                            ...label.style,
                            fontSize: nextValue
                          }
                        }))
                      )
                    }
                  />
                </Field>
                <Field label="color">
                  <TextInput
                    value={selectedLabel.style?.color ?? "#111827"}
                    onChange={(nextValue) =>
                      commit(
                        updateLabel(value, selectedLabel.id, (label) => ({
                          ...label,
                          style: {
                            ...label.style,
                            color: nextValue
                          }
                        }))
                      )
                    }
                  />
                </Field>
              </div>

              <button
                type="button"
                title="Duplicate label [Ctrl+D]"
                style={{ ...BUTTON_STYLE, width: "100%", textAlign: "center" }}
                onClick={handleDuplicate}
              >
                Duplicate
              </button>
            </div>
          ) : null}

          {/* Shape inspector */}
          {selection?.kind === "shape" ? (() => {
            const shape = (value.shapes ?? []).find((s) => s.id === selection.id);
            if (!shape) return null;
            const st = shape.style ?? {};
            const fillStyle = st.fillStyle ?? "solid";
            return (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={FIELD_GRID_STYLE}>
                  <Field label="x">
                    <NumberInput value={shape.x} step={1} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, x: v })))} />
                  </Field>
                  <Field label="y">
                    <NumberInput value={shape.y} step={1} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, y: v })))} />
                  </Field>
                </div>
                <div style={FIELD_GRID_STYLE}>
                  <Field label={shape.kind === "circle" ? "radius" : "radius x"}>
                    <NumberInput value={shape.rx} step={1} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, rx: Math.max(1, v) })))} />
                  </Field>
                  {shape.kind === "ellipse" && (
                    <Field label="radius y">
                      <NumberInput value={shape.ry ?? shape.rx} step={1} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, ry: Math.max(1, v) })))} />
                    </Field>
                  )}
                </div>
                <Field label="fill style">
                  <SelectInput value={fillStyle} options={SHAPE_FILL_OPTIONS} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, fillStyle: v } })))} />
                </Field>
                {(fillStyle === "solid" || fillStyle === "hatch") && (
                  <Field label="fill color">
                    <TextInput
                      value={st.fill ?? ""}
                      placeholder="e.g. #aaccff or blue"
                      onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, fill: v || undefined } })))}
                    />
                  </Field>
                )}
                <div style={FIELD_GRID_STYLE}>
                  <Field label="stroke color">
                    <TextInput
                      value={st.stroke ?? ""}
                      placeholder="inherit"
                      onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, stroke: v || undefined } })))}
                    />
                  </Field>
                  <Field label="stroke width">
                    <NumberInput
                      value={st.strokeWidth ?? 0}
                      step={0.5}
                      onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, strokeWidth: v > 0 ? v : undefined } })))}
                    />
                  </Field>
                </div>
                {fillStyle === "hatch" && (
                  <>
                    <div style={FIELD_GRID_STYLE}>
                      <Field label="hatch angle °">
                        <NumberInput value={st.hatchAngle ?? 45} step={15} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, hatchAngle: v } })))} />
                      </Field>
                      <Field label="hatch spacing">
                        <NumberInput value={st.hatchSpacing ?? 8} step={1} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, hatchSpacing: Math.max(2, v) } })))} />
                      </Field>
                    </div>
                    <Field label="background fill">
                      <TextInput
                        value={st.backgroundFill ?? ""}
                        placeholder="e.g. white or #fff"
                        onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, backgroundFill: v || undefined } })))}
                      />
                    </Field>
                  </>
                )}
                <div style={FIELD_GRID_STYLE}>
                  <Field label="opacity">
                    <NumberInput value={st.opacity ?? 1} step={0.05} onChange={(v) => commit(updateShape(value, shape.id, (s) => ({ ...s, style: { ...s.style, opacity: Math.min(1, Math.max(0, v)) } })))} />
                  </Field>
                  <Field label="layer">
                    <select
                      value={shape.layer ?? "back"}
                      onChange={(e) => commit(updateShape(value, shape.id, (s) => {
                        const next = { ...s };
                        if (e.target.value === "front") next.layer = "front"; else delete next.layer;
                        return next;
                      }))}
                      style={INPUT_STYLE}
                    >
                      <option value="back">back</option>
                      <option value="front">front</option>
                    </select>
                  </Field>
                </div>
              </div>
            );
          })() : null}
        </section>
      </aside>
    </div>
  );
}
