import type { CSSProperties, ComponentProps, ReactNode, SVGProps } from "react";
import { MathJax, MathJaxContext } from "better-react-mathjax";
import {
  buildSvgScene,
  type BuildSvgSceneOptions,
  type Diagram,
  type SceneHatchPattern,
  type SceneLabel,
  type ScenePath,
  type SceneShape,
  type SceneVertexGlyph,
  type SvgScene
} from "@feynman/core";

export type {
  BuildSvgSceneOptions,
  Diagram,
  SceneHatchPattern,
  SceneLabel,
  ScenePath,
  SceneShape,
  SceneVertexGlyph,
  SvgScene
} from "@feynman/core";

export interface LabelRenderContext {
  label: SceneLabel;
  defaultElement: ReactNode;
}

export interface MathJaxLabelRendererOptions {
  containerStyle?: CSSProperties;
  paddingX?: number;
  paddingY?: number;
  widthMultiplier?: number;
  heightMultiplier?: number;
}

export interface MathJaxSvgLabelProps {
  label: SceneLabel;
  fallback?: ReactNode | undefined;
  options?: MathJaxLabelRendererOptions | undefined;
}

export interface FeynmanMathJaxProviderProps {
  children: ReactNode;
  config?: ComponentProps<typeof MathJaxContext>["config"];
}

export interface FeynmanDiagramSvgProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  diagram: Diagram;
  width?: number | string;
  height?: number | string;
  title?: string;
  sceneOptions?: BuildSvgSceneOptions;
  svgStyle?: CSSProperties;
  labelRenderer?: (context: LabelRenderContext) => ReactNode;
}

export interface FeynmanSceneSvgProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  scene: SvgScene;
  width?: number | string;
  height?: number | string;
  title?: string;
  svgStyle?: CSSProperties;
  labelRenderer?: (context: LabelRenderContext) => ReactNode;
}

function DefaultLabel({ label }: { label: SceneLabel }) {
  return (
    <text
      x={label.x}
      y={label.y}
      fill={label.color}
      fontSize={label.fontSize}
      fontFamily={label.fontFamily}
      textAnchor={label.textAnchor}
      dominantBaseline="middle"
      data-kind={label.kind}
    >
      {label.text}
    </text>
  );
}

const DEFAULT_MATHJAX_OPTIONS: Required<Omit<MathJaxLabelRendererOptions, "containerStyle">> = {
  paddingX: 8,
  paddingY: 6,
  widthMultiplier: 0.82,
  heightMultiplier: 2
};

const DEFAULT_MATHJAX_CONFIG: NonNullable<ComponentProps<typeof MathJaxContext>["config"]> = {
  // No loader: tex-svg.js bundles both input/tex and output/svg natively.
  tex: {
    inlineMath: [["\\(", "\\)"], ["$", "$"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]]
  },
  svg: {
    fontCache: "none"
  }
};

function unwrapMath(text: string): string | null {
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

function escapeTextForMathJax(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}#$%&_])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\n/g, "\\\\ ");
}

function toMathJaxMarkup(text: string): string {
  const wrappedMath = unwrapMath(text);

  if (wrappedMath !== null) {
    return text.trim();
  }

  return `\\(\\text{${escapeTextForMathJax(text)}}\\)`;
}

function justifyContent(textAnchor: SceneLabel["textAnchor"]): CSSProperties["justifyContent"] {
  if (textAnchor === "start") {
    return "flex-start";
  }

  if (textAnchor === "end") {
    return "flex-end";
  }

  return "center";
}

function anchorOffset(textAnchor: SceneLabel["textAnchor"], width: number): number {
  if (textAnchor === "start") {
    return 0;
  }

  if (textAnchor === "end") {
    return -width;
  }

  return -width / 2;
}

function estimateMathBox(label: SceneLabel, options?: MathJaxLabelRendererOptions): { width: number; height: number } {
  const resolved = { ...DEFAULT_MATHJAX_OPTIONS, ...options };
  const measurableText = (unwrapMath(label.text) ?? label.text)
    .replace(/\\[a-zA-Z]+/g, "MM")
    .replace(/[{}_^]/g, "")
    .length;

  return {
    width: Math.max(label.fontSize * 2.2, measurableText * label.fontSize * resolved.widthMultiplier + resolved.paddingX * 2),
    height: label.fontSize * resolved.heightMultiplier + resolved.paddingY * 2
  };
}

export function FeynmanMathJaxProvider({ children, config }: FeynmanMathJaxProviderProps) {
  return (
    <MathJaxContext
      src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
      config={{ ...DEFAULT_MATHJAX_CONFIG, ...config }}
    >
      {children}
    </MathJaxContext>
  );
}

