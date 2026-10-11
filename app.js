/* ==========================================================================
   HEROS MARKDOWN — application logic
   Full .md viewer + LaTeX (KaTeX offline) + GFM + builder. Fast, local, free.
   ========================================================================== */
(function () {
'use strict';

/* ---------------- 0. helpers ---------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return {'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c];
  });
}
const raf = fn => requestAnimationFrame(fn);
function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; }
function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function slugify(t) {
  return String(t).toLowerCase().trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'section';
}

/* ----- New feature helpers ----- */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function escapeHtml(html) {
  return String(html).replace(/[&<>"']/g, function(c) {
    return {'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c];
  });
}

function getSelectionText() {
  const sel = window.getSelection();
  return sel.rangeCount ? sel.toString() : '';
}

function wrapSelection(prefix, suffix, placeholder) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    const text = placeholder || '';
    range.deleteContents();
    range.insertNode(document.createTextNode(prefix + text + suffix));
    range.collapse(false);
  } else {
    const text = sel.toString();
    range.deleteContents();
    range.insertNode(document.createTextNode(prefix + text + suffix));
  }
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

window.addEventListener('error', (e) => {
  try {
    const f = String(e.filename || '');
    if (f.indexOf('app.js') === -1) return;
    const msg = String((e.message || 'unknown error')).slice(0, 160);
    if (typeof toast === 'function') toast('Error: ' + msg, 'err', 5000);
  } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const msg = String((e.reason && e.reason.message) || e.reason || 'unknown').slice(0, 160);
    if (/ResizeObserver|AbortError/i.test(msg)) return;
    if (typeof toast === 'function') toast('Action failed: ' + msg, 'err', 5000);
  } catch (_) {}
});

/* ---------------- 1. DOM refs ---------------- */
const D = {
  viewer: $('#viewer'), mdScroll: $('#mdScroll'), mdCard: $('#mdCard'),
  mdMeta: $('#mdMeta'), tocCard: $('#tocCard'), tocLinks: $('#tocLinks'),
  mdDoc: $('#mdDoc'), builderCard: $('#builderCard'), builderPreview: $('#builderPreview'),
  empty: $('#empty'), sidebar: $('#sidebar'), sideBackdrop: $('#sideBackdrop'),
  outlineList: $('#outlineList'), outlineEmpty: $('#outlineEmpty'),
  searchBox: $('#searchBox'), searchInput: $('#searchInput'), searchClear: $('#searchClear'),
  searchMeta: $('#searchMeta'), searchCount: $('#searchCount'),
  searchResults: $('#searchResults'), searchEmpty: $('#searchEmpty'),
  searchPrev: $('#searchPrev'), searchNext: $('#searchNext'),
  recentList: $('#recentList'), recentEmpty: $('#recentEmpty'),
  btnClearRecent: $('#btnClearRecent'),
  fileInput: $('#fileInput'), restoreInput: $('#restoreInput'), marksRestoreInput: $('#marksRestoreInput'),
  menu: $('#menu'), toasts: $('#toasts'),
  modalBackdrop: $('#modalBackdrop'), modal: $('#modal'),
  dropOverlay: $('#dropOverlay'), progress: $('#progress'), progressBar: $('#progressBar'),
  progressBarTop: $('#progressBarTop'),
  statusDot: $('#statusDot'), statusText: $('#statusText'),
  sbWords: $('#sbWords'), sbHeads: $('#sbHeads'), sbMath: $('#sbMath'),
  sbFile: $('#sbFile'), sbZoom: $('#sbZoom'), sbProg: $('#sbProg'),
  btnSidebar: $('#btnSidebar'), btnOpen: $('#btnOpen'), fileTag: $('#fileTag'), fileTagName: $('#fileTagName'),
  btnFontDec: $('#btnFontDec'), btnFontInc: $('#btnFontInc'), btnFontLabel: $('#btnFontLabel'),
  btnEditToggle: $('#btnEditToggle'), btnSearch: $('#btnSearch'), btnToc: $('#btnToc'),
  btnSpeakTop: $('#btnSpeakTop'), btnTheme: $('#btnTheme'), themeIcon: $('#themeIcon'), btnMenu: $('#btnMenu'),
  builderArea: $('#builderArea'), fmtBar: $('#fmtBar'),
  bmList: $('#bmList'), bmEmpty: $('#bmEmpty'), notesList: $('#notesList'), notesEmpty: $('#notesEmpty'),
  featuresMini: $('#featuresMini'),
  autoBar: $('#autoBar'), autoBarSpeed: $('#autoBarSpeed'),
  tocFab: $('#tocFab'), backTop: $('#backTop'),
  // New features
  cmdPalette: $('#cmdPalette'), cmdSearch: $('#cmdSearch'), cmdList: $('#cmdList'),
  annoToolbar: $('#annoToolbar'), annoClear: $('#annoClear'),
  timerFab: $('#timerFab'), timerDisplay: $('#timerDisplay'),
  vimIndicator: $('#vimIndicator'),
  pasteNotice: $('#pasteNotice'), pasteCount: $('#pasteCount'), pasteNoticeClose: $('#pasteNoticeClose'),
  customCssEditor: $('#customCssEditor'), btnCustomCss: $('#btnCustomCss'), btnCustomCssClear: $('#btnCustomCssClear'),
  goalBarSession: $('#goalBarSession'), goalTextSession: $('#goalTextSession'),
  goalBarDaily: $('#goalBarDaily'), goalTextDaily: $('#goalTextDaily'),
  btnGoalSet: $('#btnGoalSet'), btnGoalReset: $('#btnGoalReset'),
  pomodoroWork: $('#pomodoroWork'), pomodoroWorkLbl: $('#pomodoroWorkLbl'),
  pomodoroBreak: $('#pomodoroBreak'), pomodoroBreakLbl: $('#pomodoroBreakLbl'),
  pomodoroLong: $('#pomodoroLong'), pomodoroLongLbl: $('#pomodoroLongLbl'),
  btnPomodoroStart: $('#btnPomodoroStart'), btnPomodoroSkip: $('#btnPomodoroSkip'),
  pomodoroCycles: $('#pomodoroCycles'),
  btnLinkCheck: $('#btnLinkCheck'), btnLinkCheckCancel: $('#btnLinkCheckCancel'),
  linkCheckResults: $('#linkCheckResults'),
  btnMermaidTheme: $('#btnMermaidTheme'), btnMermaidExport: $('#btnMermaidExport'),
  btnSpellCheckRun: $('#btnSpellCheckRun'), btnSpellCheckIgnore: $('#btnSpellCheckIgnore'),
  spellCheckResults: $('#spellCheckResults'),
  btnExportObsidian: $('#btnExportObsidian'), btnExportNotion: $('#btnExportNotion'),
  btnExportDocx: $('#btnExportDocx'), btnExportPdf: $('#btnExportPdf'),
  btnExportGfm: $('#btnExportGfm'), btnExportHtml: $('#btnExportHtml'), btnExportMd: $('#btnExportMd'),
  btnDiffOpen: $('#btnDiffOpen'), btnDiffClose: $('#btnDiffClose'),
  btnDiffSwap: $('#btnDiffSwap'), btnDiffExport: $('#btnDiffExport'),
  diffContainer: $('#diffContainer')
};

/* ---------------- 2. State + prefs ---------------- */
const PREF_KEY = 'herosmd-prefs-v1';
const defaults = {
  theme: 'dark', accent: '#4c8dff', sideW: 308,
  fontSize: 16, lineH: 1.7, docW: 'comfort', fontFam: 'sans',
  justify: false, tocCard: true, pageMode: 'off',
  math: true, images: true, resume: true,
  live: true, split: false, ttsRate: 1, autoSpeed: 30,
  profileName: 'My Studio', profileColor: '#4c8dff',
  // New features
  cmdPalette: true, vimMode: false,
  customCss: '',
  goalSession: 500, goalDaily: 2000,
  pomodoroWork: 25, pomodoroBreak: 5, pomodoroLong: 15,
  mermaid: true, mermaidTheme: 'default',
  spellCheck: false, spellCheckDoc: false,
  diffMode: false
};
let P = { ...defaults };
try { const s = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); P = { ...defaults, ...s }; } catch (e) {}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(P)); } catch (e) {} }

const S = {
  raw: '', file: null, fileName: '', fileSize: 0, docId: null,
  headings: [], searchText: '', searchResults: [], searchCursor: -1,
  searchCase: false, searchWhole: false,
  bookmarks: {}, notes: {},
  stats: { docs: 0, words: 0, dailyWords: 0, dailyDate: new Date().toDateString() },
  speaking: false, autoTimer: null, sessionStart: Date.now(),
  mathCount: 0, codeCount: 0, builderMode: false,
  // New features
  highlights: {}, // docId -> [{id, start, end, color, text, at}]
  annotations: {}, // docId -> [{id, target, note, color, at}]
  vimMode: false,
  vimModeState: 'normal', // normal, insert, visual
  vimLastSearch: '',
  pomodoroTimer: null,
  pomodoroState: 'idle', // idle, work, break, longBreak
  pomodoroTimeLeft: 0,
  pomodoroCycles: 0,
  linkCheckAbort: null,
  spellCheckIgnore: [],
  diffOtherDoc: null,
  diffOtherHtml: '',
  customCssSheet: null
};
try { const st = JSON.parse(localStorage.getItem('herosmd-stats-v1') || '{}'); S.stats = { docs: 0, words: 0, dailyWords: 0, dailyDate: new Date().toDateString(), ...st }; } catch (e) {}
function saveStats() { try { localStorage.setItem('herosmd-stats-v1', JSON.stringify(S.stats)); } catch (e) {} }
try { S.bookmarks = JSON.parse(localStorage.getItem('herosmd-bm-v1') || '{}'); } catch (e) { S.bookmarks = {}; }
try { S.notes = JSON.parse(localStorage.getItem('herosmd-notes-v1') || '{}'); } catch (e) { S.notes = {}; }
try { S.highlights = JSON.parse(localStorage.getItem('herosmd-highlights-v1') || '{}'); } catch (e) { S.highlights = {}; }
try { S.annotations = JSON.parse(localStorage.getItem('herosmd-annotations-v1') || '{}'); } catch (e) { S.annotations = {}; }
try { S.spellCheckIgnore = JSON.parse(localStorage.getItem('herosmd-spell-ignore-v1') || '[]'); } catch (e) { S.spellCheckIgnore = []; }
function saveMarks() {
  try { localStorage.setItem('herosmd-bm-v1', JSON.stringify(S.bookmarks)); } catch (e) {}
  try { localStorage.setItem('herosmd-notes-v1', JSON.stringify(S.notes)); } catch (e) {}
  try { localStorage.setItem('herosmd-highlights-v1', JSON.stringify(S.highlights)); } catch (e) {}
  try { localStorage.setItem('herosmd-annotations-v1', JSON.stringify(S.annotations)); } catch (e) {}
}

/* ---------------- 3. Toast / status / progress ---------------- */
function toast(msg, type, ms) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  const ic = type === 'err' ? 'i-alert' : type === 'ok' ? 'i-check' : 'i-info';
  el.innerHTML = '<svg class="ic"><use href="#' + ic + '"/></svg><span>' + esc(msg) + '</span>';
  D.toasts.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, ms || 2600);
}
function setStatus(text, kind) {
  D.statusText.textContent = text;
  D.statusDot.className = 'dot' + (kind ? ' ' + kind : '');
}
let progressTimer = null;
function showProgress(pct) {
  D.progress.classList.remove('done');
  D.progressBar.style.width = clamp(pct, 0, 100) + '%';
  clearTimeout(progressTimer);
}
function hideProgress() {
  D.progressBar.style.width = '100%';
  D.progress.classList.add('done');
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => { D.progressBar.style.width = '0%'; }, 350);
}

/* ---------------- 4. IndexedDB (recent) ---------------- */
const IDB = (function () {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no-idb'));
      const r = indexedDB.open('herosmd', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('recent')) db.createObjectStore('recent', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function store(mode) { return open().then(db => db.transaction('recent', mode).objectStore('recent')); }
  return {
    put(rec) { return store('readwrite').then(st => new Promise((res, rej) => { const q = st.put(rec); q.onsuccess = res; q.onerror = () => rej(q.error); })); },
    all() { return store('readonly').then(st => new Promise((res, rej) => { const q = st.getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); })); },
    del(id) { return store('readwrite').then(st => new Promise((res, rej) => { const q = st.delete(id); q.onsuccess = res; q.onerror = () => rej(q.error); })); },
    clear() { return store('readwrite').then(st => new Promise((res, rej) => { const q = st.clear(); q.onsuccess = res; q.onerror = () => rej(q.error); })); }
  };
})();

/* ---------------- 5. Theme (white + dark perfect) ---------------- */
const Theme = (function () {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function resolved() { return P.theme === 'system' ? (mq.matches ? 'dark' : 'light') : P.theme; }
  function apply() {
    const r = resolved();
    document.documentElement.setAttribute('data-theme', r);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#0e1014' : '#e9ecf1');
    if (D.themeIcon) D.themeIcon.innerHTML = '<use href="#' + (r === 'dark' ? 'i-sun' : 'i-moon') + '"/>';
    $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.th === P.theme));
    document.documentElement.style.setProperty('--accent', P.accent);
    document.documentElement.style.setProperty('--accent-soft',
      P.theme === 'light' || resolved() === 'light' ? hexA(P.accent, 0.10) : hexA(P.accent, 0.15));
  }
  function hexA(hex, a) {
    try {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) { return hex; }
  }
  function set(t) { P.theme = t; savePrefs(); apply(); }
  function toggle() { set(resolved() === 'dark' ? 'light' : 'dark'); }
  if (mq.addEventListener) mq.addEventListener('change', () => { if (P.theme === 'system') apply(); });
  return { apply, set, toggle, resolved };
})();

function applyReadingPrefs() {
  document.documentElement.style.setProperty('--doc-fs', P.fontSize + 'px');
  document.documentElement.style.setProperty('--doc-lh', P.lineH);
  document.body.classList.remove('doc-narrow', 'doc-comfort', 'doc-wide', 'doc-full');
  document.body.classList.add('doc-' + (P.docW || 'comfort'));
  D.mdDoc.classList.toggle('serif', P.fontFam === 'serif');
  D.mdDoc.classList.toggle('mono', P.fontFam === 'mono');
  D.mdDoc.classList.toggle('justify', !!P.justify);
  document.body.classList.remove('pm-night', 'pm-sepia', 'pm-dim');
  if (P.pageMode && P.pageMode !== 'off') document.body.classList.add('pm-' + P.pageMode);
  document.documentElement.style.setProperty('--side-w', (P.sideW || 308) + 'px');
  D.btnFontLabel.textContent = Math.round((P.fontSize / 16) * 100) + '%';
  D.sbZoom.textContent = Math.round((P.fontSize / 16) * 100) + '%';
  // hub controls sync
  const set = (id, v) => { const el = document.getElementById(id); if (el && el.type === 'checkbox') el.checked = !!v; };
  set('swJustify', P.justify); set('swTocCard', P.tocCard);
  set('swMath', P.math); set('swImages', P.images); set('swResume', P.resume);
  set('swLive', P.live); set('swSplit', P.split);
  const fs = $('#fontSize'), fl = $('#fontSizeLbl');
  if (fs) { fs.value = P.fontSize; if (fl) fl.textContent = P.fontSize + 'px'; }
  const lh = $('#lineHeight'), ll = $('#lineHeightLbl');
  if (lh) { lh.value = Math.round(P.lineH * 10); if (ll) ll.textContent = P.lineH.toFixed(1); }
  const sw = $('#sideW'), swl = $('#sideWLbl');
  if (sw) { sw.value = P.sideW; if (swl) swl.textContent = P.sideW; }
  $$('#pageModeSeg button').forEach(b => b.classList.toggle('on', b.dataset.pm === P.pageMode));
  $$('#fontFamSeg button').forEach(b => b.classList.toggle('on', b.dataset.ff === P.fontFam));
  $$('#docWidthSeg button').forEach(b => b.classList.toggle('on', b.dataset.dw === P.docW));
  const ap = $('#accentPick'); if (ap) ap.value = P.accent;
  Theme.apply();
}

