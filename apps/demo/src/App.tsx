import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { exampleDiagrams, parseDiagram, serializeDiagram, type Diagram } from "@feynman/core";
import { FeynmanDiagramEditor } from "@feynman/editor";
import { FeynmanMathJaxProvider, createMathJaxLabelRenderer } from "@feynman/react";

type ExampleKey = keyof typeof exampleDiagrams;

const exampleEntries = Object.entries(exampleDiagrams) as [ExampleKey, Diagram][];

function cloneDiagram(diagram: Diagram): Diagram {
  return parseDiagram(serializeDiagram(diagram));
}

export function App() {
  const jsonSyncTimeoutRef = useRef<number | null>(null);
  const [selectedExample, setSelectedExample] = useState<ExampleKey>(exampleEntries[0]?.[0] ?? "moellerScattering");
  const [diagram, setDiagram] = useState<Diagram>(() => cloneDiagram(exampleEntries[0]?.[1] ?? exampleDiagrams.moellerScattering));
  const [jsonText, setJsonText] = useState(() => serializeDiagram(diagram));
  const [error, setError] = useState<string | null>(null);
  const [useMathJax, setUseMathJax] = useState(true);

  const sceneTitle = useMemo(() => selectedExample.replace(/([A-Z])/g, " $1").trim(), [selectedExample]);
  const mathJaxLabelRenderer = useMemo(() => createMathJaxLabelRenderer(), []);

  useEffect(() => {
    return () => {
      if (jsonSyncTimeoutRef.current !== null) {
        window.clearTimeout(jsonSyncTimeoutRef.current);
      }
    };
  }, []);

  function clearPendingJsonSync() {
    if (jsonSyncTimeoutRef.current !== null) {
      window.clearTimeout(jsonSyncTimeoutRef.current);
      jsonSyncTimeoutRef.current = null;
    }
  }

  function handleExampleChange(nextKey: ExampleKey) {
    clearPendingJsonSync();
    const nextDiagram = cloneDiagram(exampleDiagrams[nextKey]);
    setSelectedExample(nextKey);
    setDiagram(nextDiagram);
    setJsonText(serializeDiagram(nextDiagram));
    setError(null);
  }

  function handleJsonChange(value: string) {
    clearPendingJsonSync();
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

  function handleDiagramChange(nextDiagram: Diagram) {
    setDiagram(nextDiagram);
    setError(null);

    clearPendingJsonSync();
    jsonSyncTimeoutRef.current = window.setTimeout(() => {
      startTransition(() => {
        setJsonText(serializeDiagram(nextDiagram));
      });
      jsonSyncTimeoutRef.current = null;
    }, 90);
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

        <section className="panel">
          <div className="panel-header">
            <h2>New features</h2>
            <span>v2</span>
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 18px", lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Shapes</strong> – click <em>Add shape</em> in the toolbar to place circles and ellipses. Supports solid, outline, dashed and hatch fills.</li>
            <li><strong>Vertex size</strong> – select a vertex in the inspector and edit <em>glyph radius</em> to override the default size.</li>
            <li><strong>Snap on by default</strong> – grid snap is now enabled when the editor loads.</li>
            <li><strong>TikZ export</strong> – click <em>Export TikZ</em> to copy a tikz-feynman LaTeX snippet.</li>
            <li><strong>TikZ import</strong> – click <em>Import TikZ</em> and paste a tikz-feynman snippet to load it.</li>
            <li><strong>Pointer fix</strong> – drag-to-select, vertex placement and dragging are now correctly aligned with the actual mouse position.</li>
          </ul>
        </section>
      </aside>

      <main className="stage">
        <section className="preview-card">
          <div className="preview-header">
            <div>
              <p className="eyebrow">Standalone editor package</p>
              <h2>{sceneTitle}</h2>
            </div>
            <div className="badge-row">
              <span className="badge">Controlled component</span>
              <span className="badge">Canonical JSON</span>
              <span className="badge">Shapes</span>
              <span className="badge">TikZ I/O</span>
            </div>
          </div>

          <div className="diagram-frame editor-frame">
            <FeynmanMathJaxProvider>
              <FeynmanDiagramEditor
                value={diagram}
                onChange={handleDiagramChange}
                width="100%"
                height="100%"
                title={sceneTitle}
                {...(useMathJax ? { labelRenderer: mathJaxLabelRenderer } : {})}
              />
            </FeynmanMathJaxProvider>
          </div>
        </section>

        <section className="notes-grid">
          <article className="note-card">
            <h3>Shapes</h3>
            <p>Circles and ellipses are first-class diagram items with solid, outline, dashed, and hatch fill styles, configurable stroke and fill colours.</p>
          </article>
          <article className="note-card">
            <h3>TikZ-Feynman I/O</h3>
            <p>Export any diagram to a tikz-feynman LaTeX snippet, or import a tikz-feynman snippet to load it into the visual editor. Vertex kinds, edge styles, bends, labels and shapes are all round-tripped.</p>
          </article>
          <article className="note-card">
            <h3>Pointer & snap</h3>
            <p>Coordinate mapping now correctly handles the SVG <code>xMidYMid&nbsp;meet</code> transform — drag, place, and select all land exactly where you click. Grid snap is on by default.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
