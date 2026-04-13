import type { Diagram } from "./types";

export const exampleDiagrams = {
  simpleExchange: {
    vertices: [
      { id: "a", x: 80, y: 120, label: "$e^{-}$", kind: "none", labelOffset: { x: -26, y: -8 } },
      { id: "b", x: 200, y: 120, kind: "dot" },
      { id: "c", x: 320, y: 120, kind: "dot" },
      { id: "d", x: 440, y: 120, label: "$e^{-}$", kind: "none", labelOffset: { x: 26, y: -8 } },
      { id: "e", x: 80, y: 260, label: "$e^{-}$", kind: "none", labelOffset: { x: -26, y: 18 } },
      { id: "f", x: 200, y: 260, kind: "dot" },
      { id: "g", x: 320, y: 260, kind: "dot" },
      { id: "h", x: 440, y: 260, label: "$e^{-}$", kind: "none", labelOffset: { x: 26, y: 18 } }
    ],
    edges: [
      { id: "ab", from: "a", to: "b", type: "fermion" },
      { id: "bc", from: "b", to: "c", type: "photon", label: "$q^\\mu$", labelSide: "left" },
      { id: "cd", from: "c", to: "d", type: "fermion" },
      { id: "ef", from: "e", to: "f", type: "fermion" },
      { id: "fg", from: "f", to: "g", type: "photon", label: "$q^\\mu$", labelSide: "right" },
      { id: "gh", from: "g", to: "h", type: "fermion" }
    ],
    style: {
      fontSize: 15
    }
  },
  qedVertex: {
    vertices: [
      { id: "left", x: 80, y: 220, label: "$e^{-}$", labelOffset: { x: -24, y: -8 } },
      { id: "mid", x: 240, y: 180, kind: "dot" },
      { id: "right", x: 420, y: 100, label: "$e^{-}$", labelOffset: { x: 24, y: -10 } },
      { id: "top", x: 420, y: 280, label: "$\\gamma$", labelOffset: { x: 22, y: 0 } }
    ],
    edges: [
      { id: "in", from: "left", to: "mid", type: "fermion", momentum: "p" },
      { id: "out", from: "mid", to: "right", type: "fermion", momentum: "p'" },
      { id: "boson", from: "mid", to: "top", type: "photon", momentum: "$k^\\mu$", momentumDirection: "backward" }
    ]
  },
  loopCurves: {
    viewBox: { x: 36, y: 12, width: 448, height: 284 },
    vertices: [
      { id: "l", x: 100, y: 180, label: "$\\psi$", labelOffset: { x: -20, y: -12 } },
      { id: "v1", x: 200, y: 180, kind: "dot" },
      { id: "v2", x: 320, y: 180, kind: "dot" },
      { id: "r", x: 420, y: 180, label: "$\\psi$", labelOffset: { x: 20, y: -12 } }
    ],
    edges: [
      { id: "in", from: "l", to: "v1", type: "fermion" },
      { id: "upper", from: "v1", to: "v2", type: "fermion", curve: "quadratic", bend: -90, label: "$\\ell$" },
      { id: "lower", from: "v2", to: "v1", type: "antiFermion", curve: "quadratic", bend: -90, label: "$\\ell-k$", labelSide: "right" },
      { id: "out", from: "v2", to: "r", type: "fermion" },
      { id: "ext", from: "v1", to: "v2", type: "photon", curve: "arc", bend: 70, momentum: "k" }
    ]
  },
  mixedStyles: {
    vertices: [
      { id: "s1", x: 90, y: 110, label: "$\\phi$", labelOffset: { x: -22, y: -8 } },
      { id: "v1", x: 200, y: 160, kind: "blob" },
      { id: "v2", x: 340, y: 160, kind: "cross" },
      { id: "s2", x: 460, y: 120, label: "g", labelOffset: { x: 22, y: -10 } },
      { id: "s3", x: 460, y: 240, label: "H", labelOffset: { x: 22, y: 16 } }
    ],
    edges: [
      { id: "scalar", from: "s1", to: "v1", type: "scalar", momentum: "p" },
      { id: "ghost", from: "v1", to: "v2", type: "ghost", curve: "arc", bend: -55, label: "c" },
      { id: "gluon", from: "v1", to: "s2", type: "gluon", curve: "quadratic", bend: -50, momentum: "$q_a$" },
      { id: "graviton", from: "v2", to: "s3", type: "graviton", curve: "quadratic", bend: 45, label: "$G_{\\mu\\nu}$" },
      { id: "plain", from: "v1", to: "s3", type: "plain", curve: "arc", bend: 90, label: "mix" }
    ],
    labels: [
      { id: "caption", x: 280, y: 40, text: "$\\mathcal{M}_{\\mathrm{mix}}$", style: { fontSize: 18 } }
    ]
  }
} satisfies Record<string, Diagram>;