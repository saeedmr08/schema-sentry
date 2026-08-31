# SchemaSentry

OpenAPI-like snapshot diff tool by **Saeed Rumaneh**. Paste two JSON API specs and surface breaking changes: removed paths/methods, removed required fields, and type changes. Specs and diffs go through a real API; the last pair is stored on disk.

## Features

- `diffOpenApi` + `summarize` in `lib/diff.ts`
- Path / method removal detection
- Request body & component schema walks
- Vitest coverage for breaking-change cases
- JSON persistence at `data/specs.json` (gitignored)

## API

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/diff` | Load saved `{ before, after }` |
| PUT | `/api/diff` | Persist `{ before, after }` |
| POST | `/api/diff` | Body `{ before, after }` → breaking changes + summary |

## Scripts

```bash
npm install
npm run dev
npm test
npm run typecheck
```

Open http://localhost:3000 — edit specs, run a diff, restart the app; the last pair is still on disk.

## Complete product flows

1. Click **Load breaking fixture** — after-spec becomes a breaking change and the diff runs.
2. Click **Save specs** then reload — the pair returns from `data/specs.json`.
3. Edit either pane and **Run sentry diff** — summary counts + breaking list update.

## License

MIT © 2026 Saeed Rumaneh
