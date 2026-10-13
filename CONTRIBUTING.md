# Contributing to Heros Markdown

Thank you for your interest in improving Heros Markdown. This project is free, private and offline by design, and contributions should respect those principles.

## Ground rules

- No network calls, no telemetry, no analytics, no accounts.
- No build step. Ship plain HTML, CSS and JavaScript.
- No new dependencies. Vendor libraries are bundled on purpose.
- Keep every feature free for everyone. No paywalls and no feature flags.
- Keep it accessible: labels, contrast, keyboard reachable controls.

## How to contribute

1. Fork the repository and create a branch named `feat/short-name` or `fix/short-name`.
2. Make your change in plain files. There is nothing to compile.
3. Check syntax: `node --check app.js`, `node --check background.js`, `node --check popup.js`.
4. Test manually in a Chromium browser by loading the folder as an unpacked extension.
5. Open a pull request with a clear description, before and after behaviour, and screenshots if the interface changed.

## Good first issues

- Translate the six templates into another language
- Add a template for a specific subject or workflow
- Improve label text and titles for accessibility
- Add a Firefox manifest variant
- Document a confusing feature in the README FAQ

## Code style

- Four space indentation in JavaScript and CSS.
- No comments unless the intent is required for understanding.
- Prefer the existing helpers: `$`, `$$`, `esc`, `toast`, `debounce`, `clamp`.
- Guard all DOM access; elements may be absent.
- Fail silently for optional features, never block a user action.

## Commit messages

Use short imperative messages, for example: `add habit tracker grid`, `fix mermaid queue`, `strip inline handlers`.

## License

By contributing you agree that your work is published under the MIT License of this repository.
