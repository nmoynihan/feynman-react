import type {
  ArrowDirection,
  BuildSvgSceneOptions,
  Diagram,
  EdgeGeometry,
  NormalizedDiagram,
  NormalizedEdge,
  NormalizedShape,
  NormalizedVertex,
  Point,
  SceneHatchPattern,
  SceneLabel,
  ScenePath,
  SceneShape,
  SceneVertexGlyph,
  SvgScene,
  ViewBox
} from "./types";
import { buildCurveSampler, sampledPath, trimRange } from "./curve";
import { DEFAULT_STYLE, normalizeDiagram } from "./normalize";
import { add, formatNumber, leftNormal, scale, subtract, toPath, toSmoothPath } from "./vector";

const DEFAULT_OPTIONS: Required<BuildSvgSceneOptions> = {
  samplesPerCurve: 96
};

function resolveColor(localColor: string | undefined, fallback: string): string {
  return localColor ?? fallback;
}

function resolveStrokeWidth(edge: NormalizedEdge, diagram: NormalizedDiagram): number {
  return edge.style.strokeWidth ?? diagram.style.strokeWidth;
}

function resolveVertexRadius(vertex: NormalizedVertex, diagram: NormalizedDiagram): number {
  // Explicit per-vertex size takes top priority
  if (vertex.size !== undefined) {
    return vertex.size;
  }

  if (vertex.kind === "blob") {
    return vertex.style.blobRadius ?? diagram.style.blobRadius;
  }

  return vertex.style.vertexRadius ?? diagram.style.vertexRadius;
}

function trimInset(vertex: NormalizedVertex, diagram: NormalizedDiagram): number {
  if (vertex.kind === "none") {
    return 0;
  }

  if (vertex.kind === "hook") {
    return 0;
  }

  if (vertex.kind === "cross") {
    // vertex.size overrides crossSize for the cross glyph as well
    const crossSz = vertex.size !== undefined ? vertex.size : (vertex.style.crossSize ?? diagram.style.crossSize);
    return crossSz * 0.8;
  }

  return resolveVertexRadius(vertex, diagram) + diagram.style.strokeWidth * 0.6;
}

function edgeSegments(edge: NormalizedEdge, options: Required<BuildSvgSceneOptions>): number {
  if (edge.curve === "line" && (edge.type === "plain" || edge.type === "fermion" || edge.type === "antiFermion" || edge.type === "scalar" || edge.type === "ghost")) {
    return 1;
  }

  return options.samplesPerCurve;
}

function waveCycles(lengthEstimate: number, wavelength: number): number {
  return Math.max(1, Math.round(lengthEstimate / Math.max(wavelength, 1)));
}

interface WaveGeometry {
  points: Point[];
  d: string;
}

function buildWaveGeometry(
  points: Point[],
  normals: Point[],
  tangents: Point[],
  visibleLength: number,
  amplitude: number,
  cycles: number,
  trackOffset = 0
): WaveGeometry {
  if (points.length < 2) {
    return { points, d: toPath(points) };
  }

  const count = points.length - 1;
  const omega = Math.PI * 2 * cycles;
  const displacedPoints = points.map((point, index) => {
    const phase = (index / count) * omega;
    const normal = normals[index] ?? { x: 0, y: 0 };
    return add(point, scale(normal, trackOffset + amplitude * Math.sin(phase)));
  });
  const derivatives = tangents.map((tangent, index) => {
    const phase = (index / count) * omega;
    const normal = normals[index] ?? { x: 0, y: 0 };
    return add(scale(tangent, visibleLength), scale(normal, amplitude * omega * Math.cos(phase)));
  });
  const commands = [`M ${formatNumber(displacedPoints[0]!.x)} ${formatNumber(displacedPoints[0]!.y)}`];
  const dt = 1 / count;

  for (let index = 0; index < count; index += 1) {
    const start = displacedPoints[index]!;
    const end = displacedPoints[index + 1]!;
    const startDerivative = derivatives[index]!;
    const endDerivative = derivatives[index + 1]!;
    const control1 = add(start, scale(startDerivative, dt / 3));
    const control2 = subtract(end, scale(endDerivative, dt / 3));

    commands.push(
      `C ${formatNumber(control1.x)} ${formatNumber(control1.y)} ${formatNumber(control2.x)} ${formatNumber(control2.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`
    );
  }

  return {
    points: displacedPoints,
    d: commands.join(" ")
  };
}

