# Engineering Coach

Engineering Coach turns local AI coding sessions into practical feedback about prompting, iteration, tool use, context management, and sustainable engineering habits.

It is provider-neutral and read-only. The same normalized session model supports:

- Anti-gravity
- Cursor
- Claude Code
- Codex
- OpenCode and compatible JSON/JSONL transcripts

No session data is uploaded. AI-generated insights are optional; the local parser and analytics do not require an account or a specific AI vendor.

## Quick start

```bash
npm install
npm run analyze -- --tool cursor ./sessions/session.jsonl
```

The command prints a JSON summary. Omit `--tool` for an unknown or custom provider; use the tool name when the transcript does not identify itself.

The parser accepts common JSONL shapes (`role` + `content`, nested `message`, tool calls, file paths, and usage/token fields). Provider-specific parsers remain available for richer native formats, while the universal parser provides a safe fallback for new tools.

## Development

```bash
npm run typecheck
npm test
npm run build
```

The existing dashboard is a local VS Code webview, but its analytics collection is no longer limited to one vendor. Cursor and Anti-gravity transcripts are discovered from their local data directories when present, and all collectors map into the same `Session` / `SessionRequest` model.

## Privacy

- Session files are read-only.
- There is no telemetry or hosted data pipeline.
- The parser stores bounded message previews for analytics.
- Treat generated summaries as local developer data and review them before sharing.

## License

MIT. See [LICENSE](LICENSE).
