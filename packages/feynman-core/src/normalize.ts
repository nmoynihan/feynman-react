import type {
  Diagram,
  DiagramShape,
  DiagramStyle,
  Edge,
  NormalizedDiagram,
  NormalizedEdge,
  NormalizedLabel,
  NormalizedShape,
  NormalizedVertex,
  ShapeStyle,
  ViewBox
} from "./types";

export const DEFAULT_STYLE: Required<DiagramStyle> = {
  color: "currentColor",
  strokeWidth: 2.2,
  fontSize: 16,
  fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
  vertexRadius: 4,
  blobRadius: 10,
  crossSize: 8,
  labelOffset: 18,
  momentumOffset: 28,
  photonAmplitude: 6,
  photonWavelength: 22,
  gluonAmplitude: 7,
  gluonWavelength: 18,
  gravitonSeparation: 5
};

const DEFAULT_SHAPE_STYLE: Required<ShapeStyle> = {
  fillStyle: "solid",
  fill: "",          // empty = use diagram color
  stroke: "",        // empty = use diagram color
  strokeWidth: 0,    // 0 = use diagram strokeWidth
  opacity: 1,
  hatchAngle: 45,
  hatchSpacing: 8
};

function computeViewBox(diagram: Diagram): ViewBox {
  if (diagram.viewBox) {
    return diagram.viewBox;
  }

  const points = [
    ...diagram.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
    ...(diagram.labels ?? []).map((label) => ({ x: label.x, y: label.y }))
  ];

  if (points.length === 0) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  const padding = 48;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function defaultArrow(edge: Edge): NormalizedEdge["arrow"] {
  if (edge.arrow) {
    return edge.arrow;
  }

  if (edge.type === "fermion") {
    return "forward";
  }

  if (edge.type === "antiFermion") {
    return "backward";
  }

  if (edge.type === "ghost") {
    return "forward";
  }

  return "none";
}

function normalizeEdge(edge: Edge, style: Required<DiagramStyle>): NormalizedEdge {
  const bend = edge.bend ?? 0;

  return {
    ...edge,
    curve: edge.curve ?? (bend !== 0 ? "arc" : "line"),
    bend,
    arrow: defaultArrow(edge),
    momentumDirection: edge.momentumDirection ?? "forward",
    labelOffset: edge.labelOffset ?? style.labelOffset,
    labelSide: edge.labelSide ?? (bend < 0 ? "right" : "left"),
    style: {
      ...edge.style
    }
  };
}

function normalizeShape(shape: DiagramShape): NormalizedShape {
  const s = shape.style ?? {};
  return {
    ...shape,
    ry: shape.ry ?? shape.rx,
    style: {
      fillStyle: s.fillStyle ?? DEFAULT_SHAPE_STYLE.fillStyle,
      fill: s.fill ?? DEFAULT_SHAPE_STYLE.fill,
      stroke: s.stroke ?? DEFAULT_SHAPE_STYLE.stroke,
      strokeWidth: s.strokeWidth ?? DEFAULT_SHAPE_STYLE.strokeWidth,
      opacity: s.opacity ?? DEFAULT_SHAPE_STYLE.opacity,
      hatchAngle: s.hatchAngle ?? DEFAULT_SHAPE_STYLE.hatchAngle,
      hatchSpacing: s.hatchSpacing ?? DEFAULT_SHAPE_STYLE.hatchSpacing
    }
  };
}

export function normalizeDiagram(diagram: Diagram): NormalizedDiagram {
  const style: Required<DiagramStyle> = {
    ...DEFAULT_STYLE,
    ...diagram.style
  };

  const vertexMap = new Map<string, NormalizedVertex>();
  const seenVertexIds = new Set<string>();
  const vertices = diagram.vertices.map<NormalizedVertex>((vertex) => {
    if (seenVertexIds.has(vertex.id)) {
      throw new Error(`Duplicate vertex id: ${vertex.id}`);
    }

    seenVertexIds.add(vertex.id);

    const normalizedVertex: NormalizedVertex = {
      ...vertex,
      kind: vertex.kind ?? "none",
      labelOffset: vertex.labelOffset ?? { x: 0, y: -style.fontSize },
      style: {
        ...vertex.style
      }
    };

    vertexMap.set(vertex.id, normalizedVertex);
    return normalizedVertex;
  });

  const seenEdgeIds = new Set<string>();
  const edges = diagram.edges.map((edge) => {
    if (seenEdgeIds.has(edge.id)) {
      throw new Error(`Duplicate edge id: ${edge.id}`);
    }

    if (!vertexMap.has(edge.from) || !vertexMap.has(edge.to)) {
      throw new Error(`Edge ${edge.id} references missing vertices`);
    }

    seenEdgeIds.add(edge.id);
    return normalizeEdge(edge, style);
  });

  const seenLabelIds = new Set<string>();
  const labels = (diagram.labels ?? []).map<NormalizedLabel>((label) => {
    if (seenLabelIds.has(label.id)) {
      throw new Error(`Duplicate label id: ${label.id}`);
    }

    seenLabelIds.add(label.id);

    return {
      ...label,
      style: {
        ...label.style
      }
    };
  });

  const seenShapeIds = new Set<string>();
  const shapes = (diagram.shapes ?? []).map<NormalizedShape>((shape) => {
    if (seenShapeIds.has(shape.id)) {
      throw new Error(`Duplicate shape id: ${shape.id}`);
    }

    seenShapeIds.add(shape.id);
    return normalizeShape(shape);
  });

  return {
    vertices,
    edges,
    labels,
    shapes,
    style,
    viewBox: computeViewBox(diagram),
    vertexMap
  };
}


