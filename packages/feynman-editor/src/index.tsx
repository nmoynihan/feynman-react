import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  buildSvgScene,
  type ArrowDirection,
  type BuildSvgSceneOptions,
  type CurveType,
  type Diagram,
  type Edge,
  type EdgeType,
  type Label,
  type Point,
  type ScenePath,
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
  Edge,
  EdgeType,
  Label,
  Point,
  Vertex,
  VertexKind,
  ViewBox
} from "@feynman/core";
export type { LabelRenderContext } from "@feynman/react";

type EditorMode = "select" | "add-vertex" | "add-edge" | "add-label";
type Selection =
  | { kind: "vertex"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "label"; id: string }
  | null;
type DragState =
  | { kind: "vertex"; id: string; pointerId: number; origin: Point; start: Point }
  | { kind: "label"; id: string; pointerId: number; origin: Point; start: Point }
  | null;

const EDGE_TYPE_OPTIONS: EdgeType[] = ["plain", "fermion", "antiFermion", "scalar", "ghost", "photon", "gluon", "graviton"];
const VERTEX_KIND_OPTIONS: VertexKind[] = ["none", "dot", "blob", "cross"];
const CURVE_OPTIONS: CurveType[] = ["line", "arc", "quadratic"];
const ARROW_OPTIONS: Array<{ value: "auto" | ArrowDirection; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "none", label: "None" }
];

const ROOT_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  border: "1px solid rgba(26, 37, 47, 0.14)",
  borderRadius: 24,
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(255, 253, 248, 0.96), rgba(248, 241, 230, 0.92))",
  boxShadow: "0 26px 70px rgba(59, 44, 30, 0.14)"
};

const CANVAS_PANEL_STYLE: CSSProperties = {
  position: "relative",
  minWidth: 0,
  minHeight: 0,
  background:
    "radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 26%), radial-gradient(circle at 90% 18%, rgba(195, 87, 42, 0.16), transparent 22%), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(254, 249, 240, 0.96))"
};

const SIDEBAR_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: 16,
  borderLeft: "1px solid rgba(26, 37, 47, 0.12)",
  background: "linear-gradient(180deg, rgba(255, 250, 244, 0.96), rgba(255, 247, 236, 0.92))"
};

const HEADER_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid rgba(26, 37, 47, 0.12)",
  background: "rgba(255, 252, 247, 0.78)",
  backdropFilter: "blur(8px)"
};

const TOOLBAR_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center"
};

const BUTTON_STYLE: CSSProperties = {
  border: "1px solid rgba(26, 37, 47, 0.12)",
  background: "rgba(255, 255, 255, 0.72)",
  color: "#1f2430",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer"
};

const ACTIVE_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: "rgba(195, 87, 42, 0.16)",
  borderColor: "rgba(195, 87, 42, 0.34)",
  color: "#8f3d1b"
};

const PANEL_STYLE: CSSProperties = {
  border: "1px solid rgba(26, 37, 47, 0.1)",
  borderRadius: 18,
  padding: 14,
  background: "rgba(255, 255, 255, 0.56)"
};

const FIELD_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(26, 37, 47, 0.14)",
  padding: "9px 10px",
  background: "rgba(255, 255, 255, 0.9)",
  color: "#1f2430"
};

const LABEL_STYLE: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  color: "#5f6570",
  fontWeight: 600
};

const CANVAS_SURFACE_STYLE: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: 420
};

const STATUS_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderTop: "1px solid rgba(26, 37, 47, 0.12)",
  color: "#5f6570",
  fontSize: 12,
  background: "rgba(255, 252, 247, 0.84)"
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