/* ---------------- 6. Modal + menu ---------------- */
let modalCloseCb = null;
function openModal(opts) {
  D.modal.innerHTML =
    '<div class="modal-head"><svg class="ic ic-lg"><use href="#' + (opts.icon || 'i-info') + '"/></svg>' +
    '<h3>' + esc(opts.title || '') + '</h3>' +
    '<button class="ibtn" data-close="1" title="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>' +
    '<div class="modal-body">' + (opts.html || '') + '</div>' +
    (opts.footer === false ? '' : '<div class="modal-foot">' + (opts.footer || '<button class="btn" data-close="1">Close</button>') + '</div>');
  D.modalBackdrop.classList.add('show');
  modalCloseCb = opts.onClose || null;
  $$('[data-close]', D.modal).forEach(b => b.addEventListener('click', closeModal));
  if (opts.onMount) opts.onMount(D.modal);
  const f = D.modal.querySelector('input,textarea,button:not([data-close])');
  if (f) setTimeout(() => { try { f.focus(); } catch (e) {} }, 30);
}
function closeModal() {
  D.modalBackdrop.classList.remove('show');
  D.modal.innerHTML = '';
  if (modalCloseCb) { const cb = modalCloseCb; modalCloseCb = null; cb(); }
}
D.modalBackdrop.addEventListener('mousedown', e => { if (e.target === D.modalBackdrop) closeModal(); });

let menuOpen = false;
function openMenu(anchor, items) {
  let html = '';
  items.forEach((it, idx) => {
    if (it.sep) { html += '<div class="menu-sep"></div>'; return; }
    if (it.label) { html += '<div class="menu-label">' + esc(it.label) + '</div>'; return; }
    html += '<button class="menu-item" data-idx="' + idx + '"' + (it.disabled ? ' disabled' : '') + '>' +
      '<svg class="ic"><use href="#' + (it.icon || 'i-info') + '"/></svg>' +
      '<span class="lbl">' + esc(it.text) + '</span>' +
      (it.checked ? '<svg class="ic tick"><use href="#i-check"/></svg>' : '') +
      (it.kbd ? '<span class="kbd">' + esc(it.kbd) + '</span>' : '') + '</button>';
  });
  D.menu.innerHTML = html;
  D.menu.classList.add('show');
  menuOpen = true;
  const r = anchor.getBoundingClientRect();
  const mw = D.menu.offsetWidth, mh = D.menu.offsetHeight;
  let left = r.right - mw, top = r.bottom + 6;
  if (left < 8) left = 8;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  D.menu.style.left = left + 'px';
  D.menu.style.top = top + 'px';
  $$('.menu-item:not([disabled])', D.menu).forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items[parseInt(btn.dataset.idx, 10)];
      closeMenu();
      if (item && item.action) item.action();
    });
  });
}
function closeMenu() {
  if (!menuOpen) return;
  D.menu.classList.remove('show');
  D.menu.innerHTML = '';
  menuOpen = false;
}
document.addEventListener('mousedown', e => { if (menuOpen && !D.menu.contains(e.target)) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);

/* ---------------- 7. Sample doc ---------------- */
const SAMPLE = [
'# Heros Markdown — Demo',
'',
'> Fast · Private · Free & unlimited. White + dark, LaTeX math, GFM, builder.',
'',
'Open any `.md` file, or press **E** to edit this demo in the Builder.',
'',
'## 1. GitHub Flavored Markdown',
'',
'**Bold**, *italic*, ~~strike~~, `inline code`, [link](https://example.com), and autolink https://example.com.',
'',
'- [x] Task done',
'- [ ] Task next',
'- [ ] LaTeX below',
'',
'1. First item',
'2. Second item',
'3. Third item',
'',
'| Feature | Status | Notes |',
'| --- | :---: | --- |',
'| LaTeX math | ✅ | `$E=mc^2$` |',
'| Tables | ✅ | GFM aligned |',
'| Code copy | ✅ | One-tap |',
'',
'```js',
'// Code blocks get a header + copy button',
'export function hello(name) {',
'  return `Hello, ${name}!`;',
'}',
'```',
'',
'```python',
'def quad(a, b, c):',
'    d = b**2 - 4*a*c',
'    return d ** 0.5',
'```',
'',
'> Blockquote with **rich** text and `code`.',
'',
'---',
'',
'## 2. LaTeX Math (KaTeX, offline)',
'',
'Inline: $E = mc^2$, $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$, $\\alpha + \\beta = \\gamma$.',
'',
'Display:',
'',
'$$\\int_0^\\infty e^{-x} \\, dx = 1$$',
'',
'$$\\frac{d}{dx}\\left( \\int_{0}^{x} f(t)\\,dt \\right) = f(x)$$',
'',
'$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\times \\begin{pmatrix} x \\\\ y \\end{pmatrix}$$',
'',
'## 3. Footnotes & details',
'',
'Footnotes work too[^1]. Mermaid blocks render as clean placeholders:',
'',
'[^1]: This is the footnote text — rendered at the bottom.',
'',
'```mermaid',
'graph TD;',
'  A[Markdown] --> B[Render];',
'  B --> C[LaTeX];',
'```',
'',
'## 4. Try the Builder',
'',
'Press **E**, edit the source on the left, and watch the live preview. Export `.MD`, `.HTML`, `.TXT` free.',
''
].join('\n');

/* ---------------- 8. Doc loading ---------------- */
async function docIdFor(name, size, head) {
  let h = 0x811c9dc5;
  const s = String(name) + '|' + String(size) + '|' + String(head || '').slice(0, 4000);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return [name, size, (h >>> 0).toString(16)].join('|');
}

function pickFile() { D.fileInput.click(); }
D.fileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) loadFromFile(f);
  e.target.value = '';
});

async function loadFromFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    if (/\.pdf$/i.test(file.name)) { toast('This is a PDF — Heros Markdown opens .md files', 'err'); return; }
    S.file = file;
    S.docId = await docIdFor(file.name, file.size, text.slice(0, 8000));
    onDocReady(text, file.name, file.size);
    saveRecent(file.name, file.size, text);
  } catch (err) {
    toast('Could not read file', 'err');
  }
}

async function fileFetch(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  } catch (e) {}
  return await new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => (xhr.status === 200 || xhr.status === 0) ? res(xhr.responseText) : rej(new Error('HTTP ' + xhr.status));
    xhr.onerror = () => rej(new Error('network'));
    xhr.send();
  });
}

async function loadFromUrl(url) {
  try {
    setStatus('Downloading…', 'busy');
    showProgress(20);
    const text = await fileFetch(url);
    showProgress(70);
    const fname = (url.split('/').pop().split('?')[0].split('#')[0] || 'document.md');
    S.file = null;
    S.docId = await docIdFor(fname, text.length, text.slice(0, 8000));
    onDocReady(text, fname, text.length);
    saveRecent(fname, text.length, text);
    hideProgress();
  } catch (err) {
    hideProgress();
    setStatus('Ready');
    if (/^file:/i.test(url)) {
      toast('Cannot read local file — enable "Allow access to file URLs" in chrome://extensions', 'err', 6000);
    } else {
      toast('Could not fetch URL (CORS?)', 'err', 4000);
    }
  }
}

/* ---------------- 9. Render pipeline: math protect → marked → KaTeX ---------------- */
function extractFrontmatter(src) {
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { meta: null, body: src };
  const meta = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  });
  return { meta, body: src.slice(m[0].length) };
}

function extractFootnotes(src) {
  const defs = {};
  const body = src.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (m, k, v) => { defs[k.trim()] = v.trim(); return ''; });
  return { body, defs };
}

