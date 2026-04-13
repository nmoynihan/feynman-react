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
              <span className="badge">Drag and drop</span>
              <span className="badge">Embeddable</span>
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
            <h3>Standalone package</h3>
            <p>The editor lives in its own workspace package and depends only on the existing core and React renderer packages.</p>
          </article>
          <article className="note-card">
            <h3>Controlled editing</h3>
            <p>Dragging vertices, labels, and inspector edits all emit the same canonical Diagram JSON model the rest of the repo already understands.</p>
          </article>
          <article className="note-card">
            <h3>Extension path</h3>
            <p>The editor reuses the current SVG renderer, so future embedding into other React apps can stay package-level rather than slide-editor-specific.</p>
          </article>
        </section>
      </main>
    </div>
  );
}