export function MathJaxSvgLabel({ label, fallback, options }: MathJaxSvgLabelProps) {
  if (!label.text.trim()) {
    return <>{fallback ?? <DefaultLabel label={label} />}</>;
  }

  const resolved = { ...DEFAULT_MATHJAX_OPTIONS, ...options };
  const box = estimateMathBox(label, options);
  const x = label.x + anchorOffset(label.textAnchor, box.width);
  const y = label.y - box.height / 2;

  return (
    <foreignObject x={x} y={y} width={box.width} height={box.height} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div
        style={{
          width: `${box.width}px`,
          height: `${box.height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: justifyContent(label.textAnchor),
          color: label.color,
          fontSize: `${label.fontSize}px`,
          lineHeight: 1,
          overflow: "visible",
          whiteSpace: "nowrap",
          padding: `${resolved.paddingY}px ${resolved.paddingX}px`,
          ...options?.containerStyle
        }}
      >
        <MathJax inline dynamic>
          {toMathJaxMarkup(label.text)}
        </MathJax>
      </div>
    </foreignObject>
  );
}

export function createMathJaxLabelRenderer(options?: MathJaxLabelRendererOptions) {
  return function renderMathJaxLabel({ label, defaultElement }: LabelRenderContext) {
    return <MathJaxSvgLabel label={label} fallback={defaultElement} {...(options ? { options } : {})} />;
  };
}

function RenderPath({ path }: { path: ScenePath }) {
  return (
    <path
      d={path.d}
      stroke={path.stroke}
      strokeWidth={path.strokeWidth}
      fill={path.fill}
      strokeDasharray={path.strokeDasharray}
      strokeLinecap={path.strokeLinecap}
      strokeLinejoin={path.strokeLinejoin}
      markerStart={path.markerStart}
      markerEnd={path.markerEnd}
      opacity={path.opacity}
    />
  );
}

function RenderVertex({ vertex }: { vertex: SceneVertexGlyph }) {
  if (vertex.kind === "cross") {
    return (
      <g stroke={vertex.stroke} strokeWidth={vertex.strokeWidth} strokeLinecap="round">
        <line x1={vertex.x - vertex.crossSize} y1={vertex.y - vertex.crossSize} x2={vertex.x + vertex.crossSize} y2={vertex.y + vertex.crossSize} />
        <line x1={vertex.x - vertex.crossSize} y1={vertex.y + vertex.crossSize} x2={vertex.x + vertex.crossSize} y2={vertex.y - vertex.crossSize} />
      </g>
    );
  }

  return (
    <circle
      cx={vertex.x}
      cy={vertex.y}
      r={vertex.radius}
      fill={vertex.fill}
      stroke={vertex.stroke}
      strokeWidth={vertex.kind === "dot" ? 0 : vertex.strokeWidth}
    />
  );
}

/** Render SVG <pattern> elements for hatch fills. */
function RenderHatchPattern({ pattern }: { pattern: SceneHatchPattern }) {
  // We rotate the pattern tile to achieve arbitrary angles.
  // The tile is a simple diagonal line within a square cell.
  const s = pattern.spacing;
  // Use a rotated 1×1 cell pattern
  const angle = pattern.angle;
  const transform = `rotate(${angle})`;
  return (
    <pattern
      id={pattern.id}
      width={s}
      height={s}
      patternUnits="userSpaceOnUse"
      patternTransform={transform}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={s}
        stroke={pattern.stroke}
        strokeWidth={pattern.strokeWidth}
      />
    </pattern>
  );
}

function RenderShape({ shape }: { shape: SceneShape }) {
  const sharedProps = {
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeDasharray: shape.strokeDasharray,
    opacity: shape.opacity
  };

  if (shape.kind === "circle") {
    return <circle cx={shape.x} cy={shape.y} r={shape.rx} {...sharedProps} />;
  }

  return <ellipse cx={shape.x} cy={shape.y} rx={shape.rx} ry={shape.ry} {...sharedProps} />;
}

function renderLabel(label: SceneLabel, labelRenderer?: (context: LabelRenderContext) => ReactNode) {
  const defaultElement = <DefaultLabel label={label} />;
  if (!labelRenderer) {
    return defaultElement;
  }

  return labelRenderer({ label, defaultElement });
}

export function FeynmanSceneSvg({
  scene,
  width = "100%",
  height = "100%",
  title,
  svgStyle,
  labelRenderer,
  preserveAspectRatio = "xMidYMid meet",
  ...svgProps
}: FeynmanSceneSvgProps) {
  const { viewBox } = scene;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio={preserveAspectRatio}
      style={svgStyle}
      role="img"
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <marker
          id={scene.defs.arrowMarkerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
        {scene.defs.hatchPatterns.map((pattern) => (
          <RenderHatchPattern key={pattern.id} pattern={pattern} />
        ))}
      </defs>

      {/* Shapes render behind paths and vertices */}
      <g>
        {scene.shapes.map((shape) => (
          <RenderShape key={shape.id} shape={shape} />
        ))}
      </g>

      <g>
        {scene.paths.map((path) => (
          <RenderPath key={path.id} path={path} />
        ))}
      </g>

      <g>
        {scene.vertices.map((vertex) => (
          <RenderVertex key={vertex.id} vertex={vertex} />
        ))}
      </g>

      <g>
        {scene.labels.map((label) => (
          <g key={label.id}>{renderLabel(label, labelRenderer)}</g>
        ))}
      </g>
    </svg>
  );
}

export function FeynmanDiagramSvg({ diagram, sceneOptions, ...props }: FeynmanDiagramSvgProps) {
  const scene = buildSvgScene(diagram, sceneOptions);
  return <FeynmanSceneSvg scene={scene} {...props} />;
}

export function createSvgScene(diagram: Diagram, options?: BuildSvgSceneOptions): SvgScene {
  return buildSvgScene(diagram, options);
}