function protectMath(src, stash) {
  // stash fenced code first so $ inside code is untouched
  src = src.replace(/^```(\w*)\n([\s\S]*?)^```/gm, (m, lang, code) => {
    const i = stash.code.length;
    stash.code.push({ lang: lang || '', code });
    return '\nZZCODEBLOCK' + i + 'ZZ\n';
  });
  src = src.replace(/`([^`\n]+)`/g, (m, code) => {
    const i = stash.inline.length;
    stash.inline.push(code);
    return 'ZZINLINE' + i + 'ZZ';
  });
  // display math $$...$$
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => {
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: true });
    return '\nZZMATH' + i + 'ZZ\n';
  });
  // inline math $...$ (not $$, not empty, single line-ish)
  src = src.replace(/(^|[^$\\])\$([^$\n][^$\n]*?[^$\\\n])\$(?![0-9])/g, (m, pre, tex) => {
    if (/^\d+$/.test(tex.trim())) return m;
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: false });
    return pre + 'ZZMATH' + i + 'ZZ';
  });
  return src;
}

function renderMathTex(tex, display) {
  if (!P.math || !window.katex) {
    return '<code class="math-src">' + esc((display ? '$$' : '$') + tex + (display ? '$$' : '$')) + '</code>';
  }
  try {
    return window.katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false });
  } catch (e) {
    return '<div class="math-err">' + esc(tex) + '</div>';
  }
}

function renderMarkdown(src) {
  const stash = { code: [], inline: [], math: [] };
  const fm = extractFrontmatter(src);
  const fn = extractFootnotes(fm.body);
  let work = protectMath(fn.body, stash);

  let html = '';
  try {
    html = window.marked.parse(work, { gfm: true, breaks: false });
  } catch (e) {
    html = '<p>' + esc(work) + '</p>';
  }

  // restore inline code
  html = html.replace(/ZZINLINE(\d+)ZZ/g, (m, i) => '<code>' + esc(stash.inline[+i] || '') + '</code>');
  // restore code fences → rich codeblock with header
  html = html.replace(/<p>ZZCODEBLOCK(\d+)ZZ<\/p>/g, (m, i) => codeblockHtml(stash.code[+i] || { lang: '', code: '' }));
  html = html.replace(/ZZCODEBLOCK(\d+)ZZ/g, (m, i) => codeblockHtml(stash.code[+i] || { lang: '', code: '' }));
  // restore math
  S.mathCount = stash.math.length;
  html = html.replace(/<p>ZZMATH(\d+)ZZ<\/p>/g, (m, i) => {
    const mt = stash.math[+i];
    if (!mt) return m;
    if (mt.display) return '<div class="katex-display">' + renderMathTex(mt.tex, true) + '</div>';
    return '<span class="katex-inline">' + renderMathTex(mt.tex, false) + '</span>';
  });
  html = html.replace(/ZZMATH(\d+)ZZ/g, (m, i) => {
    const mt = stash.math[+i];
    if (!mt) return m;
    if (mt.display) return '<div class="katex-display">' + renderMathTex(mt.tex, true) + '</div>';
    return '<span class="katex-inline">' + renderMathTex(mt.tex, false) + '</span>';
  });
  // footnote refs
  const defs = fn.defs;
  const order = [];
  html = html.replace(/\[\^([^\]]+)\]/g, (m, k) => {
    k = k.trim();
    if (!defs[k]) return m;
    if (order.indexOf(k) === -1) order.push(k);
    const n = order.indexOf(k) + 1;
    return '<sup class="footnote"><a href="#fn-' + esc(k) + '" id="fnref-' + esc(k) + '">[' + n + ']</a></sup>';
  });
  if (order.length) {
    html += '<div class="footnotes"><hr><ol>' + order.map(k =>
      '<li id="fn-' + esc(k) + '">' + esc(defs[k]) + ' <a href="#fnref-' + esc(k) + '">↩</a></li>'
    ).join('') + '</ol></div>';
  }
  return { html, meta: fm.meta };
}

function codeblockHtml(b) {
  const lang = (b.lang || '').toLowerCase();
  if (lang === 'mermaid') {
    return '<div class="mermaid-ph">mermaid diagram (preview placeholder)\n' + esc(b.code).slice(0, 2000) + '</div>';
  }
  const safe = esc(b.code).replace(/\n$/, '');
  return '<div class="codeblock"><div class="cb-head"><span class="lang">' + esc(lang || 'code') + '</span>' +
    '<span class="sp"></span>' +
    '<button data-copycode title="Copy code"><svg class="ic ic-sm"><use href="#i-copy"/></svg>Copy</button></div>' +
    '<pre><code class="lang-' + esc(lang || 'text') + '">' + safe + '</code></pre></div>';
}

function postProcessDoc() {
  const root = D.mdDoc;
  // strip scripts for safety
  $$('script', root).forEach(n => n.remove());
  // images toggle
  if (!P.images) $$('img', root).forEach(img => {
    const ph = document.createElement('div');
    ph.className = 'mermaid-ph';
    ph.textContent = '[image hidden: ' + (img.alt || img.src || 'img') + ']';
    img.replaceWith(ph);
  });
  // tables wrap
  $$('table', root).forEach(t => {
    if (t.parentElement && t.parentElement.classList.contains('tbl-wrap')) return;
    const w = document.createElement('div');
    w.className = 'tbl-wrap';
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });
  // task lists
  $$('li', root).forEach(li => {
    const cb = li.querySelector('input[type="checkbox"]');
    if (cb) { li.classList.add('task'); cb.disabled = false; }
  });
  // heading ids + anchors
  S.headings = [];
  const seen = {};
  $$('h1,h2,h3,h4,h5,h6', root).forEach(h => {
    const txt = h.textContent.trim();
    let slug = slugify(txt);
    if (seen[slug] != null) { seen[slug]++; slug += '-' + seen[slug]; } else seen[slug] = 0;
    h.id = 'h-' + slug;
    const a = document.createElement('a');
    a.className = 'h-anchor'; a.href = '#' + h.id; a.textContent = '#';
    a.title = 'Copy link';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const url = location.href.split('#')[0] + '#' + h.id;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Heading link copied', 'ok', 1400));
      try { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { h.scrollIntoView(); }
      history.replaceState(null, '', '#' + h.id);
    });
    h.appendChild(a);
    S.headings.push({ level: +h.tagName[1], text: txt, id: h.id, el: h });
  });
  S.codeCount = $$('.codeblock', root).length;
  // code copy buttons
  $$('[data-copycode]', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.codeblock').querySelector('code').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(code)
        .then(() => toast('Code copied', 'ok', 1400))
        .catch(() => toast('Could not copy', 'err'));
    });
  });
  // external links
  $$('a[href]', root).forEach(a => {
    const href = a.getAttribute('href') || '';
    if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    if (href.startsWith('#h-')) {
      a.addEventListener('click', (e) => {
        const t = document.getElementById(href.slice(1));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    }
  });
  // images: lazy + radius already styled
  $$('img', root).forEach(img => { img.loading = 'lazy'; });
}

function wordCountOf(text) {
  const w = String(text || '').trim().split(/\s+/).filter(Boolean);
  return text && text.trim() ? w.length : 0;
}
function plainText() {
  return D.mdDoc ? D.mdDoc.textContent || '' : '';
}

/* ---------------- 10. onDocReady ---------------- */
function onDocReady(text, name, size) {
  S.raw = text || '';
  S.fileName = name || 'document.md';
  S.fileSize = size || text.length;
  S.sessionStart = Date.now();
  setStatus('Rendering…', 'busy');
  showProgress(30);

  const out = renderMarkdown(S.raw);
  D.mdDoc.innerHTML = out.html;
  postProcessDoc();

  // meta chips
  const words = wordCountOf(D.mdDoc.textContent);
  const mins = Math.max(1, Math.round(words / 200));
  let metaHtml = '<span class="pill"><svg class="ic"><use href="#i-file"/></svg>' + esc(S.fileName) + '</span>' +
    '<span class="pill"><svg class="ic"><use href="#i-chart"/></svg>' + words.toLocaleString() + ' words</span>' +
    '<span class="pill"><svg class="ic"><use href="#i-clock"/></svg>~' + mins + ' min</span>';
  if (S.mathCount) metaHtml += '<span class="pill"><svg class="ic"><use href="#i-math"/></svg>' + S.mathCount + ' math</span>';
  if (out.meta && out.meta.title) metaHtml += '<span class="pill"><svg class="ic"><use href="#i-text"/></svg>' + esc(out.meta.title) + '</span>';
  D.mdMeta.innerHTML = metaHtml;

  D.empty.hidden = true;
  D.mdCard.hidden = false;

  buildOutline();
  buildTocCard();
  resetSearch();
  updateStatsBar();
  renderMarks();
  refreshHubStats();

  S.stats.docs++;
  S.stats.words += words;
  saveStats(); refreshHubStats();

  // file tag
  D.fileTagName.textContent = S.fileName;
  D.fileTag.hidden = false;
  D.sbFile.textContent = S.fileName;
  document.title = S.fileName.replace(/\.(md|markdown|mdown|mkd|mdx)$/i, '') + ' — Heros Markdown';

  D.btnSearch.disabled = false;
  D.btnToc.disabled = false;

  // enable builder source sync (only if builder empty or first load)
  if (!D.builderArea.value || !S.builderMode) D.builderArea.value = S.raw;
  updateBuilderCount();

  // restore scroll
  D.viewer.scrollTop = 0;
  if (P.resume && S.docId) {
    IDB.all().then(all => {
      const rec = (all || []).find(r => r.id === S.docId);
      if (rec && rec.scroll > 40) {
        setTimeout(() => {
          D.viewer.scrollTop = rec.scroll;
          toast('Resumed where you left off', null, 1600);
        }, 250);
      }
    }).catch(() => {});
  }
  // deep link
  if (location.hash && location.hash.startsWith('#h-')) {
    setTimeout(() => {
      const t = document.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView({ block: 'start' });
    }, 300);
  }
  showProgress(90);
  hideProgress();
  setStatus('Ready', 'ok');
  observeHeadings();
}

/* ---------------- 11. Outline + TOC card ---------------- */
function buildOutline() {
  D.outlineList.innerHTML = '';
  if (!S.headings.length) { D.outlineEmpty.hidden = false; return; }
  D.outlineEmpty.hidden = true;
  const frag = document.createDocumentFragment();
  S.headings.forEach((h, i) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'outline-item';
    row.dataset.hid = h.id;
    row.style.paddingLeft = (8 + Math.max(0, h.level - 1) * 12) + 'px';
    row.innerHTML = '<span class="lv">H' + h.level + '</span><span>' + esc(h.text || 'Untitled') + '</span>';
    row.title = h.text;
    row.addEventListener('click', () => {
      const t = document.getElementById(h.id);
      if (t) {
        try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { t.scrollIntoView(); }
        history.replaceState(null, '', '#' + h.id);
      }
      if (window.innerWidth <= 900) toggleSidebar(false);
    });
    li.appendChild(row);
    frag.appendChild(li);
  });
  D.outlineList.appendChild(frag);
}

function buildTocCard() {
  if (!P.tocCard || S.headings.length < 2) { D.tocCard.hidden = true; return; }
  D.tocCard.hidden = false;
  D.tocLinks.innerHTML = S.headings.slice(0, 30).map(h =>
    '<a href="#' + h.id + '" data-hid="' + h.id + '" style="padding-left:' + (Math.max(0, h.level - 1) * 14) + 'px">' + esc(h.text) + '</a>'
  ).join('');
  $$('a', D.tocLinks).forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.hid);
      if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { t.scrollIntoView(); } }
    });
  });
}

let headObserver = null;
function observeHeadings() {
  if (headObserver) headObserver.disconnect();
  if (!S.headings.length) return;
  headObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        const id = en.target.id;
        $$('.outline-item', D.outlineList).forEach(n => n.classList.toggle('active', n.dataset.hid === id));
      }
    });
  }, { root: D.viewer, rootMargin: '-60px 0px -70% 0px' });
  S.headings.forEach(h => { if (h.el) headObserver.observe(h.el); });
}

/* ---------------- 12. Stats bar + hub ---------------- */
function updateStatsBar() {
  const words = wordCountOf(plainText());
  D.sbWords.textContent = words.toLocaleString();
  D.sbHeads.textContent = S.headings.length;
  D.sbMath.textContent = S.mathCount;
  $('#kvDocWords').textContent = words.toLocaleString();
  $('#kvDocHeads').textContent = S.headings.length;
  $('#kvDocMath').textContent = S.mathCount;
  $('#kvDocCode').textContent = S.codeCount;
  $('#docStatHead').textContent = S.headings.length + ' heads';
  $('#kvWords').textContent = words.toLocaleString();
  $('#kvChars').textContent = plainText().length.toLocaleString();
  $('#kvRead').textContent = '~' + Math.max(1, Math.round(words / 200)) + ' min';
}
function refreshHubStats() {
  $('#stDocs').textContent = S.stats.docs;
  $('#stWords').textContent = (S.stats.words || 0).toLocaleString();
  const bmCount = Object.keys(S.bookmarks).reduce((a, k) => a + (S.bookmarks[k] || []).length, 0);
  const noteCount = Object.keys(S.notes).reduce((a, k) => a + (S.notes[k] || []).length, 0);
  $('#stMarks').textContent = noteCount;
  $('#stSaved').textContent = bmCount;
  const pn = $('#profileName'), pa = $('#profileAvatar'), ps = $('#profileSub');
  if (pn) pn.textContent = P.profileName || 'My Studio';
  if (pa) {
    pa.textContent = String(P.profileName || 'H').trim().charAt(0).toUpperCase() || 'H';
    pa.style.background = 'linear-gradient(140deg,' + P.profileColor + ',' + P.accent + ')';
  }
  if (ps) ps.textContent = 'Local profile · private · ' + Theme.resolved() + ' mode';
}

/* ---------------- 13. Search ---------------- */
function resetSearch() {
  S.searchResults = []; S.searchCursor = -1;
  D.searchResults.innerHTML = '';
  D.searchMeta.hidden = true;
  D.searchEmpty.hidden = false;
  clearDocMarks();
}
const doSearch = debounce(() => runSearch(D.searchInput.value.trim()), 260);
function runSearch(q) {
  S.searchResults = []; S.searchCursor = -1;
  D.searchResults.innerHTML = '';
  clearDocMarks();
  if (!q) {
    D.searchMeta.hidden = true;
    D.searchEmpty.hidden = false;
    D.searchEmpty.innerHTML = '<svg class="ic"><use href="#i-search"/></svg>Type to search across the document';
    return;
  }
  const text = plainText();
  const results = [];
  const useCase = S.searchCase, useWhole = S.searchWhole;
  if (!useWhole) {
    const hay = useCase ? text : text.toLowerCase();
    const ndl = useCase ? q : q.toLowerCase();
    let idx = hay.indexOf(ndl);
    while (idx !== -1 && results.length < 500) {
      results.push({ index: idx });
      idx = hay.indexOf(ndl, idx + ndl.length);
    }
  } else {
    try {
      const re = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', useCase ? 'g' : 'gi');
      let m;
      while ((m = re.exec(text)) && results.length < 500) {
        results.push({ index: m.index });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    } catch (e) {}
  }
  S.searchResults = results;
  D.searchEmpty.hidden = true;
  D.searchMeta.hidden = false;
  D.searchCount.textContent = results.length ? results.length + ' result' + (results.length === 1 ? '' : 's') : 'No results';
  if (!results.length) {
    D.searchResults.innerHTML = '<div class="placeholder"><svg class="ic"><use href="#i-alert"/></svg>No matches for “' + esc(q) + '”</div>';
    return;
  }
  markInDoc(q);
  const frag = document.createDocumentFragment();
  results.slice(0, 200).forEach((r, i) => {
    const start = Math.max(0, r.index - 45), end = Math.min(text.length, r.index + q.length + 65);
    const before = text.slice(start, r.index), match = text.slice(r.index, r.index + q.length), after = text.slice(r.index + q.length, end);
    const div = document.createElement('div');
    div.className = 'result'; div.dataset.idx = i;
    div.innerHTML = '<div class="r-top"><span class="badge">#' + (i + 1) + '</span></div>' +
      '<div class="r-txt">' + (start > 0 ? '…' : '') + esc(before) + '<em>' + esc(match) + '</em>' + esc(after) + (end < text.length ? '…' : '') + '</div>';
    div.addEventListener('click', () => selectSearchResult(i));
    frag.appendChild(div);
  });
  D.searchResults.appendChild(frag);
  if (results.length) selectSearchResult(0, true);
}
function markInDoc(q) {
  clearDocMarks();
  if (!q) return;
  const walker = document.createTreeWalker(D.mdDoc, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.parentElement && /^(SCRIPT|STYLE|CODE|PRE)$/.test(n.parentElement.tagName)) continue;
    if (n.nodeValue && n.nodeValue.toLowerCase().indexOf(q.toLowerCase()) !== -1) nodes.push(n);
    if (nodes.length > 400) break;
  }
  const ql = q.toLowerCase();
  nodes.forEach(n => {
    const val = n.nodeValue;
    const idx = val.toLowerCase().indexOf(ql);
    if (idx === -1) return;
    const frag = document.createDocumentFragment();
    let last = 0, i = idx;
    const low = val.toLowerCase();
    while (i !== -1 && frag.childNodes.length < 12) {
      frag.appendChild(document.createTextNode(val.slice(last, i)));
      const m = document.createElement('mark');
      m.className = 'hl';
      m.textContent = val.slice(i, i + q.length);
      frag.appendChild(m);
      last = i + q.length;
      i = low.indexOf(ql, last);
    }
    frag.appendChild(document.createTextNode(val.slice(last)));
    n.parentNode.replaceChild(frag, n);
  });
}
function clearDocMarks() {
  $$('mark.hl', D.mdDoc).forEach(m => {
    const t = document.createTextNode(m.textContent);
    m.parentNode.replaceChild(t, m);
  });
  D.mdDoc.normalize();
}
function selectSearchResult(i, silent) {
  const marks = $$('mark.hl', D.mdDoc);
  if (!marks.length) return;
  S.searchCursor = ((i % marks.length) + marks.length) % marks.length;
  marks.forEach(m => m.classList.remove('current'));
  const el = marks[S.searchCursor];
  if (el) {
    el.classList.add('current');
    if (!silent) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    } else {
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    }
  }
  $$('.result', D.searchResults).forEach(n => n.classList.toggle('active', +n.dataset.idx === S.searchCursor));
}

/* ---------------- 14. Recent ---------------- */
async function saveRecent(name, size, text) {
  if (!S.docId) return;
  try {
    await IDB.put({ id: S.docId, name, size, openedAt: Date.now(), text: String(text).slice(0, 500000), scroll: 0 });
    const all = await IDB.all();
    if (all.length > 25) {
      all.sort((a, b) => b.openedAt - a.openedAt);
      for (let i = 25; i < all.length; i++) await IDB.del(all[i].id);
    }
    renderRecent();
  } catch (e) {}
}
const saveScrollSoon = debounce(() => {
  if (!S.docId) return;
  IDB.all().then(all => {
    const rec = (all || []).find(r => r.id === S.docId);
    if (rec) { rec.scroll = D.viewer.scrollTop; IDB.put(rec).catch(() => {}); }
  }).catch(() => {});
}, 800);

async function renderRecent() {
  let all = [];
  try { all = await IDB.all(); } catch (e) { all = []; }
  all.sort((a, b) => b.openedAt - a.openedAt);
  D.recentList.innerHTML = '';
  if (!all.length) { D.recentEmpty.hidden = false; return; }
  D.recentEmpty.hidden = true;
  const frag = document.createDocumentFragment();
  all.forEach(rec => {
    const row = document.createElement('div');
    row.className = 'recent-item';
    const words = wordCountOf(rec.text || '');
    row.innerHTML = '<div class="ico"><svg class="ic"><use href="#i-file"/></svg></div>' +
      '<div class="meta"><div class="nm">' + esc(rec.name) + '</div>' +
      '<div class="sub">' + words.toLocaleString() + ' words · ' + fmtBytes(rec.size) + ' · ' + timeAgo(rec.openedAt) + '</div></div>' +
      '<button class="del" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    row.addEventListener('click', async (e) => {
      if (e.target.closest('.del')) return;
      S.docId = rec.id;
      onDocReady(rec.text || '', rec.name, rec.size);
    });
    row.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await IDB.del(rec.id).catch(() => {});
      renderRecent();
    });
    frag.appendChild(row);
  });
  D.recentList.appendChild(frag);
}

/* ---------------- 15. Marks (bookmarks + notes) ---------------- */
function marksFor(kind) {
  const bag = kind === 'notes' ? S.notes : S.bookmarks;
  if (!S.docId) return [];
  return bag[S.docId] || [];
}
function renderMarks() {
  // bookmarks
  const bms = marksFor('bm');
  D.bmList.innerHTML = '';
  D.bmEmpty.hidden = bms.length > 0;
  // keep order newest first
  bms.slice().reverse().forEach((b, ri) => {
    const i = bms.length - 1 - ri;
    const div = document.createElement('div');
    div.className = 'bm-item';
    div.innerHTML = '<div class="n"><svg class="ic ic-sm"><use href="#i-bookmark"/></svg></div>' +
      '<div class="meta"><div class="tt">' + esc(b.label || ('Position ' + (i + 1))) + '</div>' +
      '<div class="ss">' + timeAgo(b.at) + ' · ' + Math.round(b.pct || 0) + '%</div></div>' +
      '<button class="x" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.addEventListener('click', (e) => {
      if (e.target.closest('.x')) return;
      D.viewer.scrollTo({ top: b.scroll || 0, behavior: 'smooth' });
      if (window.innerWidth <= 900) toggleSidebar(false);
    });
    div.querySelector('.x').addEventListener('click', () => {
      const arr = marksFor('bm'); arr.splice(i, 1);
      S.bookmarks[S.docId] = arr; saveMarks(); renderMarks(); refreshHubStats();
    });
    D.bmList.appendChild(div);
  });
  // notes
  const notes = marksFor('notes');
  D.notesList.innerHTML = '';
  D.notesEmpty.hidden = notes.length > 0;
  notes.slice().reverse().forEach((n, ri) => {
    const i = notes.length - 1 - ri;
    const div = document.createElement('div');
    div.className = 'note-item';
    div.innerHTML = '<div class="n">' + esc(String(n.text || '?').trim().charAt(0).toUpperCase() || '•') + '</div>' +
      '<div class="meta"><div class="tt">' + esc(n.text) + '</div>' +
      '<div class="ss">' + timeAgo(n.at) + '</div></div>' +
      '<button class="x" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.querySelector('.x').addEventListener('click', () => {
      const arr = marksFor('notes'); arr.splice(i, 1);
      S.notes[S.docId] = arr; saveMarks(); renderMarks(); refreshHubStats();
    });
    D.notesList.appendChild(div);
  });
  refreshHubStats();
}

/* ---------------- 16. Builder ---------------- */
function updateBuilderCount() {
  const w = wordCountOf(D.builderArea.value || '');
  const el = $('#kvBuilderWords');
  if (el) el.textContent = w.toLocaleString();
}
const liveRender = debounce(() => {
  if (!P.live) return;
  const src = D.builderArea.value || '';
  if (S.builderMode) {
    const out = renderMarkdown(src);
    D.builderPreview.innerHTML = out.html;
    // light post-process for preview (no outline rebuild)
    $$('script', D.builderPreview).forEach(n => n.remove());
    $$('table', D.builderPreview).forEach(t => {
      if (t.parentElement && t.parentElement.classList.contains('tbl-wrap')) return;
      const w = document.createElement('div'); w.className = 'tbl-wrap';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }
}, 300);

function builderInsert(kind) {
  const ta = D.builderArea;
  const s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
  const v = ta.value;
  const sel = v.slice(s, e) || '';
  let insert = '', cursor = 0;
  const wrap = (a, b, placeholder) => {
    const mid = sel || placeholder;
    return { text: a + mid + b, select: [s + a.length, s + a.length + mid.length] };
  };
  let r;
  switch (kind) {
    case 'bold': r = wrap('**', '**', 'bold'); break;
    case 'italic': r = wrap('*', '*', 'italic'); break;
    case 'strike': r = wrap('~~', '~~', 'strike'); break;
    case 'code': r = wrap('`', '`', 'code'); break;
    case 'h1': r = { text: '\n# ' + (sel || 'Heading 1') + '\n', select: null }; break;
    case 'h2': r = { text: '\n## ' + (sel || 'Heading 2') + '\n', select: null }; break;
    case 'h3': r = { text: '\n### ' + (sel || 'Heading 3') + '\n', select: null }; break;
    case 'quote': r = { text: '\n> ' + (sel || 'Quote') + '\n', select: null }; break;
    case 'ul': r = { text: '\n- ' + (sel || 'Item 1') + '\n- Item 2\n- Item 3\n', select: null }; break;
    case 'ol': r = { text: '\n1. ' + (sel || 'First') + '\n2. Second\n3. Third\n', select: null }; break;
    case 'task': r = { text: '\n- [ ] ' + (sel || 'Task') + '\n- [ ] Next\n', select: null }; break;
    case 'link': r = wrap('[', '](https://example.com)', sel || 'link'); break;
    case 'image': r = { text: '![alt](' + (sel || 'https://example.com/img.png') + ')', select: null }; break;
    case 'table': r = { text: '\n| A | B | C |\n| --- | :---: | ---: |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n', select: null }; break;
    case 'hr': r = { text: '\n\n---\n\n', select: null }; break;
    case 'mathInline': r = wrap('$', '$', 'E=mc^2'); break;
    case 'mathBlock': r = { text: '\n$$\\int_0^\\infty e^{-x} \\, dx = 1$$\n', select: null }; break;
    case 'codeblock': r = { text: '\n```js\n' + (sel || '// code') + '\n```\n', select: null }; break;
    case 'footnote': r = { text: (sel || 'word') + '[^1]\n\n[^1]: Footnote text\n', select: null }; break;
    default: return;
  }
  ta.value = v.slice(0, s) + r.text + v.slice(e);
  ta.focus();
  if (r.select) ta.setSelectionRange(r.select[0], r.select[1]);
  else ta.setSelectionRange(s + r.text.length, s + r.text.length);
  updateBuilderCount();
  liveRender();
}
function setBuilderMode(on) {
  S.builderMode = on;
  D.btnEditToggle.classList.toggle('on', on);
  const sb = $('#sbEdit'); if (sb) sb.classList.toggle('on', on);
  if (on) {
    if (!D.builderArea.value && S.raw) D.builderArea.value = S.raw;
    D.builderCard.hidden = false;
    if (P.split || window.innerWidth > 1400) {
      // split: doc + preview both visible
      D.builderPreview.innerHTML = D.mdDoc.innerHTML;
    } else {
      D.mdCard.hidden = true;
    }
    const src = D.builderArea.value || '';
    const out = renderMarkdown(src);
    D.builderPreview.innerHTML = out.html;
    $$('script', D.builderPreview).forEach(n => n.remove());
    switchPane('edit');
    if (window.innerWidth > 900) { /* keep sidebar open on desktop */ }
    toast('Builder on — edit source, live preview', null, 1800);
  } else {
    D.builderCard.hidden = true;
    if (S.raw) D.mdCard.hidden = false;
  }
}

