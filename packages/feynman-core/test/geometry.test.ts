import { describe, expect, it } from "vitest";
import {
  buildCurveSampler,
  buildSvgScene,
  computeEdgeGeometry,
  exampleDiagrams,
  normalizeDiagram,
  parseDiagram,
  serializeDiagram,
  type Diagram,
  type NormalizedEdge
} from "../src";

describe("normalizeDiagram", () => {
  it("applies defaults and derives a viewBox", () => {
    const normalized = normalizeDiagram({
      vertices: [
        { id: "a", x: 10, y: 20 },
        { id: "b", x: 50, y: 60 }
      ],
      edges: [{ id: "ab", from: "a", to: "b", type: "fermion" }]
    });

    expect(normalized.edges[0]?.arrow).toBe("forward");
    expect(normalized.viewBox.width).toBeGreaterThan(0);
    expect(normalized.viewBox.height).toBeGreaterThan(0);
  });
});

describe("buildCurveSampler", () => {
  it("bends positive arcs toward negative y in SVG space", () => {
    const arc = buildCurveSampler({ x: 0, y: 0 }, { x: 100, y: 0 }, "arc", 30);
    const midpoint = arc.pointAt(0.5);

    expect(midpoint.y).toBeLessThan(0);
  });

  it("creates quadratic curves with a stable midpoint offset", () => {
    const curve = buildCurveSampler({ x: 0, y: 0 }, { x: 100, y: 0 }, "quadratic", -40);
    const midpoint = curve.pointAt(0.5);

    expect(midpoint.y).toBeGreaterThan(15);
  });

  it("samples straight lines with the requested resolution", () => {
    const line = buildCurveSampler({ x: 0, y: 0 }, { x: 100, y: 0 }, "line", 0);

    expect(line.sample(8)).toHaveLength(9);
  });
});

describe("computeEdgeGeometry", () => {
  function getEdge(diagram: Diagram, edgeId: string): { normalized: ReturnType<typeof normalizeDiagram>; edge: NormalizedEdge } {
    const normalized = normalizeDiagram(diagram);
    const edge = normalized.edges.find((item) => item.id === edgeId);

    if (!edge) {
      throw new Error(`Missing edge ${edgeId}`);
    }

    return { normalized, edge };
  }

  it("adds arrow markers for fermion edges", () => {
    const { normalized, edge } = getEdge(exampleDiagrams.moellerScattering, "in1");
    const geometry = computeEdgeGeometry(edge, normalized.vertexMap, normalized.style);
    const flowArrow = geometry.paths.find((path) => path.id.endsWith("flow-arrow"));

    expect(flowArrow?.markerEnd).toBe("url(#feynman-arrow)");
    expect(geometry.paths[0]?.markerEnd).toBeUndefined();
  });

  it("builds multiple paths for gravitons", () => {
    const diagram: Diagram = {
      vertices: [
        { id: "a", x: 0, y: 0, kind: "dot" },
        { id: "b", x: 0, y: 120, kind: "dot" }
      ],
      edges: [
        { id: "grav", from: "a", to: "b", type: "graviton" }
      ]
    };
    const { normalized, edge } = getEdge(diagram, "grav");
    const geometry = computeEdgeGeometry(edge, normalized.vertexMap, normalized.style);

    expect(geometry.paths.length).toBeGreaterThanOrEqual(2);
  });

  it("renders multi-segment photon waves on straight edges", () => {
    const { normalized, edge } = getEdge(exampleDiagrams.moellerScattering, "photon");
    const geometry = computeEdgeGeometry(edge, normalized.vertexMap, normalized.style);
    const cubicSegments = geometry.paths[0]?.d.match(/C/g) ?? [];

    expect(cubicSegments.length).toBeGreaterThan(3);
  });

  it("emits edge and momentum labels", () => {
    const diagram: Diagram = {
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 100, y: 0 }
      ],
      edges: [
        { id: "ab", from: "a", to: "b", type: "fermion", label: "e-", momentum: "p" }
      ]
    };
    const { normalized, edge } = getEdge(diagram, "ab");
    const geometry = computeEdgeGeometry(edge, normalized.vertexMap, normalized.style);

    expect(geometry.labels.map((label) => label.kind)).toEqual(["edge", "momentum"]);
  });

  it("keeps wrapped math strings intact for all label kinds", () => {
    const scene = buildSvgScene({
      vertices: [
        { id: "a", x: 0, y: 0, label: "$e^{-}$" },
        { id: "b", x: 100, y: 0 }
      ],
      edges: [
        {
          id: "ab",
          from: "a",
          to: "b",
          type: "fermion",
          label: "$q^{2}$",
          momentum: "$p_{\\mu}$"
        }
      ],
      labels: [{ id: "caption", x: 50, y: -20, text: "$\\mathcal{M}$" }]
    });

    expect(scene.labels.map((label) => label.text)).toEqual(["$q^{2}$", "$p_{\\mu}$", "$e^{-}$", "$\\mathcal{M}$"]);
  });
});

describe("buildSvgScene", () => {
  it("renders all example diagrams into scene graphs", () => {
    for (const [key, diagram] of Object.entries(exampleDiagrams)) {
      const scene = buildSvgScene(diagram);

      expect(scene.paths.length, `${key} should have paths`).toBeGreaterThan(0);
      expect(scene.labels.length, `${key} should have labels`).toBeGreaterThan(0);
    }
  });

  it("expands the auto viewBox for tall loop curves", () => {
    const scene = buildSvgScene({
      vertices: [
        { id: "v1", x: 200, y: 180, kind: "dot" },
        { id: "v2", x: 320, y: 180, kind: "dot" }
      ],
      edges: [
        { id: "upper", from: "v1", to: "v2", type: "fermion", curve: "quadratic", bend: -110 },
        { id: "lower", from: "v2", to: "v1", type: "antiFermion", curve: "quadratic", bend: -110, labelSide: "right" }
      ]
    });

    expect(scene.viewBox.y).toBeLessThan(100);
  });
});

describe("serialization", () => {
  it("round-trips diagram JSON", () => {
    const source = exampleDiagrams.moellerScattering;
    const json = serializeDiagram(source);
    const parsed = parseDiagram(json);

    expect(parsed).toEqual(source);
  });

  it("accepts single-backslash TeX commands in JSON strings", () => {
    const parsed = parseDiagram(String.raw`{
  "vertices": [{ "id": "a", "x": 0, "y": 0, "label": "$q^\mu$" }],
  "edges": [],
  "labels": [{ "id": "caption", "x": 10, "y": 10, "text": "$p_\nu$" }]
}`);

    expect(parsed.vertices[0]?.label).toBe("$q^\\mu$");
    expect(parsed.labels?.[0]?.text).toBe("$p_\\nu$");
  });
});