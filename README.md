# Feynman SVG Monorepo

Standalone TypeScript packages for rendering Feynman diagrams as browser-native SVG, plus a thin React wrapper and a small demo app.

## Purpose

This repository provides a lightweight alternative to older browser-side diagram tools by using a clean JSON or TypeScript diagram model and deterministic SVG geometry generation.

The project is split into:

- `packages/feynman-core`: pure TypeScript, no React, responsible for types, normalisation, geometry, path generation, and scene construction.
- `packages/feynman-react`: React renderer for the core scene model, with optional MathJax label support.
- `packages/feynman-editor`: fully featured drag-and-drop React editor built on top of the two packages above.
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

- `buildSvgScene(diagram, options?)` — main entry point; returns a `SvgScene` ready for rendering
- `normalizeDiagram(diagram)` — applies defaults and normalises the data model
- `computeEdgeGeometry(edge, vertexMap, style, options)` — low-level geometry for a single edge
- `serializeDiagram(diagram)` — serialise to a JSON string
- `parseDiagram(json)` — parse from a JSON string (tolerates single-backslash TeX in strings)
- `exampleDiagrams` — six built-in example diagrams
- `DEFAULT_STYLE` — the default diagram style object
- Full TypeScript types: `Diagram`, `Vertex`, `Edge`, `Label`, `EdgeType`, `VertexKind`, `CurveType`, `ArrowDirection`, `ViewBox`, `SvgScene`, …

```ts
import { buildSvgScene, serializeDiagram, parseDiagram, exampleDiagrams } from "@feynman/core";

const scene = buildSvgScene(diagram);
const json  = serializeDiagram(diagram);
const back  = parseDiagram(json);
```

### `@feynman/editor`

`FeynmanDiagramEditor` is a fully featured, fully controlled React component — a visual drag-and-drop editor that emits a canonical `Diagram` object on every change.

#### Install

```bash
npm install @feynman/editor
```

Because `@feynman/editor` depends on `@feynman/core` and `@feynman/react`, install all three (or add them as workspace packages):

```bash
npm install @feynman/core @feynman/react @feynman/editor
```

#### Basic usage

```tsx
import { useState } from "react";
import { parseDiagram, exampleDiagrams } from "@feynman/core";
import { FeynmanDiagramEditor } from "@feynman/editor";

export function MyPage() {
  const [diagram, setDiagram] = useState(() =>
    parseDiagram(JSON.stringify(exampleDiagrams.moellerScattering))
  );

  return (
    <div style={{ height: 680 }}>
      <FeynmanDiagramEditor
        value={diagram}
        onChange={setDiagram}
        width="100%"
        height="100%"
        title="My diagram"
      />
    </div>
  );
}
```

The component is **fully controlled**: it never mutates the diagram itself — every user action calls `onChange` with a fresh `Diagram` value.

#### With MathJax labels

Wrap the editor in `FeynmanMathJaxProvider` and pass a `labelRenderer` to render `$...$` / `\(...\)` math labels using MathJax:

```tsx
import { FeynmanDiagramEditor } from "@feynman/editor";
import { FeynmanMathJaxProvider, createMathJaxLabelRenderer } from "@feynman/react";
import { useMemo } from "react";

const labelRenderer = createMathJaxLabelRenderer();

export function EditorWithMath() {
  const [diagram, setDiagram] = useState(/* ... */);

  return (
    <FeynmanMathJaxProvider>
      <FeynmanDiagramEditor
        value={diagram}
        onChange={setDiagram}
        width="100%"
        height="100%"
        labelRenderer={labelRenderer}
      />
    </FeynmanMathJaxProvider>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Diagram` | — | The current diagram (controlled) |
| `onChange` | `(diagram: Diagram) => void` | — | Called on every edit |
| `width` | `number \| string` | `900` | CSS width of the editor shell |
| `height` | `number \| string` | `600` | CSS height of the editor shell |
| `title` | `string` | — | Display title; also used as the SVG `<title>` and the exported filename |
| `sceneOptions` | `BuildSvgSceneOptions` | — | Passed through to `buildSvgScene` (controls stroke widths, arrow sizes, etc.) |
| `labelRenderer` | `(ctx: LabelRenderContext) => ReactNode` | — | Custom label renderer, e.g. `createMathJaxLabelRenderer()` |
| `style` | `CSSProperties` | — | Extra inline styles merged onto the root element |
| `className` | `string` | — | Extra class name on the root element |

#### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `V` | Select mode |
| `A` | Add vertex mode |
| `E` | Add edge mode |
| `L` | Add label mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+D` | Duplicate selected item |
| `Delete` / `Backspace` | Delete selected item(s) |
| `Escape` | Deselect / cancel |
| `Shift+click` | Add vertex to multi-selection |

Drag on empty canvas in Select mode to draw a marquee and select multiple vertices at once.

#### Serializing the diagram

Use `serializeDiagram` / `parseDiagram` from `@feynman/core` to convert to and from JSON:

```ts
import { serializeDiagram, parseDiagram } from "@feynman/core";

// To JSON string
const json = serializeDiagram(diagram);

// From JSON string
const diagram = parseDiagram(json);
```

---

### `@feynman/react`

Key exports:

- `FeynmanDiagramSvg` — render a `Diagram` directly as an SVG element
- `FeynmanSceneSvg` — render a pre-built `SvgScene` (lower level)
- `FeynmanMathJaxProvider` — context provider that loads MathJax
- `MathJaxSvgLabel` — renders a single label using MathJax
- `createMathJaxLabelRenderer()` — returns a `labelRenderer` function for use with `FeynmanDiagramSvg` or `FeynmanDiagramEditor`

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

The demo app and `exampleDiagrams` export include six built-in diagrams:

1. **Møller scattering** — e⁻e⁻ → e⁻e⁻ via t-channel virtual photon
2. **Pair annihilation** — e⁺e⁻ → μ⁺μ⁻ via s-channel virtual photon
3. **Compton scattering** — e⁻γ → e⁻γ with momentum labels at both vertices
4. **Vacuum polarisation** — photon self-energy with an electron–positron loop
5. **Higgs gluon fusion** — gg → H through a top-quark triangle loop
6. **Vertex correction** — one-loop QED correction contributing to g − 2

## Project Structure

```text
.
├── apps
│   └── demo
├── packages
│   ├── feynman-core
│   ├── feynman-editor
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
- The editor's Export SVG embeds MathJax-rendered label SVG inline; environments without MathJax loaded fall back to plain SVG text.

## Future Extension Points

- Auto-layout engine (force-directed or TikZ-Feynman-style)
- A compact DSL inspired by TikZ-Feynman
- Import / export adapters for other diagram formats
- Additional notation features (crossed propagators, blobs, counter-term marks)
- Multi-diagram canvas

## Development Notes

The rendering pipeline is deliberately pure:

1. Normalize the diagram and defaults.
2. Build a base curve for each edge.
3. Sample and decorate the curve into SVG path data.
4. Assemble a stable SVG scene for rendering.

That separation keeps the core reusable in other environments and makes the React package a thin convenience layer rather than the source of rendering logic.