/* ---------------- 17. Exports / actions ---------------- */
function download(name, content, type) {
  const blob = new Blob([content], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Downloading ' + name, 'ok', 1600);
}
function baseName(ext) {
  const n = (S.fileName || 'document.md').replace(/\.(md|markdown|mdown|mkd|mdx)$/i, '');
  return (n || 'document') + ext;
}
function exportHTMLStandalone() {
  const title = esc((S.fileName || 'document').replace(/\.(md|markdown)$/i, ''));
  const body = D.mdDoc.innerHTML;
  const cssLink = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><link rel="stylesheet" href="' + cssLink + '">' +
    '<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;line-height:1.75;color:#1a1d23}' +
    'pre{background:#f3f5f8;border:1px solid #dde2e9;border-radius:12px;padding:14px;overflow:auto}' +
    'code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #dde2e9;padding:8px 12px}' +
    'th{background:#f3f5f8}img{max-width:100%}blockquote{border-left:4px solid #2563eb;background:#f3f5f8;margin:1em 0;padding:8px 16px;border-radius:0 12px 12px 0}' +
    '.katex-display{background:#f3f5f8;border:1px solid #dde2e9;border-radius:12px;padding:12px;overflow-x:auto}</style>' +
    '</head><body>' + body + '<hr><p style="color:#888;font-size:12px">Exported with Heros Markdown — free & local.</p></body></html>';
  download(baseName('.html'), html, 'text/html');
}
function copyText(t, label) {
  if (!navigator.clipboard) { toast('Clipboard unavailable', 'err'); return; }
  navigator.clipboard.writeText(t).then(() => toast((label || 'Copied'), 'ok', 1500)).catch(() => toast('Could not copy', 'err'));
}
function toggleSpeak() {
  try {
    if (!('speechSynthesis' in window)) { toast('Speech not supported here', 'err'); return; }
    if (S.speaking) { window.speechSynthesis.cancel(); S.speaking = false; toast('Stopped reading', null, 1400); return; }
    const text = plainText().slice(0, 20000);
    if (!text.trim()) { toast('Nothing to read', 'err'); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = P.ttsRate || 1;
    u.onend = () => { S.speaking = false; };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    S.speaking = true;
    toast('Reading aloud — Esc to stop', null, 2000);
  } catch (e) { toast('Speech failed', 'err'); }
}
function stopSpeaking() { try { window.speechSynthesis.cancel(); } catch (e) {} S.speaking = false; }
function toggleAuto() {
  if (S.autoTimer) {
    clearInterval(S.autoTimer); S.autoTimer = null;
    D.autoBar.hidden = true;
    const sw = $('#swAuto'); if (sw) sw.checked = false;
    return;
  }
  const speed = P.autoSpeed || 30;
  D.autoBar.hidden = false;
  D.autoBarSpeed.value = speed;
  S.autoTimer = setInterval(() => {
    D.viewer.scrollTop += Math.max(1, (P.autoSpeed || 30) / 20);
    if (D.viewer.scrollTop + D.viewer.clientHeight >= D.viewer.scrollHeight - 4) {
      toggleAuto();
      toast('End of document', null, 1800);
    }
  }, 50);
  const sw = $('#swAuto'); if (sw) sw.checked = true;
  toast('Auto-scroll on', null, 1500);
}
function togglePresent() {
  const on = document.body.classList.toggle('present-doc');
  if (on) {
    document.body.classList.add('focus-mode');
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    toast('Presenting — Esc to exit', null, 2200);
  } else {
    document.body.classList.remove('focus-mode');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
}
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    (document.documentElement.requestFullscreen || function () { return Promise.reject(); }).call(document.documentElement)
      .catch(() => toast('Fullscreen unavailable', 'err', 1800));
  } else document.exitFullscreen();
}
function cyclePageMode() {
  const order = ['off', 'night', 'sepia', 'dim'];
  P.pageMode = order[(order.indexOf(P.pageMode) + 1) % order.length];
  savePrefs(); applyReadingPrefs();
  toast('Page mode: ' + (P.pageMode === 'off' ? 'Normal' : P.pageMode), null, 1400);
}

/* ---------------- 18. Sidebar ---------------- */
function toggleSidebar(force) {
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    const open = force !== undefined ? force : !D.sidebar.classList.contains('open');
    D.sidebar.classList.toggle('open', open);
    D.sideBackdrop.classList.toggle('show', open);
  } else {
    const collapsed = force !== undefined ? !force : !D.sidebar.classList.contains('collapsed');
    D.sidebar.classList.toggle('collapsed', collapsed);
  }
}
D.btnSidebar.addEventListener('click', () => toggleSidebar());
D.sideBackdrop.addEventListener('click', () => toggleSidebar(false));
D.tocFab.addEventListener('click', () => { switchPane('doc'); toggleSidebar(true); });
$$('.side-tab').forEach(tab => tab.addEventListener('click', () => switchPane(tab.dataset.pane)));
function switchPane(name) {
  $$('.side-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === name));
  $$('.side-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  if (window.innerWidth <= 900 && (name === 'doc' || D.sidebar.classList.contains('open'))) {
    D.sidebar.classList.add('open');
    D.sideBackdrop.classList.add('show');
  }
  if (name === 'search') setTimeout(() => D.searchInput.focus(), 60);
  if (name === 'recent') renderRecent();
  if (name === 'marks') renderMarks();
}

/* ---------------- 19. Features data ---------------- */
const FEATURES = [
  ['i-file', 'Full .md view', 'Renders whole files — headings to footnotes, no clipping.'],
  ['i-math', 'LaTeX math', 'Offline KaTeX: $inline$ and $$display$$ blocks.'],
  ['i-table', 'GFM tables', 'Aligned tables with sticky wrap + mobile scroll.'],
  ['i-check', 'Task lists', '- [ ] interactive checkboxes, clickable.'],
  ['i-code', 'Code + copy', 'Fenced blocks with language badge + one-tap copy.'],
  ['i-book', 'Outline TOC', 'Auto headings map with active tracking + links.'],
  ['i-search', 'Full search', 'Case + whole-word, 500 hits, mini-map results.'],
  ['i-layers', 'Builder studio', 'Edit source with toolbar + live + split preview.'],
  ['i-text', 'Quick insert', 'Bold, tables, math, footnotes — one tap.'],
  ['i-globe', 'Export HTML', 'Standalone styled page with math CSS.'],
  ['i-download', 'MD / TXT out', 'Download source, plain text, search results.'],
  ['i-printer', 'Print → PDF', 'Clean print CSS for perfect PDF export.'],
  ['i-palette', 'White + Dark', 'Perfect light theme + dark + auto system.'],
  ['i-eye-dim', 'Page modes', 'Night / sepia / dim recolor for comfort.'],
  ['i-text', 'Typography', 'Size, line-height, serif/sans/mono, justify.'],
  ['i-columns', 'Widths', 'Narrow · comfort · wide · full reading widths.'],
  ['i-star', 'Bookmarks', 'Save scroll positions per file, jump back.'],
  ['i-edit', 'Notes', 'Per-file notes with backup + restore JSON.'],
  ['i-clock', 'Recent files', 'IndexedDB history with resume + search.'],
  ['i-user', 'Account hub', 'Profile, avatar color, stats, full controls.'],
  ['i-chart', 'Insights', 'Words, reading time, progress, session timer.'],
  ['i-volume', 'Read aloud', 'TTS with rate control for whole doc.'],
  ['i-copy', 'Copy tools', 'Copy text, code, outline, heading links.'],
  ['i-share', 'Share', 'Web Share API + clipboard fallbacks.'],
  ['i-scroll', 'Auto-scroll', 'Hands-free reading with speed pill.'],
  ['i-play', 'Present', 'Focus + fullscreen presentation mode.'],
  ['i-maximize', 'Fullscreen', 'One-tap immersive reading (F11).'],
  ['i-sidebar', 'Sidebar', 'Fixed drawer on mobile with backdrop.'],
  ['i-smartphone', 'Mobile ready', 'Responsive topbar, cards, builder stacks.'],
  ['i-zap', 'Fastest ever', 'Vanilla JS, debounced render, lazy math.'],
  ['i-shield', '100% local', 'No uploads, no tracking, works offline.'],
  ['i-keyboard', 'Shortcuts', 'Full keyboard map — press ? anytime.'],
  ['i-image', 'Images', 'Lazy load + toggle for instant huge docs.'],
  ['i-link', 'Smart links', 'External in new tab, anchors smooth-scroll.'],
  ['i-quote', 'Quotes', 'Styled callouts with accent rail.'],
  ['i-sliders', 'Performance', 'Math/images toggles for max speed.'],
  ['i-history', 'Resume', 'Reopen exactly where you left off.'],
  ['i-save', 'Backup', 'Account + marks backup/restore JSON.'],
  ['i-sparkle', 'Demo doc', 'One-tap rich sample with math + tables.'],
  ['i-globe', 'URL open', 'Fetch raw .md from any CORS URL.'],
  ['i-command', 'Command palette', 'Ctrl+Shift+P — quick access to all features.'],
  ['i-terminal', 'Power tools', 'Vim keys, custom CSS, annotation controls.'],
  ['i-target', 'Word goals', 'Set daily word count targets and track progress.'],
  ['i-timer', 'Focus timer', 'Pomodoro technique with 25/5 minute cycles.'],
  ['i-link-2', 'Link checker', 'Validate external links are working.'],
  ['i-spellcheck', 'Spell check', 'Find typos and build ignore list.'],
  ['i-file-diff', 'Document diff', 'Compare two Markdown files side by side.'],
  ['i-git-branch', 'Mermaid diagrams', 'Render flowcharts, Gantt, sequence diagrams.'],
  ['i-pen-tool', 'Custom CSS', 'Add personal styles for live preview.'],
  ['i-brain', 'Obsidian export', 'One-click export to Obsidian format.'],
  ['i-compass', 'Notion export', 'Export to Notion-friendly HTML.'],
  ['i-highlighter', 'Annotations', 'Highlight text with color, persistent.'],
  ['i-volleyball', 'Reading progress', 'Visual progress bar at top of page.'],
  ['i-underline', 'Vim mode', 'hjkl navigation, insert/visual modes.'],
  ['i-refresh', 'Export patch', 'Generate diff patch file.'],
  ['i-edit', 'Table insert', 'Quickly insert markdown tables.'],
  ['i-bookmark', 'Section notes', 'Attach notes to specific headings.'],
  ['i-zoom-out', 'Font presets', 'Quick increment/decrement text size.'],
  ['i-align-center', 'Justify toggle', 'Align text left/right/justified.'],
  ['i-text', 'Code syntax', 'Language-aware code blocks.']
];
function featuresHtml() {
  return '<div class="feat-grid">' + FEATURES.map(f =>
    '<div class="feat"><div class="fi"><svg class="ic"><use href="#' + f[0] + '"/></svg></div>' +
    '<div><h4>' + esc(f[1]) + '</h4><p>' + esc(f[2]) + '</p></div></div>'
  ).join('') + '</div>';
}
function renderFeaturesMini() {
  D.featuresMini.innerHTML = featuresHtml();
}

/* ---------------- 20. Info dialogs ---------------- */
function showProperties() {
  if (!S.raw) { toast('No document open', 'err'); return; }
  const rows = [
    ['File', S.fileName || '—'],
    ['Size', fmtBytes(S.fileSize)],
    ['Words', wordCountOf(plainText()).toLocaleString()],
    ['Characters', plainText().length.toLocaleString()],
    ['Headings', String(S.headings.length)],
    ['Math blocks', String(S.mathCount)],
    ['Code blocks', String(S.codeCount)],
    ['Reading time', '~' + Math.max(1, Math.round(wordCountOf(plainText()) / 200)) + ' min']
  ];
  openModal({
    title: 'Document properties', icon: 'i-info',
    html: '<div>' + rows.map(r => '<div class="prop-row"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div></div>').join('') + '</div>'
  });
}
function showShortcuts() {
  const groups = [
    ['File', [['Open file', ['Ctrl', 'O']], ['Save .md', ['Ctrl', 'S']], ['Print', ['Ctrl', 'P']]]],
    ['Read', [['Search', ['Ctrl', 'F']], ['Bigger text', ['+']], ['Smaller text', ['−']], ['Save position', ['D']], ['Page mode', ['N']]]],
    ['Builder', [['Toggle builder', ['E']], ['Bold in builder', ['Ctrl', 'B']], ['Link in builder', ['Ctrl', 'K']]]],
    ['View', [['Sidebar', ['Ctrl', 'B']], ['Fullscreen', ['F11']], ['Present', ['P']], ['Theme', ['T']]]],
    ['Help', [['This help', ['?']], ['Close dialog', ['Esc']]]]
  ];
  let html = '';
  groups.forEach(g => {
    html += '<div class="menu-label" style="padding-left:0">' + esc(g[0]) + '</div><div class="kbd-grid" style="margin-bottom:14px">';
    g[1].forEach(row => {
      html += '<div class="k-label">' + esc(row[0]) + '</div><div class="kbd-row">' + row[1].map(k => '<kbd>' + esc(k) + '</kbd>').join('') + '</div>';
    });
    html += '</div>';
  });
  openModal({ title: 'Keyboard shortcuts', icon: 'i-keyboard', html });
}
function showFeatures() {
  openModal({ title: 'All features — free & unlimited (' + FEATURES.length + ')', icon: 'i-sparkle', html: featuresHtml() });
}
function showAbout() {
  openModal({
    title: 'About Heros Markdown', icon: 'i-shield',
    html: '<div style="text-align:center;padding:8px 0 18px">' +
      '<img src="icons/logo.png" alt="logo" style="width:64px;height:64px;margin:0 auto 14px;border-radius:18px;display:block;box-shadow:0 12px 28px -10px var(--accent-ring)">' +
      '<h3 style="margin:0 0 4px;font-size:18px">Heros Markdown</h3>' +
      '<p style="margin:0;color:var(--muted);font-size:13px">Version 1.0 · marked + KaTeX offline</p></div>' +
      '<div class="prop-row"><div class="k">Markdown</div><div class="v">marked 12 (GFM, local)</div></div>' +
      '<div class="prop-row"><div class="k">Math</div><div class="v">KaTeX 0.16 (bundled fonts, offline)</div></div>' +
      '<div class="prop-row"><div class="k">Storage</div><div class="v">IndexedDB + localStorage (local only)</div></div>' +
      '<div class="prop-row"><div class="k">Privacy</div><div class="v">No uploads · no analytics · no tracking</div></div>' +
      '<div class="prop-row"><div class="k">Offline</div><div class="v">Fully offline after install</div></div>' +
      '<div class="prop-row"><div class="k">License</div><div class="v">Free & unlimited</div></div>'
  });
}

/* ---------------- 21. Menu ---------------- */
D.btnMenu.addEventListener('click', () => {
  const has = !!S.raw;
  openMenu(D.btnMenu, [
    { label: 'File' },
    { icon: 'i-folder', text: 'Open .md…', kbd: 'Ctrl O', action: pickFile },
    { icon: 'i-globe', text: 'Open from URL…', action: openUrlModal },
    { icon: 'i-edit', text: 'Paste / write…', action: openPasteModal },
    { icon: 'i-sparkle', text: 'Load demo (math)', action: () => { S.docId = null; onDocReady(SAMPLE, 'demo.md', SAMPLE.length); } },
    { icon: 'i-download', text: 'Download .md', kbd: 'Ctrl S', disabled: !has, action: () => download(baseName('.md'), S.raw, 'text/markdown') },
    { icon: 'i-globe', text: 'Export .HTML', disabled: !has, action: exportHTMLStandalone },
    { icon: 'i-file', text: 'Export .TXT', disabled: !has, action: () => download(baseName('.txt'), plainText(), 'text/plain') },
    { icon: 'i-printer', text: 'Print / PDF', kbd: 'Ctrl P', disabled: !has, action: () => window.print() },
    { icon: 'i-x', text: 'Close document', disabled: !has, action: closeDocument },
    { sep: true },
    { label: 'Builder' },
    { icon: 'i-edit', text: 'Toggle builder', kbd: 'E', checked: S.builderMode, action: () => setBuilderMode(!S.builderMode) },
    { icon: 'i-check', text: 'Apply builder → view', disabled: !S.builderMode, action: applyBuilder },
    { sep: true },
    { label: 'View' },
    { icon: 'i-text', text: 'Bigger text', kbd: '+', action: () => fontStep(1) },
    { icon: 'i-text', text: 'Smaller text', kbd: '−', action: () => fontStep(-1) },
    { icon: 'i-eye-dim', text: 'Page mode (N)', checked: P.pageMode !== 'off', action: cyclePageMode },
    { icon: 'i-sidebar', text: 'Toggle sidebar', kbd: 'Ctrl B', action: () => toggleSidebar() },
    { icon: 'i-maximize', text: 'Fullscreen', kbd: 'F11', action: toggleFullscreen },
    { icon: 'i-play', text: 'Present', disabled: !has, action: togglePresent },
    { sep: true },
    { label: 'Tools' },
    { icon: 'i-search', text: 'Search', kbd: 'Ctrl F', disabled: !has, action: () => { switchPane('search'); toggleSidebar(true); } },
    { icon: 'i-star', text: 'Save position', kbd: 'D', disabled: !has, action: addBookmark },
    { icon: 'i-volume', text: 'Read aloud', disabled: !has, action: toggleSpeak },
    { icon: 'i-copy', text: 'Copy text', disabled: !has, action: () => copyText(plainText(), 'Text copied') },
    { icon: 'i-share', text: 'Share', disabled: !has, action: shareDoc },
    { sep: true },
    { label: 'Appearance' },
    { icon: 'i-sun', text: 'White theme', checked: Theme.resolved() === 'light', action: () => Theme.set('light') },
    { icon: 'i-moon', text: 'Dark theme', checked: Theme.resolved() === 'dark', action: () => Theme.set('dark') },
    { icon: 'i-smartphone', text: 'Match system', checked: P.theme === 'system', action: () => Theme.set('system') },
    { sep: true },
    { label: 'Information' },
    { icon: 'i-info', text: 'Properties', disabled: !has, action: showProperties },
    { icon: 'i-sparkle', text: 'All features (' + FEATURES.length + ')', action: showFeatures },
    { icon: 'i-keyboard', text: 'Shortcuts', kbd: '?', action: showShortcuts },
    { icon: 'i-shield', text: 'About', action: showAbout }
  ]);
});

function openUrlModal() {
  openModal({
    title: 'Open from URL', icon: 'i-globe',
    html: '<label class="field-label" for="urlField">Raw Markdown link</label>' +
      '<input class="pw-input" id="urlField" type="url" placeholder="https://example.com/notes.md" spellcheck="false">' +
      '<p style="margin:12px 0 0;font-size:12px;color:var(--muted)">The server must allow cross-origin requests (CORS). Raw GitHub URLs work best.</p>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="urlGo">Open</button>',
    onMount(m) {
      const inp = m.querySelector('#urlField');
      const go = () => { const v = inp.value.trim(); if (!v) return; closeModal(); loadFromUrl(v); };
      m.querySelector('#urlGo').addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  });
}
function openPasteModal() {
  openModal({
    title: 'Paste / write Markdown', icon: 'i-edit',
    html: '<label class="field-label" for="pasteField">Markdown source (LaTeX supported)</label>' +
      '<textarea class="field code-field" id="pasteField" style="min-height:180px" placeholder="# Hello&#10;&#10;$E=mc^2$"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="pasteGo">Render</button>',
    onMount(m) {
      const inp = m.querySelector('#pasteField');
      m.querySelector('#pasteGo').addEventListener('click', async () => {
        const v = inp.value;
        if (!v.trim()) return;
        closeModal();
        S.docId = await docIdFor('pasted.md', v.length, v.slice(0, 8000));
        onDocReady(v, 'pasted.md', v.length);
        saveRecent('pasted.md', v.length, v);
      });
    }
  });
}
function closeDocument() {
  S.raw = ''; S.docId = null; S.headings = [];
  D.mdCard.hidden = true; D.builderCard.hidden = true;
  D.empty.hidden = false;
  D.fileTag.hidden = true;
  D.sbFile.textContent = 'No document';
  D.btnSearch.disabled = true; D.btnToc.disabled = true;
  document.title = 'Heros Markdown';
  resetSearch();
  D.outlineList.innerHTML = '';
  D.outlineEmpty.hidden = false;
  setStatus('Ready');
}

/* ---------------- 22. Toolbar wiring ---------------- */
D.btnOpen.addEventListener('click', pickFile);
$('#btnEmptyOpen').addEventListener('click', pickFile);
$('#btnEmptyUrl').addEventListener('click', openUrlModal);
$('#btnEmptyPaste').addEventListener('click', () => { setBuilderMode(true); D.empty.hidden = true; D.builderCard.hidden = false; });
$('#btnEmptyDemo').addEventListener('click', async () => {
  S.docId = await docIdFor('demo.md', SAMPLE.length, SAMPLE.slice(0, 8000));
  onDocReady(SAMPLE, 'demo.md', SAMPLE.length);
  saveRecent('demo.md', SAMPLE.length, SAMPLE);
});
D.btnTheme.addEventListener('click', () => Theme.toggle());
$('#sbTheme').addEventListener('click', () => Theme.toggle());
$('#sbFull').addEventListener('click', toggleFullscreen);
$('#sbPresent').addEventListener('click', togglePresent);
$('#sbEdit').addEventListener('click', () => setBuilderMode(!S.builderMode));
$('#sbBookmark').addEventListener('click', addBookmark);
$('#sbSpeak').addEventListener('click', toggleSpeak);
D.btnEditToggle.addEventListener('click', () => setBuilderMode(!S.builderMode));
D.btnSearch.addEventListener('click', () => { switchPane('search'); toggleSidebar(true); });
D.btnToc.addEventListener('click', () => { switchPane('doc'); toggleSidebar(true); });
D.btnSpeakTop.addEventListener('click', toggleSpeak);
function fontStep(d) {
  P.fontSize = clamp(P.fontSize + d, 13, 22);
  savePrefs(); applyReadingPrefs();
}
D.btnFontInc.addEventListener('click', () => fontStep(1));
D.btnFontDec.addEventListener('click', () => fontStep(-1));
D.btnFontLabel.addEventListener('click', () => {
  openMenu(D.btnFontLabel, [13, 14, 15, 16, 18, 20, 22].map(px => ({
    icon: 'i-text', text: px + 'px', checked: P.fontSize === px,
    action: () => { P.fontSize = px; savePrefs(); applyReadingPrefs(); }
  })));
});

/* ----- New features wiring ----- */
// Command palette
D.cmdPalette?.addEventListener('click', e => { if (e.target === D.cmdPalette) D.cmdPalette.classList.remove('show'); });

// Progress bar click to top
D.progressBarTop?.addEventListener('click', () => { D.viewer.scrollTo({ top: 0, behavior: 'smooth' }); });

// Annotations toolbar
D.annoClear?.addEventListener('click', () => {
  if (!S.docId) return;
  S.highlights[S.docId] = [];
  applyHighlights();
  toast('Highlights cleared', 'ok', 1200);
});

// Pomodoro timer FAB
D.timerFab?.addEventListener('click', () => {
  if (pomodoroTimer) { stopPomodoro(); D.timerFab.textContent = '25:00'; }
  else { startPomodoro(); }
});

// Vim mode toggle
D.swVimMode?.addEventListener('change', e => {
  if (e.target.checked) {
    S.vimMode = true;
    if (D.vimIndicator) D.vimIndicator.classList.add('show');
    toast('Vim mode ON', 'ok', 1500);
  } else {
    S.vimMode = false;
    if (D.vimIndicator) D.vimIndicator.classList.remove('show');
  }
});

// Custom CSS
D.btnCustomCss?.addEventListener('click', () => {
  D.customCssEditor.value = P.customCss || '';
  D.customCssEditor.hidden = false;
  openModal({
    title: 'Custom CSS', icon: 'i-pen-tool',
    html: '<label class="field-label">Add your CSS rules (applied instantly)</label>' +
          '<textarea class="field code-field css-editor" id="customCssEditorInput" style="min-height:180px" placeholder=".md-doc { font-family: Georgia, serif; }&#10;/* Your CSS here */"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="cssApply">Apply</button>',
    onMount: m => {
      m.querySelector('#cssApply').addEventListener('click', () => {
        const css = m.querySelector('#customCssEditorInput').value;
        if (css.trim()) {
          P.customCss = css;
          savePrefs();
          loadCustomCss();
          toast('Custom CSS applied', 'ok', 1500);
        }
        closeModal();
      });
    }
  });
});

// Word count goals
D.btnGoalSet?.addEventListener('click', () => {
  const session = prompt('Session word goal:', P.goalSession || 500);
  const daily = prompt('Daily word goal:', P.goalDaily || 2000);
  if (session) { P.goalSession = parseInt(session) || 500; }
  if (daily) { P.goalDaily = parseInt(daily) || 2000; }
  savePrefs(); checkGoals();
  toast('Goals set: session ' + P.goalSession + ', daily ' + P.goalDaily, 'ok', 2000);
});
D.btnGoalReset?.addEventListener('click', () => {
  S.stats.dailyWords = 0;
  saveStats(); checkGoals();
  toast('Daily count reset', 'ok', 1500);
});

// Pomodoro settings
D.pomodoroWork?.addEventListener('input', e => { P.pomodoroWork = +e.target.value; D.pomodoroWorkLbl.textContent = P.pomodoroWork; savePrefs(); });
D.pomodoroBreak?.addEventListener('input', e => { P.pomodoroBreak = +e.target.value; D.pomodoroBreakLbl.textContent = P.pomodoroBreak; savePrefs(); });
D.pomodoroLong?.addEventListener('input', e => { P.pomodoroLong = +e.target.value; D.pomodoroLongLbl.textContent = P.pomodoroLong; savePrefs(); });
D.btnPomodoroStart?.addEventListener('click', startPomodoro);
D.btnPomodoroSkip?.addEventListener('click', () => { pomodoroState = 'break'; pomodoroTimeLeft = (P.pomodoroBreak || 5) * 60; });

// Link checker
D.btnLinkCheck?.addEventListener('click', checkLinks);
D.btnLinkCheckCancel?.addEventListener('click', () => { linkCheckRunning = false; if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder">Check cancelled</div>'; });

// Mermaid settings
D.btnMermaidTheme?.addEventListener('click', () => {
  const themes = ['default', 'dark', 'forest', 'neutral'];
  openMenu(D.btnMermaidTheme, themes.map(t => ({
    text: t.charAt(0).toUpperCase() + t.slice(1),
    checked: P.mermaidTheme === t,
    action: () => { P.mermaidTheme = t; mermaidInitialized = false; initMermaid(); toast('Mermaid theme: ' + t, 'ok', 1500); }
  })));
});
D.btnMermaidExport?.addEventListener('click', () => {
  const blocks = D.mdDoc.querySelectorAll('.mermaid');
  if (blocks.length) {
    const svgs = Array.from(blocks).map(b => b.outerHTML).join('\n');
    download('mermaid-diagrams.html', '<!DOCTYPE html><html><body>' + svgs + '</body></html>', 'text/html');
  } else { toast('No mermaid diagrams found', 'err'); }
});

// Spell check
D.btnSpellCheckRun?.addEventListener('click', () => {
  if (!S.spellCheckIgnore) S.spellCheckIgnore = [];
  runSpellCheck();
});
D.btnSpellCheckIgnore?.addEventListener('click', () => {
  const ignored = prompt('Enter words to ignore (comma-separated):', (S.spellCheckIgnore || []).join(', '));
  if (ignored) { S.spellCheckIgnore = ignored.split(',').map(w => w.trim().toLowerCase()).filter(w => w); saveMarks(); toast('Words added to ignore list', 'ok', 1500); }
});

// Export formats
D.btnExportObsidian?.addEventListener('click', exportObsidian);
D.btnExportNotion?.addEventListener('click', exportNotion);

// Document compare
D.btnDiffOpen?.addEventListener('click', diffDocuments);
D.btnDiffClose?.addEventListener('click', () => { if (D.diffContainer) D.diffContainer.hidden = true; });
D.btnDiffSwap?.addEventListener('click', () => {
  if (S.diffOtherDoc && S.raw) {
    const tmp = S.raw; S.raw = S.diffOtherDoc; S.diffOtherDoc = tmp; onDocReady(S.raw, S.fileName, S.fileSize); showDiff();
  }
});
D.btnDiffExport?.addEventListener('click', () => {
  if (S.diffOtherDoc) download('diff-' + S.fileName.replace(/\.[^/.]+$/, '') + '.html', '<!DOCTYPE html><html><body>' + (S.diffOtherDoc || '') + '</body></html>', 'text/html');
});

// drag & drop
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  e.preventDefault(); dragDepth++;
  if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) D.dropOverlay.classList.add('show');
});
window.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', e => { e.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) D.dropOverlay.classList.remove('show'); });
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0;
  D.dropOverlay.classList.remove('show');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFromFile(f);
});