function pointerToDiagramPoint(event: PointerEvent, element: SVGSVGElement, viewBox: ViewBox): Point {
  const rect = element.getBoundingClientRect();
  const x = viewBox.x + ((event.clientX - rect.left) / Math.max(rect.width, 1)) * viewBox.width;
  const y = viewBox.y + ((event.clientY - rect.top) / Math.max(rect.height, 1)) * viewBox.height;
  return { x, y };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
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

  return withOptionalLabels(diagram, (diagram.labels ?? []).filter((label) => label.id !== selection.id));
}

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
  const [mode, setMode] = useState<EditorMode>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [edgeDraftPoint, setEdgeDraftPoint] = useState<Point | null>(null);
  const [newVertexKind, setNewVertexKind] = useState<VertexKind>("dot");
  const [newEdgeType, setNewEdgeType] = useState<EdgeType>("fermion");
  const gridId = useId();
  const autoScene = useMemo(() => buildSvgScene(value, sceneOptions), [value, sceneOptions]);
  const [viewport, setViewport] = useState<ViewBox>(() => expandViewBox(autoScene.viewBox, 48));

  latestDiagramRef.current = value;
  latestViewportRef.current = viewport;
  latestOnChangeRef.current = onChange;

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

  useEffect(() => {
    if (!selection) {
      return;
    }

    if (selection.kind === "vertex" && !value.vertices.some((vertex) => vertex.id === selection.id)) {
      setSelection(null);
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

  useEffect(() => {
    if (mode !== "add-edge") {
      setEdgeSourceId(null);
      setEdgeDraftPoint(null);
    }
  }, [mode]);

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

      if (activeDrag.kind === "vertex") {
        latestOnChangeRef.current(
          updateVertex(currentDiagram, activeDrag.id, (vertex) => ({
            ...vertex,
            x: roundCoordinate(activeDrag.start.x + dx),
            y: roundCoordinate(activeDrag.start.y + dy)
          }))
        );
        return;
      }

      latestOnChangeRef.current(
        updateLabel(currentDiagram, activeDrag.id, (label) => ({
          ...label,
          x: roundCoordinate(activeDrag.start.x + dx),
          y: roundCoordinate(activeDrag.start.y + dy)
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

  const scene = useMemo(() => ({ ...autoScene, viewBox: viewport }), [autoScene, viewport]);
  const activeLabelRenderer = dragState ? undefined : labelRenderer;
  const selectedVertex = selection?.kind === "vertex" ? value.vertices.find((vertex) => vertex.id === selection.id) ?? null : null;
  const selectedEdge = selection?.kind === "edge" ? value.edges.find((edge) => edge.id === selection.id) ?? null : null;
  const selectedLabel = selection?.kind === "label" ? (value.labels ?? []).find((label) => label.id === selection.id) ?? null : null;
  const currentModeHint =
    mode === "add-vertex"
      ? `Click the canvas to place ${newVertexKind} vertices.`
      : mode === "add-label"
        ? "Click the canvas to add standalone labels."
        : mode === "add-edge"
          ? edgeSourceId
            ? `Connect ${edgeSourceId} to another vertex to add a ${newEdgeType} edge.`
            : `Pick a source vertex for the next ${newEdgeType} edge.`
          : selection
            ? `Selected ${selection.kind} ${selection.id}. Drag handles or edit fields in the inspector.`
            : "Select, drag, and inspect items. Delete removes the current selection.";

  function commit(nextDiagram: Diagram) {
    onChange(nextDiagram);
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!overlayRef.current || mode !== "add-edge" || !edgeSourceId) {
      return;
    }

    setEdgeDraftPoint(pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport));
  }

  function handleCanvasClick(event: ReactPointerEvent<SVGSVGElement>) {
    if (!overlayRef.current) {
      return;
    }

    const point = pointerToDiagramPoint(event.nativeEvent, overlayRef.current, viewport);

    if (mode === "add-vertex") {
      const { diagram: nextDiagram, vertexId } = appendVertex(value, point);
      commit(nextDiagram);
      setSelection({ kind: "vertex", id: vertexId });
      return;
    }

    if (mode === "add-label") {
      const labelId = createId((value.labels ?? []).map((label) => label.id), "label");
      commit(
        withOptionalLabels(value, [
          ...(value.labels ?? []),
          {
            id: labelId,
            x: roundCoordinate(point.x),
            y: roundCoordinate(point.y),
            text: "Label"
          }
        ])
      );
      setSelection({ kind: "label", id: labelId });
      return;
    }

    if (mode === "add-edge") {
      if (!edgeSourceId) {
        const { diagram: nextDiagram, vertexId } = appendVertex(value, point);
        commit(nextDiagram);
        setEdgeSourceId(vertexId);
        setSelection({ kind: "vertex", id: vertexId });
        return;
      }

      const withTarget = appendVertex(value, point);
      const withEdge = appendEdge(withTarget.diagram, edgeSourceId, withTarget.vertexId);
      commit(withEdge.diagram);
      setSelection({ kind: "edge", id: withEdge.edgeId });
      setEdgeSourceId(null);
      return;
    }

    setSelection(null);
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
    setSelection({ kind: "vertex", id: vertex.id });
    setDragState({ kind: "vertex", id: vertex.id, pointerId: event.pointerId, origin: point, start: { x: vertex.x, y: vertex.y } });
  }

  function handleVertexClick(vertex: Vertex) {

    if (mode === "add-edge") {
      if (!edgeSourceId) {
        setEdgeSourceId(vertex.id);
        setSelection({ kind: "vertex", id: vertex.id });
        return;
      }

      if (edgeSourceId === vertex.id) {
        setEdgeSourceId(null);
        setEdgeDraftPoint(null);
        return;
      }

      const { diagram: nextDiagram, edgeId } = appendEdge(value, edgeSourceId, vertex.id);
      commit(nextDiagram);
      setEdgeSourceId(null);
      setEdgeDraftPoint(null);
      setSelection({ kind: "edge", id: edgeId });
      return;
    }

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
    setSelection({ kind: "label", id: label.id });
    setDragState({ kind: "label", id: label.id, pointerId: event.pointerId, origin: point, start: { x: label.x, y: label.y } });
  }

  function handleEdgeClick(edgeId: string) {
    if (mode === "select") {
      setSelection({ kind: "edge", id: edgeId });
    }
  }

  function handleDeleteSelection() {
    if (!selection) {
      return;
    }

    commit(removeSelected(value, selection));
    setSelection(null);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Backspace" || event.key === "Delete") && selection) {
      event.preventDefault();
      handleDeleteSelection();
      return;
    }

    if (event.key === "Escape") {
      setSelection(null);
      setMode("select");
      setEdgeSourceId(null);
      setEdgeDraftPoint(null);
    }
  }

  const surfaceStyle: CSSProperties = {
    ...ROOT_STYLE,
    width: toDimension(width, 900),
    height: toDimension(height, 600),
    ...(style ?? {})
  };

  return (
    <div className={className} style={surfaceStyle} onKeyDown={handleKeyDown} tabIndex={0}>
      <div style={CANVAS_PANEL_STYLE}>
        <div style={HEADER_STYLE}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0f766e", fontWeight: 700 }}>
              Visual editor
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: "#1f2430" }}>{title ?? "Feynman diagram editor"}</div>
          </div>

          <div style={TOOLBAR_STYLE}>
            <button type="button" style={mode === "select" ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE} onClick={() => setMode("select")}>
              Select
            </button>
            <button type="button" style={mode === "add-vertex" ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE} onClick={() => setMode("add-vertex")}>
              Add vertex
            </button>
            <button type="button" style={mode === "add-edge" ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE} onClick={() => setMode("add-edge")}>
              Add edge
            </button>
            <button type="button" style={mode === "add-label" ? ACTIVE_BUTTON_STYLE : BUTTON_STYLE} onClick={() => setMode("add-label")}>
              Add label
            </button>
            <button type="button" style={BUTTON_STYLE} onClick={() => setViewport((current) => zoomViewBox(current, 0.85))}>
              Zoom in
            </button>
            <button type="button" style={BUTTON_STYLE} onClick={() => setViewport((current) => zoomViewBox(current, 1.18))}>
              Zoom out
            </button>
            <button type="button" style={BUTTON_STYLE} onClick={() => setViewport(expandViewBox(autoScene.viewBox, 48))}>
              Fit
            </button>
          </div>
        </div>

        <div style={CANVAS_SURFACE_STYLE}>
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
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: mode === "select" ? "default" : "crosshair" }}
            onClick={handleCanvasClick}
            onPointerMove={handleCanvasPointerMove}
            aria-hidden="true"
          >
            <defs>
              <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(31, 36, 48, 0.06)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height} fill={`url(#${gridId})`} />

            {selection?.kind === "edge"
              ? getEdgePaths(scene.paths, selection.id).map((path) => (
                  <path
                    key={`highlight-${path.id}`}
                    d={path.d}
                    fill="none"
                    stroke="rgba(195, 87, 42, 0.42)"
                    strokeWidth={Math.max(path.strokeWidth + 7, 8)}
                    strokeLinecap={path.strokeLinecap}
                    strokeLinejoin={path.strokeLinejoin}
                  />
                ))
              : null}

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

            {value.vertices.map((vertex) => {
              const isSelected = selection?.kind === "vertex" && selection.id === vertex.id;
              return (
                <g key={vertex.id}>
                  {isSelected ? <circle cx={vertex.x} cy={vertex.y} r={16} fill="rgba(15, 118, 110, 0.12)" stroke="rgba(15, 118, 110, 0.6)" strokeWidth="2" /> : null}
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r={7}
                    fill={isSelected ? "#0f766e" : "rgba(255, 255, 255, 0.95)"}
                    stroke={isSelected ? "#0f766e" : "#1f2430"}
                    strokeWidth="2"
                    onPointerDown={(event) => handleVertexPointerDown(event, vertex)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleVertexClick(vertex);
                    }}
                  />
                </g>
              );
            })}

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
                  fill={isSelected ? "rgba(15, 118, 110, 0.14)" : "transparent"}
                  stroke={isSelected ? "rgba(15, 118, 110, 0.55)" : "transparent"}
                  strokeWidth="2"
                  onPointerDown={(event) => handleLabelPointerDown(event, label)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelection({ kind: "label", id: label.id });
                  }}
                />
              );
            })}

            {mode === "add-edge" && edgeSourceId && edgeDraftPoint
              ? (() => {
                  const source = value.vertices.find((vertex) => vertex.id === edgeSourceId);
                  if (!source) {
                    return null;
                  }
                  return <line x1={source.x} y1={source.y} x2={edgeDraftPoint.x} y2={edgeDraftPoint.y} stroke="rgba(195, 87, 42, 0.7)" strokeWidth="2.5" strokeDasharray="8 6" />;
                })()
              : null}
          </svg>
        </div>

        <div style={STATUS_STYLE}>
          <span>{currentModeHint}</span>
          <span>
            {value.vertices.length} vertices · {value.edges.length} edges · {(value.labels ?? []).length} labels
          </span>
        </div>
      </div>

      <aside style={SIDEBAR_STYLE}>
        <section style={PANEL_STYLE}>
          <div style={{ marginBottom: 10, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0f766e", fontWeight: 700 }}>Tool defaults</div>
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
              <div style={{ marginBottom: 4, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0f766e", fontWeight: 700 }}>Inspector</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2430" }}>
                {selection ? `${selection.kind}: ${selection.id}` : "No selection"}
              </div>
            </div>
            {selection ? (
              <button type="button" style={{ ...BUTTON_STYLE, color: "#8f2d17" }} onClick={handleDeleteSelection}>
                Delete
              </button>
            ) : null}
          </div>

          {!selection ? (
            <div style={{ display: "grid", gap: 12, color: "#5f6570", lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>This editor stays fully controlled: every drag or form edit emits a fresh canonical Diagram object through onChange.</p>
              <p style={{ margin: 0 }}>Use the mode buttons to add vertices, connect them with edges, and place freeform labels. JSON and visual edits can stay in sync in the host app.</p>
            </div>
          ) : null}

          {selectedVertex ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={FIELD_GRID_STYLE}>
                <Field label="x">
                  <NumberInput value={selectedVertex.x} step={1} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, x: nextValue })))} />
                </Field>
                <Field label="y">
                  <NumberInput value={selectedVertex.y} step={1} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, y: nextValue })))} />
                </Field>
              </div>

              <Field label="kind">
                <SelectInput value={selectedVertex.kind ?? "none"} options={VERTEX_KIND_OPTIONS} onChange={(nextValue) => commit(updateVertex(value, selectedVertex.id, (vertex) => ({ ...vertex, kind: nextValue })))} />
              </Field>

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
            </div>
          ) : null}

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

              <div style={FIELD_GRID_STYLE}>
                <Field label="type">
                  <SelectInput value={selectedEdge.type} options={EDGE_TYPE_OPTIONS} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, type: nextValue })))} />
                </Field>
                <Field label="curve">
                  <SelectInput value={selectedEdge.curve ?? "line"} options={CURVE_OPTIONS} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, curve: nextValue })))} />
                </Field>
              </div>

              <div style={FIELD_GRID_STYLE}>
                <Field label="bend">
                  <NumberInput value={selectedEdge.bend ?? 0} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, bend: nextValue })))} />
                </Field>
                <Field label="label offset">
                  <NumberInput value={selectedEdge.labelOffset ?? 18} onChange={(nextValue) => commit(updateEdge(value, selectedEdge.id, (edge) => ({ ...edge, labelOffset: nextValue })))} />
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
          ) : null}

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
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}