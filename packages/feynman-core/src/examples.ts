import type { Diagram } from "./types";

export const exampleDiagrams = {
  /**
   * Møller scattering: e⁻e⁻ → e⁻e⁻ via single virtual photon (t-channel).
   */
  moellerScattering: {
    vertices: [
      { id: "i1", x: 80, y: 80, label: "$e^{-}$", kind: "none", labelOffset: { x: -24, y: -8 } },
      { id: "v1", x: 260, y: 80, kind: "dot" },
      { id: "o1", x: 440, y: 80, label: "$e^{-}$", kind: "none", labelOffset: { x: 24, y: -8 } },
      { id: "i2", x: 80, y: 260, label: "$e^{-}$", kind: "none", labelOffset: { x: -24, y: 18 } },
      { id: "v2", x: 260, y: 260, kind: "dot" },
      { id: "o2", x: 440, y: 260, label: "$e^{-}$", kind: "none", labelOffset: { x: 24, y: 18 } }
    ],
    edges: [
      { id: "in1", from: "i1", to: "v1", type: "fermion", momentum: "$p_1$" },
      { id: "out1", from: "v1", to: "o1", type: "fermion", momentum: "$p_1'$" },
      { id: "photon", from: "v1", to: "v2", type: "photon", label: "$\\gamma$" },
      { id: "in2", from: "i2", to: "v2", type: "fermion", momentum: "$p_2$" },
      { id: "out2", from: "v2", to: "o2", type: "fermion", momentum: "$p_2'$" }
    ]
  },

  /**
   * Pair annihilation: e⁺e⁻ → μ⁺μ⁻ via s-channel virtual photon.
   */
  pairAnnihilation: {
    vertices: [
      { id: "i1", x: 80, y: 80, label: "$e^{-}$", kind: "none", labelOffset: { x: -24, y: -8 } },
      { id: "i2", x: 80, y: 260, label: "$e^{+}$", kind: "none", labelOffset: { x: -24, y: 18 } },
      { id: "v1", x: 230, y: 170, kind: "dot" },
      { id: "v2", x: 370, y: 170, kind: "dot" },
      { id: "o1", x: 520, y: 80, label: "$\\mu^{-}$", kind: "none", labelOffset: { x: 28, y: -8 } },
      { id: "o2", x: 520, y: 260, label: "$\\mu^{+}$", kind: "none", labelOffset: { x: 28, y: 18 } }
    ],
    edges: [
      { id: "e-in", from: "i1", to: "v1", type: "fermion" },
      { id: "e+in", from: "i2", to: "v1", type: "antiFermion" },
      { id: "gamma", from: "v1", to: "v2", type: "photon", label: "$\\gamma^{*}$" },
      { id: "mu-out", from: "v2", to: "o1", type: "fermion" },
      { id: "mu+out", from: "v2", to: "o2", type: "antiFermion" }
    ]
  },

  /**
   * Compton scattering: e⁻γ → e⁻γ (s-channel).
   * Electron absorbs a photon, propagates, then emits a photon.
   */
  comptonScattering: {
    vertices: [
      { id: "ei", x: 80, y: 200, label: "$e^{-}$", kind: "none", labelOffset: { x: -24, y: -8 } },
      { id: "v1", x: 230, y: 200, kind: "dot" },
      { id: "v2", x: 370, y: 200, kind: "dot" },
      { id: "eo", x: 520, y: 200, label: "$e^{-}$", kind: "none", labelOffset: { x: 24, y: -8 } },
      { id: "gi", x: 230, y: 50, label: "$\\gamma$", kind: "none", labelOffset: { x: 0, y: -16 } },
      { id: "go", x: 370, y: 350, label: "$\\gamma$", kind: "none", labelOffset: { x: 0, y: 18 } }
    ],
    edges: [
      { id: "e-in", from: "ei", to: "v1", type: "fermion", momentum: "$p$" },
      { id: "prop", from: "v1", to: "v2", type: "fermion", label: "$e^{-}$" },
      { id: "e-out", from: "v2", to: "eo", type: "fermion", momentum: "$p'$" },
      { id: "g-in", from: "gi", to: "v1", type: "photon", momentum: "$k$" },
      { id: "g-out", from: "v2", to: "go", type: "photon", momentum: "$k'$" }
    ]
  },

  /**
   * QED vacuum polarization: the photon self-energy with an electron–positron loop.
   */
  vacuumPolarization: {
    vertices: [
      { id: "l", x: 80, y: 170, label: "$\\gamma$", kind: "none", labelOffset: { x: -22, y: -12 } },
      { id: "v1", x: 230, y: 170, kind: "dot" },
      { id: "v2", x: 370, y: 170, kind: "dot" },
      { id: "r", x: 520, y: 170, label: "$\\gamma$", kind: "none", labelOffset: { x: 22, y: -12 } }
    ],
    edges: [
      { id: "g-in", from: "l", to: "v1", type: "photon", momentum: "$q$" },
      { id: "top", from: "v1", to: "v2", type: "fermion", curve: "quadratic", bend: 80, label: "$e^{-}$" },
      { id: "bot", from: "v2", to: "v1", type: "fermion", curve: "quadratic", bend: 80, label: "$e^{+}$", labelSide: "right" },
      { id: "g-out", from: "v2", to: "r", type: "photon", momentum: "$q$" }
    ]
  },

  /**
   * Higgs production via gluon fusion: gg → H through a top-quark triangle loop.
   * Dominant Higgs production mechanism at the LHC.
   */
  higgsGluonFusion: {
    vertices: [
      { id: "g1", x: 60, y: 80, label: "$g$", kind: "none", labelOffset: { x: -20, y: -10 } },
      { id: "g2", x: 60, y: 260, label: "$g$", kind: "none", labelOffset: { x: -20, y: 18 } },
      { id: "v1", x: 200, y: 80, kind: "dot" },
      { id: "v2", x: 200, y: 260, kind: "dot" },
      { id: "v3", x: 360, y: 170, kind: "dot" },
      { id: "h", x: 500, y: 170, label: "$H$", kind: "none", labelOffset: { x: 22, y: -10 } }
    ],
    edges: [
      { id: "gl1", from: "g1", to: "v1", type: "gluon" },
      { id: "gl2", from: "g2", to: "v2", type: "gluon" },
      { id: "t1", from: "v1", to: "v3", type: "fermion", label: "$t$" },
      { id: "t2", from: "v3", to: "v2", type: "fermion", label: "$t$", labelSide: "right" },
      { id: "t3", from: "v2", to: "v1", type: "fermion", label: "$t$" },
      { id: "higgs", from: "v3", to: "h", type: "scalar" }
    ]
  },

  /**
   * QED vertex correction (one-loop): contributes to the electron anomalous
   * magnetic moment (g − 2). A virtual photon spans two vertices on the
   * electron line, forming a triangular loop.
   */
  vertexCorrection: {
    vertices: [
      { id: "ei", x: 60, y: 200, label: "$e^{-}$", kind: "none", labelOffset: { x: -24, y: -8 } },
      { id: "v1", x: 180, y: 200, kind: "dot" },
      { id: "v2", x: 300, y: 200, kind: "dot" },
      { id: "v3", x: 420, y: 200, kind: "dot" },
      { id: "eo", x: 540, y: 200, label: "$e^{-}$", kind: "none", labelOffset: { x: 24, y: -8 } },
      { id: "ext", x: 300, y: 360, label: "$\\gamma$", kind: "none", labelOffset: { x: 0, y: 18 } }
    ],
    edges: [
      { id: "e-in", from: "ei", to: "v1", type: "fermion", momentum: "$p$" },
      { id: "f1", from: "v1", to: "v2", type: "fermion" },
      { id: "f2", from: "v2", to: "v3", type: "fermion" },
      { id: "e-out", from: "v3", to: "eo", type: "fermion", momentum: "$p'$" },
      { id: "loop-g", from: "v1", to: "v3", type: "photon", curve: "quadratic", bend: 80, label: "$\\gamma$" },
      { id: "ext-g", from: "ext", to: "v2", type: "photon", momentum: "$q$" }
    ]
  }
} satisfies Record<string, Diagram>;