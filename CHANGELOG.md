# Changelog — Heros Markdown

All notable changes to Heros Markdown are documented here.
Format follows Keep a Changelog and Semantic Versioning.

## v1.2.0 — 110 free tools, study studio complete

### Added
- Task manager tab with priorities, due dates, open/done/all filters, checklist import and Markdown export
- Stopwatch with count-up timer and fifty saved laps
- Tally counters with custom step sizes, per-counter reset
- Habit tracker with a 14-day check-in grid and streak counting per habit
- Backup everything: one JSON file covering marks, cards, tasks, counters, habits, laps, notes and preferences
- Study pack export combining outline, markers, notes, flashcards and tasks in one Markdown file
- Anki TSV import, focus mode command, copy document stats command
- Full Heros PDF studio design port including theme tokens, chrome, bottom status bar, presentation mode
- Focus and performance controls, render time meter, study streak, table sort, print selection

### Changed
- Every Markdown engine input now normalizes carriage returns, handles tilde fences, unclosed fences and four math delimiter forms
- Search is Unicode-aware so whole-word matching works in every written language
- Document compare now uses a longest common subsequence algorithm with typed arrays
- Image paste compresses to data URLs with proper Markdown syntax
- Timer and Vim indicators moved into the bottom status bar instead of floating windows
- All overlay elements moved before the application shell so nothing paints under the bottom bar

### Removed
- Command palette window, replaced by the searchable features list opened with the F key
- Features modal window, replaced by the inline features list in the Tools tab
- Read-aloud text-to-speech feature and all of its controls

### Fixed
- Unclosed CSS brace that disabled overlay hiding and responsive rules
- Spell-check ignore used inline attributes, moved to safe event listeners
- Search highlighting corrupted KaTeX output, now skips rendered math and code
- Stopwatch button replaced its own DOM and lost the cached node
- Command palette produced invalid markup and referenced undefined globals

## v1.1.0 — 100 tools

### Added
- Marker Studio with highlight, underline and strike, seven colors, per-file panel and export
- Floating selection mini-bar with H, U, S, copy and note actions
- Automatic flashcards from headings, question and answer pairs, bold terms and cloze blanks
- Quiz mode with reveal, navigation, score and known state
- Anki TSV export and study pack export
- Templates gallery with six study templates
- Study lab: lint, extractive summary, keywords, word frequency and readability
- Custom CSS editor, Vim navigation, writing goals, Pomodoro timer, visual diff

### Fixed
- Mermaid race conditions with unique render identifiers and a sequential queue
- Selection marks collided with search marks, now separated by class
- Frontmatter and footnote handling for carriage return line endings

## v1.0.0 — first release

### Added
- Full Markdown viewer with GitHub Flavored Markdown, footnotes and frontmatter
- Offline KaTeX rendering with bundled fonts
- Mermaid diagram engine offline
- Outline map, full text search, bookmarks, notes, recent files and resume reading
- Builder studio with live preview and quick insert bar
- Exports: Markdown, standalone HTML, plain text, DOCX, Obsidian, Notion, GFM
- White and dark themes with six accent colors, four page comfort modes