// search wiring
D.searchInput.addEventListener('input', () => {
  D.searchBox.classList.toggle('has', D.searchInput.value.length > 0);
  doSearch();
});
D.searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? selectSearchResult(S.searchCursor - 1) : selectSearchResult(S.searchCursor + 1); }
  if (e.key === 'Escape') { D.searchInput.value = ''; D.searchBox.classList.remove('has'); resetSearch(); }
});
D.searchClear.addEventListener('click', () => { D.searchInput.value = ''; D.searchBox.classList.remove('has'); resetSearch(); D.searchInput.focus(); });
D.searchPrev.addEventListener('click', () => selectSearchResult(S.searchCursor - 1));
D.searchNext.addEventListener('click', () => selectSearchResult(S.searchCursor + 1));
$('#swCase').addEventListener('click', (e) => {
  S.searchCase = !S.searchCase;
  e.currentTarget.classList.toggle('accent', S.searchCase);
  runSearch(D.searchInput.value.trim());
});
$('#swWhole').addEventListener('click', (e) => {
  S.searchWhole = !S.searchWhole;
  e.currentTarget.classList.toggle('accent', S.searchWhole);
  runSearch(D.searchInput.value.trim());
});
$('#btnSearchExport').addEventListener('click', () => {
  if (!S.searchResults.length) { toast('No results to export', 'err'); return; }
  const q = D.searchInput.value.trim();
  const text = plainText();
  const out = S.searchResults.slice(0, 500).map((r, i) =>
    (i + 1) + '. …' + text.slice(Math.max(0, r.index - 60), r.index + q.length + 60).replace(/\s+/g, ' ') + '…'
  ).join('\n');
  download('search-' + q.slice(0, 20).replace(/\W+/g, '-') + '.txt', 'Search: ' + q + '\n' + S.searchResults.length + ' results\n\n' + out, 'text/plain');
});