function buildPhotonPath(
  points: Point[],
  normals: Point[],
  tangents: Point[],
  visibleLength: number,
  amplitude: number,
  cycles: number,
  trackOffset = 0
): WaveGeometry {
  return buildWaveGeometry(points, normals, tangents, visibleLength, amplitude, cycles, trackOffset);
}

function buildGluonPoints(points: Point[], normals: Point[], tangents: Point[], amplitude: number, cycles: number): Point[] {
  return points.map((point, index) => {
    const phase = (index / Math.max(points.length - 1, 1)) * Math.PI * 2 * cycles;
    const normalOffset = Math.sin(phase) * amplitude;
    const tangentOffset = Math.cos(phase) * amplitude * 0.55;
    return add(add(point, scale(normals[index] ?? { x: 0, y: 0 }, normalOffset)), scale(tangents[index] ?? { x: 0, y: 0 }, tangentOffset));
  });
}

function buildGluonPath(
  points: Point[],
  normals: Point[],
  tangents: Point[],
  amplitude: number,
  cycles: number
): string {
  return toSmoothPath(buildGluonPoints(points, normals, tangents, amplitude, cycles));
}

function buildArrowPath(id: string, points: Point[], markerId: string, stroke: string, strokeWidth: number): ScenePath | null {
  if (points.length < 2) {
    return null;
  }

  return {
    id,
    d: toPath(points),
    stroke,
    strokeWidth: Math.max(1.2, strokeWidth * 0.75),
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    markerEnd: `url(#${markerId})`
  };
}

function createScenePath(
  base: Pick<ScenePath, "id" | "d" | "stroke" | "strokeWidth" | "fill"> & {
    strokeDasharray?: string | undefined;
    strokeLinecap?: ScenePath["strokeLinecap"] | undefined;
    strokeLinejoin?: ScenePath["strokeLinejoin"] | undefined;
    markerStart?: string | undefined;
    markerEnd?: string | undefined;
    opacity?: number | undefined;
  }
): ScenePath {
  const path: ScenePath = {
    id: base.id,
    d: base.d,
    stroke: base.stroke,
    strokeWidth: base.strokeWidth,
    fill: base.fill
  };

  if (base.strokeDasharray) {
    path.strokeDasharray = base.strokeDasharray;
  }

  if (base.strokeLinecap) {
    path.strokeLinecap = base.strokeLinecap;
  }

  if (base.strokeLinejoin) {
    path.strokeLinejoin = base.strokeLinejoin;
  }

  if (base.markerStart) {
    path.markerStart = base.markerStart;
  }

  if (base.markerEnd) {
    path.markerEnd = base.markerEnd;
  }

  if (base.opacity !== undefined) {
    path.opacity = base.opacity;
  }

  return path;
}

function arrowSegment(midpoint: Point, tangent: Point, direction: ArrowDirection, length: number): Point[] | null {
  if (direction === "none") {
    return null;
  }

  const half = scale(tangent, length / 2);

  if (direction === "backward") {
    return [add(midpoint, half), subtract(midpoint, half)];
  }

  return [subtract(midpoint, half), add(midpoint, half)];
}

