# Feynman SVG Monorepo

Standalone TypeScript packages for rendering Feynman diagrams as browser-native SVG, plus a thin React wrapper and a small demo app.

## Purpose

This repository provides a lightweight alternative to older browser-side diagram tools by using a clean JSON or TypeScript diagram model and deterministic SVG geometry generation.

The project is split into:

- `packages/feynman-core`: pure TypeScript, no React, responsible for types, normalization, geometry, path generation, and scene construction.
- `packages/feynman-react`: React renderer for the core scene model.
- `apps/demo`: Vite React app for manual testing and example exploration.

## Installation

```bash
npm install
```

Or use the helper script:

```bash
./run.sh install
```

Run the demo:

```bash
npm run dev
```

Or:

```bash
./run.sh
```

Build everything:

```bash
./run.sh build
```

Run tests and linting:

```bash
npm run check
```

## Data Model

The canonical representation is plain JSON or TypeScript data. The core package keeps the model explicit and suitable for later import or export layers.

```ts
type Diagram = {
  vertices: Vertex[];
  edges: Edge[];
  labels?: Label[];
  style?: DiagramStyle;
  viewBox?: { x: number; y: number; width: number; height: number };
};
```

Supported edge types in v1:

- `plain`
- `fermion`
- `antiFermion`
- `scalar`
- `ghost`
- `photon`
- `gluon`
- `graviton`

Supported edge curves in v1:

- `line`
- `arc`
- `quadratic`

Supported vertex glyphs in v1:

- `none`
- `dot`
- `blob`
- `cross`

## Public API

### `@feynman/core`

Key exports:

- `normalizeDiagram(diagram)`
- `computeEdgeGeometry(edge, vertexMap, style, options)`
- `buildSvgScene(diagram, options)`
- `serializeDiagram(diagram)`
- `parseDiagram(json)`
- `exampleDiagrams`

Example:

```ts
import { buildSvgScene } from "@feynman/core";

const scene = buildSvgScene(diagram);
```

### `@feynman/react`

Key exports:

- `FeynmanDiagramSvg`
- `FeynmanSceneSvg`
- `createSvgScene`

Example:

```tsx
import { FeynmanDiagramSvg } from "@feynman/react";

export function Example() {
  return <FeynmanDiagramSvg diagram={diagram} width={600} height={400} />;
}
```

The React API accepts a `labelRenderer` override so labels can be rendered with MathJax or another math-aware label system without changing the core package.

Math-aware labels are now supported directly in `@feynman/react` through:

- `FeynmanMathJaxProvider`
- `MathJaxSvgLabel`
- `createMathJaxLabelRenderer()`

Example:

```tsx
import { FeynmanDiagramSvg, FeynmanMathJaxProvider, createMathJaxLabelRenderer } from "@feynman/react";

const labelRenderer = createMathJaxLabelRenderer();

export function Example() {
  return (
    <FeynmanMathJaxProvider>
      <FeynmanDiagramSvg diagram={diagram} width={600} height={400} labelRenderer={labelRenderer} />
    </FeynmanMathJaxProvider>
  );
}
```

Wrap math labels in `$...$`, `$$...$$`, `\(...\)`, or `\[...\]`. Unwrapped labels are rendered as plain text through the same MathJax pipeline.

`parseDiagram` also tolerates single backslashes inside JSON strings and repairs them before parsing, so input such as `$q^\mu$` can be pasted directly into the demo editor without doubling every backslash first.

## Examples

The demo app includes built-in examples for:

1. Simple fermion exchange
2. QED-like vertex with incoming and outgoing fermions plus a photon
3. Loop-style curved propagators
4. Mixed styles with labels, momentum arrows, and different edge types

## Project Structure

```text
.
├── apps
│   └── demo
├── packages
│   ├── feynman-core
│   └── feynman-react
├── eslint.config.mjs
├── package.json
├── tsconfig.base.json
└── vitest.config.ts
```

## Current Limitations

- Manual coordinates are the primary model; there is no auto-layout engine.
- MathJax labels in the React layer are rendered through SVG `foreignObject`, which works well in modern browsers but is less portable than plain SVG text.
- The geometry aims for visually clean output rather than exhaustive notation coverage.
- There is no TikZ parser or TeX import layer yet.

## Future Extension Points

- Math-aware label rendering in the React layer
- A compact DSL inspired by TikZ-Feynman
- Import or export adapters for other diagram formats
- Additional notation features and style controls

## Development Notes

The rendering pipeline is deliberately pure:

1. Normalize the diagram and defaults.
2. Build a base curve for each edge.
3. Sample and decorate the curve into SVG path data.
4. Assemble a stable SVG scene for rendering.

That separation keeps the core reusable in other environments and makes the React package a thin convenience layer rather than the source of rendering logic.