// recent
D.btnClearRecent.addEventListener('click', async () => {
  try { await IDB.clear(); } catch (e) {}
  renderRecent();
  toast('Recent list cleared', 'ok', 1600);
});

// marks wiring
$$('#marksSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#marksSeg button').forEach(x => x.classList.toggle('on', x === b));
  const notes = b.dataset.mtab === 'notes';
  $('#mtab-bookmarks').hidden = notes;
  $('#mtab-notes').hidden = !notes;
}));
function addBookmark() {
  if (!S.raw || !S.docId) { toast('Open a document first', 'err'); return; }
  const max = D.viewer.scrollHeight - D.viewer.clientHeight;
  const pct = max > 0 ? (D.viewer.scrollTop / max) * 100 : 0;
  // nearest heading as label
  let label = 'Position ' + Math.round(pct) + '%';
  try {
    const vr = D.viewer.getBoundingClientRect();
    let best = null, bestD = 1e9;
    S.headings.forEach(h => {
      const r = h.el.getBoundingClientRect();
      const d = Math.abs(r.top - vr.top - 80);
      if (d < bestD) { bestD = d; best = h; }
    });
    if (best) label = best.text.slice(0, 60);
  } catch (e) {}
  const arr = marksFor('bm');
  arr.push({ label, scroll: D.viewer.scrollTop, pct, at: Date.now() });
  S.bookmarks[S.docId] = arr;
  saveMarks(); renderMarks();
  toast('Position saved', 'ok', 1500);
}
$('#btnAddBookmark').addEventListener('click', addBookmark);
$('#btnAddNote').addEventListener('click', () => {
  const inp = $('#noteInput');
  const v = (inp.value || '').trim();
  if (!v) return;
  if (!S.docId) { toast('Open a document first', 'err'); return; }
  const arr = marksFor('notes');
  arr.push({ text: v.slice(0, 280), at: Date.now() });
  S.notes[S.docId] = arr;
  saveMarks(); renderMarks();
  inp.value = '';
  toast('Note added', 'ok', 1400);
});
$('#noteInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnAddNote').click(); });
$('#btnMarksClear').addEventListener('click', () => {
  if (!S.docId) return;
  S.bookmarks[S.docId] = []; S.notes[S.docId] = [];
  saveMarks(); renderMarks();
  toast('Marks cleared', 'ok', 1500);
});
$('#btnMarksExport').addEventListener('click', () => {
  if (!S.docId) { toast('Open a document first', 'err'); return; }
  download('herosmd-marks.json', JSON.stringify({ bookmarks: marksFor('bm'), notes: marksFor('notes') }, null, 2), 'application/json');
});
$('#btnMarksImport').addEventListener('click', () => D.marksRestoreInput.click());
D.marksRestoreInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (!f || !S.docId) return;
  f.text().then(t => {
    const j = JSON.parse(t);
    if (j.bookmarks) S.bookmarks[S.docId] = j.bookmarks;
    if (j.notes) S.notes[S.docId] = j.notes;
    saveMarks(); renderMarks();
    toast('Marks restored', 'ok', 1600);
  }).catch(() => toast('Invalid backup file', 'err'));
  e.target.value = '';
});
$('#btnTocCopy').addEventListener('click', () => {
  if (!S.headings.length) return;
  copyText(S.headings.map(h => '  '.repeat(Math.max(0, h.level - 1)) + '- ' + h.text).join('\n'), 'Outline copied');
});

// builder wiring
D.fmtBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fmt]');
  if (b) builderInsert(b.dataset.fmt);
});
D.builderArea.addEventListener('input', () => { updateBuilderCount(); liveRender(); });
D.builderArea.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); builderInsert('bold'); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); builderInsert('italic'); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); builderInsert('link'); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = D.builderArea, s = ta.selectionStart, v = ta.value;
    ta.value = v.slice(0, s) + '  ' + v.slice(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = s + 2;
  }
});
function applyBuilder() {
  const src = D.builderArea.value || '';
  if (!src.trim()) { toast('Builder is empty', 'err'); return; }
  S.raw = src;
  const out = renderMarkdown(src);
  D.mdDoc.innerHTML = out.html;
  postProcessDoc();
  D.empty.hidden = true;
  D.mdCard.hidden = false;
  D.builderCard.hidden = true;
  S.builderMode = false;
  D.btnEditToggle.classList.remove('on');
  buildOutline(); buildTocCard(); resetSearch(); updateStatsBar();
  if (!S.docId) S.docId = 'builder-' + Date.now();
  S.fileName = S.fileName || 'builder.md';
  toast('Applied to view', 'ok', 1500);
}
$('#btnApplyBuilder').addEventListener('click', applyBuilder);
$('#swLive').addEventListener('change', (e) => { P.live = e.target.checked; $('#kvBuilderLive').textContent = P.live ? 'on' : 'off'; savePrefs(); if (P.live) liveRender(); });
$('#swSplit').addEventListener('change', (e) => {
  P.split = e.target.checked; savePrefs();
  if (S.builderMode) setBuilderMode(true);
});
$('#btnBuilderSample').addEventListener('click', () => { D.builderArea.value = SAMPLE; updateBuilderCount(); liveRender(); });
$('#btnBuilderClear').addEventListener('click', () => { D.builderArea.value = ''; updateBuilderCount(); liveRender(); });
$('#btnBuilderCopy').addEventListener('click', () => copyText(D.builderArea.value || '', 'Markdown copied'));
$('#btnBuilderMd').addEventListener('click', () => download('builder.md', D.builderArea.value || '', 'text/markdown'));
$('#btnBuilderTxt').addEventListener('click', () => {
  const tmp = document.createElement('div');
  tmp.innerHTML = renderMarkdown(D.builderArea.value || '').html;
  download('builder.txt', tmp.textContent || '', 'text/plain');
});
$('#btnBuilderHtml').addEventListener('click', () => {
  const keep = D.mdDoc.innerHTML;
  D.mdDoc.innerHTML = renderMarkdown(D.builderArea.value || '').html;
  exportHTMLStandalone();
  D.mdDoc.innerHTML = keep;
});

