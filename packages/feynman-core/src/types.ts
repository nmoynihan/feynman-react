export type EdgeType =
  | "plain"
  | "fermion"
  | "antiFermion"
  | "scalar"
  | "ghost"
  | "photon"
  | "gluon"
  | "graviton";

export type VertexKind = "none" | "dot" | "blob" | "cross";
export type CurveType = "line" | "arc" | "quadratic";
export type ArrowDirection = "forward" | "backward" | "none";
export type LabelSide = "left" | "right";

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
}

export interface LabelStyle extends Partial<DiagramStyle> {
  color?: string;
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  kind?: VertexKind;
  label?: string;
  labelOffset?: Point;
  style?: VertexStyle;
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

export interface NormalizedDiagram {
  vertices: NormalizedVertex[];
  edges: NormalizedEdge[];
  labels: NormalizedLabel[];
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
  defs: {
    arrowMarkerId: string;
  };
}

export interface BuildSvgSceneOptions {
  samplesPerCurve?: number;
}