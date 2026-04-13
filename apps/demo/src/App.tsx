import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { exampleDiagrams, parseDiagram, serializeDiagram, type Diagram } from "@feynman/core";
import { FeynmanDiagramSvg, FeynmanMathJaxProvider, createMathJaxLabelRenderer } from "@feynman/react";

type ExampleKey = keyof typeof exampleDiagrams;

const exampleEntries = Object.entries(exampleDiagrams) as [ExampleKey, Diagram][];

function cloneDiagram(diagram: Diagram): Diagram {
  return parseDiagram(serializeDiagram(diagram));
}

export function App() {
  const [selectedExample, setSelectedExample] = useState<ExampleKey>(exampleEntries[0]?.[0] ?? "moellerScattering");
  const [diagram, setDiagram] = useState<Diagram>(() => cloneDiagram(exampleEntries[0]?.[1] ?? exampleDiagrams.moellerScattering));
  const [jsonText, setJsonText] = useState(() => serializeDiagram(diagram));
  const [error, setError] = useState<string | null>(null);
  const [useMathJax, setUseMathJax] = useState(true);
  const deferredDiagram = useDeferredValue(diagram);

  const sceneTitle = useMemo(() => selectedExample.replace(/([A-Z])/g, " $1").trim(), [selectedExample]);
  const mathJaxLabelRenderer = useMemo(() => createMathJaxLabelRenderer(), []);

  function handleExampleChange(nextKey: ExampleKey) {
    const nextDiagram = cloneDiagram(exampleDiagrams[nextKey]);
    setSelectedExample(nextKey);
    setDiagram(nextDiagram);
    setJsonText(serializeDiagram(nextDiagram));
    setError(null);
  }

  function handleJsonChange(value: string) {
    setJsonText(value);

    startTransition(() => {
      try {
        const nextDiagram = parseDiagram(value);
        setDiagram(nextDiagram);
        setError(null);
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : "Invalid JSON");
      }
    });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="hero">
          <p className="eyebrow">Standalone SVG library</p>
          <h1>Feynman diagrams as typed JSON</h1>
          <p className="lede">
            The core package computes deterministic SVG geometry. The React package only turns that scene into markup.
          </p>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Examples</h2>
            <span>{exampleEntries.length} built in</span>
          </div>

          <div className="example-list">
            {exampleEntries.map(([key]) => {
              const active = key === selectedExample;
              return (
                <button key={key} className={active ? "example-button active" : "example-button"} onClick={() => handleExampleChange(key)}>
                  <span>{key.replace(/([A-Z])/g, " $1")}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Diagram JSON</h2>
            <span>Canonical data model</span>
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={useMathJax} onChange={(event) => setUseMathJax(event.target.checked)} />
            <span>Render labels with MathJax, using $...$ or \(...\) for math</span>
          </label>

          <textarea
            aria-label="Diagram JSON"
            className="editor"
            spellCheck={false}
            value={jsonText}
            onChange={(event) => handleJsonChange(event.target.value)}
          />

          <div className={error ? "status error" : "status"}>{error ?? "Valid diagram JSON"}</div>
        </section>
      </aside>

      <main className="stage">
        <section className="preview-card">
          <div className="preview-header">
            <div>
              <p className="eyebrow">Live SVG preview</p>
              <h2>{sceneTitle}</h2>
            </div>
            <div className="badge-row">
              <span className="badge">Pure SVG</span>
              <span className="badge">React wrapper</span>
              <span className="badge">MathJax optional</span>
              <span className="badge">Embeddable</span>
            </div>
          </div>

          <div className="diagram-frame">
            <FeynmanMathJaxProvider>
              <FeynmanDiagramSvg
                diagram={deferredDiagram}
                width="100%"
                height="100%"
                title={sceneTitle}
                svgStyle={{ overflow: "visible" }}
                {...(useMathJax ? { labelRenderer: mathJaxLabelRenderer } : {})}
              />
            </FeynmanMathJaxProvider>
          </div>
        </section>

        <section className="notes-grid">
          <article className="note-card">
            <h3>Library shape</h3>
            <p>Core owns geometry, normalization, and serialization. React stays thin and replaceable.</p>
          </article>
          <article className="note-card">
            <h3>Rendering model</h3>
            <p>Manual coordinates drive deterministic curves, labels, and markers with no hidden mutable DOM state.</p>
          </article>
          <article className="note-card">
            <h3>Extension path</h3>
            <p>MathJax now keys off inline delimiters rather than per-label flags, and future DSL importers can still target the same canonical JSON model.</p>
          </article>
        </section>
      </main>
    </div>
  );
}