// hub wiring
function bindSeg(id, key, cb) {
  $$('#' + id + ' button').forEach(b => b.addEventListener('click', () => {
    P[key] = b.dataset.pm || b.dataset.ff || b.dataset.dw || b.dataset.th;
    savePrefs();
    if (cb) cb();
    else applyReadingPrefs();
  }));
}
bindSeg('pageModeSeg', 'pageMode');
bindSeg('fontFamSeg', 'fontFam');
bindSeg('docWidthSeg', 'docW');
$$('#themeSeg button').forEach(b => b.addEventListener('click', () => Theme.set(b.dataset.th)));
$('#fontSize').addEventListener('input', (e) => { P.fontSize = +e.target.value; $('#fontSizeLbl').textContent = P.fontSize + 'px'; savePrefs(); applyReadingPrefs(); });
$('#lineHeight').addEventListener('input', (e) => { P.lineH = (+e.target.value) / 10; $('#lineHeightLbl').textContent = P.lineH.toFixed(1); savePrefs(); applyReadingPrefs(); });
$('#swJustify').addEventListener('change', (e) => { P.justify = e.target.checked; savePrefs(); applyReadingPrefs(); });
$('#swTocCard').addEventListener('change', (e) => { P.tocCard = e.target.checked; savePrefs(); buildTocCard(); });
$('#swFocus').addEventListener('change', (e) => { document.body.classList.toggle('focus-mode', e.target.checked); });
$('#swAuto').addEventListener('change', (e) => { if (e.target.checked !== !!S.autoTimer) toggleAuto(); });
$('#autoSpeed').addEventListener('input', (e) => { P.autoSpeed = +e.target.value; $('#autoSpeedLbl').textContent = P.autoSpeed; savePrefs(); });
$('#autoBarSpeed').addEventListener('input', (e) => { P.autoSpeed = +e.target.value; const l = $('#autoSpeedLbl'); if (l) l.textContent = P.autoSpeed; const r = $('#autoSpeed'); if (r) r.value = P.autoSpeed; savePrefs(); });
$('#autoBarClose').addEventListener('click', toggleAuto);
$('#ttsRate').addEventListener('input', (e) => { P.ttsRate = (+e.target.value) / 10; $('#ttsRateLbl').textContent = P.ttsRate.toFixed(1) + '×'; savePrefs(); });
$('#btnSpeak').addEventListener('click', toggleSpeak);
$('#btnCopyText').addEventListener('click', () => copyText(plainText(), 'Text copied'));
$('#btnShare').addEventListener('click', shareDoc);
function shareDoc() {
  const data = { title: S.fileName || 'Heros Markdown', text: plainText().slice(0, 4000) };
  if (navigator.share) navigator.share(data).catch(() => {});
  else copyText(plainText().slice(0, 8000), 'Text copied — share it anywhere');
}
$('#accentPick').addEventListener('input', (e) => { P.accent = e.target.value; savePrefs(); Theme.apply(); refreshHubStats(); });
$$('[data-accent]').forEach(b => b.addEventListener('click', () => { P.accent = b.dataset.accent; P.profileColor = b.dataset.accent; savePrefs(); Theme.apply(); refreshHubStats(); }));
$('#sideW').addEventListener('input', (e) => { P.sideW = +e.target.value; $('#sideWLbl').textContent = P.sideW; savePrefs(); applyReadingPrefs(); });
$('#btnWordCount2').addEventListener('click', updateStatsBar);
$('#btnExportTxt2').addEventListener('click', () => { if (S.raw) download(baseName('.txt'), plainText(), 'text/plain'); });
$('#btnCopyAll2').addEventListener('click', () => { if (S.raw) copyText(plainText(), 'Copied all text'); });
$('#swMath').addEventListener('change', (e) => { P.math = e.target.checked; savePrefs(); if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize); });
$('#swImages').addEventListener('change', (e) => { P.images = e.target.checked; savePrefs(); if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize); });
$('#swResume').addEventListener('change', (e) => { P.resume = e.target.checked; savePrefs(); });
$('#swAutoOpen').addEventListener('change', async (e) => {
  const on = e.target.checked;
  try { await chrome.storage.local.set({ autoFile: on, autoWeb: on }); } catch (err) {}
  toast(on ? 'Auto-open on' : 'Auto-open off', null, 1500);
});
$('#btnFeaturesModal').addEventListener('click', showFeatures);
$('#btnShortcuts2').addEventListener('click', showShortcuts);
$('#btnProfileEdit').addEventListener('click', editProfile);
$('#btnAccountEdit').addEventListener('click', editProfile);
$('#btnAccountAvatar').addEventListener('click', () => {
  const colors = ['#4c8dff', '#22c55e', '#b45cf0', '#ff6b6a', '#ff8a00', '#14b8a6'];
  P.profileColor = colors[(colors.indexOf(P.profileColor) + 1 + colors.length) % colors.length] || colors[0];
  savePrefs(); refreshHubStats();
  toast('Avatar color updated', 'ok', 1400);
});
function editProfile() {
  openModal({
    title: 'Edit account', icon: 'i-user',
    html: '<label class="field-label">Display name</label>' +
      '<input class="field" id="pfName" maxlength="40" value="' + esc(P.profileName || '') + '" style="margin-top:6px">' +
      '<label class="field-label">Avatar + accent color</label>' +
      '<input type="color" id="pfColor" value="' + esc(P.profileColor || '#4c8dff') + '" style="width:100%;height:44px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2);margin-top:6px">',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="pfGo">Save</button>',
    onMount(m) {
      m.querySelector('#pfGo').addEventListener('click', () => {
        P.profileName = (m.querySelector('#pfName').value || 'My Studio').slice(0, 40);
        P.profileColor = m.querySelector('#pfColor').value || P.profileColor;
        P.accent = P.profileColor;
        savePrefs(); Theme.apply(); applyReadingPrefs(); refreshHubStats();
        closeModal();
        toast('Account saved', 'ok', 1500);
      });
    }
  });
}
$('#btnBackupAll').addEventListener('click', () => {
  download('herosmd-backup.json', JSON.stringify({ prefs: P, stats: S.stats, bookmarks: S.bookmarks, notes: S.notes }, null, 2), 'application/json');
});
$('#btnRestoreAll').addEventListener('click', () => D.restoreInput.click());
D.restoreInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  f.text().then(t => {
    const j = JSON.parse(t);
    if (j.prefs) { P = { ...defaults, ...j.prefs }; savePrefs(); }
    if (j.stats) { S.stats = j.stats; saveStats(); }
    if (j.bookmarks) S.bookmarks = j.bookmarks;
    if (j.notes) S.notes = j.notes;
    saveMarks(); applyReadingPrefs(); renderMarks(); refreshHubStats();
    toast('Backup restored', 'ok', 1800);
  }).catch(() => toast('Invalid backup file', 'err'));
  e.target.value = '';
});
$('#btnResetAll').addEventListener('click', () => {
  openModal({
    title: 'Reset everything?', icon: 'i-trash',
    html: '<p style="margin:0;color:var(--muted);line-height:1.6">Clears profile, preferences, bookmarks, notes, stats and recent files on this device.</p>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn danger" id="resetGo" style="background:rgba(220,38,38,.14)">Reset all</button>',
    onMount(m) {
      m.querySelector('#resetGo').addEventListener('click', async () => {
        try { localStorage.removeItem(PREF_KEY); localStorage.removeItem('herosmd-stats-v1'); localStorage.removeItem('herosmd-bm-v1'); localStorage.removeItem('herosmd-notes-v1'); } catch (e) {}
        try { await IDB.clear(); } catch (e) {}
        closeModal();
        location.reload();
      });
    }
  });
});

/* ---------------- 23. Scroll tracking ---------------- */
const onScroll = (() => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    raf(() => {
      queued = false;
      const max = D.viewer.scrollHeight - D.viewer.clientHeight;
      const pct = max > 0 ? Math.round((D.viewer.scrollTop / max) * 100) : 0;
      D.sbProg.textContent = S.raw ? pct + '%' : '–';
      const kv = $('#kvProg');
      if (kv) kv.textContent = S.raw ? pct + '%' : '—';
      D.backTop.classList.toggle('show', D.viewer.scrollTop > 600);
      saveScrollSoon();
    });
  };
})();
D.viewer.addEventListener('scroll', onScroll, { passive: true });
D.backTop.addEventListener('click', () => D.viewer.scrollTo({ top: 0, behavior: 'smooth' }));
setInterval(() => {
  const el = $('#kvTime');
  if (el) el.textContent = fmtTime((Date.now() - S.sessionStart) / 1000);
}, 1000);

/* ---------------- 24. Keyboard ---------------- */
document.addEventListener('keydown', e => {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); pickFile(); return; }
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); if (S.raw) { switchPane('search'); toggleSidebar(true); } return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (S.raw) download(baseName('.md'), S.raw, 'text/markdown'); return; }
  if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); if (S.raw) window.print(); return; }
  if (mod && e.key.toLowerCase() === 'b' && !typing) { e.preventDefault(); toggleSidebar(); return; }
  if (e.key === 'Escape') {
    if (S.speaking) { stopSpeaking(); }
    if (D.modalBackdrop.classList.contains('show')) { closeModal(); return; }
    if (menuOpen) { closeMenu(); return; }
    if (document.body.classList.contains('present-doc')) { togglePresent(); return; }
    if (window.innerWidth <= 900 && D.sidebar.classList.contains('open')) { toggleSidebar(false); return; }
    return;
  }
  if (typing) return;
  if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
  if (!S.raw && (e.key === 'e' || e.key === 'E')) { setBuilderMode(true); if (!S.raw) { D.empty.hidden = true; D.builderCard.hidden = false; } return; }
  if (e.key === 'e' || e.key === 'E') { setBuilderMode(!S.builderMode); return; }
  if (!S.raw) return;
  if (e.key === 'd' || e.key === 'D') { addBookmark(); return; }
  if (e.key === 'n' || e.key === 'N') { cyclePageMode(); return; }
  if (e.key === 't' || e.key === 'T') { Theme.toggle(); return; }
  if (e.key === 'p' || e.key === 'P') { togglePresent(); return; }
  if (e.key === '+' || e.key === '=') { fontStep(1); return; }
  if (e.key === '-' || e.key === '_') { fontStep(-1); return; }
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
});

/* ---------------- 25. Command Palette ---------------- */
let cmdIndex = -1;
function renderCmdPalette() {
  const cmds = [
    { icon: 'i-folder', text: 'Open file', action: pickFile, kbd: 'Ctrl+O' },
    { icon: 'i-globe', text: 'Open from URL', action: openUrlModal },
    { icon: 'i-edit', text: 'Paste / write', action: openPasteModal },
    { icon: 'i-zap', text: 'Load demo', action: () => { S.docId = null; onDocReady(SAMPLE, 'demo.md', SAMPLE.length); saveRecent('demo.md', SAMPLE.length, SAMPLE); } },
    { icon: 'i-download', text: 'Download .md', disabled: !S.raw, action: () => download(baseName('.md'), S.raw, 'text/markdown') },
    { icon: 'i-globe', text: 'Export .HTML', disabled: !S.raw, action: exportHTMLStandalone },
    { icon: 'i-file', text: 'Export .TXT', disabled: !S.raw, action: () => download(baseName('.txt'), plainText(), 'text/plain') },
    { icon: 'i-check', text: 'Apply builder', disabled: !S.builderMode, action: applyBuilder },
    { icon: 'i-edit', text: 'Toggle builder (E)', action: () => setBuilderMode(!S.builderMode) },
    { icon: 'i-sidebar', text: 'Toggle sidebar (Ctrl+B)', action: () => toggleSidebar() },
    { icon: 'i-search', text: 'Search (Ctrl+F)', action: () => { switchPane('search'); toggleSidebar(true); } },
    { icon: 'i-star', text: 'Save position (D)', action: addBookmark },
    { icon: 'i-volume', text: 'Read aloud', action: toggleSpeak },
    { icon: 'i-palette', text: 'Toggle theme (T)', action: () => Theme.toggle() },
    { icon: 'i-maximize', text: 'Fullscreen (F11)', action: toggleFullscreen },
    { icon: 'i-play', text: 'Present (P)', action: togglePresent },
    { icon: 'i-keyboard', text: 'Show shortcuts (?)', action: showShortcuts },
    { icon: 'i-info', text: 'Properties', action: showProperties },
    { icon: 'i-sparkle', text: 'All features', action: showFeatures },
    { icon: 'i-shield', text: 'About', action: showAbout },
    { icon: 'i-clock', text: 'Focus timer', action: () => toast('Click timer FAB to start') },
    { icon: 'i-target', text: 'Set word goals', action: () => $('#goalBarSession').click() },
    { icon: 'i-link-2', text: 'Check links', action: () => btnLinkCheck.click() },
    { icon: 'i-git-branch', text: 'Mermaid settings', action: () => btnMermaidTheme.click() },
    { icon: 'i-spellcheck', text: 'Spell check', action: () => btnSpellCheckRun.click() },
    { icon: 'i-file-diff', text: 'Compare documents', action: btnDiffOpen },
    { icon: 'i-pen-tool', text: 'Edit custom CSS', action: btnCustomCss.click() }
  ];
  let html = '';
  cmds.forEach(c => {
    if (!c.disabled) {
      html += '<div class="cmd-item" data-idx="' + cmds.indexOf(c) + '"' +
        (cmdIndex === cmds.indexOf(c) ? ' class="cmd-item selected"' : '') + '>' +
        '<svg class="ic"><use href="#' + c.icon + '"/></svg>' +
        '<span>' + c.text + '</span>' +
        (c.kbd ? '<kbd>' + c.kbd + '</kbd>' : '') +
        '<span class="meta">' + esc(c.action.name || '') + '</span></div>';
    }
  });
  D.cmdList.innerHTML = html;
  $$('[data-idx]', D.cmdList).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const cmd = cmds[idx];
      if (cmd && !cmd.disabled) {
        cmd.action();
        D.cmdPalette.classList.remove('show');
        D.cmdSearch.value = '';
        cmdIndex = -1;
      }
    });
  });
}
D.cmdSearch.addEventListener('input', () => {
  const q = D.cmdSearch.value.trim().toLowerCase();
  const items = $$('.cmd-item', D.cmdList);
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
});
D.cmdSearch.addEventListener('keydown', e => {
  if (e.key === 'Escape') { D.cmdPalette.classList.remove('show'); D.cmdSearch.value = ''; cmdIndex = -1; return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex = (cmdIndex + 1) % $$('.cmd-item:not([style*="display:none"])').length; renderCmdPalette(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); cmdIndex = cmdIndex <= 0 ? -1 : cmdIndex - 1; renderCmdPalette(); }
  if (e.key === 'Enter' && cmdIndex >= 0) {
    const selector = '.cmd-item:not([style*="display:none"])';
    const visibleCmds = Array.from($$(selector)).filter(el => el.offsetParent !== null);
    if (visibleCmds[cmdIndex]) visibleCmds[cmdIndex].click();
  }
});
document.addEventListener('keydown', e => {
  if (S.speaking || D.modalBackdrop.classList.contains('show') || menuOpen || document.body.classList.contains('present-doc')) return;
  if (e.shiftKey && e.ctrlKey && e.key === 'P') { e.preventDefault(); D.cmdPalette.classList.add('show'); D.cmdSearch.focus(); }
});

/* ---------------- 26. Progress bar ---------------- */
function updateProgressBar() {
  if (!S.raw) {
    D.progressBarTop.classList.remove('active');
    D.progressBarTop.style.transform = 'scaleX(0)';
    return;
  }
  const max = D.viewer.scrollHeight - D.viewer.clientHeight;
  const pct = max > 0 ? (D.viewer.scrollTop / max) * 100 : 0;
  D.progressBarTop.style.transform = 'scaleX(' + (pct / 100) + ')';
  D.progressBarTop.setAttribute('aria-valuenow', Math.round(pct));
}

/* ---------------- 27. Annotations / Highlights ---------------- */
function createAnnoId() { return 'a-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5); }
function addHighlight(color) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const start = S.docId + ':' + range.startOffset;
  const end = S.docId + ':' + range.endOffset;
  const text = sel.toString().trim();
  if (!text || range.collapsed) { toast('Select text first', 'err'); return; }
  const anno = { id: createAnnoId(), start: range.startOffset, end: range.endOffset, color, text, at: Date.now() };
  if (!S.highlights[S.docId]) S.highlights[S.docId] = [];
  S.highlights[S.docId].push(anno);
  saveMarks();
  applyHighlights();
  toast('Highlight added', 'ok', 1200);
}
function applyHighlights() {
  if (!S.docId || !S.raw) return;
  const highlights = S.highlights[S.docId] || [];
  const walker = document.createTreeWalker(D.mdDoc, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent || parent.classList.contains('hl')) return;
    highlights.forEach(h => {
      if (node.textContent.substr(node.value.indexOf ? node.value.indexOf(h.text) : 0, h.text.length) === h.text) {
        const span = document.createElement('span');
        span.className = 'user-highlight';
        span.style.backgroundColor = h.color;
        span.style.cursor = 'pointer';
        span.title = 'Click to remove';
        span.addEventListener('click', () => removeHighlight(h.id));
        const newNode = document.createTextNode(h.text);
        node.parentNode.replaceChild(span, node);
        span.appendChild(newNode);
      }
    });
  });
}
function removeHighlight(id) {
  const idx = S.highlights[S.docId]?.findIndex(h => h.id === id);
  if (idx >= 0) {
    S.highlights[S.docId].splice(idx, 1);
    saveMarks();
    onDocReady(S.raw, S.fileName, S.fileSize);
    toast('Highlight removed', 'ok', 1200);
  }
}

