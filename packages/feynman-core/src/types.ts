export type EdgeType =
  | "plain"
  | "fermion"
  | "antiFermion"
  | "scalar"
  | "ghost"
  | "photon"
  | "gluon"
  | "graviton";

export type VertexKind = "none" | "dot" | "blob" | "cross" | "hook";
export type CurveType = "line" | "arc" | "quadratic";
export type ArrowDirection = "forward" | "backward" | "none";
export type LabelSide = "left" | "right";

/** Fill style for shapes. */
export type ShapeFillStyle = "solid" | "outline" | "dashed" | "hatch";

/** Supported shape primitives. */
export type ShapeKind = "circle" | "ellipse";

export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramStyle {
  color?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  vertexRadius?: number;
  blobRadius?: number;
  crossSize?: number;
  labelOffset?: number;
  momentumOffset?: number;
  photonAmplitude?: number;
  photonWavelength?: number;
  gluonAmplitude?: number;
  gluonWavelength?: number;
  gravitonSeparation?: number;
}

export interface EdgeStyle extends Partial<DiagramStyle> {
  dashArray?: string;
  opacity?: number;
}

export interface VertexStyle extends Partial<DiagramStyle> {
  fill?: string;
  stroke?: string;
  /** Fill style for blob vertices (solid/outline/dashed/hatch). Default "solid". */
  fillStyle?: ShapeFillStyle;
  /** Optional solid background fill drawn beneath the hatch (blob vertices with fillStyle==="hatch"). */
  backgroundFill?: string;
}

export interface LabelStyle extends Partial<DiagramStyle> {
  color?: string;
}

/** Style options for diagram shapes (circle / ellipse). */
export interface ShapeStyle {
  /** How the interior is filled. Defaults to "solid". */
  fillStyle?: ShapeFillStyle;
  /** Fill colour (CSS colour string). Defaults to the diagram colour. */
  fill?: string;
  /** Stroke colour. Defaults to the diagram colour. */
  stroke?: string;
  /** Stroke width in diagram units. Defaults to the diagram strokeWidth. */
  strokeWidth?: number;
  /** Overall opacity 0-1. */
  opacity?: number;
  /** Hatch line angle in degrees (used when fillStyle === "hatch"). Default 45. */
  hatchAngle?: number;
  /** Spacing between hatch lines in diagram units (used when fillStyle === "hatch"). Default 8. */
  hatchSpacing?: number;
  /** Optional solid background fill drawn beneath the hatch pattern (used when fillStyle === "hatch"). */
  backgroundFill?: string;
}

/** A shape item stored in a diagram's canonical JSON. */
export interface DiagramShape {
  id: string;
  kind: ShapeKind;
  /** Centre x in diagram units. */
  x: number;
  /** Centre y in diagram units. */
  y: number;
  /** Horizontal radius (and the only radius for a circle). */
  rx: number;
  /** Vertical radius (for ellipses; defaults to rx). */
  ry?: number;
  style?: ShapeStyle;
  /** Render layer: "back" renders before edges (default), "front" renders after vertex glyphs. */
  layer?: "back" | "front";
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  kind?: VertexKind;
  /**
   * Radius of the vertex glyph in diagram units.
   * Overrides the diagram-level vertexRadius / blobRadius / crossSize when set.
   */
  size?: number;
  label?: string;
  labelOffset?: Point;
  style?: VertexStyle;
  /** Render layer for blob vertices: "back" draws before edges, "front" (default) draws after. */
  layer?: "back" | "front";
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  curve?: CurveType;
  bend?: number;
  label?: string;
  labelOffset?: number;
  labelSide?: LabelSide;
  momentum?: string;
  momentumDirection?: ArrowDirection;
  arrow?: ArrowDirection;
  style?: EdgeStyle;
}

export interface Label {
  id: string;
  x: number;
  y: number;
  text: string;
  style?: LabelStyle;
}

export interface Diagram {
  vertices: Vertex[];
  edges: Edge[];
  labels?: Label[];
  /** Freeform shapes (circles, ellipses) placed on the canvas. */
  shapes?: DiagramShape[];
  style?: DiagramStyle;
  viewBox?: ViewBox;
}

export interface NormalizedVertex extends Vertex {
  kind: VertexKind;
  labelOffset: Point;
  style: VertexStyle;
}

export interface NormalizedEdge extends Edge {
  curve: CurveType;
  bend: number;
  arrow: ArrowDirection;
  momentumDirection: ArrowDirection;
  labelOffset: number;
  labelSide: LabelSide;
  style: EdgeStyle;
}

export interface NormalizedLabel extends Label {
  style: LabelStyle;
}

/** Shape with all optional fields resolved to concrete values. */
export interface NormalizedShape extends DiagramShape {
  /** Vertical radius always present after normalization (= rx for circles). */
  ry: number;
  style: Required<ShapeStyle>;
}

export interface NormalizedDiagram {
  vertices: NormalizedVertex[];
  edges: NormalizedEdge[];
  labels: NormalizedLabel[];
  shapes: NormalizedShape[];
  style: Required<DiagramStyle>;
  viewBox: ViewBox;
  vertexMap: Map<string, NormalizedVertex>;
}

export interface ScenePath {
  id: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  strokeDasharray?: string;
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "miter" | "bevel";
  markerStart?: string;
  markerEnd?: string;
  opacity?: number;
}

export type SceneLabelKind = "edge" | "momentum" | "vertex" | "standalone";

export interface SceneLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: SceneLabelKind;
  color: string;
  fontSize: number;
  fontFamily: string;
  textAnchor: "start" | "middle" | "end";
}

export interface SceneVertexGlyph {
  id: string;
  kind: Exclude<VertexKind, "none">;
  x: number;
  y: number;
  radius: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  crossSize: number;
  /** Optional hatch pattern id (url reference). Only present on blob with fillStyle="hatch". */
  hatchPatternId?: string;
  /** For blob vertices: the fill style being used. */
  fillStyle?: ShapeFillStyle;
  /** For blob vertices with hatch: optional solid background fill. */
  backgroundFill?: string;
  /** Render layer: "back" draws before edges, "front" (default) draws after paths. */
  layer?: "back" | "front";
}

/** A hatch pattern definition to be emitted into SVG <defs>. */
export interface SceneHatchPattern {
  /** Unique id used in fill="url(#id)" references. */
  id: string;
  angle: number;
  spacing: number;
  stroke: string;
  strokeWidth: number;
}

/** A resolved shape ready to be rendered as SVG. */
export interface SceneShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  fillStyle: ShapeFillStyle;
  /** Reference to a hatch pattern id in SvgScene.defs.hatchPatterns (only when fillStyle==="hatch"). */
  hatchPatternId?: string;
  opacity?: number;
  /** Optional solid background fill rendered beneath the hatch pattern. */
  backgroundFill?: string;
  /** Render layer: "back" (default) draws before edges, "front" draws after vertex glyphs. */
  layer?: "back" | "front";
}

export interface EdgeGeometry {
  id: string;
  paths: ScenePath[];
  labels: SceneLabel[];
}

export interface SvgScene {
  viewBox: ViewBox;
  style: Required<DiagramStyle>;
  paths: ScenePath[];
  vertices: SceneVertexGlyph[];
  labels: SceneLabel[];
  shapes: SceneShape[];
  defs: {
    arrowMarkerId: string;
    hatchPatterns: SceneHatchPattern[];
  };
}

export interface BuildSvgSceneOptions {
  samplesPerCurve?: number;
}
