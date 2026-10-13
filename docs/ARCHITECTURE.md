# Architecture — Heros Markdown

## Overview

Heros Markdown is a manifest version 3 browser extension with no build step. The viewer page contains one application. The background service worker only handles link takeover. The popup exposes auto-open settings.

```
viewer.html       shell, styles and all overlay markup
app.js            rendering engine, study system, power tools, wiring
background.js     navigation takeover for .md links, context menu, message bus
popup.html/.js    auto-open toggles, open app button
vendor/           marked, KaTeX (with fonts), Mermaid — all bundled for offline use
```

## Render pipeline

1. Normalize: carriage returns converted, tilde and unclosed fences handled.
2. Extract: frontmatter and footnote definitions removed to a side table.
3. Protect: code blocks and inline code stashed so delimiters inside code are untouched.
4. Math: `$…$`, `$$…$$`, `\(…\)`, `\[…\]` converted to numbered placeholders; currency like `$1.00` is excluded.
5. Parse: `marked.parse` with GitHub Flavored Markdown and configurable line breaks.
6. Restore: code blocks become panels with language badge, line count and copy button; math is rendered by KaTeX; marks, callouts and `[[toc]]` expand.
7. Post-process the DOM: scripts stripped, tables wrapped, tasks made interactive, heading ids and anchors added, reading-time badges computed, right-to-left blocks detected.

## Diagram layer

Mermaid blocks are placed as source placeholders. A single sequential queue renders them with unique identifiers during idle time. Successful renders become diagram panels with copy-source and save-SVG actions. Failures become error panels showing the message and preserved source, so a bad block never breaks the page.

## Study layer

- Marks are stored per document id under key `herosmd-highlights-v1`, capped at 400 entries, with tool, color, text and timestamp. Painting is a single pass over safe text nodes.
- Cards are stored under `herosmd-flash-v1`, capped at 80 per document, generated from headings, question and answer pairs, bold terms and cloze blanks.
- Tasks, counters, habits and stopwatch laps live under their own keys and are saved on every change by `savePower()`.

## Storage

| Store | Key | Purpose |
|---|---|---|
| localStorage | `herosmd-prefs-v1` | Preferences |
| localStorage | `herosmd-stats-v1` | Statistics, goals, streak data |
| localStorage | `herosmd-bm-v1`, `herosmd-notes-v1` | Bookmarks and notes |
| localStorage | `herosmd-highlights-v1` | Markers |
| localStorage | `herosmd-flash-v1` | Flashcards |
| localStorage | `herosmd-todos-v1` | Tasks |
| localStorage | `herosmd-counters-v1` | Counters |
| localStorage | `herosmd-habits-v1` | Habit check-ins |
| localStorage | `herosmd-stopwatch-v1` | Lap records |
| localStorage | `herosmd-spell-ignore-v1` | Ignored words |
| IndexedDB | `herosmd` store `recent` | Last 25 documents with scroll position |

## Performance strategy

- Debounced preview and search, requestAnimationFrame scroll work.
- Idle Mermaid rendering so text paints first.
- Perf mode skips math and diagrams above 200 KB of source.
- Typed arrays for the diff algorithm; caps on all lists.
- The render time of the last document is displayed in milliseconds.

## Security posture

- Inline scripts, iframes and event handler attributes are removed from rendered documents.
- User CSS is accepted as-is because it is the user's own machine.
- No remote code is executed; vendor bundles are committed.