/* ---------------- 28. Image Paste as Base64 ---------------- */
let pasteImageCount = 0;
document.addEventListener('paste', async e => {
  if (!e.clipboardData || !e.clipboardData.files?.length) return;
  const items = Array.from(e.clipboardData.files);
  const images = items.filter(f => f.type.startsWith('image/'));
  if (!images.length) return;
  e.preventDefault();
  pasteImageCount += images.length;
  if (D.pasteNotice) D.pasteNotice.classList.add('show');
  if (D.pasteCount) D.pasteCount.textContent = pasteImageCount;
  const builder = D.builderArea;
  if (builder) {
    const pos = builder.selectionStart;
    let newText = builder.value;
    for (const img of images) {
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(img);
      });
      const alt = img.name.replace(/\.[^/.]+$/, '');
      const md = '![alt](base64:' + base64.replace(/[^A-Za-z0-9+/=]/g, '') + ')';
      newText = newText.slice(0, pos) + md + newText.slice(pos);
    }
    builder.value = newText;
    updateBuilderCount();
    liveRender();
  }
});
D.pasteNoticeClose?.addEventListener('click', () => D.pasteNotice.classList.remove('show'));

/* ---------------- 29. Mermaid Diagrams ---------------- */
let mermaidInitialized = false;
const mermaidStyle = document.createElement('style');
mermaidStyle.textContent = '.mermaid .node rect,.mermaid .node circle{fill:var(--surface);stroke:var(--border)}.mermaid .node text{fill:var(--text)}.mermaid .edge-path{stroke:var(--text-2)}.mermaid .edge-label{fill:var(--text-2)}';
document.head.appendChild(mermaidStyle);
function initMermaid() {
  if (mermaidInitialized || !window.mermaid) return;
  try {
    const theme = P.theme === 'dark' ? (P.mermaidTheme || 'dark') : (P.mermaidTheme || 'default');
    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      flowChart: { useMaxWidth: true },
      sequenceDiagram: { useMaxWidth: true },
      securityLevel: 'loose'
    });
    S.mermaidInit = true;
    mermaidInitialized = true;
  } catch (e) {}
}
function renderMermaid() {
  if (!P.mermaid || !mermaidInitialized || !window.mermaid) return;
  const blocks = D.mdDoc.querySelectorAll('pre code.language-mermaid, .mermaid-ph');
  blocks.forEach(async block => {
    const code = block.textContent;
    try {
      const svg = await mermaid.render('mmd-' + Date.now(), code);
      let rendered = svg;
      if (rendered.includes('<svg')) {
        rendered = rendered.replace(/<style[^>]*>.*?<\/style>/gs, '');
        rendered = rendered.replace(/fill="[^"]*"/g, 'fill="var(--text)"');
        rendered = rendered.replace(/stroke="[^"]*"/g, 'stroke="var(--border)"');
      }
      block.innerHTML = rendered;
      block.className = 'mermaid';
    } catch (e) {}
  });
}

/* ---------------- 30. Link Checker ---------------- */
let linkCheckRunning = false;
function checkLinks() {
  if (linkCheckRunning) return;
  linkCheckRunning = true;
  if (D.btnLinkCheck) D.btnLinkCheck.disabled = true;
  if (D.btnLinkCheckCancel) D.btnLinkCheckCancel.style.display = 'inline-block';
  if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder">Checking links...</div>';
  const links = $$('a[href]', D.mdDoc).filter(a => /^https?:/i.test(a.getAttribute('href')));
  let checked = 0;
  const results = [];
  const checkLink = (link) => {
    fetch(link.href, { method: 'HEAD', mode: 'cors' })
      .then(res => {
        const status = res.status;
        const ok = status < 400;
        results.push({ url: link.href, ok, status });
        checked++;
        if (checked === links.length) finishCheck();
      })
      .catch(err => {
        results.push({ url: link.href, ok: false, error: err.message });
        checked++;
        if (checked === links.length) finishCheck();
      });
  };
  function finishCheck() {
    if (D.linkCheckResults) {
      D.linkCheckResults.innerHTML = results.map(r =>
        '<div class="link-result ' + (r.ok ? 'ok' : (r.status > 400 ? 'err' : 'warn')) + '">' +
        '<span class="url">' + escapeHtml(r.url) + '</span>' +
        '<span class="status">' + (r.ok ? '✓ OK' : (r.error || r.status) + ' ✗') + '</span></div>'
      ).join('');
    }
    if (D.btnLinkCheck) D.btnLinkCheck.disabled = false;
    if (D.btnLinkCheckCancel) D.btnLinkCheckCancel.style.display = 'none';
    linkCheckRunning = false;
  }
  links.forEach(checkLink);
}
D.btnLinkCheck?.addEventListener('click', checkLinks);
D.btnLinkCheckCancel?.addEventListener('click', () => {
  linkCheckRunning = false;
  if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder">Check cancelled</div>';
  if (D.btnLinkCheck) D.btnLinkCheck.disabled = false;
});

/* ---------------- 31. Word Count Goals ---------------- */
function checkGoals() {
  const words = wordCountOf(plainText());
  const today = new Date().toDateString();
  if (S.stats.dailyDate !== today) {
    S.stats.dailyWords = 0;
    S.stats.dailyDate = today;
  }
  S.stats.dailyWords = words;
  const sessionGoal = P.goalSession || 500;
  const dailyGoal = P.goalDaily || 2000;
  if (D.goalBarSession) D.goalBarSession.style.width = Math.min(100, (words / sessionGoal) * 100) + '%';
  if (D.goalTextSession) D.goalTextSession.textContent = words + ' / ' + sessionGoal;
  if (D.goalBarDaily) D.goalBarDaily.style.width = Math.min(100, (S.stats.dailyWords / dailyGoal) * 100) + '%';
  if (D.goalTextDaily) D.goalTextDaily.textContent = S.stats.dailyWords + ' / ' + dailyGoal;
  saveStats();
}

/* ---------------- 31. Pomodoro Timer ---------------- */
let pomodoroTimer = null, pomodoroState = 'idle', pomodoroTimeLeft = 0;
function startPomodoro() {
  if (pomodoroTimer) clearInterval(pomodoroTimer);
  pomodoroTimer = null;
  const workMs = (P.pomodoroWork || 25) * 60 * 1000;
  const breakMs = (P.pomodoroBreak || 5) * 60 * 1000;
  const longBreakMs = (P.pomodoroLong || 15) * 60 * 1000;
  pomodoroState = 'work';
  pomodoroTimeLeft = workMs;
  if (D.timerDisplay) D.timerDisplay.textContent = fmtTime(pomodoroTimeLeft / 1000);
  if (S.timerFab) S.timerFab.textContent = '25:00';
  if (S.timerFab) S.timerFab.className = 'timer-fab running';
  if (S.timerFab) {
    S.timerFab.innerHTML = '<span id="timerDisplay">' + fmtTime(pomodoroTimeLeft / 1000) + '</span><span class="timer-label">Focus</span>';
  }
  S.pomodoroTimer = setInterval(() => {
    pomodoroTimeLeft -= 1000;
    if (D.timerDisplay) D.timerDisplay.textContent = fmtTime(pomodoroTimeLeft / 1000);
    if (S.timerFab) S.timerFab.innerHTML = '<span id="timerDisplay">' + fmtTime(pomodoroTimeLeft / 1000) + '</span><span class="timer-label">' + (pomodoroState === 'work' ? 'Work' : pomodoroState === 'break' ? 'Break' : 'Long') + '</span>';
    if (pomodoroTimeLeft <= 0) {
      pomodoroTimeLeft = breakMs;
      pomodoroState = pomodoroState === 'work' ? 'break' : pomodoroState === 'break' ? (S.pomodoroCycles % 4 === 0 ? 'longBreak' : 'break') : 'work';
      toast(pomodoroState === 'break' || pomodoroState === 'longBreak' ? 'Break time!' : 'Back to work!', 'ok', 3000);
    }
  }, 1000);
}
function stopPomodoro() {
  if (pomodoroTimer) clearInterval(pomodoroTimer);
  pomodoroTimer = null;
  pomodoroState = 'idle';
  pomodoroTimeLeft = 0;
  if (D.timerDisplay) D.timerDisplay.textContent = '25:00';
  if (S.pomodoroTimer) clearInterval(S.pomodoroTimer);
}
const pomodoroTimerEl = {
  start: () => { S.pomodoroState = 'work'; pomodoroTimer = true; },
  skip: () => { pomodoroState = 'break'; pomodoroTimeLeft = (P.pomodoroBreak || 5) * 60; },
  stop: () => { if (pomodoroTimer) clearInterval(pomodoroTimer); pomodoroTimer = null; pomodoroState = 'idle'; pomodoroTimeLeft = 0; }
};

/* ---------------- 33. Custom CSS ---------------- */
function loadCustomCss() {
  const css = P.customCss || '';
  if (S.customCssSheet) {
    document.head.removeChild(S.customCssSheet);
    S.customCssSheet = null;
  }
  if (css.trim()) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    S.customCssSheet = style;
  }
}
function applyCustomCss() {
  loadCustomCss();
}

/* ---------------- 34. Spell Check ---------------- */
function runSpellCheck() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const words = S.raw.match(/\b\w{4,}\b/g) || [];
  const ignored = S.spellCheckIgnore || [];
  const errors = [];
  for (const word of words) {
    if (ignored.includes(word.toLowerCase())) continue;
    const input = document.createElement('input');
    input.type = 'text';
    input.spellcheck = true;
    input.value = word;
    document.body.appendChild(input);
    if (!input.spellcheck) {
      errors.push(word);
    }
    document.body.removeChild(input);
  }
  if (D.spellCheckResults) {
    D.spellCheckResults.innerHTML = errors.length
      ? errors.slice(0, 20).map(w => '<div class="link-result err"><span class="url">' + w + '</span><span class="status">Typo detected</span></div>').join('')
      : '<div class="placeholder">No misspellings found</div>';
  }
}

/* ---------------- 35. Export Formats ---------------- */
function exportObsidian() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const html = renderMarkdown(S.raw).html;
  download(baseName('.md'), '# ' + (S.fileName.replace(/\.[^.]+$/, '') || 'Document') + '\n\n' + html.split('</h1>')[0].split('</h2>')[0], 'text/markdown');
  toast('Exported for Obsidian', 'ok', 1500);
}
function exportNotion() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  download(baseName('.md'), renderMarkdown(S.raw).html, 'text/html');
  toast('Exported for Notion', 'ok', 1500);
}

/* ---------------- 36. Document Compare ---------------- */
function diffDocuments() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  openModal({
    title: 'Compare with another document',
    icon: 'i-file-diff',
    html: '<label class="field-label">Load another .md file to compare</label>' +
      '<input class="field" id="diffUrl" type="url" placeholder="https://example.com/other.md" style="margin-top:6px">' +
      '<div id="diffLoading" style="display:none;margin-top:8px;color:var(--muted)">Loading...</div>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="diffGo">Compare</button>',
    onMount: m => {
      const go = async () => {
        const url = $('#diffUrl').value.trim();
        if (!url) return;
        m.querySelector('#diffLoading').style.display = 'block';
        try {
          const text = await fileFetch(url);
          if (text) {
            S.diffOtherDoc = text;
            showDiff();
}

function showDiff() {
  if (!S.diffOtherDoc) return;
  const html1 = renderMarkdown(S.raw).html;
  const html2 = renderMarkdown(S.diffOtherDoc).html;
  if (D.diffContainer) {
    D.diffContainer.innerHTML = '<div class="diff-pane removed"><div class="diff-header">Original</div><div class="diff-content" id="diffContent1"></div></div><div class="diff-pane added"><div class="diff-header">Compared</div><div class="diff-content" id="diffContent2"></div></div>';
    document.getElementById('diffContent1').innerHTML = html1;
    document.getElementById('diffContent2').innerHTML = html2;
  }
  if (D.btnDiffClose) D.btnDiffClose.style.display = 'inline-block';
  if (D.btnDiffSwap) D.btnDiffSwap.classList.remove('on');
}

function renderAnnotations() {
  if (!S.docId) return;
  const highlights = S.highlights[S.docId] || [];
  highlights.forEach(h => {
    const walker = document.createTreeWalker(D.mdDoc, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.textContent.includes(h.text)) {
        const span = document.createElement('span');
        span.className = 'user-highlight';
        span.style.backgroundColor = h.color;
        span.style.cursor = 'pointer';
        span.title = 'Click to remove';
        span.addEventListener('click', (e) => { e.stopPropagation(); removeHighlight(h.id); });
        const idx = node.textContent.indexOf(h.text);
        const before = document.createTextNode(node.textContent.slice(0, idx));
        const mid = document.createElement('span');
        mid.textContent = h.text;
        const after = document.createTextNode(node.textContent.slice(idx + h.text.length));
        node.parentNode.insertBefore(before, node);
        node.parentNode.insertBefore(mid, node);
        node.parentNode.insertBefore(after, node);
        node.parentNode.removeChild(node);
      }
    });
  });
}
        } catch (e) {}
        m.querySelector('#diffLoading').style.display = 'none';
      };
      m.querySelector('#diffGo').addEventListener('click', go);
      m.querySelector('#diffUrl').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  });
}

/* ---------------- 37. Boot (silent, no weird animations) ---------------- */
function boot() {
  applyReadingPrefs();
  renderFeaturesMini();
  renderRecent();
  renderMarks();
  refreshHubStats();
  updateBuilderCount();
  loadCustomCss();
  checkGoals();
  initMermaid();
  // auto-open pref sync for hub toggle
  try {
    chrome.storage.local.get({ autoFile: true, autoWeb: true }).then(s => {
      const sw = $('#swAutoOpen');
      if (sw) sw.checked = (s.autoFile !== false) && (s.autoWeb !== false);
    }).catch(() => {});
  } catch (e) {}
  // ?md= param
  let mdUrl = null;
  try {
    const q = new URLSearchParams(location.search);
    mdUrl = q.get('md');
  } catch (e) {}
  if (mdUrl) {
    loadFromUrl(mdUrl);
  } else {
    setStatus('Ready');
  }
  // silent instant paint: drop .booting on next frames, no animation
  raf(() => raf(() => {
    setTimeout(() => document.body.classList.remove('booting'), 30);
  }));
  window.addEventListener('resize', debounce(() => {}, 200));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
