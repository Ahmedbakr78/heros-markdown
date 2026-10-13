# Repo setup — paste-ready values for github.com/Ahmedbakr78

## 1. Repository name
```
heros-markdown
```

## 2. About description (About section, one line)
```
Free, private and unlimited Markdown studio for Chrome, Edge and Brave — perfect rendering, offline LaTeX, every mermaid diagram, all languages and RTL, plus markers, flashcards, quizzes, tasks, stopwatch and habit tracking.
```

## 3. Website (About field)
```
https://ahmedbakr78.github.io/heros-markdown/
```
Enable it with **Settings, Pages, Deploy from a branch, main, /docs**. The landing page is already in `docs/index.html`.

## 4. Topics (About, Add topics — paste all)
```
markdown
markdown-viewer
latex
katex
mermaid
diagrams
chrome-extension
study-tools
flashcards
anki
note-taking
offline-first
privacy
free
right-to-left
todo-list
habit-tracker
pomodoro
javascript
no-dependencies
```

## 5. Social preview image
Upload `assets/app-icon-512.png` as the social preview, or generate a 1280 by 640 banner from `assets/screenshots/reader-dark.png`.

## 6. Release v1.2.0
Title:
```
v1.2.0 — 110 free tools, study studio complete
```
Body: copy the whole file [RELEASE_v1.2.0.md](RELEASE_v1.2.0.md).
Attach: a ZIP of this folder so users can Load unpacked without using git.
Set as latest release.

## 7. Push commands
```bash
cd Heros_Markdown
git init
git add -A
git commit -m "Heros Markdown v1.2.0 - 110 free tools, study studio, documents"
git branch -M main
git remote add origin https://github.com/Ahmedbakr78/heros-markdown.git
git push -u origin main
```

## 8. Optional extras in the repo
- `FUNDING.yml` if you want a sponsor button, otherwise skip.
- `SECURITY.md` with a contact address for reports.
- Issue labels: `bug`, `enhancement`, `question`, `good first issue`.

## 9. Suggested first issues
- Add a template for your subject
- Improve accessibility labels
- Translate the six templates into another language
- Add a Firefox manifest variant