function sampleWithFrame(
  edge: NormalizedEdge,
  start: Point,
  end: Point,
  startInset: number,
  endInset: number,
  options: Required<BuildSvgSceneOptions>
): {
  points: Point[];
  tangents: Point[];
  normals: Point[];
  midpoint: Point;
  midpointTangent: Point;
  midpointNormal: Point;
  samplerLength: number;
  visibleLength: number;
  tStart: number;
  tEnd: number;
} {
  const sampler = buildCurveSampler(start, end, edge.curve, edge.bend);
  const { tStart, tEnd } = trimRange(sampler.lengthEstimate, startInset, endInset);
  const segments = Math.max(edgeSegments(edge, options), 8);
  const points = sampler.sample(segments, tStart, tEnd);
  const tangents = points.map((_, index) => {
    const t = tStart + (tEnd - tStart) * (index / Math.max(points.length - 1, 1));
    return sampler.tangentAt(t);
  });
  const normals = tangents.map((tangent) => leftNormal(tangent));
  const tMid = (tStart + tEnd) / 2;

  return {
    points,
    tangents,
    normals,
    midpoint: sampler.pointAt(tMid),
    midpointTangent: sampler.tangentAt(tMid),
    midpointNormal: sampler.normalAt(tMid),
    samplerLength: sampler.lengthEstimate,
    visibleLength: sampler.lengthEstimate * (tEnd - tStart),
    tStart,
    tEnd
  };
}

function labelDirection(edge: NormalizedEdge): number {
  return edge.labelSide === "right" ? -1 : 1;
}

function buildEdgeLabels(
  edge: NormalizedEdge,
  diagram: NormalizedDiagram,
  midpoint: Point,
  midpointNormal: Point,
  markerId: string,
  stroke: string,
  strokeWidth: number,
  sample: { points: Point[]; tStart: number; tEnd: number; tangents: Point[] }
): { labels: SceneLabel[]; extraPaths: ScenePath[] } {
  const labels: SceneLabel[] = [];
  const extraPaths: ScenePath[] = [];
  const fontSize = edge.style.fontSize ?? diagram.style.fontSize;
  const color = resolveColor(edge.style.color, diagram.style.color);
  const direction = labelDirection(edge);

  if (edge.label) {
    const labelPoint = add(midpoint, scale(midpointNormal, edge.labelOffset * direction));
    labels.push({
      id: `${edge.id}-label`,
      x: labelPoint.x,
      y: labelPoint.y,
      text: edge.label,
      kind: "edge",
      color,
      fontSize,
      fontFamily: edge.style.fontFamily ?? diagram.style.fontFamily,
      textAnchor: "middle"
    });
  }

  if (edge.momentum) {
    const offset = (edge.style.momentumOffset ?? diagram.style.momentumOffset) * -direction;
    const labelPoint = add(midpoint, scale(midpointNormal, offset));
    labels.push({
      id: `${edge.id}-momentum`,
      x: labelPoint.x,
      y: labelPoint.y,
      text: edge.momentum,
      kind: "momentum",
      color,
      fontSize: Math.max(fontSize - 1, 11),
      fontFamily: edge.style.fontFamily ?? diagram.style.fontFamily,
      textAnchor: "middle"
    });

    const centerIndex = Math.floor(sample.points.length / 2);
    const arrowOffset = add(sample.points[centerIndex] ?? midpoint, scale(midpointNormal, offset - 8 * Math.sign(offset || 1)));
    const tangent = sample.tangents[centerIndex] ?? { x: 1, y: 0 };
    const arrowPath = buildArrowPath(
      `${edge.id}-momentum-arrow`,
      arrowSegment(arrowOffset, tangent, edge.momentumDirection, 36) ?? [],
      markerId,
      stroke,
      strokeWidth
    );

    if (arrowPath) {
      extraPaths.push(arrowPath);
    }
  }

  return { labels, extraPaths };
}

