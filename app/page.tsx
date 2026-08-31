"use client";

import { useCallback, useEffect, useState } from "react";
import type { BreakingChange, OpenApiLike } from "@/lib/diff";

const BREAKING_AFTER: OpenApiLike = {
  openapi: "3.0.3",
  info: { title: "Demo API", version: "2.0.0" },
  paths: {
    "/users": {
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "phone"],
                properties: {
                  email: { type: "string" },
                  age: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "integer" }, role: { type: "string" } },
      },
    },
  },
};

export default function HomePage() {
  const [beforeText, setBeforeText] = useState("");
  const [afterText, setAfterText] = useState("");
  const [error, setError] = useState("");
  const [changes, setChanges] = useState<BreakingChange[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/diff");
      if (!res.ok) throw new Error("Failed to load specs");
      const data = (await res.json()) as {
        before: OpenApiLike;
        after: OpenApiLike;
      };
      setBeforeText(JSON.stringify(data.before, null, 2));
      setAfterText(JSON.stringify(data.after, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSpecs() {
    setError("");
    try {
      const before = JSON.parse(beforeText) as OpenApiLike;
      const after = JSON.parse(afterText) as OpenApiLike;
      const res = await fetch("/api/diff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      throw err;
    }
  }

  async function runDiff() {
    setError("");
    setBusy(true);
    try {
      const before = JSON.parse(beforeText) as OpenApiLike;
      const after = JSON.parse(afterText) as OpenApiLike;
      await saveSpecs();
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after }),
      });
      const data = (await res.json()) as {
        changes?: BreakingChange[];
        summary?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) {
        setChanges(null);
        setCounts(null);
        setError(data.error ?? "Diff failed");
        return;
      }
      setChanges(data.changes ?? []);
      setCounts(data.summary ?? null);
    } catch (err) {
      setChanges(null);
      setCounts(null);
      setError(err instanceof Error ? err.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  }

  async function loadBreakingFixture() {
    setError("");
    setBusy(true);
    try {
      let before: OpenApiLike;
      try {
        before = JSON.parse(beforeText) as OpenApiLike;
      } catch {
        const res = await fetch("/api/diff");
        const data = (await res.json()) as { before: OpenApiLike };
        before = data.before;
        setBeforeText(JSON.stringify(before, null, 2));
      }
      const after = BREAKING_AFTER;
      setAfterText(JSON.stringify(after, null, 2));
      const put = await fetch("/api/diff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after }),
      });
      if (!put.ok) throw new Error("Failed to save breaking fixture");
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before, after }),
      });
      const data = (await res.json()) as {
        changes?: BreakingChange[];
        summary?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Diff failed");
      setChanges(data.changes ?? []);
      setCounts(data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fixture load failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p className="lede">Loading saved specs…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">SchemaSentry</p>
        <h1>Catch breaking API drifts before clients do.</h1>
        <p className="lede">
          Diff two OpenAPI-like snapshots: removed paths, dropped required fields, type shifts.
          Specs persist in <code>data/specs.json</code>.
        </p>
      </header>

      {!beforeText && !afterText ? (
        <p className="lede">No specs loaded — seed data should appear after refresh.</p>
      ) : null}

      <div className="grid">
        <label>
          Before
          <textarea value={beforeText} onChange={(e) => setBeforeText(e.target.value)} rows={16} />
        </label>
        <label>
          After
          <textarea value={afterText} onChange={(e) => setAfterText(e.target.value)} rows={16} />
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={() => void runDiff()} disabled={busy}>
          {busy ? "Diffing…" : "Run sentry diff"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void saveSpecs().catch(() => undefined)}
          disabled={busy}
        >
          Save specs
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          Reload saved
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void loadBreakingFixture()}
          disabled={busy}
        >
          Load breaking fixture
        </button>
      </div>

      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      {counts && (
        <div className="summary">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k}>
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      )}

      {changes === null ? (
        <p className="lede" style={{ marginTop: "1.25rem" }}>
          No diff yet — run sentry diff or load the breaking fixture.
        </p>
      ) : (
        <ul className="list">
          {changes.length === 0 && <li className="ok">No breaking changes detected.</li>}
          {changes.map((c, i) => (
            <li key={`${c.kind}-${c.path}-${i}`}>
              <code>{c.kind}</code>
              <span>{c.path}</span>
              <em>{c.detail}</em>
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 3rem 1.25rem 4rem;
        }
        .hero {
          margin-bottom: 1.75rem;
          animation: fade 0.6s ease both;
        }
        .brand {
          font-size: clamp(2.5rem, 8vw, 3.7rem);
          font-weight: 700;
          letter-spacing: -0.045em;
          margin: 0;
          color: var(--cyan);
          line-height: 1;
        }
        h1 {
          font-size: clamp(1.15rem, 2.8vw, 1.5rem);
          font-weight: 500;
          max-width: 22ch;
          margin: 0.8rem 0 0.6rem;
        }
        .lede {
          margin: 0;
          color: #9bb4c4;
          max-width: 48ch;
        }
        .lede code {
          font-family: var(--font-plex), var(--font-mono);
          color: var(--cyan);
          font-size: 0.85em;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        label {
          display: grid;
          gap: 0.4rem;
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8eacbd;
        }
        textarea {
          font-family: var(--font-plex), var(--font-mono);
          font-size: 0.78rem;
          background: var(--deep);
          color: var(--paper);
          border: 1px solid var(--cyan-dim);
          padding: 0.85rem;
          resize: vertical;
          min-height: 280px;
          text-transform: none;
          letter-spacing: normal;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        button {
          background: var(--cyan);
          color: var(--navy);
          border: none;
          font: inherit;
          font-weight: 700;
          padding: 0.8rem 1.2rem;
          cursor: pointer;
          transition: transform 0.15s, filter 0.15s;
        }
        button.secondary {
          background: transparent;
          color: var(--cyan);
          border: 1px solid var(--cyan-dim);
        }
        button:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        button:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        .err {
          color: var(--bad);
        }
        .summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
          margin: 1.25rem 0 0.75rem;
          font-size: 0.9rem;
          color: #9bb4c4;
          animation: fade 0.4s ease both;
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.65rem;
        }
        .list li {
          display: grid;
          gap: 0.15rem;
          padding: 0.75rem 0.85rem;
          border-left: 3px solid var(--warn);
          background: rgba(0, 0, 0, 0.25);
          animation: fade 0.45s ease both;
        }
        .list li.ok {
          border-left-color: var(--cyan);
        }
        .list code {
          font-family: var(--font-plex), var(--font-mono);
          color: var(--warn);
          font-size: 0.78rem;
        }
        .list em {
          font-style: normal;
          color: #9bb4c4;
          font-size: 0.9rem;
        }
        @keyframes fade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (max-width: 800px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