function edgeDashArray(edge: NormalizedEdge, diagram: NormalizedDiagram): string | undefined {
  if (edge.style.dashArray) {
    return edge.style.dashArray;
  }

  if (edge.type === "scalar") {
    return `${diagram.style.strokeWidth * 4} ${diagram.style.strokeWidth * 3}`;
  }

  if (edge.type === "ghost") {
    return `${diagram.style.strokeWidth} ${diagram.style.strokeWidth * 3.5}`;
  }

  return undefined;
}

function computeAutoViewBox(diagram: Diagram, normalized: NormalizedDiagram, options: Required<BuildSvgSceneOptions>): ViewBox {
  if (diagram.viewBox) {
    return diagram.viewBox;
  }

  const points: Point[] = [];
  const padding = 56;

  for (const vertex of normalized.vertices) {
    points.push({ x: vertex.x, y: vertex.y });

    if (vertex.label) {
      points.push(add(vertex, vertex.labelOffset));
    }
  }

  for (const label of normalized.labels) {
    points.push({ x: label.x, y: label.y });
  }

  // Include shape bounding boxes
  for (const shape of normalized.shapes) {
    points.push({ x: shape.x - shape.rx, y: shape.y - shape.ry });
    points.push({ x: shape.x + shape.rx, y: shape.y + shape.ry });
  }

  for (const edge of normalized.edges) {
    const fromVertex = normalized.vertexMap.get(edge.from);
    const toVertex = normalized.vertexMap.get(edge.to);

    if (!fromVertex || !toVertex) {
      continue;
    }

    const startInset = trimInset(fromVertex, normalized);
    const endInset = trimInset(toVertex, normalized);
    const sample = sampleWithFrame(edge, fromVertex, toVertex, startInset, endInset, options);
    const wavelength = edge.style.photonWavelength ?? normalized.style.photonWavelength;
    const photonAmplitude = edge.style.photonAmplitude ?? normalized.style.photonAmplitude;
    const gluonAmplitude = edge.style.gluonAmplitude ?? normalized.style.gluonAmplitude;
    const gluonWavelength = edge.style.gluonWavelength ?? normalized.style.gluonWavelength;

    if (edge.type === "photon") {
      points.push(...buildPhotonPath(sample.points, sample.normals, sample.tangents, sample.visibleLength, photonAmplitude, waveCycles(sample.visibleLength, wavelength)).points);
    } else if (edge.type === "gluon") {
      points.push(...buildGluonPoints(sample.points, sample.normals, sample.tangents, gluonAmplitude, waveCycles(sample.visibleLength, gluonWavelength)));
    } else if (edge.type === "graviton") {
      const separation = edge.style.gravitonSeparation ?? normalized.style.gravitonSeparation;
      const cycles = waveCycles(sample.visibleLength, wavelength);
      points.push(...buildPhotonPath(sample.points, sample.normals, sample.tangents, sample.visibleLength, photonAmplitude * 0.9, cycles, separation / 2).points);
      points.push(...buildPhotonPath(sample.points, sample.normals, sample.tangents, sample.visibleLength, photonAmplitude * 0.9, cycles, -separation / 2).points);
    } else {
      points.push(...sample.points);
    }

    if (edge.arrow !== "none") {
      points.push(...(arrowSegment(sample.midpoint, sample.midpointTangent, edge.arrow, 20) ?? []));
    }

    if (edge.label) {
      points.push(add(sample.midpoint, scale(sample.midpointNormal, edge.labelOffset * labelDirection(edge))));
    }

    if (edge.momentum) {
      const offset = (edge.style.momentumOffset ?? normalized.style.momentumOffset) * -labelDirection(edge);
      const momentumPoint = add(sample.midpoint, scale(sample.midpointNormal, offset));
      points.push(momentumPoint);
      points.push(...(arrowSegment(add(momentumPoint, scale(sample.midpointNormal, -8 * Math.sign(offset || 1))), sample.midpointTangent, edge.momentumDirection, 36) ?? []));
    }
  }

  if (points.length === 0) {
    return normalized.viewBox;
  }

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

/**
 * Compute SVG-ready geometry for a single edge without any React dependency.
 */
export function computeEdgeGeometry(
  edge: NormalizedEdge,
  vertexMap: Map<string, NormalizedVertex>,
  diagramStyle: NormalizedDiagram["style"],
  options: BuildSvgSceneOptions = {}
): EdgeGeometry {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const fromVertex = vertexMap.get(edge.from);
  const toVertex = vertexMap.get(edge.to);

  if (!fromVertex || !toVertex) {
    throw new Error(`Missing vertices for edge ${edge.id}`);
  }

  const normalizedDiagram = {
    style: diagramStyle,
    vertexMap,
    vertices: [],
    edges: [],
    labels: [],
    shapes: [],
    viewBox: { x: 0, y: 0, width: 0, height: 0 }
  } as NormalizedDiagram;
  const startInset = trimInset(fromVertex, normalizedDiagram);
  const endInset = trimInset(toVertex, normalizedDiagram);
  const sample = sampleWithFrame(edge, fromVertex, toVertex, startInset, endInset, resolvedOptions);
  const color = resolveColor(edge.style.color, diagramStyle.color);
  const strokeWidth = resolveStrokeWidth(edge, normalizedDiagram);
  const markerId = "feynman-arrow";
  const baseSampler = buildCurveSampler(fromVertex, toVertex, edge.curve, edge.bend);
  const basePath = createScenePath({
    id: edge.id,
    d: sampledPath(baseSampler, edgeSegments(edge, resolvedOptions), sample.tStart, sample.tEnd),
    stroke: color,
    strokeWidth,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    opacity: edge.style.opacity,
    strokeDasharray: edgeDashArray(edge, normalizedDiagram)
  });

  if (edge.type === "photon") {
    const wavelength = edge.style.photonWavelength ?? diagramStyle.photonWavelength;
    const amplitude = edge.style.photonAmplitude ?? diagramStyle.photonAmplitude;
    basePath.d = buildPhotonPath(
      sample.points,
      sample.normals,
      sample.tangents,
      sample.visibleLength,
      amplitude,
      waveCycles(sample.visibleLength, wavelength)
    ).d;
  }

  if (edge.type === "gluon") {
    const wavelength = edge.style.gluonWavelength ?? diagramStyle.gluonWavelength;
    const amplitude = edge.style.gluonAmplitude ?? diagramStyle.gluonAmplitude;
    basePath.d = buildGluonPath(sample.points, sample.normals, sample.tangents, amplitude, waveCycles(sample.visibleLength, wavelength));
  }

  const paths: ScenePath[] = [basePath];

  if (edge.arrow !== "none") {
    const arrowPath = buildArrowPath(
      `${edge.id}-flow-arrow`,
      arrowSegment(sample.midpoint, sample.midpointTangent, edge.arrow, 20) ?? [],
      markerId,
      color,
      strokeWidth
    );

    if (arrowPath) {
      paths.push(arrowPath);
    }
  }

  if (edge.type === "graviton") {
    const wavelength = edge.style.photonWavelength ?? diagramStyle.photonWavelength;
    const amplitude = edge.style.photonAmplitude ?? diagramStyle.photonAmplitude * 0.9;
    const separation = edge.style.gravitonSeparation ?? diagramStyle.gravitonSeparation;
    const cycles = waveCycles(sample.visibleLength, wavelength);
    paths[0] = createScenePath({
      ...basePath,
      d: buildPhotonPath(sample.points, sample.normals, sample.tangents, sample.visibleLength, amplitude, cycles, separation / 2).d,
    });
    paths.push(createScenePath({
      ...basePath,
      id: `${edge.id}-secondary`,
      d: buildPhotonPath(sample.points, sample.normals, sample.tangents, sample.visibleLength, amplitude, cycles, -separation / 2).d,
      markerStart: basePath.markerStart,
      markerEnd: basePath.markerEnd
    }));
  }

  const labelBundle = buildEdgeLabels(edge, normalizedDiagram, sample.midpoint, sample.midpointNormal, markerId, color, strokeWidth, sample);

  return {
    id: edge.id,
    paths: [...paths, ...labelBundle.extraPaths],
    labels: labelBundle.labels
  };
}

function buildVertexGlyph(
  vertex: NormalizedVertex,
  diagram: NormalizedDiagram,
  hatchPatterns: SceneHatchPattern[]
): SceneVertexGlyph | null {
  if (vertex.kind === "none") {
    return null;
  }

  const stroke = vertex.style.stroke ?? diagram.style.color;
  const strokeWidth = vertex.style.strokeWidth ?? diagram.style.strokeWidth;
  const radius = resolveVertexRadius(vertex, diagram);
  // vertex.size also overrides crossSize for cross vertices
  const crossSize = vertex.size !== undefined ? vertex.size : (vertex.style.crossSize ?? diagram.style.crossSize);

  if (vertex.kind === "hook") {
    return {
      id: vertex.id,
      kind: "hook",
      x: vertex.x,
      y: vertex.y,
      radius,
      stroke,
      strokeWidth,
      fill: "none",
      crossSize
    };
  }

  if (vertex.kind === "blob") {
    const fillStyle = vertex.style.fillStyle ?? "solid";
    let fill = "none";
    let hatchPatternId: string | undefined;
    let backgroundFill: string | undefined;

    if (fillStyle === "solid") {
      fill = vertex.style.fill ?? diagram.style.color;
    } else if (fillStyle === "outline") {
      fill = "none";
    } else if (fillStyle === "dashed") {
      fill = "none";
    } else if (fillStyle === "hatch") {
      hatchPatternId = `hatch-blob-${vertex.id}`;
      hatchPatterns.push({
        id: hatchPatternId,
        angle: 45,
        spacing: 8,
        stroke: stroke,
        strokeWidth: Math.max(0.8, strokeWidth * 0.5)
      });
      fill = `url(#${hatchPatternId})`;
      if (vertex.style.backgroundFill) {
        backgroundFill = vertex.style.backgroundFill;
      }
    }

    const glyph: SceneVertexGlyph = {
      id: vertex.id,
      kind: "blob",
      x: vertex.x,
      y: vertex.y,
      radius,
      stroke,
      strokeWidth,
      fill,
      crossSize,
      fillStyle
    };
    if (hatchPatternId !== undefined) glyph.hatchPatternId = hatchPatternId;
    if (backgroundFill !== undefined) glyph.backgroundFill = backgroundFill;
    if (vertex.layer !== undefined) glyph.layer = vertex.layer;
    return glyph;
  }

  const fill = vertex.style.fill ?? (vertex.kind === "cross" ? "none" : diagram.style.color);
  const glyph: SceneVertexGlyph = {
    id: vertex.id,
    kind: vertex.kind,
    x: vertex.x,
    y: vertex.y,
    radius,
    stroke,
    strokeWidth,
    fill,
    crossSize
  };
  if (vertex.layer !== undefined) glyph.layer = vertex.layer;
  return glyph;
}

function buildVertexLabel(vertex: NormalizedVertex, diagram: NormalizedDiagram): SceneLabel | null {
  if (!vertex.label) {
    return null;
  }

  const color = vertex.style.color ?? diagram.style.color;
  const fontSize = vertex.style.fontSize ?? diagram.style.fontSize;
  const point = add(vertex, vertex.labelOffset);

  return {
    id: `${vertex.id}-label`,
    x: point.x,
    y: point.y,
    text: vertex.label,
    kind: "vertex",
    color,
    fontSize,
    fontFamily: vertex.style.fontFamily ?? diagram.style.fontFamily,
    textAnchor: "middle"
  };
}

/** Build a SceneShape (and optional hatch pattern) from a normalized shape. */
function buildSceneShape(
  shape: NormalizedShape,
  diagramColor: string,
  diagramStrokeWidth: number,
  hatchPatterns: SceneHatchPattern[]
): SceneShape {
  const s = shape.style;
  const stroke = s.stroke || diagramColor;
  const sw = s.strokeWidth || diagramStrokeWidth;
  const fillStyle = s.fillStyle;

  let fill = "none";
  let strokeDasharray: string | undefined;
  let hatchPatternId: string | undefined;

  if (fillStyle === "solid") {
    fill = s.fill || diagramColor;
  } else if (fillStyle === "outline") {
    fill = "none";
  } else if (fillStyle === "dashed") {
    fill = "none";
    strokeDasharray = `${sw * 4} ${sw * 3}`;
  } else if (fillStyle === "hatch") {
    // Build a unique hatch pattern for this shape's parameters
    hatchPatternId = `hatch-${shape.id}`;
    hatchPatterns.push({
      id: hatchPatternId,
      angle: s.hatchAngle,
      spacing: s.hatchSpacing,
      stroke: s.stroke || diagramColor,
      strokeWidth: Math.max(0.8, sw * 0.5)
    });
    fill = `url(#${hatchPatternId})`;
    // also draw border
  }

  const result: SceneShape = {
    id: shape.id,
    kind: shape.kind,
    x: shape.x,
    y: shape.y,
    rx: shape.rx,
    ry: shape.ry,
    fill,
    stroke,
    strokeWidth: sw,
    fillStyle
  };
  if (strokeDasharray !== undefined) result.strokeDasharray = strokeDasharray;
  if (hatchPatternId !== undefined) result.hatchPatternId = hatchPatternId;
  if (s.opacity !== 1) result.opacity = s.opacity;
  if (s.backgroundFill) result.backgroundFill = s.backgroundFill;
  if (shape.layer !== undefined) result.layer = shape.layer;
  return result;
}

/**
 * Build a full SVG scene graph from a diagram description.
 */
export function buildSvgScene(diagram: Diagram, options: BuildSvgSceneOptions = {}): SvgScene {
  const normalized = normalizeDiagram(diagram);
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const paths: ScenePath[] = [];
  const labels: SceneLabel[] = [];

  for (const edge of normalized.edges) {
    const geometry = computeEdgeGeometry(edge, normalized.vertexMap, normalized.style, options);
    paths.push(...geometry.paths);
    labels.push(...geometry.labels);
  }

  labels.push(
    ...normalized.vertices
      .map((vertex) => buildVertexLabel(vertex, normalized))
      .filter((label): label is SceneLabel => label !== null)
  );

  labels.push(
    ...normalized.labels.map<SceneLabel>((label) => ({
      id: label.id,
      x: label.x,
      y: label.y,
      text: label.text,
      kind: "standalone",
      color: label.style.color ?? normalized.style.color,
      fontSize: label.style.fontSize ?? normalized.style.fontSize,
      fontFamily: label.style.fontFamily ?? normalized.style.fontFamily,
      textAnchor: "middle"
    }))
  );

  // Build shapes and hatch patterns (shapes first so blob vertex IDs don't collide)
  const hatchPatterns: SceneHatchPattern[] = [];
  const shapes: SceneShape[] = normalized.shapes.map((shape) =>
    buildSceneShape(shape, normalized.style.color, normalized.style.strokeWidth, hatchPatterns)
  );

  const vertices = normalized.vertices
    .map((vertex) => buildVertexGlyph(vertex, normalized, hatchPatterns))
    .filter((vertex): vertex is SceneVertexGlyph => vertex !== null);

  return {
    viewBox: computeAutoViewBox(diagram, normalized, resolvedOptions),
    style: normalized.style,
    paths,
    vertices,
    labels,
    shapes,
    defs: {
      arrowMarkerId: "feynman-arrow",
      hatchPatterns
    }
  };
}

export function buildDefaultStyle() {
  return { ...DEFAULT_STYLE };
}
