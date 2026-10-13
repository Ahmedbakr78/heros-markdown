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
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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
  return esc(html);
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
  btnTheme: $('#btnTheme'), themeIcon: $('#themeIcon'), btnMenu: $('#btnMenu'),
  builderArea: $('#builderArea'), fmtBar: $('#fmtBar'),
  bmList: $('#bmList'), bmEmpty: $('#bmEmpty'), notesList: $('#notesList'), notesEmpty: $('#notesEmpty'),
  featuresMini: $('#featuresMini'),
  autoBar: $('#autoBar'), autoBarSpeed: $('#autoBarSpeed'),
  tocFab: $('#tocFab'), backTop: $('#backTop'),
  // New features
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
  diffContainer: $('#diffContainer'),
  swVimMode: $('#swVimMode'),
  swMermaid: $('#swMermaid'), swSpellCheck: $('#swSpellCheck'), swSpellCheckDoc: $('#swSpellCheckDoc'),
  filePermTip: $('#filePermTip'), btnPermDismiss: $('#btnPermDismiss'), btnPermOpen: $('#btnPermOpen'),
  featSearch: $('#featSearch'), featFilterPills: $('#featFilterPills'),
  featuresTabSeg: $('#featuresTabSeg'), ftabTools: $('#ftab-tools'), ftabList: $('#ftab-list'),
  // Study magic (Heros PDF parity, local only)
  selBar: $('#selBar'), selHighlight: $('#selHighlight'), selUnderline: $('#selUnderline'),
  selStrike: $('#selStrike'), selCopy: $('#selCopy'), selNote: $('#selNote'),
  selClose: $('#selClose'),
  markerList: $('#markerList'), markerEmpty: $('#markerEmpty'),
  btnMarkerClear: $('#btnMarkerClear'), btnMarkerExport: $('#btnMarkerExport'),
  flashList: $('#flashList'), flashEmpty: $('#flashEmpty'),
  btnFlashGen: $('#btnFlashGen'), btnFlashQuiz: $('#btnFlashQuiz'), btnFlashExport: $('#btnFlashExport'),
  btnFlashClear: $('#btnFlashClear'), quizBox: $('#quizBox'),
  // Power lab + window
  labResults: $('#labResults'),
  btnLint: $('#btnLint'), btnSummary: $('#btnSummary'), btnKeywords: $('#btnKeywords'),
  btnFreq: $('#btnFreq'), btnReadability: $('#btnReadability'),
  btnCopyHtml: $('#btnCopyHtml'), btnCopyOutline: $('#btnCopyOutline'),
  btnPrintSel: $('#btnPrintSel'), btnShuffleFlash: $('#btnShuffleFlash'),
  kvRenderMs: $('#kvRenderMs'), kvStreak: $('#kvStreak'),
  // Todo + stopwatch + counters + tracker
  todoInput: $('#todoInput'), todoPrio: $('#todoPrio'), todoDue: $('#todoDue'),
  btnTodoAdd: $('#btnTodoAdd'), todoList: $('#todoList'), todoEmpty: $('#todoEmpty'),
  todoCount: $('#todoCount'), btnTodoExport: $('#btnTodoExport'), btnTodoClearDone: $('#btnTodoClearDone'), btnTodoImport: $('#btnTodoImport'),
  swDisplay: $('#swDisplay'), btnSwStart: $('#btnSwStart'), btnSwLap: $('#btnSwLap'),
  btnSwReset: $('#btnSwReset'), swLaps: $('#swLaps'),
  counterName: $('#counterName'), counterStep: $('#counterStep'), btnCounterAdd: $('#btnCounterAdd'),
  counterList: $('#counterList'), counterEmpty: $('#counterEmpty'),
  habitName: $('#habitName'), btnHabitAdd: $('#btnHabitAdd'),
  habitList: $('#habitList'), habitEmpty: $('#habitEmpty'),
  kvSaved: $('#kvSaved')
};

/* ---------------- 2. State + prefs ---------------- */
const PREF_KEY = 'herosmd-prefs-v1';
const defaults = {
  theme: 'dark', accent: '#4c8dff', sideW: 308,
  fontSize: 16, lineH: 1.7, docW: 'comfort', fontFam: 'sans',
  justify: false, tocCard: true, pageMode: 'off',
  math: true, images: true, resume: true,
  live: true, split: false, autoSpeed: 30,
  profileName: 'My Studio', profileColor: '#4c8dff',
  // New features
  vimMode: false,
  customCss: '',
  goalSession: 500, goalDaily: 2000,
  pomodoroWork: 25, pomodoroBreak: 5, pomodoroLong: 15,
  mermaid: true, mermaidTheme: 'default',
  spellCheck: false, spellCheckDoc: false,
  diffMode: false,
  // Perfect markdown + study magic
  breaks: true, rtlAuto: true, sectionTime: true,
  markerColor: '#ffd400', markerTool: 'highlight',
  fastMode: true,
  // Power window lab
  focusSent: false, outlineNum: false, perf: true
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
  autoTimer: null, sessionStart: Date.now(),
  mathCount: 0, codeCount: 0, builderMode: false,
  // New features
  highlights: {}, // docId -> [{id, color, tool, text, at}]  (Heros PDF marker parity)
  annotations: {}, // docId -> [{id, target, note, color, at}]
  flashcards: {}, // docId -> [{id, q, a, at, known}]
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
  customCssSheet: null,
  mermaidSeq: 0,
  quiz: { cards: [], idx: 0, show: false, score: 0 },
  // Power: todo + stopwatch + counters + tracker (all auto-saved)
  todos: [], counters: [], habits: {},
  sw: { running: false, base: 0, startTs: 0, laps: [] },
  todoFilter: 'open'
};
try { const st = JSON.parse(localStorage.getItem('herosmd-stats-v1') || '{}'); S.stats = { docs: 0, words: 0, dailyWords: 0, dailyDate: new Date().toDateString(), ...st }; } catch (e) {}
function saveStats() { try { localStorage.setItem('herosmd-stats-v1', JSON.stringify(S.stats)); } catch (e) {} }
try { S.bookmarks = JSON.parse(localStorage.getItem('herosmd-bm-v1') || '{}'); } catch (e) { S.bookmarks = {}; }
try { S.notes = JSON.parse(localStorage.getItem('herosmd-notes-v1') || '{}'); } catch (e) { S.notes = {}; }
try { S.highlights = JSON.parse(localStorage.getItem('herosmd-highlights-v1') || '{}'); } catch (e) { S.highlights = {}; }
try { S.annotations = JSON.parse(localStorage.getItem('herosmd-annotations-v1') || '{}'); } catch (e) { S.annotations = {}; }
try { S.flashcards = JSON.parse(localStorage.getItem('herosmd-flash-v1') || '{}'); } catch (e) { S.flashcards = {}; }
try { S.spellCheckIgnore = JSON.parse(localStorage.getItem('herosmd-spell-ignore-v1') || '[]'); } catch (e) { S.spellCheckIgnore = []; }
try { S.todos = JSON.parse(localStorage.getItem('herosmd-todos-v1') || '[]'); if (!Array.isArray(S.todos)) S.todos = []; } catch (e) { S.todos = []; }
try { S.counters = JSON.parse(localStorage.getItem('herosmd-counters-v1') || '[]'); if (!Array.isArray(S.counters)) S.counters = []; } catch (e) { S.counters = []; }
try { S.habits = JSON.parse(localStorage.getItem('herosmd-habits-v1') || '{}'); if (!S.habits || typeof S.habits !== 'object') S.habits = {}; } catch (e) { S.habits = {}; }
try { const sw = JSON.parse(localStorage.getItem('herosmd-stopwatch-v1') || 'null'); if (sw && Array.isArray(sw.laps)) S.sw = { running: false, base: sw.base || 0, startTs: 0, laps: sw.laps.slice(-50) }; } catch (e) {}
function savePower() {
  try { localStorage.setItem('herosmd-todos-v1', JSON.stringify(S.todos.slice(-500))); } catch (e) {}
  try { localStorage.setItem('herosmd-counters-v1', JSON.stringify(S.counters.slice(-60))); } catch (e) {}
  try { localStorage.setItem('herosmd-habits-v1', JSON.stringify(S.habits)); } catch (e) {}
  try { localStorage.setItem('herosmd-stopwatch-v1', JSON.stringify({ base: swElapsed(), laps: S.sw.laps.slice(-50) })); } catch (e) {}
  try { if (D.kvSaved) D.kvSaved.textContent = new Date().toLocaleTimeString(); } catch (e) {}
}
function saveMarks() {
  try { localStorage.setItem('herosmd-bm-v1', JSON.stringify(S.bookmarks)); } catch (e) {}
  try { localStorage.setItem('herosmd-notes-v1', JSON.stringify(S.notes)); } catch (e) {}
  try { localStorage.setItem('herosmd-highlights-v1', JSON.stringify(S.highlights)); } catch (e) {}
  try { localStorage.setItem('herosmd-annotations-v1', JSON.stringify(S.annotations)); } catch (e) {}
  try { localStorage.setItem('herosmd-flash-v1', JSON.stringify(S.flashcards)); } catch (e) {}
}
// Migrate old highlight shape {start,end} -> {tool,text} (back-compat, fast)
(function migrateMarks() {
  try {
    Object.keys(S.highlights || {}).forEach(k => {
      (S.highlights[k] || []).forEach(h => {
        if (!h.tool) h.tool = 'highlight';
        if (h.color === '#fff3bf') h.color = '#ffd400';
      });
    });
  } catch (e) {}
})();

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
    try {
      if (window.mermaid && window.__herosMermaidReady) {
        const mTheme = resolved() === 'dark' ? 'dark' : (P.mermaidTheme || 'default');
        window.mermaid.initialize({
          startOnLoad: false,
          theme: mTheme === 'forest' || mTheme === 'neutral' || mTheme === 'default' ? mTheme : mTheme,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: { useMaxWidth: true, htmlLabels: true },
          sequence: { useMaxWidth: true },
          securityLevel: 'loose'
        });
        if (S && S.raw && D.mdDoc && D.mdDoc.querySelector && D.mdDoc.querySelector('.mermaid')) {
          if (typeof renderMermaid === 'function') renderMermaid();
        }
      }
    } catch (e) {}
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
  set('swVimMode', !!P.vimMode);
  set('swMermaid', P.mermaid !== false);
  set('swSpellCheck', !!P.spellCheck);
  set('swSpellCheckDoc', !!P.spellCheckDoc);
  set('swBreaks', P.breaks !== false);
  set('swRtlAuto', P.rtlAuto !== false);
  set('swSectionTime', P.sectionTime !== false);
  set('swFocusSent', !!P.focusSent);
  set('swOutlineNum', !!P.outlineNum);
  set('swPerf', P.perf !== false);
  try { document.body.classList.toggle('focus-sent', !!P.focusSent); } catch (e) {}
  if (D.vimIndicator) D.vimIndicator.classList.toggle('show', !!P.vimMode);
  S.vimMode = !!P.vimMode;
  if (D.builderArea) D.builderArea.spellcheck = !!P.spellCheck;
  if (D.pomodoroWork) { D.pomodoroWork.value = P.pomodoroWork || 25; if (D.pomodoroWorkLbl) D.pomodoroWorkLbl.textContent = P.pomodoroWork || 25; }
  if (D.pomodoroBreak) { D.pomodoroBreak.value = P.pomodoroBreak || 5; if (D.pomodoroBreakLbl) D.pomodoroBreakLbl.textContent = P.pomodoroBreak || 5; }
  if (D.pomodoroLong) { D.pomodoroLong.value = P.pomodoroLong || 15; if (D.pomodoroLongLbl) D.pomodoroLongLbl.textContent = P.pomodoroLong || 15; }
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

/* ---------------- 7. Sample doc (perfect markdown showcase) ---------------- */
const SAMPLE = [
'# Heros Markdown — Magic Demo',
'',
'> Fast · Private · Free & unlimited. Newlines work, LaTeX, diagrams, all languages, study markers.',
'',
'Open any `.md` file, or press **E** to edit this demo. Select text  press **H** to mark it.',
'',
'Single newlines render as breaks:',
'First line',
'Second line',
'Third line — no double-space needed.',
'',
'[[toc]]',
'',
'## 1. GitHub Flavored Markdown',
'',
'**Bold**, *italic*, ~~strike~~, ==highlight==, ++underline++, `inline code`, [link](https://example.com), autolink https://example.com.',
'',
'- [x] Task done (click to toggle — syncs to source)',
'- [ ] Task next',
'- [ ] LaTeX below',
'',
'1. First item',
'2. Second item',
'3. Third item',
'',
'| Feature | Status | Notes |',
'| --- | :---: | --- |',
'| LaTeX math | [x] | `$E=mc^2$` |',
'| Tables | [x] | GFM aligned |',
'| Code copy | [x] | One-tap |',
'',
'```js',
'// Code blocks get a header + copy button + line count',
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
'> [!NOTE]',
'> Callouts work: NOTE, TIP, WARNING, CAUTION, IMPORTANT.',
'',
'> [!TIP]',
'> Select this text and press **H / U / S** — Heros PDF-style markers.',
'',
'<details>',
'<summary>Click to expand — details work</summary>',
'',
'Hidden study answer: $E=mc^2$.',
'',
'</details>',
'',
'---',
'',
'## 2. LaTeX Math (KaTeX, offline)',
'',
'Inline: $E = mc^2$, \\(\\alpha + \\beta = \\gamma\\), $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$.',
'',
'Display:',
'',
'$$\\int_0^\\infty e^{-x} \\, dx = 1$$',
'',
'\\[\\frac{d}{dx}\\left( \\int_{0}^{x} f(t)\\,dt \\right) = f(x)\\]',
'',
'$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\times \\begin{pmatrix} x \\\\ y \\end{pmatrix}$$',
'',
'## 3. Diagrams — every mermaid graph',
'',
'```mermaid',
'graph TD;',
'  A[Markdown] --> B[Render];',
'  B --> C[LaTeX];',
'  B --> D[Diagrams];',
'```',
'',
'```mermaid',
'sequenceDiagram;',
'  Student->>Doc: select text;',
'  Doc->>Marker: H / U / S;',
'  Marker->>Quiz: flashcards;',
'```',
'',
'```mermaid',
'mindmap',
'  root((Study))',
'    Marker',
'    Flashcards',
'    Quiz',
'    Focus timer',
'```',
'',
'## 4. All languages + study',
'',
'Arabic (RTL auto): مرحبا بك في هيروس — حدد النص واضغط H.',
'',
'Hebrew: שלום — סמן טקסט ולחץ H.',
'',
'Chinese: 你好 — 选择文本按 H 高亮。',
'',
'Q: What does Heros Markdown render?',
'A: Markdown, LaTeX math, mermaid diagrams, tables, tasks, footnotes — all offline.',
'',
'Q: How do I study?',
'A: Mark with H/U/S, generate flashcards, press Quiz me, export Anki TSV.',
'',
'Key term: ==photosynthesis== turns light into energy.',
'',
'Footnotes work too[^1].',
'',
'[^1]: This is the footnote text — rendered at the bottom.',
'',
'## 5. Try the Builder',
'',
'Press **E**, edit the source, watch live preview. Export `.MD`, `.HTML`, `.TXT`, `.DOCX`, Anki free.',
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
  // fetch() first (works for http(s), and for file:// when CSP + "Allow access to file URLs" allow it)
  try {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  } catch (e) {}
  // XHR fallback (some Chrome builds block fetch on file:// but still allow XHR)
  return await new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => (xhr.status === 200 || xhr.status === 0) ? res(xhr.responseText) : rej(new Error('HTTP ' + xhr.status));
    xhr.onerror = () => rej(new Error('network'));
    xhr.send();
  });
}

// Heal double-encoded file URLs (ex: file:///…/Study%2520Prompt.md -> Study%20Prompt.md)
function normUrl(u) {
  let s = String(u == null ? '' : u).trim();
  try { if (/%25[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s); } catch (e) {}
  return s;
}

function fileNameFromUrl(url) {
  let last = String(url).split('?')[0].split('#')[0].split('/').pop() || 'document.md';
  try { return decodeURIComponent(last) || 'document.md'; } catch (e) { return last || 'document.md'; }
}

async function loadFromUrl(rawUrl) {
  const url = normUrl(rawUrl);
  try {
    setStatus('Downloading…', 'busy');
    showProgress(20);
    const text = await fileFetch(url);
    showProgress(70);
    let fname = fileNameFromUrl(url);
    if (!/\.[A-Za-z0-9]+$/.test(fname) && /\.(md|markdown|mdown|mkd|mdx)$/i.test(url)) {
      fname = (url.match(/[^/]+\.(?:md|markdown|mdown|mkd|mdx)$/i) || [fname])[0];
    }
    S.file = null;
    S.docId = await docIdFor(fname, text.length, text.slice(0, 8000));
    onDocReady(text, fname, text.length);
    saveRecent(fname, text.length, text);
    hideProgress();
  } catch (err) {
    hideProgress();
    setStatus('Ready');
    if (/^file:/i.test(url)) {
      if (D.filePermTip) D.filePermTip.hidden = false;
      const csp = String((err && err.message) || err || '');
      const reason = /content security policy/i.test(csp)
        ? 'blocked by page policy'
        : (/network|cors|refused/i.test(csp) ? 'enable "Allow access to file URLs"' : 'not readable');
      toast('Cannot read local file (' + reason + ') — enable "Allow access to file URLs" in chrome://extensions, or use Choose file', 'err', 7000);
    } else {
      toast('Could not fetch URL (CORS or network error)', 'err', 4000);
    }
  }
}

/* ---------------- 9. Render pipeline: PERFECT markdown (newlines + GFM + math + diagrams + all languages) ---------------- */
function normSrc(src) { return String(src == null ? '' : src).replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function extractFrontmatter(src) {
  const m = src.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
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
  const body = src.replace(/^\[\^([^\]]+)\]:[ \t]*(.+)$/gm, (m, k, v) => { defs[k.trim()] = v.trim(); return ''; });
  return { body, defs };
}

function isRtlText(t) {
  return /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(t || '');
}

function protectMath(src, stash) {
  // Normalize first
  src = normSrc(src);
  // stash fenced code: ```lang or ~~~lang, tolerant to \r\n, spaces, unclosed
  src = src.replace(/^(?:```|~~~)[ \t]*([^\s`~]*)([^\n]*)\n([\s\S]*?)^(?:```|~~~)[ \t]*$/gm, (m, lang) => {
    const code = m.replace(/^(?:```|~~~)[^\n]*\n/, '').replace(/\n(?:```|~~~)[ \t]*$/, '');
    const i = stash.code.length;
    stash.code.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return '\nZZCODEBLOCK' + i + 'ZZ\n';
  });
  // leftover unclosed fence
  src = src.replace(/^(?:```|~~~)[ \t]*([^\s`~]*).*?\n([\s\S]*)$/gm, (m, lang, code) => {
    if (m.indexOf('ZZCODEBLOCK') !== -1) return m;
    const i = stash.code.length;
    stash.code.push({ lang: (lang || '').trim(), code: (code || '').replace(/\n$/, '') });
    return '\nZZCODEBLOCK' + i + 'ZZ\n';
  });
  src = src.replace(/`([^`\n]+)`/g, (m, code) => {
    const i = stash.inline.length;
    stash.inline.push(code);
    return 'ZZINLINE' + i + 'ZZ';
  });
  // \(...\) inline latex and \[...\] display latex (standard)
  src = src.replace(/\\\((.+?)\\\)/gs, (m, tex) => {
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: false });
    return 'ZZMATH' + i + 'ZZ';
  });
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m, tex) => {
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: true });
    return '\nZZMATH' + i + 'ZZ\n';
  });
  // display math $$...$$ (multiline)
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => {
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: true });
    return '\nZZMATH' + i + 'ZZ\n';
  });
  // \( \) already done; inline $...$ (avoid $$, avoid $1.00 prices, avoid empty)
  src = src.replace(/(^|[^$\\\w])\$([^$\n][^$\n]*?[^$\\\s\n])\$(?![0-9\w])/g, (m, pre, tex) => {
    if (/^\d+([.,]\d+)*$/.test(tex.trim())) return m;
    if (tex.trim().length > 300) return m;
    const i = stash.math.length;
    stash.math.push({ tex: tex.trim(), display: false });
    return pre + 'ZZMATH' + i + 'ZZ';
  });
  return src;
}

function preGfmExtras(src) {
  // ==highlight== (study marker in source), ++underline/ins++, ~sub~, ^sup^  — stash-safe (no $)
  src = src.replace(/==([^=\n]+?)==/g, (m, t) => 'ZZMARKHL' + BufferSafe(t) + 'ZZEND');
  return src;
  function BufferSafe(t) { return '\u0001' + t + '\u0001'; }
}

function renderMathTex(tex, display) {
  if (!P.math || !window.katex) {
    return '<code class="math-src">' + esc((display ? '$$' : '$') + tex + (display ? '$$' : '$')) + '</code>';
  }
  try {
    return window.katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: false });
  } catch (e) {
    return '<div class="math-err" title="LaTeX error">' + esc(tex) + '</div>';
  }
}

function renderMarkdown(src) {
  src = normSrc(src);
  const stash = { code: [], inline: [], math: [] };
  const fm = extractFrontmatter(src);
  const fn = extractFootnotes(fm.body);
  let work = protectMath(fn.body, stash);

  let html = '';
  try {
    html = window.marked.parse(work, { gfm: true, breaks: P.breaks !== false });
  } catch (e) {
    html = '<p>' + esc(work) + '</p>';
  }

  // restore inline code
  html = html.replace(/ZZINLINE(\d+)ZZ/g, (m, i) => '<code>' + esc(stash.inline[+i] || '') + '</code>');
  // restore code fences  rich codeblock with header + wrap + run
  html = html.replace(/<p>ZZCODEBLOCK(\d+)ZZ<\/p>/g, (m, i) => codeblockHtml(stash.code[+i] || { lang: '', code: '' }));
  html = html.replace(/ZZCODEBLOCK(\d+)ZZ/g, (m, i) => codeblockHtml(stash.code[+i] || { lang: '', code: '' }));
  // restore math
  S.mathCount = stash.math.length;
  html = html.replace(/<p>ZZMATH(\d+)ZZ<\/p>/g, (m, i) => {
    const mt = stash.math[+i];
    if (!mt) return m;
    if (mt.display) return '<div class="katex-display" data-tex="' + esc(mt.tex).slice(0, 400) + '">' + renderMathTex(mt.tex, true) + '</div>';
    return '<span class="katex-inline">' + renderMathTex(mt.tex, false) + '</span>';
  });
  html = html.replace(/ZZMATH(\d+)ZZ/g, (m, i) => {
    const mt = stash.math[+i];
    if (!mt) return m;
    if (mt.display) return '<div class="katex-display" data-tex="' + esc(mt.tex).slice(0, 400) + '">' + renderMathTex(mt.tex, true) + '</div>';
    return '<span class="katex-inline">' + renderMathTex(mt.tex, false) + '</span>';
  });
  // GFM extras (run on HTML-escaped-safe text nodes only via regex on non-tag spans)
  html = html.replace(/==([^=\n<>]+?)==/g, (m, t) => '<mark class="src-mark">' + esc(t) + '</mark>');
  html = html.replace(/\+\+([^+\n<>]+?)\+\+/g, (m, t) => '<ins class="src-ins">' + esc(t) + '</ins>');
  html = html.replace(/\^([^\s^<>]+?)\^/g, (m, t) => '<sup>' + esc(t) + '</sup>');
  // GitHub-style admonitions: > [!NOTE] / TIP / WARNING / CAUTION / IMPORTANT
  html = html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]/gi, (m, kind) => {
    return '<blockquote class="callout callout-' + kind.toLowerCase() + '"><p class="callout-title">' + esc(kind) + '</p><p>';
  });
  // [[toc]] placeholder  filled in postProcess
  html = html.replace(/<p>\[\[toc\]\]<\/p>/gi, '<div class="toc-auto" data-toc-auto="1"></div>');
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
      '<li id="fn-' + esc(k) + '">' + esc(defs[k]) + ' <a href="#fnref-' + esc(k) + '"></a></li>'
    ).join('') + '</ol></div>';
  }
  return { html, meta: fm.meta };
}

function codeblockHtml(b) {
  const lang = (b.lang || '').toLowerCase().trim();
  const rawLang = (b.lang || '').trim() || 'code';
  if (lang === 'mermaid' || lang === 'mmd') {
    return '<div class="mermaid-ph" data-mermaid="' + esc(b.code) + '"><div class="mmd-head"><span>' + esc(rawLang) + ' diagram</span><span class="mmd-hint">rendering…</span></div><pre>' + esc(b.code) + '</pre></div>';
  }
  // Graph / latex-as-code helpers: chart, dot, plantuml, latex, tex  styled block with copy + hint
  if (['chart', 'dot', 'graphviz', 'plantuml', 'puml', 'latex', 'tex', 'tikz'].indexOf(lang) !== -1) {
    const safe = esc(b.code).replace(/\n$/, '');
    return '<div class="codeblock diag-block"><div class="cb-head"><span class="lang">' + esc(rawLang) + '</span>' +
      '<span class="sp"></span><span class="diag-hint">paste into your ' + esc(rawLang) + ' tool</span>' +
      '<button data-copycode title="Copy code"><svg class="ic ic-sm"><use href="#i-copy"/></svg>Copy</button></div>' +
      '<pre><code class="lang-' + esc(lang || 'text') + '">' + safe + '</code></pre></div>';
  }
  const safe = esc(b.code).replace(/\n$/, '');
  const lines = safe.split('\n').length;
  return '<div class="codeblock" data-lang="' + esc(rawLang) + '"><div class="cb-head"><span class="lang">' + esc(rawLang) + '</span>' +
    '<span class="cb-lines">' + lines + ' lines</span>' +
    '<span class="sp"></span>' +
    '<button data-copycode title="Copy code"><svg class="ic ic-sm"><use href="#i-copy"/></svg>Copy</button></div>' +
    '<pre><code class="lang-' + esc(lang || 'text') + '">' + safe + '</code></pre></div>';
}

function postProcessDoc() {
  const root = D.mdDoc;
  if (!root) return;
  // strip scripts/iframes/objects for safety (offline, no XSS)
  $$('script,iframe,object,embed', root).forEach(n => n.remove());
  $$('*', root).forEach(n => {
    if (n.hasAttribute && n.hasAttribute('onerror')) n.removeAttribute('onerror');
    if (n.hasAttribute && n.hasAttribute('onclick')) n.removeAttribute('onclick');
  });
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
  // task lists — interactive + sync back to source
  $$('li', root).forEach(li => {
    const cb = li.querySelector('input[type="checkbox"]');
    if (cb) {
      li.classList.add('task'); cb.disabled = false;
      if (!cb.dataset.wired) {
        cb.dataset.wired = '1';
        cb.addEventListener('change', () => {
          try { syncTaskToSource(); } catch (e) {}
          toast(cb.checked ? 'Task done' : 'Task reopened', 'ok', 1000);
        });
      }
    }
  });
  // RTL auto-detect per block (all languages: ar/he/fa/ur + CJK safe)
  if (P.rtlAuto !== false) {
    $$('p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th', root).forEach(n => {
      const t = (n.textContent || '').trim().slice(0, 200);
      if (t && isRtlText(t)) { n.setAttribute('dir', 'auto'); n.classList.add('rtl'); }
    });
    const full = (root.textContent || '').trim().slice(0, 2000);
    if (full && isRtlText(full.slice(0, 500))) root.setAttribute('dir', 'auto');
    else root.removeAttribute('dir');
  }
  // details/summary passthrough polish (raw HTML preserved by marked)
  $$('details', root).forEach(d => d.classList.add('md-details'));
  // heading ids + anchors
  // heading ids + anchors + per-section reading time (study magic)
  S.headings = [];
  const seen = {};
  const heads = $$('h1,h2,h3,h4,h5,h6', root);
  heads.forEach((h, hi) => {
    const txt = h.textContent.trim();
    let slug = slugify(txt);
    if (!slug) slug = 'section-' + hi;
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
    // section words  time badge
    let words = 0;
    if (P.sectionTime !== false) {
      let n = h.nextElementSibling;
      let guard = 0;
      while (n && !/^H[1-6]$/.test(n.tagName) && guard < 400) {
        words += wordCountOf(n.textContent || '');
        n = n.nextElementSibling; guard++;
      }
      if (words > 20) {
        const st = document.createElement('span');
        st.className = 'section-time';
        st.textContent = '· ~' + Math.max(1, Math.round(words / 200)) + ' min · ' + words.toLocaleString() + 'w';
        h.appendChild(st);
      }
    }
    S.headings.push({ level: +h.tagName[1], text: txt, id: h.id, el: h, words });
  });
  // [[toc]] auto-fill
  $$('[data-toc-auto]', root).forEach(box => {
    if (!S.headings.length) { box.innerHTML = '<p style="color:var(--muted)">No headings</p>'; return; }
    box.innerHTML = '<div class="toc-card" style="margin:0"><h5>Contents</h5>' +
      S.headings.slice(0, 60).map(h => '<a href="#' + h.id + '" data-hid="' + h.id + '" style="padding-left:' + (Math.max(0, h.level - 1) * 14) + 'px">' + esc(h.text) + '</a>').join('') + '</div>';
    $$('a', box).forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.hid);
      if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { t.scrollIntoView(); } }
    }));
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
  const s = String(text || '').trim();
  if (!s) return 0;
  // CJK / Thai / all languages: count words + CJK chars
  const cjk = (s.match(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F]/g) || []).length;
  const noCjk = s.replace(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F]/g, ' ');
  const words = noCjk.split(/\s+/).filter(Boolean).length;
  return words + cjk;
}
function syncTaskToSource() {
  // Reflect checkbox toggles back into S.raw so export/save keeps state (fast, single pass)
  try {
    if (!S.raw || !D.mdDoc) return;
    const boxes = Array.prototype.slice.call(D.mdDoc.querySelectorAll('li.task input[type="checkbox"]'));
    if (!boxes.length) return;
    let idx = 0;
    S.raw = S.raw.replace(/^(\s*[-*+]|\s*\d+[.)])\s+\[([ xX])\]/gm, (m, pre, mark) => {
      const b = boxes[idx++];
      if (!b) return m;
      return pre + ' [' + (b.checked ? 'x' : ' ') + ']';
    });
    if (D.builderArea && !S.builderMode) D.builderArea.value = S.raw;
  } catch (e) {}
}
function plainText() {
  return D.mdDoc ? D.mdDoc.textContent || '' : '';
}

/* ---------------- 10. onDocReady (timed, perf-guarded, streak) ---------------- */
function onDocReady(text, name, size) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  S.raw = text || '';
  S.fileName = name || 'document.md';
  S.fileSize = size || text.length;
  S.sessionStart = Date.now();
  setStatus('Rendering…', 'busy');
  showProgress(30);

  // Perf mode: giant files skip heavy math/diagrams for instant paint
  const huge = S.raw.length > 200000 && P.perf !== false;
  const keepMath = P.math, keepMmd = P.mermaid;
  if (huge) { P.math = false; P.mermaid = false; }
  const out = renderMarkdown(S.raw);
  D.mdDoc.innerHTML = out.html;
  postProcessDoc();
  if (huge) {
    P.math = keepMath; P.mermaid = keepMmd;
    D.mdMeta.innerHTML = '';
    toast('Perf mode: instant text — toggle math/diagrams in Tools for full render', null, 3500);
  }
  try { enableTableSort(); } catch (e) {}
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  S.lastRenderMs = Math.round(t1 - t0);
  try { if (D.kvRenderMs) D.kvRenderMs.textContent = S.lastRenderMs + 'ms' + (huge ? ' (perf)' : ''); } catch (e) {}
  try { showStreakSilent(); } catch (e) {}

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
  if (typeof renderMarkerList === 'function') renderMarkerList();
  if (typeof renderFlashList === 'function') renderFlashList();
  refreshHubStats();
  // Fast path: paint text instantly, render heavy diagrams idle (no jank on huge docs)
  if (typeof applyStudyMarks === 'function') applyStudyMarks();
  if (typeof renderMermaid === 'function') {
    if ('requestIdleCallback' in window) requestIdleCallback(() => renderMermaid(), { timeout: 800 });
    else setTimeout(() => renderMermaid(), 60);
  }
  if (typeof checkGoals === 'function') checkGoals();
  if (typeof updateProgressBar === 'function') updateProgressBar();

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
function showStreakSilent() {
  try {
    const k = 'herosmd-streak-v1';
    const today = new Date().toDateString();
    let st = {};
    try { st = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { st = {}; }
    if (st.last !== today) {
      const y = new Date(Date.now() - 864e5).toDateString();
      st.n = st.last === y ? (st.n || 0) + 1 : 1;
      st.last = today;
      try { localStorage.setItem(k, JSON.stringify(st)); } catch (e) {}
    }
    if (D.kvStreak) D.kvStreak.textContent = (st.n || 1) + ' day(s)';
  } catch (e) {}
}
function buildOutline() {
  D.outlineList.innerHTML = '';
  if (!S.headings.length) { D.outlineEmpty.hidden = false; return; }
  D.outlineEmpty.hidden = true;
  const nums = (P.outlineNum && typeof outlineNumbers === 'function') ? outlineNumbers() : [];
  const frag = document.createDocumentFragment();
  S.headings.forEach((h, i) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'outline-item';
    row.dataset.hid = h.id;
    row.style.paddingLeft = (8 + Math.max(0, h.level - 1) * 12) + 'px';
    row.innerHTML = '<span class="lv">' + (nums[i] || ('H' + h.level)) + '</span><span>' + esc(h.text || 'Untitled') + '</span>';
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

/* ---------------- 12. Stats bar + hub (null-safe) ---------------- */
function setTxt(sel, v) { try { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = v; } catch (e) {} }
function updateStatsBar() {
  const words = wordCountOf(plainText());
  try { D.sbWords.textContent = words.toLocaleString(); } catch (e) {}
  try { D.sbHeads.textContent = S.headings.length; } catch (e) {}
  try { D.sbMath.textContent = S.mathCount; } catch (e) {}
  setTxt('#kvDocWords', words.toLocaleString());
  setTxt('#kvDocHeads', S.headings.length);
  setTxt('#kvDocMath', S.mathCount);
  setTxt('#kvDocCode', S.codeCount);
  setTxt('#docStatHead', S.headings.length + ' heads');
  setTxt('#kvWords', words.toLocaleString());
  setTxt('#kvChars', plainText().length.toLocaleString());
  setTxt('#kvRead', '~' + Math.max(1, Math.round(words / 200)) + ' min');
}
function refreshHubStats() {
  setTxt('#stDocs', S.stats.docs);
  setTxt('#stWords', (S.stats.words || 0).toLocaleString());
  const bmCount = Object.keys(S.bookmarks).reduce((a, k) => a + (S.bookmarks[k] || []).length, 0);
  const noteCount = Object.keys(S.notes).reduce((a, k) => a + (S.notes[k] || []).length, 0);
  const markCount = Object.keys(S.highlights || {}).reduce((a, k) => a + ((S.highlights[k] || []).length), 0);
  const flashCount = Object.keys(S.flashcards || {}).reduce((a, k) => a + ((S.flashcards[k] || []).length), 0);
  setTxt('#stMarks', (noteCount + markCount));
  setTxt('#stSaved', bmCount);
  try {
    const el = $('#stWords');
    if (el) el.title = flashCount + ' flashcards total';
  } catch (e) {}
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
  const fold = s => useCase ? s : s.toLocaleLowerCase();
  const hayF = fold(text), ndlF = fold(q);
  if (!useWhole) {
    let idx = hayF.indexOf(ndlF);
    while (idx !== -1 && results.length < 500) {
      results.push({ index: idx });
      idx = hayF.indexOf(ndlF, idx + Math.max(1, ndlF.length));
    }
  } else {
    // Unicode-aware whole-word: letters/numbers in ANY language (no \b which breaks Arabic/CJK)
    const qe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const re = new RegExp('(^|[^\\p{L}\\p{N}_])(' + qe + ')(?![\\p{L}\\p{N}_])', (useCase ? 'g' : 'gi') + 'u');
      let m;
      while ((m = re.exec(text)) && results.length < 500) {
        results.push({ index: m.index + m[1].length });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    } catch (e) {
      let idx = hayF.indexOf(ndlF);
      while (idx !== -1 && results.length < 500) {
        results.push({ index: idx });
        idx = hayF.indexOf(ndlF, idx + Math.max(1, ndlF.length));
      }
    }
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
function inSafeSearchNode(n) {
  if (!n || !n.parentElement) return false;
  const p = n.parentElement;
  if (/^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/.test(p.tagName)) return false;
  if (p.closest && (p.closest('.katex') || p.closest('.katex-display') || p.closest('.mermaid') || p.closest('mark.hl') || p.closest('.user-mark'))) return false;
  return true;
}
function markInDoc(q) {
  clearDocMarks();
  if (!q || !D.mdDoc) return;
  const qFold = q.toLocaleLowerCase();
  const walker = document.createTreeWalker(D.mdDoc, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!inSafeSearchNode(n)) continue;
    if (n.nodeValue && n.nodeValue.toLocaleLowerCase().indexOf(qFold) !== -1) nodes.push(n);
    if (nodes.length > 400) break;
  }
  nodes.forEach(n => {
    const val = n.nodeValue;
    const low = val.toLocaleLowerCase();
    let i = low.indexOf(qFold);
    if (i === -1) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    let guard = 0;
    while (i !== -1 && guard < 12) {
      guard++;
      frag.appendChild(document.createTextNode(val.slice(last, i)));
      const m = document.createElement('mark');
      m.className = 'hl';
      m.textContent = val.slice(i, i + q.length);
      frag.appendChild(m);
      last = i + q.length;
      i = low.indexOf(qFold, last);
    }
    frag.appendChild(document.createTextNode(val.slice(last)));
    try { n.parentNode.replaceChild(frag, n); } catch (e) {}
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
  if (S.builderMode && D.builderPreview) {
    // Fast guard: huge source  plain preview note (no freeze)
    if (src.length > 400000) {
      D.builderPreview.innerHTML = '<div class="placeholder">Large file — live preview paused for speed. Press Apply to render.</div>';
      return;
    }
    const out = renderMarkdown(src);
    D.builderPreview.innerHTML = out.html;
    // light post-process for preview (no outline rebuild) + math via KaTeX already inline
    $$('script,iframe,object,embed', D.builderPreview).forEach(n => n.remove());
    $$('table', D.builderPreview).forEach(t => {
      if (t.parentElement && t.parentElement.classList.contains('tbl-wrap')) return;
      const w = document.createElement('div'); w.className = 'tbl-wrap';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    $$('[data-copycode]', D.builderPreview).forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.closest('.codeblock').querySelector('code').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('Code copied', 'ok', 1200));
      });
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
    case 'mark': r = wrap('==', '==', 'key term'); break;
    case 'mermaid': r = { text: '\n```mermaid\ngraph TD;\n  A[Start] --> B{Study?};\n  B -->|Yes| C[Marker + Quiz];\n  B -->|No| A;\n```\n', select: null }; break;
    case 'callout': r = { text: '\n> [!NOTE]\n> ' + (sel || 'Study tip here') + '\n', select: null }; break;
    case 'details': r = { text: '\n<details>\n<summary>' + (sel || 'Click to expand') + '</summary>\n\nAnswer here…\n\n</details>\n', select: null }; break;
    case 'toc': r = { text: '\n[[toc]]\n', select: null }; break;
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
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const title = esc((S.fileName || 'document').replace(/\.(md|markdown|mdown|mkd|mdx)$/i, ''));
  // Export from SOURCE so builder edits are included even in builder mode
  const src = (S.builderMode && D.builderArea && D.builderArea.value.trim()) ? D.builderArea.value : S.raw;
  const body = renderMarkdown(src).html;
  const cssLink = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><link rel="stylesheet" href="' + cssLink + '">' +
    '<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;line-height:1.75;color:#1a1d23}' +
    'pre{background:#f3f5f8;border:1px solid #dde2e9;border-radius:12px;padding:14px;overflow:auto}' +
    'code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #dde2e9;padding:8px 12px}' +
    'th{background:#f3f5f8}img{max-width:100%}blockquote{border-left:4px solid #2563eb;background:#f3f5f8;margin:1em 0;padding:8px 16px;border-radius:0 12px 12px 0}' +
    '.katex-display{background:#f3f5f8;border:1px solid #dde2e9;border-radius:12px;padding:12px;overflow-x:auto}' +
    'mark{background:#fef08a;padding:0 2px;border-radius:3px}ins{text-decoration:underline;text-decoration-color:#10b981;text-underline-offset:3px}' +
    '.mermaid{border:1px solid #dde2e9;border-radius:12px;padding:12px;margin:1em 0;overflow-x:auto}</style>' +
    '</head><body>' + body + '<hr><p style="color:#888;font-size:12px">Exported with Heros Markdown — free & local.</p></body></html>';
  download(baseName('.html'), html, 'text/html');
}
function copyText(t, label) {
  if (!navigator.clipboard) { toast('Clipboard unavailable', 'err'); return; }
  navigator.clipboard.writeText(t).then(() => toast((label || 'Copied'), 'ok', 1500)).catch(() => toast('Could not copy', 'err'));
}
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
function toggleFocusMode() {
  const on = !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', on);
  try { const sw = $('#swFocus'); if (sw) sw.checked = on; } catch (e) {}
  toast(on ? 'Focus mode on — sidebar hidden' : 'Focus mode off', 'ok', 1400);
}
function copyDocStats() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const words = wordCountOf(plainText());
  copyText((S.fileName || 'document') + ' · ' + words.toLocaleString() + ' words · ' + S.headings.length + ' heads · ' + S.mathCount + ' math · ~' + Math.max(1, Math.round(words / 200)) + ' min', 'Stats copied');
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

/* ---------------- 19. Features data (70+ Free & Unlimited — perfect + study magic) ---------------- */
const FEATURES = [
  // Core Reader & Perfect Markdown Engine
  ['i-file', 'Full .md view', 'Renders massive markdown files — headings to footnotes, zero clipping or lag.', 'reader', 'Core'],
  ['i-zap', 'True newlines', 'Single line breaks render as breaks — study notes read exactly as written.', 'reader', 'Newlines'],
  ['i-math', 'LaTeX math (KaTeX)', 'Offline KaTeX: $…$ $$…$$ \\(…\\) \\[…\\] with bundled fonts, all languages.', 'reader', 'Offline'],
  ['i-git-branch', 'Every mermaid graph', 'Flowchart, sequence, mindmap, Gantt, pie, journey, gitgraph — queued, themed, exportable SVG.', 'reader', 'Diagrams'],
  ['i-globe', 'All languages + RTL', 'Arabic/Hebrew/Persian/Urdu auto-RTL, CJK word count, unicode search in every language.', 'reader', 'i18n'],
  ['i-quote', 'Callouts + details', '> [!NOTE/TIP/WARNING] admonitions, <details> accordions, [[toc]] auto-contents, ==mark== ++ins++.', 'reader', 'GFM+'],
  ['i-table', 'GFM tables', 'GitHub-aligned tables with sticky headers, mobile scroll, and zebra striping.', 'reader', 'GFM'],
  ['i-check', 'Interactive task lists', '- [ ] and - [x] checkboxes are clickable with live document update.', 'reader', 'Live'],
  ['i-code', 'Syntax code blocks', 'Fenced code blocks with programming language badges and 1-tap copy button.', 'reader', '1-Tap'],
  ['i-book', 'Outline TOC map', 'Automatic headings hierarchy map with real-time active scroll tracking.', 'reader', 'TOC'],
  ['i-search', 'Full-text search', 'Instant search with case match, whole-word toggle, and hit counter.', 'reader', 'Find'],
  ['i-quote', 'Blockquote callouts', 'Styled callouts with colored accent rails and formatted text.', 'reader', 'Style'],
  ['i-link', 'Footnotes & citations', 'Bidirectional footnote references [^1] with smooth jump back links.', 'reader', 'Refs'],
  ['i-layout', 'YAML frontmatter', 'Parses --- YAML frontmatter --- into clean metadata chips and document tags.', 'reader', 'Meta'],

  // White Mode, Dark Mode & Themes
  ['i-palette', 'Studio White mode', 'Ultra-clean, crisp paper white theme with sharp borders and dark slate text.', 'theme', 'Light'],
  ['i-moon', 'Obsidian Dark mode', 'Deep OLED dark slate theme with glowing accents and eye-saving contrast.', 'theme', 'Dark'],
  ['i-sun', 'Auto system theme', 'Automatically syncs with your operating system light and dark mode.', 'theme', 'Auto'],
  ['i-sparkle', '6 Accent palettes', 'Blue, emerald green, violet purple, coral red, amber orange, and teal.', 'theme', 'Colors'],
  ['i-pen-tool', 'Custom accent picker', 'Full RGB color picker to style the UI in any custom brand color.', 'theme', 'RGB'],
  ['i-eye-dim', 'Page comfort modes', 'Sepia warm paper, Night sky, and Dim contrast modes for relaxed reading.', 'theme', 'Ergonomic'],
  ['i-columns', '4 Reading widths', 'Narrow (680px), Comfort (860px), Wide (1080px), and Full viewport width.', 'theme', 'Layout'],
  ['i-text', 'Typography scaling', 'Fine font size scaling (75% to 200%), line height adjustment, sans/serif/mono.', 'theme', 'Fonts'],
  ['i-sliders', 'Text justification', 'Toggle fully justified text alignment with hyphenation and clean margins.', 'theme', 'Align'],

  // Power Tools & Utilities
  ['i-sparkle', 'Features list', 'Inline directory of every tool — search, filter, one-tap Run. Press F.', 'tools', 'F', 'features'],
  ['i-terminal', 'Vim navigation mode', 'hjkl smooth navigation, gg/G jumping, / search, and half-page scrolling.', 'tools', 'Vim'],
  ['i-target', 'Writing target goals', 'Set session & daily word count targets with real-time animated progress bars.', 'tools', 'Goals'],
  ['i-timer', 'Pomodoro focus timer', 'Configurable work and break intervals (25/5/15) with offline audio chime.', 'tools', 'Focus'],
  ['i-file-diff', 'Visual document diff', 'Side-by-side comparison of two Markdown files with additions & deletions.', 'tools', 'Diff'],
  ['i-link-2', 'Smart link checker', 'Scans and verifies all internal heading anchors and external URLs.', 'tools', 'Audit'],
  ['i-spellcheck', 'Spell check & grammar', 'On-demand scan for typos in Markdown source with custom dictionary ignore list.', 'tools', 'Spell'],
  ['i-git-branch', 'Mermaid diagram engine', 'Renders flowcharts, sequence diagrams, Gantt charts, and class diagrams.', 'tools', 'Mermaid'],
  ['i-pen-tool', 'Live custom CSS editor', 'Inject your own custom CSS styling with instant live application & presets.', 'tools', 'CSS'],
  ['i-highlighter', 'Marker Studio (Heros PDF parity)', 'Select  H highlight, U underline, S strike, 7 colors, per-file list, export. Same feel as Heros PDF.', 'tools', 'H/U/S'],
  ['i-text', 'Selection mini-bar', 'Floating bar near selection: mark, copy, note — Heros PDF sel-bar for Markdown.', 'tools', 'Select'],
  ['i-layers', 'Flashcards auto-deck', 'Builds from headings, Q:/A:, **bold terms**, ==cloze==. Click card to quiz.', 'tools', 'Deck'],
  ['i-play', 'Cloze quiz mode', 'Space to reveal, arrows to move, OK scoring, per-card known state.', 'tools', 'Quiz'],
  ['i-download', 'Anki TSV + markers TXT', 'One-tap Anki import file and markers export for revision.', 'export', 'Anki'],
  ['i-eye-dim', 'Distraction-free focus', 'Hide the sidebar for pure reading. Toggle anytime, free.', 'tools', 'Focus', 'focus-mode'],
  ['i-clock', 'Section reading time', 'Every heading shows ~min + words — plan study sessions instantly.', 'reader', 'Time'],
  ['i-scroll', 'Hands-free auto-scroll', 'Smooth automated scrolling with dynamic speed slider (5 to 120 px/sec).', 'tools', 'Scroll'],
  ['i-maximize', 'Zen fullscreen mode', 'One-tap distraction-free reading experience (F11 shortcut).', 'tools', 'F11'],
  ['i-play', 'Presentation mode', 'Full-screen slide/presentation view for meetings, classes, and demos.', 'tools', 'Slides'],

  // Builder & Edit Studio
  ['i-layers', 'Builder Studio mode', 'Edit raw Markdown source with real-time live preview (Press E).', 'builder', 'Live Preview'],
  ['i-edit', 'Markdown quick-bar', 'One-click insertion for bold, italic, headings, links, code, math, and tables.', 'builder', 'Toolbar'],
  ['i-image-plus', 'Image paste (Base64)', 'Paste images from clipboard directly into Markdown embedded as data URLs.', 'builder', 'Paste'],
  ['i-upload-cloud', 'Drag & drop loader', 'Drop any .md file anywhere on the browser window for instant opening.', 'builder', 'Drop'],
  ['i-globe', 'Load from URL', 'Fetch raw Markdown from any HTTP/HTTPS URL or web repository.', 'builder', 'Fetch'],
  ['i-zap', 'One-click demo doc', 'Instant sample file demonstrating math, tables, code, and diagrams.', 'builder', 'Demo'],

  // Universal Power Exports
  ['i-download', 'Markdown export (.md)', 'Download the raw or edited Markdown source file.', 'export', '.MD'],
  ['i-globe', 'Standalone HTML (.html)', 'Self-contained styled HTML file with inline KaTeX styles and typography.', 'export', '.HTML'],
  ['i-file', 'Plain text export (.txt)', 'Clean text export with all markdown formatting stripped.', 'export', '.TXT'],
  ['i-printer', 'Vector PDF print (.pdf)', 'Clean print-ready CSS that strips UI and renders crisp vector pages.', 'export', '.PDF'],
  ['i-file-diff', 'Word document (.docx)', 'Formatted document compatible with Microsoft Word and LibreOffice.', 'export', '.DOCX'],
  ['i-brain', 'Obsidian vault format', 'Formatted Markdown with Obsidian YAML frontmatter and note metadata.', 'export', 'Obsidian'],
  ['i-compass', 'Notion-ready format', 'Formatted content ready for 1-click import into Notion workspaces.', 'export', 'Notion'],
  ['i-git-branch', 'GitHub Flavored export', 'Standard GFM format ready for GitHub READMEs and issues.', 'export', 'GFM'],
  ['i-download', 'Export Mermaid SVG', 'Save rendered diagrams as standalone vector SVG files.', 'export', 'SVG'],

  // Navigation, Bookmarks & Storage
  ['i-star', 'Scroll position bookmarks', 'Save precise reading positions per file and jump back anytime.', 'reader', 'Marks'],
  ['i-bookmark', 'Per-document notes', 'Write persistent notes and thoughts attached to any Markdown document.', 'reader', 'Notes'],
  ['i-clock', 'Recent files history', 'IndexedDB persistent history of opened files with fast resumption.', 'reader', 'History'],
  ['i-history', 'Auto-resume reading', 'Reopen any document and automatically continue exactly where you left off.', 'reader', 'Resume'],
  ['i-copy', 'Smart copy tools', 'Copy entire document, formatted HTML, outline TOC, or individual headings.', 'reader', 'Copy'],
  ['i-save', 'Backup & restore JSON', 'Export and import all bookmarks, notes, history, and preferences.', 'tools', 'Backup'],

  // Performance & Security
  ['i-zap', 'Fastest ever rendering', 'Pure vanilla JavaScript, debounced parsing, and zero framework bloat.', 'tools', 'Speed', 'perf'],
  ['i-shield', '100% offline & private', 'Zero cloud uploads, zero telemetry, zero analytics — completely local.', 'tools', 'Private', 'about'],
  ['i-sparkle', 'Free & unlimited forever', 'No subscriptions, no account required, no feature paywalls.', 'tools', 'Free', 'features'],

  // NEW: Templates gallery (1-tap)
  ['i-layout', 'Study notes template', 'Headings + tasks + Q/A + cloze + mermaid starter for revision.', 'builder', '1-Tap', 'tpl-study'],
  ['i-user', 'Meeting notes template', 'Agenda, decisions, actions with owners and dates.', 'builder', '1-Tap', 'tpl-meeting'],
  ['i-play', 'Exam prep template', 'Countdown, topics, flashcards hook, mock Q/A blocks.', 'builder', '1-Tap', 'tpl-exam'],
  ['i-book', 'Journal template', 'Daily log with mood, wins, gratitude, tomorrow.', 'builder', '1-Tap', 'tpl-journal'],
  ['i-text', 'Thesis template', 'Abstract, chapters, citations, appendix skeleton.', 'builder', '1-Tap', 'tpl-thesis'],
  ['i-check', 'Habit tracker template', '30-day markdown table + weekly review.', 'builder', '1-Tap', 'tpl-habit'],

  // NEW: Study Lab (offline text lab)
  ['i-search-code', 'Markdown lint', 'Long lines, missing image alt, heading jumps, broken #anchors. Offline.', 'tools', 'Lab', 'lint'],
  ['i-sparkle', 'Extractive summary', 'Top sentences by frequency — instant TL;DR, no cloud.', 'tools', 'Lab', 'summary'],
  ['i-target', 'Keyword extractor', 'Top terms with counts — find what matters in seconds.', 'tools', 'Lab', 'keywords'],
  ['i-chart', 'Word frequency', 'Bar list of most used words, stopwords removed.', 'tools', 'Lab', 'freq'],
  ['i-eye', 'Readability score', 'Flesch reading-ease + grade level, offline estimate.', 'tools', 'Lab', 'readability'],
  ['i-copy', 'Copy as HTML', 'Rendered HTML of current doc to clipboard.', 'export', 'Copy', 'copy-html'],
  ['i-list', 'Copy outline', 'Numbered outline to clipboard for notes.', 'export', 'Copy', 'copy-outline'],
  ['i-printer', 'Print selection', 'Print only selected text, clean page.', 'export', 'Print', 'print-sel'],
  ['i-file', 'Export JSON model', 'Headings + words + marks + cards as JSON.', 'export', '.JSON', 'export-json'],
  ['i-download', 'Export CSV frequency', 'Word,count CSV for spreadsheets.', 'export', '.CSV', 'export-csv'],

  // NEW: Focus & speed
  ['i-eye-dim', 'Sentence focus mode', 'Dims all but hovered paragraph — deep reading.', 'tools', 'Focus', 'focus-sent'],
  ['i-list', 'Numbered outline', '1 · 1.1 · 1.1.1 numbering in outline.', 'reader', 'Outline', 'outline-num'],
  ['i-zap', 'Perf mode + render meter', 'Skips heavy diagrams/math on giant files, shows ms render time.', 'tools', 'Fast', 'perf'],
  ['i-timer', 'Study streak', 'Daily open streak counter, local only.', 'tools', 'Streak', 'streak'],
  ['i-refresh', 'Shuffle flashcards', 'Randomize deck order for real recall.', 'tools', 'Deck', 'shuffle'],
  ['i-check', 'Mark all known', 'One tap: all cards known. Reset anytime.', 'tools', 'Deck', 'known-all'],
  ['i-x', 'Reset known', 'Clear known state, restart revision.', 'tools', 'Deck', 'known-reset'],
  ['i-upload-cloud', 'Import Anki TSV', 'Paste Q<TAB>A lines to add cards.', 'builder', 'Import', 'import-tsv'],
  ['i-copy', 'Copy doc stats', 'File, words, heads, math and reading time in one line.', 'export', 'Copy', 'copy-stats'],
  ['i-scroll', 'Back to top + progress', 'Top progress bar, back-to-top, % in status.', 'reader', 'Nav', 'top'],

  // NEW: Builder power
  ['i-code', 'Wrap as code', 'Wrap selection in `code` or fenced block.', 'builder', 'Edit', 'wrap-code'],
  ['i-table', 'Sort table by column', 'Tap header to sort rendered tables AZ.', 'reader', 'Tables', 'sort-tables'],
  ['i-link', 'Copy heading links', 'All headings as markdown links list.', 'export', 'Copy', 'copy-links'],
  ['i-clock', 'Insert timestamp', 'Insert current date-time at cursor.', 'builder', 'Edit', 'timestamp'],
  ['i-text', 'Upper / lower / title', 'Transform selection case instantly.', 'builder', 'Edit', 'case-menu'],
  ['i-trash', 'Remove blank lines', 'Collapse 3+ newlines, trim trailing spaces.', 'builder', 'Clean', 'clean-md'],
  ['i-timer', 'Stopwatch + laps', 'Count-up timer with 50 saved laps for study sessions.', 'tools', 'Timer', 'stopwatch'],
  ['i-plus', 'Tally counters', 'Named counters with custom steps — dhikr, reps, anything. Auto-saved.', 'tools', 'Count', 'counter'],
  ['i-chart', 'Habit tracker', 'Daily check-ins, 14-day grid, per-habit fire streaks. All saved.', 'tools', 'Streak', 'tracker'],
  ['i-check', 'Todo manager', 'Tasks with priority + due dates, filters, markdown export. Press O.', 'tools', 'Todo', 'todo'],
  ['i-download', 'Todo export (.md)', 'Open + done tasks as a dated markdown checklist.', 'export', '.MD', 'todo-export'],
  ['i-upload-cloud', 'Import checklist', 'Paste any - [ ] checklist  instant tasks.', 'builder', 'Import', 'todo-import'],
  ['i-sparkle', 'Study pack export', 'Outline + markers + notes + flashcards + tasks in one .md file.', 'export', 'Pack', 'study-pack'],
  ['i-save', 'Backup everything', 'One file: tasks, counters, habits, laps, marks, cards, notes, prefs.', 'export', 'All', 'backup-all'],
  ['i-copy', 'Copy markers list', 'All H/U/S marks as numbered list.', 'export', 'Copy', 'copy-markers'],
  ['i-list', 'Export outline .md', 'Headings as markdown list file.', 'export', '.MD', 'export-outline'],
  ['i-clock', 'Word goal check', 'Instant session/daily progress toast.', 'tools', 'Goals', 'goal-check'],
  ['i-moon', 'Night reading toggle', 'One tap page night mode.', 'theme', 'Night', 'night-toggle']
];

let currentFeatCat = 'all';
let currentFeatFilter = '';

function featCounts() {
  const c = { all: FEATURES.length, reader: 0, theme: 0, tools: 0, builder: 0, export: 0 };
  FEATURES.forEach(f => { if (c[f[3]] != null) c[f[3]]++; });
  return c;
}
function featuresHtml(filterText = '', cat = 'all', win) {
  const q = String(filterText || '').trim().toLowerCase();
  const filtered = FEATURES.filter(f => {
    if (cat !== 'all' && f[3] !== cat) return false;
    if (!q) return true;
    return f[1].toLowerCase().includes(q) || f[2].toLowerCase().includes(q) || (f[4] && f[4].toLowerCase().includes(q));
  });
  if (!filtered.length) {
    return '<div class="placeholder"><svg class="ic"><use href="#i-search"/></svg>No features matching "' + esc(filterText) + '"</div>';
  }
  const gridCls = win ? 'feat-win-grid' : 'feat-grid';
  const cardCls = win ? 'feat-win-card' : 'feat';
  return '<div class="' + gridCls + '">' + filtered.map((f, i) => {
    const run = f[5] ? '<button class="feat-run" data-run="' + esc(f[5]) + '">Run</button>' : '';
    return '<div class="' + cardCls + '"><div class="fi"><svg class="ic"><use href="#' + f[0] + '"/></svg></div>' +
      '<div style="flex:1;min-width:0"><h4>' + esc(f[1]) + (f[4] ? '<span class="feat-badge">' + esc(f[4]) + '</span>' : '') + '</h4><p>' + esc(f[2]) + '</p>' + run + '</div></div>';
  }).join('') + '</div>';
}
function bindFeatRuns(root) {
  try {
    root.querySelectorAll('[data-run]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        runFeature(b.dataset.run);
      });
    });
  } catch (e) {}
}
function renderFeaturesMini() {
  if (D.featuresMini) {
    D.featuresMini.innerHTML = featuresHtml(currentFeatFilter, currentFeatCat, false);
    bindFeatRuns(D.featuresMini);
  }
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
/* ---- Feature runner: every card's Run button works (fast, offline) ---- */
function runFeature(key) {
  try {
    closeModal();
    switch (key) {
      case 'features': openFeaturesList(); break;
      case 'about': showAbout(); break;
      case 'perf': togglePerfInfo(); break;
      case 'tpl-study': applyTemplate('study'); break;
      case 'tpl-meeting': applyTemplate('meeting'); break;
      case 'tpl-exam': applyTemplate('exam'); break;
      case 'tpl-journal': applyTemplate('journal'); break;
      case 'tpl-thesis': applyTemplate('thesis'); break;
      case 'tpl-habit': applyTemplate('habit'); break;
      case 'lint': labLint(); break;
      case 'summary': labSummary(); break;
      case 'keywords': labKeywords(); break;
      case 'freq': labFreq(); break;
      case 'readability': labReadability(); break;
      case 'copy-html': copyHtmlDoc(); break;
      case 'copy-outline': copyOutline(); break;
      case 'print-sel': printSelection(); break;
      case 'export-json': exportJsonModel(); break;
      case 'export-csv': exportFreqCsv(); break;
      case 'focus-sent': toggleFocusSent(); break;
      case 'outline-num': toggleOutlineNum(); break;
      case 'streak': showStreak(); break;
      case 'shuffle': shuffleFlash(); break;
      case 'known-all': knownAll(true); break;
      case 'known-reset': knownAll(false); break;
      case 'import-tsv': importTsvModal(); break;
      case 'focus-mode': toggleFocusMode(); break;
      case 'copy-stats': copyDocStats(); break;
      case 'top': try { D.viewer.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} break;
      case 'wrap-code': builderInsert('codeblock'); setBuilderMode(true); break;
      case 'sort-tables': enableTableSort(); toast('Tap any table header to sort', null, 1800); break;
      case 'copy-links': copyHeadingLinks(); break;
      case 'timestamp': insertTimestamp(); break;
      case 'case-menu': caseMenu(); break;
      case 'clean-md': cleanMarkdown(); break;
      case 'stopwatch': switchPane('features'); try { D.swDisplay.scrollIntoView({ block: 'nearest' }); } catch (e) {} swStartStop(); break;
      case 'counter': switchPane('features'); if (D.counterName) D.counterName.focus(); addCounter(); break;
      case 'tracker': switchPane('features'); if (D.habitName) D.habitName.focus(); break;
      case 'todo': switchPane('todo'); toggleSidebar(true); if (D.todoInput) setTimeout(() => D.todoInput.focus(), 120); break;
      case 'todo-export': exportTodos(); break;
      case 'todo-import': importTodoChecklist(); break;
      case 'study-pack': exportStudyPack(); break;
      case 'backup-all': if (D.btnBackupAll) D.btnBackupAll.click(); break;
      case 'copy-markers': exportMarkers(); break;
      case 'export-outline': copyOutline(); break;
      case 'goal-check': checkGoals(); toast('Goals updated — see Tools tab', 'ok', 1600); break;
      case 'night-toggle': cyclePageMode(); break;
      default: openFeaturesList(); break;
    }
  } catch (e) { toast('Could not run feature', 'err'); }
}
function togglePerfInfo() {
  const ms = S.lastRenderMs != null ? S.lastRenderMs + 'ms' : '—';
  toast('Render: ' + ms + ' · Perf mode ' + (P.perf !== false ? 'ON' : 'OFF'), null, 2200);
  switchPane('features');
}
function showShortcuts() {
  const groups = [
    ['File', [['Open file', ['Ctrl', 'O']], ['Save .md', ['Ctrl', 'S']], ['Print', ['Ctrl', 'P']], ['Todo manager', ['O']]]],
    ['Read', [['Search', ['Ctrl', 'F']], ['Bigger text', ['+']], ['Smaller text', ['−']], ['Save position', ['D']], ['Page mode', ['N']], ['Mark H/U/S/C', ['H', 'U', 'S', 'C']]]],
    ['Builder', [['Toggle builder', ['E']], ['Bold in builder', ['Ctrl', 'B']], ['Link in builder', ['Ctrl', 'K']], ['Templates', ['1-6']]]],
    ['View', [['Sidebar', ['Ctrl', 'B']], ['Fullscreen', ['F11']], ['Present', ['P']], ['Theme', ['T']], ['Features list', ['F']]]],
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
function openFeaturesList() {
  switchPane('features');
  toggleSidebar(true);
  $$('#featuresTabSeg button').forEach(b => b.classList.toggle('on', b.dataset.ftab === 'list'));
  if (D.ftabTools) D.ftabTools.hidden = true;
  if (D.ftabList) D.ftabList.hidden = false;
  renderFeaturesMini();
  if (D.featSearch) setTimeout(() => { try { D.featSearch.focus(); } catch (e) {} }, 120);
}
function showAbout() {
  openModal({
    title: 'About Heros Markdown', icon: 'i-shield',
    html: '<div style="text-align:center;padding:8px 0 18px">' +
      '<img src="icons/logo.png" alt="logo" style="width:64px;height:64px;margin:0 auto 14px;border-radius:18px;display:block;box-shadow:0 12px 28px -10px var(--accent-ring)">' +
      '<h3 style="margin:0 0 4px;font-size:18px">Heros Markdown</h3>' +
      '<p style="margin:0;color:var(--muted);font-size:13px">Version 1.2 · 110 tools · marked + KaTeX offline</p></div>' +
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
    { icon: 'i-check', text: 'Apply builder  view', disabled: !S.builderMode, action: applyBuilder },
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
    { icon: 'i-sparkle', text: 'All features list (' + FEATURES.length + ')', kbd: 'F', action: openFeaturesList },
    { icon: 'i-search-code', text: 'Lint markdown', disabled: !has, action: labLint },
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
  hideSelBar();
  S.raw = ''; S.docId = null; S.headings = [];
  S.quiz = { cards: [], idx: 0, show: false, score: 0 };
  if (D.mdCard) D.mdCard.hidden = true;
  if (D.builderCard) D.builderCard.hidden = true;
  if (D.empty) D.empty.hidden = false;
  if (D.fileTag) D.fileTag.hidden = true;
  if (D.sbFile) D.sbFile.textContent = 'No document';
  if (D.btnSearch) D.btnSearch.disabled = true;
  if (D.btnToc) D.btnToc.disabled = true;
  document.title = 'Heros Markdown';
  resetSearch();
  if (D.outlineList) D.outlineList.innerHTML = '';
  if (D.outlineEmpty) D.outlineEmpty.hidden = false;
  try { renderMarkerList(); } catch (e) {}
  try { renderFlashList(); } catch (e) {}
  try { updateProgressBar(); } catch (e) {}
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
D.btnEditToggle.addEventListener('click', () => setBuilderMode(!S.builderMode));
D.btnSearch.addEventListener('click', () => { switchPane('search'); toggleSidebar(true); });
D.btnToc.addEventListener('click', () => { switchPane('doc'); toggleSidebar(true); });
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


// Features Tab Switcher (Power Tools vs All Features)
D.featuresTabSeg?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-ftab]');
  if (!btn) return;
  $$('#featuresTabSeg button').forEach(b => b.classList.toggle('on', b === btn));
  const isList = btn.dataset.ftab === 'list';
  if (D.ftabTools) D.ftabTools.hidden = isList;
  if (D.ftabList) D.ftabList.hidden = !isList;
  if (isList) renderFeaturesMini();
});

// Features mini search & category filter pills
D.featSearch?.addEventListener('input', () => {
  currentFeatFilter = (D.featSearch.value || '').trim();
  renderFeaturesMini();
});
D.featFilterPills?.addEventListener('click', e => {
  const pill = e.target.closest('.feat-pill');
  if (!pill) return;
  $$('.feat-pill', D.featFilterPills).forEach(p => p.classList.toggle('on', p === pill));
  currentFeatCat = pill.dataset.cat || 'all';
  renderFeaturesMini();
});

// File permission tip dismiss
D.btnPermDismiss?.addEventListener('click', () => {
  if (D.filePermTip) D.filePermTip.hidden = true;
});

// Progress bar click to top
D.progressBarTop?.addEventListener('click', () => { D.viewer.scrollTo({ top: 0, behavior: 'smooth' }); });

// Local-file tip: open the picker (works with no extra permission) or dismiss
if (D.btnPermOpen) D.btnPermOpen.addEventListener('click', () => { pickFile(); });

// Annotations toolbar (legacy  routes to study marks, sel-bar is primary)
if (D.annoClear) D.annoClear.addEventListener('click', () => {
  if (!S.docId) return;
  S.highlights[S.docId] = [];
  saveMarks();
  try { renderMarkerList(); } catch (e) {}
  if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize);
  toast('Markers cleared', 'ok', 1200);
});

try {
  if (D.annoToolbar) $$('.anno-color', D.annoToolbar).forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => {
      P.markerColor = btn.dataset.color || '#ffd400';
      savePrefs();
      addStudyMark('highlight', P.markerColor);
      if (D.annoToolbar) D.annoToolbar.classList.remove('show');
    });
  });
} catch (e) {}
// NOTE: selection  sel-bar handled in wireStudyMagic (single debounced listener, no conflict)

// Pomodoro timer FAB
D.timerFab?.addEventListener('click', () => {
  if (pomodoroTimer) { stopPomodoro(); }
  else { startPomodoro(); }
});

// Vim mode toggle
D.swVimMode?.addEventListener('change', e => {
  P.vimMode = e.target.checked;
  savePrefs();
  S.vimMode = P.vimMode;
  if (D.vimIndicator) D.vimIndicator.classList.toggle('show', S.vimMode);
  toast(S.vimMode ? 'Vim navigation ON (j/k/d/u/gg/G)' : 'Vim mode OFF', 'ok', 1500);
});

// Custom CSS
D.btnCustomCss?.addEventListener('click', () => {
  openModal({
    title: 'Custom CSS', icon: 'i-pen-tool',
    html: '<label class="field-label">Add your CSS rules (applied instantly, saved locally)</label>' +
          '<textarea class="field code-field css-editor" id="customCssEditorInput" style="min-height:180px;width:100%;margin-top:6px" placeholder=".md-doc { font-family: Georgia, serif; }&#10;.md-doc h1 { color: var(--accent); }"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="cssApply">Apply</button>',
    onMount: m => {
      const input = m.querySelector('#customCssEditorInput');
      if (input) input.value = P.customCss || '';
      m.querySelector('#cssApply').addEventListener('click', () => {
        P.customCss = (input ? input.value : '').trim();
        savePrefs();
        loadCustomCss();
        if (D.btnCustomCssClear) D.btnCustomCssClear.style.display = P.customCss ? 'inline-flex' : 'none';
        closeModal();
        toast('Custom CSS applied', 'ok', 1500);
      });
    }
  });
});
D.btnCustomCssClear?.addEventListener('click', () => {
  P.customCss = '';
  savePrefs();
  loadCustomCss();
  if (D.btnCustomCssClear) D.btnCustomCssClear.style.display = 'none';
  toast('Custom CSS cleared', 'ok', 1500);
});

// Word count goals
D.btnGoalSet?.addEventListener('click', () => {
  const session = prompt('Session word goal (current: ' + (P.goalSession || 500) + '):', P.goalSession || 500);
  const daily = prompt('Daily word goal (current: ' + (P.goalDaily || 2000) + '):', P.goalDaily || 2000);
  if (session !== null) { P.goalSession = parseInt(session) || 500; }
  if (daily !== null) { P.goalDaily = parseInt(daily) || 2000; }
  savePrefs(); checkGoals();
  toast('Goals updated: session ' + P.goalSession + ', daily ' + P.goalDaily, 'ok', 2000);
});
D.btnGoalReset?.addEventListener('click', () => {
  S.stats.dailyWords = 0;
  saveStats(); checkGoals();
  toast('Daily count reset to 0', 'ok', 1500);
});

// Pomodoro settings
D.pomodoroWork?.addEventListener('input', e => { P.pomodoroWork = +e.target.value; if (D.pomodoroWorkLbl) D.pomodoroWorkLbl.textContent = P.pomodoroWork; savePrefs(); });
D.pomodoroBreak?.addEventListener('input', e => { P.pomodoroBreak = +e.target.value; if (D.pomodoroBreakLbl) D.pomodoroBreakLbl.textContent = P.pomodoroBreak; savePrefs(); });
D.pomodoroLong?.addEventListener('input', e => { P.pomodoroLong = +e.target.value; if (D.pomodoroLongLbl) D.pomodoroLongLbl.textContent = P.pomodoroLong; savePrefs(); });
D.btnPomodoroStart?.addEventListener('click', () => {
  if (pomodoroTimer) stopPomodoro();
  else startPomodoro();
});
D.btnPomodoroSkip?.addEventListener('click', skipPomodoro);

// Link checker
D.btnLinkCheck?.addEventListener('click', checkLinks);
D.btnLinkCheckCancel?.addEventListener('click', () => {
  linkCheckRunning = false;
  if (linkCheckAbortCtrl) linkCheckAbortCtrl.abort();
  if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder">Link check cancelled</div>';
  if (D.btnLinkCheck) D.btnLinkCheck.disabled = false;
  if (D.btnLinkCheckCancel) D.btnLinkCheckCancel.style.display = 'none';
});

// Mermaid settings
D.swMermaid?.addEventListener('change', e => {
  P.mermaid = e.target.checked;
  savePrefs();
  if (P.mermaid && S.raw) onDocReady(S.raw, S.fileName, S.fileSize);
  toast(P.mermaid ? 'Mermaid diagrams ON' : 'Mermaid diagrams OFF', 'ok', 1400);
});
D.btnMermaidTheme?.addEventListener('click', () => {
  const themes = ['default', 'dark', 'forest', 'neutral'];
  openMenu(D.btnMermaidTheme, themes.map(t => ({
    text: t.charAt(0).toUpperCase() + t.slice(1),
    checked: (P.mermaidTheme || 'default') === t,
    action: () => {
      P.mermaidTheme = t;
      savePrefs();
      mermaidInitialized = false;
      initMermaid();
      if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize);
      toast('Mermaid theme: ' + t, 'ok', 1500);
    }
  })));
});
D.btnMermaidExport?.addEventListener('click', () => {
  const blocks = D.mdDoc ? D.mdDoc.querySelectorAll('.mermaid svg') : [];
  if (blocks.length) {
    const svgs = Array.from(blocks).map((b, i) => '<!-- Diagram ' + (i + 1) + ' -->\n' + b.outerHTML).join('\n\n<hr/>\n\n');
    download((S.fileName || 'diagrams').replace(/\.[^.]+$/, '') + '-diagrams.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mermaid Diagrams</title><style>body{padding:30px;background:#0d1117;display:flex;flex-direction:column;align-items:center;gap:30px}svg{max-width:100%;height:auto}hr{width:100%;border-color:#30363d}</style></head><body>' + svgs + '</body></html>', 'text/html');
    toast('Exported ' + blocks.length + ' diagram(s)', 'ok', 1800);
  } else {
    toast('No rendered mermaid diagrams found', 'err');
  }
});

// Spell check
D.swSpellCheck?.addEventListener('change', e => {
  P.spellCheck = e.target.checked;
  savePrefs();
  if (D.builderArea) D.builderArea.spellcheck = P.spellCheck;
  toast(P.spellCheck ? 'Builder spellcheck ON' : 'Builder spellcheck OFF', 'ok', 1400);
});
D.swSpellCheckDoc?.addEventListener('change', e => {
  P.spellCheckDoc = e.target.checked;
  savePrefs();
  if (P.spellCheckDoc) runSpellCheck();
  toast(P.spellCheckDoc ? 'On-demand scan enabled' : 'On-demand scan disabled', 'ok', 1400);
});
D.btnSpellCheckRun?.addEventListener('click', runSpellCheck);
D.btnSpellCheckIgnore?.addEventListener('click', () => {
  const current = (S.spellCheckIgnore || []).join(', ');
  const input = prompt('Enter words to ignore (comma-separated):', current);
  if (input !== null) {
    S.spellCheckIgnore = input.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
    try { localStorage.setItem('herosmd-spell-ignore-v1', JSON.stringify(S.spellCheckIgnore)); } catch (e) {}
    toast('Updated ignore list (' + S.spellCheckIgnore.length + ' words)', 'ok', 1500);
    if (P.spellCheckDoc) runSpellCheck();
  }
});

// Export formats
D.btnExportObsidian?.addEventListener('click', exportObsidian);
D.btnExportNotion?.addEventListener('click', exportNotion);
D.btnExportDocx?.addEventListener('click', exportDocx);
D.btnExportPdf?.addEventListener('click', () => window.print());
D.btnExportGfm?.addEventListener('click', exportGfm);
D.btnExportHtml?.addEventListener('click', exportHTMLStandalone);
D.btnExportMd?.addEventListener('click', () => {
  if (S.raw) download(baseName('.md'), S.raw, 'text/markdown');
  else toast('Open a document first', 'err');
});

// Document compare
D.btnDiffOpen?.addEventListener('click', diffDocuments);
D.btnDiffClose?.addEventListener('click', () => {
  if (D.diffContainer) D.diffContainer.hidden = true;
  if (D.btnDiffClose) D.btnDiffClose.style.display = 'none';
  S.diffOtherDoc = null;
  toast('Diff view closed', null, 1200);
});
D.btnDiffSwap?.addEventListener('click', () => {
  if (S.diffOtherDoc && S.raw) {
    const tmp = S.raw;
    S.raw = S.diffOtherDoc;
    S.diffOtherDoc = tmp;
    onDocReady(S.raw, S.fileName, S.fileSize);
    showDiff();
    toast('Swapped documents', 'ok', 1200);
  } else {
    toast('No compared document loaded to swap', 'err');
  }
});
D.btnDiffExport?.addEventListener('click', () => {
  if (!S.diffOtherDoc || !S.raw) { toast('Run a comparison first', 'err'); return; }
  const { diff1, diff2, delCount, addCount } = computeLineDiff(S.raw, S.diffOtherDoc);
  let patch = `--- ${S.fileName || 'Original'}\n+++ Compared\n@@ -${delCount} +${addCount} @@\n`;
  const max = Math.max(diff1.length, diff2.length);
  for (let i = 0; i < max; i++) {
    const d1 = diff1[i], d2 = diff2[i];
    if (d1 && d1.type === 'del') patch += '- ' + d1.text + '\n';
    if (d2 && d2.type === 'add') patch += '+ ' + d2.text + '\n';
    if (d1 && d1.type === 'same') patch += '  ' + d1.text + '\n';
  }
  download((S.fileName || 'doc').replace(/\.[^.]+$/, '') + '.patch', patch, 'text/plain');
  toast('Diff patch exported', 'ok', 1500);
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
  if (!S.docId) S.docId = 'builder-' + Date.now();
  if (!S.fileName || S.fileName === 'document.md') S.fileName = 'builder.md';
  S.builderMode = false;
  if (D.btnEditToggle) D.btnEditToggle.classList.remove('on');
  const sb = $('#sbEdit'); if (sb) sb.classList.remove('on');
  if (D.builderCard) D.builderCard.hidden = true;
  onDocReady(src, S.fileName, src.length);
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
function fullBackupData() {
  return {
    app: 'heros-markdown', v: 2, at: new Date().toISOString(),
    prefs: P, stats: S.stats,
    bookmarks: S.bookmarks, notes: S.notes,
    highlights: S.highlights, annotations: S.annotations, flashcards: S.flashcards,
    todos: S.todos, counters: S.counters, habits: S.habits,
    stopwatch: { base: swElapsed(), laps: (S.sw.laps || []).slice(-50) },
    spellIgnore: S.spellCheckIgnore
  };
}
$('#btnBackupAll').addEventListener('click', () => {
  download('herosmd-backup-all-' + dayKey() + '.json', JSON.stringify(fullBackupData(), null, 2), 'application/json');
  try { if (D.kvSaved) D.kvSaved.textContent = new Date().toLocaleTimeString(); } catch (e) {}
  toast('Everything saved — tasks, counters, habits, laps, marks, cards', 'ok', 2200);
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
    if (j.highlights) S.highlights = j.highlights;
    if (j.annotations) S.annotations = j.annotations;
    if (j.flashcards) S.flashcards = j.flashcards;
    if (Array.isArray(j.todos)) S.todos = j.todos;
    if (Array.isArray(j.counters)) S.counters = j.counters;
    if (j.habits && typeof j.habits === 'object') S.habits = j.habits;
    if (j.stopwatch && Array.isArray(j.stopwatch.laps)) S.sw = { running: false, base: j.stopwatch.base || 0, startTs: 0, laps: j.stopwatch.laps };
    if (Array.isArray(j.spellIgnore)) S.spellCheckIgnore = j.spellIgnore;
    saveMarks(); savePower();
    applyReadingPrefs(); renderMarks(); refreshHubStats();
    try { renderMarkerList(); renderFlashList(); renderTodos(); renderCounters(); renderHabits(); renderSwLaps(); } catch (err) {}
    toast('Everything restored', 'ok', 1800);
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
      updateProgressBar();
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
    if (D.modalBackdrop.classList.contains('show')) { closeModal(); return; }
    if (menuOpen) { closeMenu(); return; }
    if (document.body.classList.contains('present-doc')) { togglePresent(); return; }
    if (window.innerWidth <= 900 && D.sidebar.classList.contains('open')) { toggleSidebar(false); return; }
    return;
  }
  if (typing) return;
  // Vim Mode Navigation
  if (S.vimMode && !mod) {
    if (e.key === 'j') { e.preventDefault(); D.viewer.scrollBy({ top: 80, behavior: 'smooth' }); return; }
    if (e.key === 'k') { e.preventDefault(); D.viewer.scrollBy({ top: -80, behavior: 'smooth' }); return; }
    if (e.key === 'd') { e.preventDefault(); D.viewer.scrollBy({ top: D.viewer.clientHeight * 0.5, behavior: 'smooth' }); return; }
    if (e.key === 'u') { e.preventDefault(); D.viewer.scrollBy({ top: -D.viewer.clientHeight * 0.5, behavior: 'smooth' }); return; }
    if (e.key === 'g') {
      const now = Date.now();
      if (now - (window._lastGTime || 0) < 500) {
        e.preventDefault();
        D.viewer.scrollTo({ top: 0, behavior: 'smooth' });
        window._lastGTime = 0;
      } else {
        window._lastGTime = now;
      }
      return;
    }
    if (e.key === 'G') { e.preventDefault(); D.viewer.scrollTo({ top: D.viewer.scrollHeight, behavior: 'smooth' }); return; }
    if (e.key === '/') {
      e.preventDefault();
      switchPane('search');
      toggleSidebar(true);
      D.searchInput.focus();
      return;
    }
    if (e.key === 'n') { e.preventDefault(); selectSearchResult(S.searchCursor + 1); return; }
    if (e.key === 'N') { e.preventDefault(); selectSearchResult(S.searchCursor - 1); return; }
    if (e.key === 'i') { e.preventDefault(); setBuilderMode(true); D.builderArea.focus(); return; }
  }
  if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
  if (!S.raw && (e.key === 'e' || e.key === 'E')) { setBuilderMode(true); if (!S.raw) { D.empty.hidden = true; D.builderCard.hidden = false; } return; }
  if (e.key === 'e' || e.key === 'E') { setBuilderMode(!S.builderMode); return; }
  if (e.key === 'o' || e.key === 'O') { switchPane('todo'); toggleSidebar(true); setTimeout(() => { try { D.todoInput.focus(); } catch (err) {} }, 120); return; }
  if (!S.raw) return;
  if (e.key === 'd' || e.key === 'D') { addBookmark(); return; }
  if (e.key === 'n' || e.key === 'N') { cyclePageMode(); return; }
  if (e.key === 't' || e.key === 'T') { Theme.toggle(); return; }
  if (e.key === 'p' || e.key === 'P') { togglePresent(); return; }
  if (e.key === '+' || e.key === '=') { fontStep(1); return; }
  if (e.key === '-' || e.key === '_') { fontStep(-1); return; }
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
});

/* ---------------- 25. Quick actions (palette removed — use Features Window (F)) ---------------- */
function safeClick(el) { try { if (el) el.click(); } catch (e) {} }

/* ---------------- 26. Progress bar ---------------- */
function updateProgressBar() {
  if (!S.raw) {
    D.progressBarTop.classList.remove('active');
    D.progressBarTop.style.transform = 'scaleX(0)';
    return;
  }
  const max = D.viewer.scrollHeight - D.viewer.clientHeight;
  const pct = max > 0 ? (D.viewer.scrollTop / max) * 100 : 0;
  D.progressBarTop.classList.add('active');
  D.progressBarTop.style.transform = 'scaleX(' + (pct / 100) + ')';
  D.progressBarTop.setAttribute('aria-valuenow', Math.round(pct));
}

/* ---------------- 27. Study marks — Heros PDF marker parity (highlight/underline/strike + sel-bar) ----------------
   Copied behavior from Heros PDF (select  mini-bar  H/U/S/Copy/Note), adapted to Markdown DOM.
   Heros PDF itself is NEVER touched — read-only inspiration, all code lives here. */
function createAnnoId() { return 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function currentSelText() { try { const s = window.getSelection(); return s && s.rangeCount ? s.toString() : ''; } catch (e) { return ''; } }
function addHighlight(color) { addStudyMark('highlight', color); }
function addStudyMark(tool, color) {
  tool = tool || P.markerTool || 'highlight';
  const raw = currentSelText();
  const text = (raw || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length < 1) { toast('Select text in the document first', 'err'); return; }
  if (text.length > 600) { toast('Selection too long (600 chars max)', 'err'); return; }
  if (!S.docId) S.docId = 'doc-' + Date.now();
  if (!S.highlights[S.docId]) S.highlights[S.docId] = [];
  const exists = S.highlights[S.docId].some(h => h.text === text && (h.tool || 'highlight') === tool);
  if (exists) { toast('Already marked — see Markers panel', null, 1500); return; }
  S.highlights[S.docId].push({ id: createAnnoId(), tool, color: color || P.markerColor || '#ffd400', text: text.slice(0, 600), at: Date.now() });
  // cap per doc (fast + storage-safe)
  if (S.highlights[S.docId].length > 400) S.highlights[S.docId] = S.highlights[S.docId].slice(-400);
  saveMarks();
  applyStudyMarks();
  renderMarkerList();
  hideSelBar();
  try { window.getSelection().removeAllRanges(); } catch (e) {}
  toast(tool === 'highlight' ? 'Marker saved' : tool === 'underline' ? 'Underline saved' : 'Strike saved', 'ok', 1200);
}
function applyStudyMarks() { return applyHighlights(); }
function applyHighlights() {
  if (!S.docId || !S.raw || !D.mdDoc) return;
  const marks = S.highlights[S.docId] || [];
  if (!marks.length) return;
  // Single-pass: collect safe text nodes once (skip katex/code/mermaid/existing marks)
  const walker = document.createTreeWalker(D.mdDoc, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const p = n.parentElement;
    if (!p) continue;
    if (/^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/.test(p.tagName)) continue;
    if (p.closest && (p.closest('.katex') || p.closest('.katex-display') || p.closest('.mermaid') || p.closest('.user-mark') || p.closest('mark.hl'))) continue;
    if (n.nodeValue && n.nodeValue.trim()) nodes.push(n);
    if (nodes.length > 1200) break;
  }
  marks.forEach(h => {
    if (!h.text || h.text.length < 1) return;
    for (const node of nodes) {
      if (!node.parentNode || !node.nodeValue) continue;
      if (node.parentNode.closest && node.parentNode.closest('.user-mark')) continue;
      const val = node.nodeValue;
      const idx = val.indexOf(h.text);
      if (idx === -1) continue;
      try {
        const tool = h.tool || 'highlight';
        const before = document.createTextNode(val.slice(0, idx));
        const span = document.createElement('span');
        span.className = 'user-mark mark-' + tool;
        span.dataset.mid = h.id;
        if (tool === 'highlight') span.style.backgroundColor = h.color || '#ffd400';
        else if (tool === 'underline') { span.style.textDecorationColor = h.color || '#4c8dff'; }
        else if (tool === 'strike') { span.style.textDecorationColor = h.color || '#ff6b6a'; }
        span.textContent = h.text;
        span.title = (tool === 'highlight' ? 'Marker' : tool) + ' — click to remove';
        span.addEventListener('click', (e) => { e.stopPropagation(); removeHighlight(h.id); });
        const after = document.createTextNode(val.slice(idx + h.text.length));
        const par = node.parentNode;
        par.insertBefore(before, node);
        par.insertBefore(span, node);
        par.insertBefore(after, node);
        par.removeChild(node);
        // keep node list consistent: split done, stop for this mark (first occurrence)
        break;
      } catch (e) { break; }
    }
  });
}
const renderAnnotations = applyHighlights;
function removeHighlight(id) {
  try {
    if (!S.docId || !S.highlights[S.docId]) return;
    const i = S.highlights[S.docId].findIndex(h => h.id === id);
    if (i >= 0) {
      S.highlights[S.docId].splice(i, 1);
      saveMarks();
      renderMarkerList();
      onDocReady(S.raw, S.fileName, S.fileSize);
      toast('Marker removed', 'ok', 1200);
    }
  } catch (e) {}
}
function copySelectionOrDoc() {
  const t = currentSelText().trim();
  if (t) copyText(t, 'Selection copied');
  else if (S.raw) copyText(plainText(), 'Text copied');
  else toast('Nothing to copy', 'err');
}
function noteFromSelection() {
  const t = currentSelText().trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!S.docId) { toast('Open a document first', 'err'); return; }
  openModal({
    title: 'Note on selection', icon: 'i-text',
    html: (t ? '<div class="file-perm-tip" style="margin:0 0 10px"><svg class="ic"><use href="#i-quote"/></svg><div style="flex:1">“' + esc(t) + '”</div></div>' : '') +
      '<label class="field-label">Your note</label><textarea class="field" id="selNoteField" style="min-height:90px;margin-top:6px" placeholder="Why does this matter?"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="selNoteGo">Save note</button>',
    onMount(m) {
      m.querySelector('#selNoteGo').addEventListener('click', () => {
        const v = (m.querySelector('#selNoteField').value || '').trim();
        if (!v) return;
        const arr = marksFor('notes');
        arr.push({ text: (t ? '“' + t.slice(0, 120) + '” — ' : '') + v.slice(0, 280), at: Date.now() });
        S.notes[S.docId] = arr;
        saveMarks(); renderMarks();
        closeModal(); hideSelBar();
        toast('Note saved', 'ok', 1400);
      });
    }
  });
}
/* Floating selection mini-bar (Heros PDF selBar parity): H / U / S / Copy / Note */
function hideSelBar() { try { if (D.selBar) D.selBar.hidden = true; } catch (e) {} }
function showSelBarNearSelection() {
  try {
    if (!D.selBar || !D.mdDoc) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { hideSelBar(); return; }
    const txt = sel.toString().trim();
    if (!txt || txt.length < 1) { hideSelBar(); return; }
    // only inside rendered doc (not builder/search inputs)
    const an = sel.anchorNode;
    if (!an || !D.mdDoc.contains(an.nodeType === 1 ? an : an.parentNode)) { hideSelBar(); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) { hideSelBar(); return; }
    const bar = D.selBar;
    // measure off-screen first so the bar never flashes below the bottom bar
    bar.style.visibility = 'hidden';
    bar.hidden = false;
    const bw = bar.offsetWidth || 280, bh = bar.offsetHeight || 44;
    let left = r.left + r.width / 2 - bw / 2;
    let top = r.top - bh - 10;
    if (top < 70) top = r.bottom + 10;
    left = Math.max(10, Math.min(window.innerWidth - bw - 10, left));
    // never below the bottom status bar
    top = Math.max(64, Math.min(window.innerHeight - bh - 60, top));
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
    bar.style.visibility = '';
  } catch (e) {}
}
function renderMarkerList() {
  if (!D.markerList) return;
  const arr = (S.docId && S.highlights[S.docId]) || [];
  D.markerList.innerHTML = '';
  if (D.markerEmpty) D.markerEmpty.hidden = arr.length > 0;
  arr.slice().reverse().forEach(m => {
    const div = document.createElement('div');
    div.className = 'bm-item';
    const dot = m.tool === 'highlight'
      ? '<span style="width:14px;height:14px;border-radius:5px;background:' + esc(m.color || '#ffd400') + ';display:inline-block;flex:0 0 auto"></span>'
      : '<span style="font-weight:800;color:' + esc(m.color || 'var(--accent)') + ';flex:0 0 auto">' + (m.tool === 'underline' ? 'U' : 'S') + '</span>';
    div.innerHTML = '<div class="n">' + dot + '</div>' +
      '<div class="meta"><div class="tt">' + esc((m.text || '').slice(0, 90)) + '</div>' +
      '<div class="ss">' + esc(m.tool || 'highlight') + ' · ' + timeAgo(m.at) + ' · click to jump</div></div>' +
      '<button class="x" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.addEventListener('click', (e) => {
      if (e.target.closest('.x')) return;
      jumpToMarkText(m.text);
    });
    div.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); removeHighlight(m.id); });
    D.markerList.appendChild(div);
  });
  const cnt = Object.keys(S.highlights || {}).reduce((a, k) => a + ((S.highlights[k] || []).length), 0);
  const el = $('#stMarks');
  if (el) { /* stMarks shows notes count elsewhere; keep markers in title */ el.title = cnt + ' markers'; }
}
function jumpToMarkText(text) {
  if (!text || !D.mdDoc) return;
  const el = Array.prototype.slice.call(D.mdDoc.querySelectorAll('.user-mark')).find(n => n.textContent === text)
    || Array.prototype.slice.call(D.mdDoc.querySelectorAll('.user-mark')).find(n => n.textContent.indexOf(text.slice(0, 40)) !== -1);
  if (el) {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    el.style.outline = '2px solid var(--accent)';
    setTimeout(() => { el.style.outline = ''; }, 1400);
  } else toast('Marker text not on screen (maybe filtered)', null, 1600);
}

/* ---------------- 28. Image Paste as data-URL (fixed: valid markdown, compressed) ---------------- */
let pasteImageCount = 0;
document.addEventListener('paste', async e => {
  try {
    if (!e.clipboardData) return;
    const files = e.clipboardData.files;
    if (!files || !files.length) return;
    const images = Array.from(files).filter(f => f.type && f.type.indexOf('image/') === 0);
    if (!images.length) return;
    // only when builder focused or builder mode (don't hijack doc copy-paste)
    const ae = document.activeElement;
    const inBuilder = ae === D.builderArea || (S.builderMode && D.builderArea);
    if (!inBuilder && !S.builderMode) return;
    e.preventDefault();
    pasteImageCount += images.length;
    if (D.pasteNotice) D.pasteNotice.classList.add('show');
    if (D.pasteCount) D.pasteCount.textContent = pasteImageCount;
    const builder = D.builderArea;
    if (!builder) return;
    const pos = builder.selectionStart != null ? builder.selectionStart : builder.value.length;
    const end = builder.selectionEnd != null ? builder.selectionEnd : pos;
    let insert = '';
    for (const img of images) {
      const dataUrl = await fileToDataUrl(img, 1400);
      const alt = ((img.name || 'image').replace(/\.[^/.]+$/, '') || 'image').slice(0, 40).replace(/[\[\]()]/g, '');
      insert += (insert ? '\n' : '') + '![' + (alt || 'image') + '](' + dataUrl + ')';
    }
    builder.value = builder.value.slice(0, pos) + '\n' + insert + '\n' + builder.value.slice(end);
    updateBuilderCount();
    liveRender();
    setTimeout(() => { if (D.pasteNotice) D.pasteNotice.classList.remove('show'); }, 3500);
  } catch (err) {}
});
function fileToDataUrl(file, maxDim) {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || 800, h = img.naturalHeight || 600;
          const sc = Math.min(1, (maxDim || 1400) / Math.max(w, h));
          w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/png'));
        } catch (e) { URL.revokeObjectURL(url); fallback(); }
      };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch (e) {} fallback(); };
      img.src = url;
      function fallback() {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve('');
        r.readAsDataURL(file);
      }
    } catch (e) {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    }
  });
}
if (D.pasteNoticeClose) D.pasteNoticeClose.addEventListener('click', () => { if (D.pasteNotice) D.pasteNotice.classList.remove('show'); });

/* ---------------- 29. Mermaid Diagrams — PERFECT (all graphs, queue, errors, export) ---------------- */
var mermaidInitialized = false;
try {
  const mermaidStyle = document.createElement('style');
  mermaidStyle.textContent = '.mermaid{display:flex;flex-direction:column;align-items:center;margin:20px 0;overflow-x:auto;background:var(--surface-2);border:1px solid var(--border);border-radius:16px;padding:14px}.mermaid svg{max-width:100%;height:auto}.mmd-err{border:1px dashed var(--danger);border-radius:12px;padding:10px;font-family:var(--mono);font-size:12px;color:var(--danger);white-space:pre-wrap}';
  document.head.appendChild(mermaidStyle);
} catch (e) {}

function initMermaid() {
  if (!window.mermaid) return false;
  try {
    const r = (typeof Theme !== 'undefined' && Theme.resolved) ? Theme.resolved() : 'dark';
    let theme = P.mermaidTheme || 'default';
    if (r === 'dark' && (theme === 'default' || theme === 'neutral')) theme = 'dark';
    if (r === 'light' && theme === 'dark') theme = 'default';
    window.mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true },
      securityLevel: 'loose'
    });
    mermaidInitialized = true;
    window.__herosMermaidReady = true;
    return true;
  } catch (e) { return false; }
}

function renderMermaid() {
  if (P.mermaid === false || !window.mermaid || !D.mdDoc) return;
  if (!initMermaid() && !mermaidInitialized) return;
  const blocks = D.mdDoc.querySelectorAll('.mermaid-ph');
  if (!blocks.length) return;
  // sequential queue (mermaid.render is not safely parallel + unique ids)
  let chain = Promise.resolve();
  blocks.forEach((block) => {
    chain = chain.then(() => renderOneMermaid(block));
  });
}
async function renderOneMermaid(block) {
  if (!block || !block.isConnected) return;
  if (block.dataset.done === '1') return;
  const rawCode = (block.dataset.mermaid || (block.querySelector('pre') ? block.querySelector('pre').textContent : block.textContent) || '').trim();
  if (!rawCode) return;
  // already has svg?
  if (block.querySelector('svg')) { block.dataset.done = '1'; return; }
  try {
    S.mermaidSeq = (S.mermaidSeq || 0) + 1;
    const id = 'herosmmd-' + Date.now().toString(36) + '-' + S.mermaidSeq;
    const res = await window.mermaid.render(id, rawCode);
    const svg = typeof res === 'string' ? res : (res && res.svg ? res.svg : '');
    // guard: a diagram mermaid cannot measure returns a non-finite viewBox (ex: "0 0 -Infinity 450")
    const vb = (svg.match(/viewBox="([^"]*)"/) || [])[1] || '';
    if (vb) {
      const parts = String(vb).trim().split(/[\s,]+/);
      const bad = parts.length !== 4 || parts.some(function (n) { return !isFinite(parseFloat(n)); });
      if (bad) throw new Error('invalid diagram size (viewBox "' + vb + '")');
    }
    if (svg) {
      // keep source for export/theme re-render
      const src = rawCode;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.dataset.mermaid = src;
      div.innerHTML = svg + '<div style="margin-top:8px;display:flex;gap:6px"><button class="btn ghost" style="height:28px;font-size:11px" data-mmd-copy>Copy source</button><button class="btn ghost" style="height:28px;font-size:11px" data-mmd-svg>Save SVG</button></div><pre hidden>' + esc(src) + '</pre>';
      block.replaceWith(div);
      const cb = div.querySelector('[data-mmd-copy]');
      if (cb) cb.addEventListener('click', () => copyText(src, 'Diagram source copied'));
      const sv = div.querySelector('[data-mmd-svg]');
      if (sv) sv.addEventListener('click', () => {
        const svgEl = div.querySelector('svg');
        if (svgEl) download((S.fileName || 'diagram').replace(/\.[^.]+$/, '') + '-diagram.svg', svgEl.outerHTML, 'image/svg+xml');
      });
    }
  } catch (e) {
    try {
      const err = document.createElement('div');
      err.className = 'mmd-err';
      err.textContent = 'Diagram could not render (' + String((e && e.message) || e || 'syntax').slice(0, 220) + ')\n\n' + rawCode.slice(0, 800);
      const head = block.querySelector('.mmd-head');
      if (head) { const h = head.querySelector('.mmd-hint'); if (h) h.textContent = 'syntax error — source kept'; }
      block.appendChild(err);
      block.dataset.done = '1';
    } catch (_) {}
  }
}

/* ---------------- 30. Link Checker ---------------- */
let linkCheckRunning = false;
let linkCheckAbortCtrl = null;

async function checkLinks() {
  if (linkCheckRunning) return;
  if (!D.mdDoc || !S.raw) { toast('Open a document first', 'err'); return; }

  const anchors = $$('a[href]', D.mdDoc);
  if (!anchors.length) {
    if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder">No links found in document</div>';
    return;
  }

  linkCheckRunning = true;
  linkCheckAbortCtrl = new AbortController();
  if (D.btnLinkCheck) D.btnLinkCheck.disabled = true;
  if (D.btnLinkCheckCancel) D.btnLinkCheckCancel.style.display = 'inline-flex';
  if (D.linkCheckResults) D.linkCheckResults.innerHTML = '<div class="placeholder"><span class="spin"></span> Checking ' + anchors.length + ' link(s)...</div>';

  const results = [];
  for (const a of anchors) {
    if (!linkCheckRunning) break;
    const href = (a.getAttribute('href') || '').trim();
    if (!href) continue;

    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      const target = document.getElementById(targetId) || document.getElementById('h-' + targetId);
      results.push({
        href,
        type: 'internal',
        ok: !!target,
        status: target ? 'Anchor valid' : 'Missing heading #' + targetId
      });
    } else if (/^https?:/i.test(href)) {
      try {
        await fetch(href, { method: 'HEAD', mode: 'no-cors', signal: linkCheckAbortCtrl.signal });
        results.push({
          href,
          type: 'external',
          ok: true,
          status: 'Reachable (OK)'
        });
      } catch (err) {
        if (err.name === 'AbortError') break;
        results.push({
          href,
          type: 'external',
          ok: false,
          status: 'Network / CORS restricted'
        });
      }
    } else {
      results.push({
        href,
        type: 'other',
        ok: true,
        status: 'Local/Protocol URI'
      });
    }
  }

  if (D.linkCheckResults) {
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    let html = `<div style="padding:4px 0 8px;font-size:12px;color:var(--text-2);font-weight:600">` +
      `Tested ${results.length} link(s) • <span style="color:var(--ok)">OK ${passed} valid</span>` +
      (failed ? ` • <span style="color:var(--danger)">x ${failed} broken</span>` : '') +
      `</div>`;
    html += results.map(r =>
      `<div class="link-result ${r.ok ? 'ok' : 'err'}" style="margin-bottom:4px">` +
      `<span class="url" style="max-width:65%;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(r.href)}">${escapeHtml(r.href)}</span>` +
      `<span class="status">${escapeHtml(r.status)}</span>` +
      `</div>`
    ).join('');
    D.linkCheckResults.innerHTML = html;
  }

  if (D.btnLinkCheck) D.btnLinkCheck.disabled = false;
  if (D.btnLinkCheckCancel) D.btnLinkCheckCancel.style.display = 'none';
  linkCheckRunning = false;
}

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
  const sessionPct = Math.min(100, Math.round((words / sessionGoal) * 100));
  const dailyPct = Math.min(100, Math.round((S.stats.dailyWords / dailyGoal) * 100));

  if (D.goalBarSession) {
    D.goalBarSession.style.width = sessionPct + '%';
    D.goalBarSession.style.backgroundColor = sessionPct >= 100 ? 'var(--ok)' : 'var(--accent)';
  }
  if (D.goalTextSession) D.goalTextSession.textContent = words.toLocaleString() + ' / ' + sessionGoal.toLocaleString() + ' (' + sessionPct + '%)';
  if (D.goalBarDaily) {
    D.goalBarDaily.style.width = dailyPct + '%';
    D.goalBarDaily.style.backgroundColor = dailyPct >= 100 ? 'var(--ok)' : 'var(--accent)';
  }
  if (D.goalTextDaily) D.goalTextDaily.textContent = S.stats.dailyWords.toLocaleString() + ' / ' + dailyGoal.toLocaleString() + ' (' + dailyPct + '%)';
  saveStats();
}

/* ---------------- 32. Pomodoro Focus Timer ---------------- */
let pomodoroTimer = null;
let pomodoroState = 'idle';
let pomodoroTimeLeft = 0;

function playChime(type = 'work') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'work') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.18);
      osc.frequency.setValueAtTime(783.99, now + 0.36);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    }
  } catch (e) {}
}

function updatePomodoroUI() {
  const display = fmtTime(Math.max(0, Math.ceil(pomodoroTimeLeft / 1000)));
  try {
    const label = pomodoroState === 'work' ? 'Focus' : (pomodoroState === 'idle' ? 'Focus' : 'Break');
    if (D.timerFab) {
      D.timerFab.classList.toggle('running', pomodoroState !== 'idle');
      // FIX: don't destroy cached node — update in place, re-query fresh
      let disp = D.timerFab.querySelector('#timerDisplay');
      let lab = D.timerFab.querySelector('.timer-label');
      if (!disp || !lab) {
        D.timerFab.innerHTML = '<svg class="ic" style="width:13px;height:13px"><use href="#i-timer"/></svg><span id="timerDisplay">' + esc(display) + '</span><span class="timer-label">' + esc(label) + '</span>';
      } else {
        disp.textContent = display;
        lab.textContent = label;
      }
      D.timerFab.title = pomodoroState === 'idle' ? 'Start focus timer' : (label + ' ' + display + ' — click to stop');
    }
  } catch (e) {}
  try { if (D.pomodoroCycles) D.pomodoroCycles.textContent = S.pomodoroCycles || 0; } catch (e) {}
  try { D.timerDisplay = document.getElementById('timerDisplay'); } catch (e) {}
}

function startPomodoro() {
  if (pomodoroTimer) clearInterval(pomodoroTimer);
  const workMins = P.pomodoroWork || 25;
  pomodoroState = 'work';
  pomodoroTimeLeft = workMins * 60 * 1000;
  updatePomodoroUI();
  toast('Focus session started (' + workMins + ' min)', 'ok', 2000);

  pomodoroTimer = setInterval(() => {
    pomodoroTimeLeft -= 1000;
    if (pomodoroTimeLeft <= 0) {
      if (pomodoroState === 'work') {
        S.pomodoroCycles = (S.pomodoroCycles || 0) + 1;
        saveStats();
        playChime('break');
        const isLong = S.pomodoroCycles % 4 === 0;
        pomodoroState = isLong ? 'longBreak' : 'break';
        const breakMins = isLong ? (P.pomodoroLong || 15) : (P.pomodoroBreak || 5);
        pomodoroTimeLeft = breakMins * 60 * 1000;
        toast(isLong ? 'Great focus! Take a long break (' + breakMins + ' min)' : 'Focus cycle done! Take a break (' + breakMins + ' min)', 'ok', 4000);
      } else {
        playChime('work');
        pomodoroState = 'work';
        pomodoroTimeLeft = (P.pomodoroWork || 25) * 60 * 1000;
        toast('Break finished! Back to focus.', 'ok', 3000);
      }
    }
    updatePomodoroUI();
  }, 1000);
}

function stopPomodoro() {
  if (pomodoroTimer) clearInterval(pomodoroTimer);
  pomodoroTimer = null;
  pomodoroState = 'idle';
  pomodoroTimeLeft = (P.pomodoroWork || 25) * 60 * 1000;
  updatePomodoroUI();
  toast('Timer stopped', null, 1200);
}

function skipPomodoro() {
  if (pomodoroState === 'work') {
    S.pomodoroCycles = (S.pomodoroCycles || 0) + 1;
    saveStats();
    playChime('break');
    pomodoroState = 'break';
    pomodoroTimeLeft = (P.pomodoroBreak || 5) * 60 * 1000;
    toast('Skipped to break', 'ok', 1500);
  } else {
    pomodoroState = 'work';
    pomodoroTimeLeft = (P.pomodoroWork || 25) * 60 * 1000;
    toast('Skipped to focus', 'ok', 1500);
  }
  updatePomodoroUI();
}

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
  if (D.btnCustomCssClear) D.btnCustomCssClear.style.display = css.trim() ? 'inline-flex' : 'none';
}
function applyCustomCss() {
  loadCustomCss();
}

/* ---------------- 34. Spell Check (unicode-safe, XSS-fixed) ---------------- */
function runSpellCheck() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  // all languages: latin words 3+ chars (skip CJK which has no spelling)
  const words = (plainText().match(/[\p{L}]{3,}/gu) || []).filter(w => /[A-Za-z]/.test(w));
  const ignored = S.spellCheckIgnore || [];
  const freq = {};
  words.forEach(w => {
    const lw = w.toLowerCase();
    if (!ignored.includes(lw)) freq[lw] = (freq[lw] || 0) + 1;
  });

  const dictionary = new Set([
    'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at',
    'this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there',
    'their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no',
    'just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then',
    'now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well',
    'way','even','new','want','because','any','these','give','day','most','us','markdown','latex','katex','mermaid',
    'code','html','css','javascript','json','node','table','image','link','header','inline','block','quote','list',
    'item','bold','italic','strike','task','math','formula','syntax','style','font','color','theme','dark','light',
    'true','false','null','undefined','const','let','var','function','return','async','await','promise','class','export',
    'import','from','default','window','document','element','button','input','string','number','object','array',
    'width','height','display','margin','padding','border','background','radius','center','left','right','top','bottom'
  ]);

  const candidates = [];
  for (const [word, count] of Object.entries(freq)) {
    if (!dictionary.has(word) && word.length > 3 && !/^\d+$/.test(word)) {
      candidates.push({ word, count });
    }
  }

  candidates.sort((a, b) => b.count - a.count);

  if (D.spellCheckResults) {
    if (!candidates.length) {
      D.spellCheckResults.innerHTML = '<div class="placeholder"><span style="color:var(--ok)">OK No spelling issues detected</span></div>';
    } else {
      let html = `<div style="padding:4px 0 6px;font-size:12px;color:var(--text-2);font-weight:600">${candidates.length} unique unfamiliar word(s)</div>`;
      html += candidates.slice(0, 30).map((c, i) =>
        `<div class="link-result warn" style="margin-bottom:4px">` +
        `<span class="url"><b>${escapeHtml(c.word)}</b> (${c.count}×)</span>` +
        `<button class="btn" style="height:22px;padding:0 6px;font-size:11px" data-ignore="${i}">Ignore</button>` +
        `</div>`
      ).join('');
      D.spellCheckResults.innerHTML = html;
      Array.prototype.forEach.call(D.spellCheckResults.querySelectorAll('[data-ignore]'), btn => {
        btn.addEventListener('click', () => {
          const c = candidates[parseInt(btn.dataset.ignore, 10)];
          if (c) ignoreWord(c.word);
        });
      });
    }
  }
}

function ignoreWord(w) {
  if (!S.spellCheckIgnore) S.spellCheckIgnore = [];
  if (!S.spellCheckIgnore.includes(w.toLowerCase())) {
    S.spellCheckIgnore.push(w.toLowerCase());
    try { localStorage.setItem('herosmd-spell-ignore-v1', JSON.stringify(S.spellCheckIgnore)); } catch (e) {}
    toast('Added "' + w + '" to ignore list', 'ok', 1200);
    runSpellCheck();
  }
}
window.ignoreWord = ignoreWord;

/* ---------------- 35. Export Formats ---------------- */
function exportObsidian() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const title = (S.fileName || 'Document').replace(/\.[^.]+$/, '');
  const out = '---\ntitle: "' + title + '"\ncreated: ' + new Date().toISOString() + '\ntags: [markdown, heros]\n---\n\n' + S.raw;
  download(baseName('-obsidian.md'), out, 'text/markdown');
  toast('Exported for Obsidian', 'ok', 1500);
}

function exportNotion() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const html = renderMarkdown(S.raw).html;
  download(baseName('-notion.html'), '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeHtml(S.fileName) + '</title></head><body>' + html + '</body></html>', 'text/html');
  toast('Exported for Notion', 'ok', 1500);
}

function exportDocx() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const html = renderMarkdown(S.raw).html;
  const title = (S.fileName || 'Document').replace(/\.[^.]+$/, '');
  const docxContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 1in; }
h1, h2, h3, h4, h5, h6 { font-family: Calibri, Arial, sans-serif; color: #1e3a8a; margin-top: 18pt; margin-bottom: 6pt; }
h1 { font-size: 22pt; border-bottom: 1.5pt solid #3b82f6; padding-bottom: 4pt; }
h2 { font-size: 16pt; }
h3 { font-size: 13pt; }
pre, code { font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; background: #f1f5f9; }
pre { padding: 8pt; border: 1pt solid #cbd5e1; border-radius: 4pt; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
th, td { border: 1pt solid #cbd5e1; padding: 6pt 8pt; text-align: left; }
th { background: #f8fafc; font-weight: bold; }
blockquote { border-left: 3pt solid #3b82f6; margin: 10pt 0; padding-left: 10pt; color: #475569; font-style: italic; }
</style>
</head>
<body>
${html}
</body>
</html>`;
  download(baseName('.docx'), docxContent, 'application/vnd.ms-word');
  toast('Exported DOCX (Word)', 'ok', 1500);
}

function exportGfm() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const clean = S.raw.replace(/\r\n/g, '\n');
  download(baseName('-gfm.md'), clean, 'text/markdown');
  toast('Exported GitHub GFM', 'ok', 1500);
}

/* ---------------- 36. Document Compare (LCS-based, handles inserts) ---------------- */
function computeLineDiff(text1, text2) {
  const a = normSrc(text1 || '').split('\n');
  const b = normSrc(text2 || '').split('\n');
  // cap for speed on huge docs
  const A = a.slice(0, 2000), B = b.slice(0, 2000);
  const n = A.length, m = B.length;
  // LCS DP with typed arrays (fast, low memory) — fallback to naive if too big
  if (n * m > 4000000) {
    const max = Math.max(n, m);
    const diff1 = [], diff2 = [];
    let delCount = 0, addCount = 0;
    for (let i = 0; i < max; i++) {
      const l1 = A[i] !== undefined ? A[i] : null;
      const l2 = B[i] !== undefined ? B[i] : null;
      if (l1 === l2) {
        if (l1 !== null) diff1.push({ text: l1, type: 'same' });
        if (l2 !== null) diff2.push({ text: l2, type: 'same' });
      } else {
        if (l1 !== null) { diff1.push({ text: l1, type: 'del' }); delCount++; }
        if (l2 !== null) { diff2.push({ text: l2, type: 'add' }); addCount++; }
      }
    }
    return { diff1, diff2, delCount, addCount };
  }
  const dp = new Uint16Array((n + 1) * (m + 1));
  const idx = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] = A[i] === B[j] ? dp[idx(i + 1, j + 1)] + 1 : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }
  const diff1 = [], diff2 = [];
  let delCount = 0, addCount = 0, i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { diff1.push({ text: A[i], type: 'same' }); diff2.push({ text: B[j], type: 'same' }); i++; j++; }
    else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) { diff1.push({ text: A[i], type: 'del' }); delCount++; i++; }
    else { diff2.push({ text: B[j], type: 'add' }); addCount++; j++; }
  }
  while (i < n) { diff1.push({ text: A[i], type: 'del' }); delCount++; i++; }
  while (j < m) { diff2.push({ text: B[j], type: 'add' }); addCount++; j++; }
  return { diff1, diff2, delCount, addCount };
}

function showDiff() {
  if (!S.diffOtherDoc || !D.diffContainer) return;
  const { diff1, diff2, delCount, addCount } = computeLineDiff(S.raw, S.diffOtherDoc);

  const renderLines = (diffList) => diffList.map(item =>
    `<div class="diff-line ${item.type}">${escapeHtml(item.text || ' ')}</div>`
  ).join('');

  D.diffContainer.hidden = false;
  D.diffContainer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:600;color:var(--text-2)">
      <span>Comparison</span>
      <span><b style="color:var(--danger)">-${delCount}</b> / <b style="color:var(--ok)">+${addCount}</b></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="diff-pane removed">
        <div class="diff-header"><span>Original (${escapeHtml(S.fileName || 'Doc')})</span></div>
        <div class="diff-content">${renderLines(diff1)}</div>
      </div>
      <div class="diff-pane added">
        <div class="diff-header"><span>Compared Doc</span></div>
        <div class="diff-content">${renderLines(diff2)}</div>
      </div>
    </div>
  `;
  if (D.btnDiffClose) D.btnDiffClose.style.display = 'inline-flex';
}

function diffDocuments() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  openModal({
    title: 'Compare with another document',
    icon: 'i-file-diff',
    html: `
      <label class="field-label">1. Choose local Markdown file to compare</label>
      <input type="file" id="diffFileInput" accept=".md,.markdown,.mdown,.txt" style="display:none">
      <button class="btn" id="btnDiffPickFile" style="width:100%;margin-top:4px"><svg class="ic"><use href="#i-upload-cloud"/></svg> Select file from disk</button>
      <div style="margin:12px 0 6px;text-align:center;color:var(--muted);font-size:11.5px">— OR —</div>
      <label class="field-label">2. Enter URL</label>
      <input class="field" id="diffUrl" type="url" placeholder="https://example.com/other.md" style="margin-top:4px">
      <div style="margin:12px 0 6px;text-align:center;color:var(--muted);font-size:11.5px">— OR —</div>
      <label class="field-label">3. Paste Markdown source</label>
      <textarea class="field code-field" id="diffPaste" placeholder="Paste Markdown text here..." style="min-height:100px;margin-top:4px;width:100%"></textarea>
      <div id="diffLoading" style="display:none;margin-top:8px;color:var(--muted);font-size:12px"><span class="spin"></span> Loading document...</div>
    `,
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="diffGo">Compare</button>',
    onMount: m => {
      const fileInput = m.querySelector('#diffFileInput');
      m.querySelector('#btnDiffPickFile').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            S.diffOtherDoc = ev.target.result;
            closeModal();
            showDiff();
            toast('Compared with ' + file.name, 'ok', 1600);
          };
          reader.readAsText(file);
        }
      });

      const go = async () => {
        const pasteText = m.querySelector('#diffPaste').value.trim();
        const url = m.querySelector('#diffUrl').value.trim();
        if (pasteText) {
          S.diffOtherDoc = pasteText;
          closeModal();
          showDiff();
          toast('Document comparison ready', 'ok', 1500);
          return;
        }
        if (url) {
          m.querySelector('#diffLoading').style.display = 'block';
          try {
            const text = await fileFetch(url);
            if (text) {
              S.diffOtherDoc = text;
              closeModal();
              showDiff();
              toast('Document comparison ready', 'ok', 1500);
              return;
            }
          } catch (e) {
            toast('Could not fetch compare URL', 'err', 3000);
          } finally {
            m.querySelector('#diffLoading').style.display = 'none';
          }
        }
        toast('Provide a file, URL or pasted text to compare', 'err');
      };
      m.querySelector('#diffGo').addEventListener('click', go);
      m.querySelector('#diffUrl').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  });
}

/* ---------------- 36b. Flashcards + Cloze Quiz + Anki (study magic, offline) ---------------- */
function flashFor() { if (!S.docId) return []; return S.flashcards[S.docId] || []; }
function generateFlashcards() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const cards = [];
  const push = (q, a) => {
    q = String(q || '').trim().replace(/\s+/g, ' ');
    a = String(a || '').trim().replace(/\s+/g, ' ');
    if (q.length < 2 || a.length < 1) return;
    if (q.length > 220) q = q.slice(0, 220);
    if (a.length > 500) a = a.slice(0, 500);
    if (cards.some(c => c.q === q)) return;
    cards.push({ id: createAnnoId(), q, a, at: Date.now(), known: false });
    if (cards.length >= 80) return;
  };
  // 1) Q:/A: pairs in source
  const lines = S.raw.split('\n');
  for (let i = 0; i < lines.length && cards.length < 80; i++) {
    const m = lines[i].match(/^\s*(Q\s*[:?\-]|Question\s*[:\-])\s*(.+)$/i);
    if (m) {
      let a = '';
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const am = lines[j].match(/^\s*(A\s*[:\-]|Answer\s*[:\-])\s*(.+)$/i);
        if (am) { a = am[2]; break; }
        if (/^\s*(Q\s*[:?\-]|Question\s*[:\-]|#{1,6}\s)/i.test(lines[j])) break;
        if (lines[j].trim()) a += (a ? ' ' : '') + lines[j].trim();
      }
      if (a) push(m[2], a);
    }
  }
  // 2) Headings  first sentence under heading
  S.headings.slice(0, 40).forEach(h => {
    try {
      let n = h.el.nextElementSibling, txt = '';
      let g = 0;
      while (n && !/^H[1-6]$/.test(n.tagName) && g < 4) { txt += ' ' + (n.textContent || ''); n = n.nextElementSibling; g++; }
      txt = txt.trim().replace(/\s+/g, ' ');
      if (txt.length > 10) push('What is: ' + h.text + '?', txt.slice(0, 280));
    } catch (e) {}
  });
  // 3) Bold terms  sentence context
  try {
    const bolds = Array.prototype.slice.call(D.mdDoc.querySelectorAll('strong')).slice(0, 40);
    bolds.forEach(b => {
      const term = (b.textContent || '').trim();
      if (term.length < 2 || term.length > 60) return;
      const sent = (b.closest('p,li') ? b.closest('p,li').textContent : '').trim().replace(/\s+/g, ' ');
      if (sent.length > term.length + 10) push('Define: ' + term, sent.slice(0, 280));
    });
  } catch (e) {}
  // 4) ==cloze== marks  fill-in-blank
  const clozes = (S.raw.match(/==([^=\n]+?)==/g) || []).slice(0, 30);
  clozes.forEach(c => {
    const t = c.slice(2, -2).trim();
    if (t.length > 1) push('Fill in: “… ' + '▓'.repeat(Math.min(6, t.length)) + ' …”', t);
  });
  if (!cards.length) { toast('No flashcard material found (add headings, Q:/A: or ==cloze==)', 'err', 3000); return; }
  S.flashcards[S.docId] = cards;
  saveMarks();
  renderFlashList();
  toast(cards.length + ' flashcards ready — Quiz me!', 'ok', 2200);
  switchPane('features');
}
function renderFlashList() {
  if (!D.flashList) return;
  const arr = flashFor();
  D.flashList.innerHTML = '';
  if (D.flashEmpty) D.flashEmpty.hidden = arr.length > 0;
  arr.slice().reverse().slice(0, 60).forEach((c, ri) => {
    const i = arr.length - 1 - ri;
    const div = document.createElement('div');
    div.className = 'bm-item';
    div.innerHTML = '<div class="n">' + esc(String(c.q || '?').trim().charAt(0).toUpperCase() || '?') + '</div>' +
      '<div class="meta"><div class="tt">' + esc(c.q) + '</div>' +
      '<div class="ss">' + esc((c.a || '').slice(0, 120)) + (c.known ? ' · OK known' : '') + '</div></div>' +
      '<button class="x" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.addEventListener('click', (e) => {
      if (e.target.closest('.x')) return;
      openQuiz(arr.length - 1 - ri);
    });
    div.querySelector('.x').addEventListener('click', (e) => {
      e.stopPropagation();
      arr.splice(i, 1);
      S.flashcards[S.docId] = arr; saveMarks(); renderFlashList();
    });
    D.flashList.appendChild(div);
  });
}
function openQuiz(startIdx) {
  const arr = flashFor();
  if (!arr.length) { generateFlashcards(); return; }
  S.quiz = { cards: arr.slice(), idx: Math.max(0, Math.min(startIdx || 0, arr.length - 1)), show: false, score: 0, total: arr.length };
  // shuffle? keep order but allow nav
  showQuizModal();
}
function showQuizModal() {
  const q = S.quiz;
  if (!q.cards.length) return;
  const card = q.cards[q.idx];
  openModal({
    title: 'Quiz — card ' + (q.idx + 1) + ' / ' + q.cards.length + (q.score ? ' · OK' + q.score : ''),
    icon: 'i-play',
    html: '<div class="quiz-q">' + esc(card.q) + '</div>' +
      '<div class="quiz-a" id="quizA" hidden>' + esc(card.a) + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
      '<button class="btn accent" id="quizShow" style="flex:1">Show answer (Space)</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button class="btn" id="quizPrev"> Prev</button>' +
      '<button class="btn" id="quizKnow" hidden>OK I knew it</button>' +
      '<button class="btn" id="quizNext" style="flex:1">Next </button>' +
      '</div>',
    footer: false,
    onMount(m) {
      const show = () => {
        m.querySelector('#quizA').hidden = false;
        m.querySelector('#quizShow').style.display = 'none';
        m.querySelector('#quizKnow').hidden = false;
        S.quiz.show = true;
      };
      m.querySelector('#quizShow').addEventListener('click', show);
      m.querySelector('#quizNext').addEventListener('click', () => {
        S.quiz.idx = (S.quiz.idx + 1) % S.quiz.cards.length;
        S.quiz.show = false;
        closeModal(); showQuizModal();
      });
      m.querySelector('#quizPrev').addEventListener('click', () => {
        S.quiz.idx = (S.quiz.idx - 1 + S.quiz.cards.length) % S.quiz.cards.length;
        S.quiz.show = false;
        closeModal(); showQuizModal();
      });
      m.querySelector('#quizKnow').addEventListener('click', () => {
        S.quiz.score++;
        try {
          const arr = flashFor();
          const hit = arr.find(c => c.q === card.q);
          if (hit) { hit.known = true; saveMarks(); renderFlashList(); }
        } catch (e) {}
        S.quiz.idx = (S.quiz.idx + 1) % S.quiz.cards.length;
        S.quiz.show = false;
        closeModal(); showQuizModal();
        toast('Nice! Score ' + S.quiz.score, 'ok', 1200);
      });
      m.addEventListener('keydown', (e) => {
        if (e.key === ' ') { e.preventDefault(); show(); }
        if (e.key === 'ArrowRight') m.querySelector('#quizNext').click();
        if (e.key === 'ArrowLeft') m.querySelector('#quizPrev').click();
      });
      setTimeout(() => { const b = m.querySelector('#quizShow'); if (b) b.focus(); }, 60);
    }
  });
}
function exportAnki() {
  const arr = flashFor();
  if (!arr.length) { toast('Generate flashcards first', 'err'); return; }
  const tsv = arr.map(c => c.q.replace(/\t/g, ' ').replace(/\n/g, ' ') + '\t' + c.a.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\n');
  download(baseName('-anki.tsv'), tsv, 'text/tab-separated-values');
  toast('Anki file exported (' + arr.length + ' cards)', 'ok', 1800);
}
function exportMarkers() {
  if (!S.docId) { toast('Open a document first', 'err'); return; }
  const marks = S.highlights[S.docId] || [];
  if (!marks.length) { toast('No markers to export', 'err'); return; }
  const txt = marks.map((m, i) => (i + 1) + '. [' + (m.tool || 'highlight') + '] ' + m.text).join('\n');
  download(baseName('-markers.txt'), 'Markers — ' + S.fileName + '\n' + marks.length + ' marks\n\n' + txt, 'text/plain');
}

/* ---------------- 36c. Power Lab — templates, lint, summary, speed (all offline, all free) ---------------- */
const TEMPLATES = {
  study: ['# Study — TITLE', '', 'Goal: …', '', '## Key points', '', '- [ ] Point 1', '- [ ] Point 2', '', '## Q / A', '', 'Q: …?', 'A: …', '', 'Key term: ==term== means …', '', '```mermaid', 'graph TD;', '  A[Topic] --> B[Idea];', '```', ''].join('\n'),
  meeting: ['# Meeting — DATE', '', 'Attendees: …', '', '## Agenda', '', '1. …', '2. …', '', '## Decisions', '', '- …', '', '## Actions', '', '| Who | Task | Due |', '| --- | --- | --- |', '|  |  |  |', ''].join('\n'),
  exam: ['# Exam Prep — SUBJECT', '', 'Date: … · Days left: …', '', '## Topics', '', '- [ ] Topic 1 (~20 min)', '- [ ] Topic 2', '', '## Mock Q/A', '', 'Q: …?', 'A: …', '', '## Formula', '', '$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$', ''].join('\n'),
  journal: ['# Journal — DATE', '', 'Mood: …/5 · Energy: …/5', '', '## Wins', '', '- …', '', '## Gratitude', '', '- …', '', '## Tomorrow', '', '- [ ] …', ''].join('\n'),
  thesis: ['# Thesis — TITLE', '', '## Abstract', '', '…', '', '## 1. Introduction', '', '…', '', '## 2. Method', '', '…', '', '## References', '', '- [^1]: …', ''].join('\n'),
  habit: ['# Habits — MONTH', '', '| Habit | Mo | Tu | We | Th | Fr | Sa | Su |', '| --- | --- | --- | --- | --- | --- | --- | --- |', '| Read 20m |  |  |  |  |  |  |  |', '| Mark H/U/S |  |  |  |  |  |  |  |', '', '## Weekly review', '', '- …', ''].join('\n')
};
async function applyTemplate(kind) {
  const t = TEMPLATES[kind] || TEMPLATES.study;
  const name = (kind || 'notes') + '-template.md';
  S.docId = await docIdFor(name, t.length, t.slice(0, 2000));
  D.builderArea.value = t;
  updateBuilderCount();
  setBuilderMode(true);
  liveRender();
  saveRecent(name, t.length, t);
  toast(kind + ' template loaded — Apply to view', 'ok', 2000);
}
function labBox(html) { if (D.labResults) { D.labResults.innerHTML = html; switchPane('features'); } }
function labLint() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const lines = S.raw.split('\n');
  const issues = [];
  lines.forEach((ln, i) => {
    if (ln.length > 120) issues.push(['Long line ' + (i + 1), ln.length + ' chars — split for reading']);
    if (/!\[([^\]]*)\]\(\)/.test(ln) || /!\[([^\]]*)\]\(\s*\)/.test(ln)) issues.push(['Empty image ' + (i + 1), 'Add alt + URL']);
    if (/\[([^\]]+)\]\(\)/.test(ln)) issues.push(['Empty link ' + (i + 1), 'Add URL']);
  });
  // heading jumps
  const lv = [];
  lines.forEach((ln, i) => { const m = ln.match(/^(#{1,6})\s/); if (m) lv.push([m[1].length, i + 1]); });
  for (let i = 1; i < lv.length; i++) if (lv[i][0] - lv[i - 1][0] > 1) issues.push(['Heading jump @' + lv[i][1], 'H' + lv[i - 1][0] + '  H' + lv[i][0]]);
  // broken #anchors
  const anchors = (S.raw.match(/\[[^\]]+\]\(#[^)]+\)/g) || []).slice(0, 20);
  anchors.forEach(a => {
    const id = (a.match(/\(#([^)]+)\)/) || [])[1] || '';
    if (id && !document.getElementById(id) && !document.getElementById('h-' + id)) issues.push(['Anchor ' + a.slice(0, 40), 'Missing #' + id]);
  });
  labBox(issues.length
    ? '<div style="font-size:12px;font-weight:700;margin-bottom:6px">' + issues.length + ' lint note(s)</div>' + issues.slice(0, 40).map(x => '<div class="link-result warn"><span class="url"><b>' + esc(x[0]) + '</b> — ' + esc(x[1]) + '</span></div>').join('')
    : '<div class="placeholder"><span style="color:var(--ok)">OK Lint clean — perfect markdown</span></div>');
}
function topWords(n) {
  const txt = plainText().toLocaleLowerCase();
  const words = (txt.match(/[\p{L}]{3,}/gu) || []).filter(w => /[a-z\u00c0-\u024f\u0590-\u08ff\u4e00-\u9fff]/i.test(w));
  const stop = new Set(('the,and,for,are,but,not,you,all,can,had,her,was,one,our,out,has,have,with,this,that,from,they,will,would,there,their,what,about,which,when,make,like,time,just,into,year,your,some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use,had,или,это,как,для,или,und,der,die,das,avec,pour,les,que,una,los,que,और,है,के,में,的,了,在,是,我,有,في,من,على,أن,ما,של,את,לא,کی,ہے,کا,میں').split(','));
  const f = {};
  words.forEach(w => { if (!stop.has(w) && w.length < 30) f[w] = (f[w] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n || 12);
}
function labSummary() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const sents = (plainText().replace(/\s+/g, ' ').match(/[^.!?؟。！？]+[.!?؟。！？]+/g) || []).map(s => s.trim()).filter(s => s.length > 30);
  if (!sents.length) { labBox('<div class="placeholder">Not enough sentences</div>'); return; }
  const freq = {};
  topWords(60).forEach(([w, c]) => freq[w] = c);
  const scored = sents.slice(0, 120).map(s => {
    const ws = (s.toLocaleLowerCase().match(/[\p{L}]{3,}/gu) || []);
    let sc = 0;
    ws.forEach(w => { sc += freq[w] || 0; });
    return [sc / Math.max(8, ws.length), s];
  }).sort((a, b) => b[0] - a[0]).slice(0, 5);
  labBox('<div style="font-size:12px;font-weight:700;margin-bottom:6px">TL;DR — top 5 sentences</div>' + scored.map(([sc, s], i) => '<div class="link-result ok"><span class="url"><b>' + (i + 1) + '.</b> ' + esc(s.slice(0, 280)) + '</span></div>').join('') + '<div class="tool-row" style="margin-top:8px"><button class="btn" id="labCopySum">Copy summary</button></div>');
  const b = $('#labCopySum');
  if (b) b.addEventListener('click', () => copyText(scored.map(x => '• ' + x[1]).join('\n'), 'Summary copied'));
}
function labKeywords() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const tw = topWords(15);
  labBox('<div style="font-size:12px;font-weight:700;margin-bottom:6px">Top keywords</div>' + tw.map(([w, c]) => '<div class="link-result"><span class="url"><b>' + esc(w) + '</b> ×' + c + '</span><div class="lab-bar"><i style="width:' + Math.min(100, c * 12) + '%"></i></div></div>').join(''));
}
function labFreq() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  labKeywords();
}
function labReadability() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const txt = plainText();
  const words = Math.max(1, wordCountOf(txt));
  const sents = Math.max(1, (txt.match(/[.!?؟。！？]+/g) || []).length);
  const syll = Math.max(1, (txt.toLocaleLowerCase().match(/[aeiouy\u00e0-\u00ff\u0100-\u017f]+/g) || []).length);
  const ease = Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words / sents) - 84.6 * (syll / words))));
  const grade = ease > 90 ? 'Very easy' : ease > 80 ? 'Easy' : ease > 70 ? 'Fairly easy' : ease > 60 ? 'Standard' : ease > 50 ? 'Fairly hard' : ease > 30 ? 'Hard' : 'Very hard';
  labBox('<div class="stat-grid"><div class="stat"><b>' + ease + '</b><span>Flesch ease</span></div><div class="stat"><b>' + esc(grade) + '</b><span>Level</span></div></div><div class="kv"><span>Words / sentences</span><b>' + words + ' / ' + sents + '</b></div>');
}
function copyHtmlDoc() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  copyText(D.mdDoc.innerHTML, 'HTML copied');
}
function copyOutline() {
  if (!S.headings.length) { toast('No headings', 'err'); return; }
  const nums = outlineNumbers();
  copyText(S.headings.map((h, i) => (nums[i] ? nums[i] + ' ' : '') + h.text).join('\n'), 'Outline copied');
}
function copyHeadingLinks() {
  if (!S.headings.length) { toast('No headings', 'err'); return; }
  copyText(S.headings.map(h => '- [' + h.text + '](#' + h.id + ')').join('\n'), 'Heading links copied');
}
function printSelection() {
  const t = currentSelText().trim();
  if (!t) { window.print(); return; }
  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked', 'err'); return; }
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Selection</title><style>body{font-family:system-ui;padding:32px;line-height:1.7;max-width:700px;margin:auto}</style></head><body><pre style="white-space:pre-wrap;font-family:inherit">' + esc(t).slice(0, 20000) + '</pre></body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}
function exportJsonModel() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const model = { file: S.fileName, words: wordCountOf(plainText()), headings: S.headings.map(h => ({ level: h.level, text: h.text })), math: S.mathCount, code: S.codeCount, marks: (S.highlights[S.docId] || []).length, cards: (S.flashcards[S.docId] || []).length };
  download(baseName('.json'), JSON.stringify(model, null, 2), 'application/json');
}
function exportFreqCsv() {
  if (!S.raw) { toast('Open a document first', 'err'); return; }
  const tw = topWords(100);
  download(baseName('-freq.csv'), 'word,count\n' + tw.map(([w, c]) => '"' + w.replace(/"/g, '""') + '",' + c).join('\n'), 'text/csv');
}
function toggleFocusSent() {
  P.focusSent = !P.focusSent;
  savePrefs(); applyReadingPrefs();
  toast('Sentence focus ' + (P.focusSent ? 'ON' : 'OFF'), 'ok', 1300);
}
function toggleOutlineNum() {
  P.outlineNum = !P.outlineNum;
  savePrefs(); buildOutline();
  toast('Numbered outline ' + (P.outlineNum ? 'ON' : 'OFF'), 'ok', 1300);
}
function outlineNumbers() {
  const nums = [];
  const stack = [0, 0, 0, 0, 0, 0];
  S.headings.forEach(h => {
    const l = Math.max(1, Math.min(6, h.level));
    stack[l - 1]++;
    for (let i = l; i < 6; i++) stack[i] = 0;
    nums.push(stack.slice(0, l).join('.'));
  });
  return nums;
}
function shuffleFlash() {
  const arr = flashFor();
  if (!arr.length) { toast('Generate cards first', 'err'); return; }
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  S.flashcards[S.docId] = arr;
  saveMarks(); renderFlashList();
  toast('Shuffled ' + arr.length + ' cards', 'ok', 1400);
}
function knownAll(v) {
  const arr = flashFor();
  if (!arr.length) { toast('Generate cards first', 'err'); return; }
  arr.forEach(c => c.known = !!v);
  saveMarks(); renderFlashList();
  toast(v ? 'All marked known OK' : 'Known reset', 'ok', 1400);
}
function importTsvModal() {
  openModal({
    title: 'Import Anki TSV', icon: 'i-upload-cloud',
    html: '<label class="field-label">One card per line: <b>Question TAB Answer</b></label><textarea class="field code-field" id="tsvField" style="min-height:140px;margin-top:6px" placeholder="What is …?\tAnswer …"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="tsvGo">Import</button>',
    onMount(m) {
      m.querySelector('#tsvGo').addEventListener('click', () => {
        const v = m.querySelector('#tsvField').value;
        const lines = v.split('\n').map(s => s.trim()).filter(Boolean);
        if (!lines.length) return;
        if (!S.docId) S.docId = 'doc-' + Date.now();
        if (!S.flashcards[S.docId]) S.flashcards[S.docId] = [];
        let n = 0;
        lines.slice(0, 200).forEach(ln => {
          const parts = ln.split('\t');
          if (parts.length < 2) return;
          S.flashcards[S.docId].push({ id: createAnnoId(), q: parts[0].slice(0, 220), a: parts.slice(1).join(' ').slice(0, 500), at: Date.now(), known: false });
          n++;
        });
        saveMarks(); renderFlashList();
        closeModal();
        toast(n + ' cards imported', 'ok', 1600);
      });
    }
  });
}
function insertTimestamp() {
  setBuilderMode(true);
  const ta = D.builderArea;
  const s = ta.selectionStart || 0;
  const stamp = new Date().toLocaleString();
  ta.value = ta.value.slice(0, s) + stamp + ta.value.slice(ta.selectionEnd || s);
  updateBuilderCount(); liveRender();
}
function caseMenu() {
  const sel = currentSelText() || '';
  openMenu(D.btnMenu, [
    { icon: 'i-text', text: 'UPPERCASE selection', action: () => xformSel(t => t.toLocaleUpperCase()) },
    { icon: 'i-text', text: 'lowercase selection', action: () => xformSel(t => t.toLocaleLowerCase()) },
    { icon: 'i-text', text: 'Title Case selection', action: () => xformSel(t => t.replace(/\w\S*/g, w => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase())) }
  ]);
  function xformSel(fn) {
    if (!S.builderMode) { toast('Open Builder (E) to transform', 'err'); return; }
    const ta = D.builderArea, s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { toast('Select text in Builder first', 'err'); return; }
    ta.value = ta.value.slice(0, s) + fn(ta.value.slice(s, e)) + ta.value.slice(e);
    updateBuilderCount(); liveRender();
  }
}
function cleanMarkdown() {
  if (!S.builderMode) setBuilderMode(true);
  const ta = D.builderArea;
  ta.value = ta.value.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  updateBuilderCount(); liveRender();
  toast('Markdown cleaned', 'ok', 1400);
}
function enableTableSort() {
  if (!D.mdDoc) return;
  D.mdDoc.querySelectorAll('table').forEach(tbl => {
    const ths = tbl.querySelectorAll('th');
    ths.forEach((th, ci) => {
      if (th.dataset.sortable) return;
      th.dataset.sortable = '1';
      th.style.cursor = 'pointer';
      th.title = 'Sort by this column';
      th.addEventListener('click', () => {
        const tb = tbl.querySelector('tbody') || tbl;
        const rows = Array.prototype.slice.call(tb.querySelectorAll('tr')).filter(r => r.querySelectorAll('td').length);
        const asc = th.dataset.dir !== 'asc';
        rows.sort((a, b) => {
          const x = (a.children[ci] || {}).textContent || '', y = (b.children[ci] || {}).textContent || '';
          const xn = parseFloat(x), yn = parseFloat(y);
          if (!isNaN(xn) && !isNaN(yn)) return asc ? xn - yn : yn - xn;
          return asc ? x.localeCompare(y) : y.localeCompare(x);
        });
        th.dataset.dir = asc ? 'asc' : 'desc';
        rows.forEach(r => tb.appendChild(r));
      });
    });
  });
}
function showStreak() {
  try {
    const k = 'herosmd-streak-v1';
    const today = new Date().toDateString();
    let st = {};
    try { st = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { st = {}; }
    if (st.last !== today) {
      const y = new Date(Date.now() - 864e5).toDateString();
      st.n = st.last === y ? (st.n || 0) + 1 : 1;
      st.last = today;
      try { localStorage.setItem(k, JSON.stringify(st)); } catch (e) {}
    }
    if (D.kvStreak) D.kvStreak.textContent = (st.n || 1) + ' day(s)';
    toast('Study streak: ' + (st.n || 1) + ' day(s) — keep going!', 'ok', 2000);
  } catch (e) {}
}

/* ---------------- 36d. Todo + Stopwatch + Counters + Tracker (save everything, offline) ---------------- */
function dayKey(d) {
  const t = d || new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
/* ---- Todo ---- */
function addTodo() {
  const inp = D.todoInput;
  const v = ((inp && inp.value) || '').trim();
  if (!v) { toast('Write a task first', 'err'); return; }
  S.todos.unshift({ id: createAnnoId(), text: v.slice(0, 200), done: false, prio: (D.todoPrio && D.todoPrio.value) || 'med', due: (D.todoDue && D.todoDue.value) || '', at: Date.now() });
  if (inp) inp.value = '';
  savePower(); renderTodos();
  toast('Task added', 'ok', 1200);
}
function renderTodos() {
  if (!D.todoList) return;
  const f = S.todoFilter || 'open';
  const order = { high: 0, med: 1, low: 2 };
  const arr = S.todos
    .map((t, i) => ({ t, i }))
    .filter(x => f === 'all' ? true : f === 'done' ? x.t.done : !x.t.done)
    .sort((a, b) => (a.t.done - b.t.done) || (order[a.t.prio] - order[b.t.prio]) || (b.t.at - a.t.at));
  const open = S.todos.filter(t => !t.done).length;
  if (D.todoCount) D.todoCount.textContent = open + ' open';
  if (D.todoEmpty) D.todoEmpty.hidden = arr.length > 0;
  D.todoList.innerHTML = '';
  const frag = document.createDocumentFragment();
  arr.slice(0, 120).forEach(x => {
    const t = x.t;
    const div = document.createElement('div');
    div.className = 'todo-item' + (t.done ? ' done' : '');
    div.innerHTML = '<button class="box" title="Toggle done">' + (t.done ? '<svg class="ic ic-sm"><use href="#i-check"/></svg>' : '') + '</button>' +
      '<div class="meta"><div class="tt">' + esc(t.text) + '</div>' +
      '<div class="ss"><span class="prio ' + esc(t.prio || 'med') + '">' + esc(t.prio || 'med') + '</span>' +
      (t.due ? '<span>due ' + esc(t.due) + '</span>' : '') + '</div></div>' +
      '<button class="x" title="Delete"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.querySelector('.box').addEventListener('click', () => { t.done = !t.done; savePower(); renderTodos(); });
    div.querySelector('.x').addEventListener('click', () => { S.todos.splice(x.i, 1); savePower(); renderTodos(); });
    frag.appendChild(div);
  });
  D.todoList.appendChild(frag);
}
function exportStudyPack() {
  if (!S.raw && !S.todos.length) { toast('Open a document first', 'err'); return; }
  const marks = (S.docId && S.highlights[S.docId]) || [];
  const notes = (S.docId && S.notes[S.docId]) || [];
  const cards = (S.docId && S.flashcards[S.docId]) || [];
  let md = '# Study Pack — ' + (S.fileName || 'document') + '\n_' + new Date().toLocaleString() + '_\n';
  md += '\n## Outline\n' + (S.headings.length ? S.headings.map(h => '- ' + h.text).join('\n') : '_none_') + '\n';
  md += '\n## Markers (' + marks.length + ')\n' + (marks.length ? marks.map((m, i) => (i + 1) + '. [' + (m.tool || 'highlight') + '] ' + m.text).join('\n') : '_none_') + '\n';
  md += '\n## Notes (' + notes.length + ')\n' + (notes.length ? notes.map((n, i) => (i + 1) + '. ' + n.text).join('\n') : '_none_') + '\n';
  md += '\n## Flashcards (' + cards.length + ')\n' + (cards.length ? cards.map((c, i) => (i + 1) + '. Q: ' + c.q + '\n   A: ' + c.a).join('\n') : '_none_') + '\n';
  const open = S.todos.filter(t => !t.done);
  md += '\n## Open tasks (' + open.length + ')\n' + (open.length ? open.map(t => '- [ ] ' + t.text).join('\n') : '_none_') + '\n';
  download(baseName('-study-pack.md'), md, 'text/markdown');
  toast('Study pack exported', 'ok', 1800);
}
function importTodoChecklist() {
  openModal({
    title: 'Import checklist', icon: 'i-upload-cloud',
    html: '<label class="field-label">Paste markdown checklist — every <b>- [ ]</b> / <b>- [x]</b> / <b>-</b> line becomes a task</label>' +
      '<textarea class="field code-field" id="clField" style="min-height:140px;margin-top:6px" placeholder="- [ ] Revise chapter 4&#10;- [x] Done thing&#10;- Plain task"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="clGo">Import</button>',
    onMount(m) {
      m.querySelector('#clGo').addEventListener('click', () => {
        const lines = m.querySelector('#clField').value.split('\n');
        let n = 0;
        lines.forEach(ln => {
          const mt = ln.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.+)$/);
          if (!mt || !mt[2].trim()) return;
          S.todos.unshift({ id: createAnnoId(), text: mt[2].trim().slice(0, 200), done: !!mt[1] && mt[1].toLowerCase() === 'x', prio: 'med', due: '', at: Date.now() });
          n++;
          if (n >= 200) return;
        });
        savePower(); renderTodos();
        closeModal();
        switchPane('todo'); toggleSidebar(true);
        toast(n + ' tasks imported', 'ok', 1600);
      });
    }
  });
}
function exportTodos() {
  if (!S.todos.length) { toast('No tasks to export', 'err'); return; }
  const open = S.todos.filter(t => !t.done), done = S.todos.filter(t => t.done);
  let md = '# Todo — ' + new Date().toLocaleDateString() + '\n\n## Open (' + open.length + ')\n';
  open.forEach(t => { md += '- [ ] ' + t.text + (t.due ? ' (due ' + t.due + ')' : '') + ' [' + t.prio + ']\n'; });
  md += '\n## Done (' + done.length + ')\n';
  done.forEach(t => { md += '- [x] ' + t.text + '\n'; });
  download('todos-' + dayKey() + '.md', md, 'text/markdown');
}
/* ---- Stopwatch ---- */
let swTick = null;
function swElapsed() {
  const s = S.sw;
  return (s.base || 0) + (s.running ? Date.now() - s.startTs : 0);
}
function swFmt(ms) {
  const t = Math.max(0, Math.floor(ms));
  const m = Math.floor(t / 60000), s = Math.floor(t % 60000 / 1000), d = Math.floor(t % 1000 / 100);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + d;
}
function swPaint() {
  if (D.swDisplay) D.swDisplay.textContent = swFmt(swElapsed());
  if (D.btnSwStart) D.btnSwStart.innerHTML = S.sw.running
    ? '<svg class="ic"><use href="#i-x"/></svg>Stop'
    : '<svg class="ic"><use href="#i-play"/></svg>Start';
}
function swStartStop() {
  if (S.sw.running) {
    S.sw.base = swElapsed();
    S.sw.running = false;
    if (swTick) { clearInterval(swTick); swTick = null; }
  } else {
    S.sw.running = true;
    S.sw.startTs = Date.now();
    if (swTick) clearInterval(swTick);
    swTick = setInterval(swPaint, 100);
  }
  savePower(); swPaint(); renderSwLaps();
}
function swLap() {
  if (!S.sw.running && swElapsed() === 0) { toast('Start the stopwatch first', 'err'); return; }
  S.sw.laps.push({ t: swElapsed(), at: Date.now() });
  if (S.sw.laps.length > 50) S.sw.laps = S.sw.laps.slice(-50);
  savePower(); renderSwLaps();
  toast('Lap ' + S.sw.laps.length + ' — ' + swFmt(S.sw.laps[S.sw.laps.length - 1].t), 'ok', 1300);
}
function swReset() {
  S.sw = { running: false, base: 0, startTs: 0, laps: [] };
  if (swTick) { clearInterval(swTick); swTick = null; }
  savePower(); swPaint(); renderSwLaps();
}
function renderSwLaps() {
  if (!D.swLaps) return;
  const laps = S.sw.laps || [];
  D.swLaps.innerHTML = laps.length ? laps.slice().reverse().map((l, ri) => {
    const n = laps.length - ri;
    const prev = ri === laps.length - 1 ? 0 : laps[laps.length - ri - 2].t;
    return '<div class="sw-lap"><span>Lap ' + n + '</span><span>+' + swFmt(l.t - prev) + ' · ' + swFmt(l.t) + '</span></div>';
  }).join('') : '';
  swPaint();
}
/* ---- Counters ---- */
function addCounter() {
  const name = ((D.counterName && D.counterName.value) || '').trim() || 'Counter ' + (S.counters.length + 1);
  const step = Math.max(1, Math.min(1000, parseInt((D.counterStep && D.counterStep.value) || '1', 10) || 1));
  S.counters.unshift({ id: createAnnoId(), name: name.slice(0, 40), count: 0, step });
  if (D.counterName) D.counterName.value = '';
  savePower(); renderCounters();
  toast('Counter added', 'ok', 1200);
}
function renderCounters() {
  if (!D.counterList) return;
  if (D.counterEmpty) D.counterEmpty.hidden = S.counters.length > 0;
  D.counterList.innerHTML = '';
  const frag = document.createDocumentFragment();
  S.counters.slice(0, 60).forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'counter-row';
    div.innerHTML = '<button class="ibtn" data-a="dec" title="-' + c.step + '"><svg class="ic ic-sm"><use href="#i-minus"/></svg></button>' +
      '<div class="nm" title="' + esc(c.name) + '"> ' + esc(c.name) + ' <span style="color:var(--muted);font-weight:400">±' + c.step + '</span></div>' +
      '<div class="ct">' + c.count.toLocaleString() + '</div>' +
      '<button class="ibtn" data-a="inc" title="+' + c.step + '"><svg class="ic ic-sm"><use href="#i-plus"/></svg></button>' +
      '<button class="ibtn" data-a="zero" title="Reset"><svg class="ic ic-sm"><use href="#i-refresh"/></svg></button>' +
      '<button class="ibtn" data-a="del" title="Delete"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.querySelector('[data-a="inc"]').addEventListener('click', () => { c.count += c.step; savePower(); renderCounters(); });
    div.querySelector('[data-a="dec"]').addEventListener('click', () => { c.count -= c.step; savePower(); renderCounters(); });
    div.querySelector('[data-a="zero"]').addEventListener('click', () => { c.count = 0; savePower(); renderCounters(); });
    div.querySelector('[data-a="del"]').addEventListener('click', () => { S.counters.splice(i, 1); savePower(); renderCounters(); });
    frag.appendChild(div);
  });
  D.counterList.appendChild(frag);
}
/* ---- Habit tracker ---- */
function addHabit() {
  const v = ((D.habitName && D.habitName.value) || '').trim();
  if (!v) { toast('Name your habit first', 'err'); return; }
  if (S.habits[v]) { toast('Habit already exists', 'err'); return; }
  S.habits[v] = {};
  if (D.habitName) D.habitName.value = '';
  savePower(); renderHabits();
  toast('Tracking: ' + v.slice(0, 30), 'ok', 1400);
}
function last14() {
  const out = [];
  for (let i = 13; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * 864e5)));
  return out;
}
function habitStreak(days) {
  let n = 0;
  const t = dayKey();
  const has = k => !!days[k];
  if (!has(t)) {
    const y = dayKey(new Date(Date.now() - 864e5));
    if (!has(y)) return 0;
  }
  let cur = new Date();
  if (!has(dayKey(cur))) cur = new Date(Date.now() - 864e5);
  while (has(dayKey(cur))) { n++; cur = new Date(cur.getTime() - 864e5); if (n > 400) break; }
  return n;
}
function renderHabits() {
  if (!D.habitList) return;
  const names = Object.keys(S.habits || {});
  if (D.habitEmpty) D.habitEmpty.hidden = names.length > 0;
  D.habitList.innerHTML = '';
  const days = last14();
  const today = dayKey();
  const frag = document.createDocumentFragment();
  names.slice(0, 40).forEach(name => {
    const marks = S.habits[name] || {};
    const card = document.createElement('div');
    card.className = 'habit-card';
    const st = habitStreak(marks);
    card.innerHTML = '<div class="hh"><div class="hn">' + esc(name) + '</div>' +
      '<div class="st"> ' + st + '</div>' +
      '<button class="ibtn" data-h="del" style="width:26px;height:26px" title="Delete habit"><svg class="ic ic-sm"><use href="#i-x"/></svg></button></div>' +
      '<div class="habit-grid">' + days.map(d =>
        '<button class="habit-day' + (marks[d] ? ' on' : '') + (d === today ? ' today' : '') + '" data-d="' + d + '" title="' + d + '"></button>'
      ).join('') + '</div>';
    card.querySelector('[data-h="del"]').addEventListener('click', () => { delete S.habits[name]; savePower(); renderHabits(); });
    card.querySelectorAll('.habit-day').forEach(b => b.addEventListener('click', () => {
      const d = b.dataset.d;
      if (S.habits[name][d]) delete S.habits[name][d];
      else S.habits[name][d] = true;
      savePower(); renderHabits();
    }));
    frag.appendChild(card);
  });
  D.habitList.appendChild(frag);
}

/* ---------------- 37. Boot (silent, no weird animations) ---------------- */
function boot() {
  applyReadingPrefs();
  renderFeaturesMini();
  renderRecent();
  renderMarks();
  try { renderMarkerList(); } catch (e) {}
  try { renderFlashList(); } catch (e) {}
  try { renderTodos(); renderCounters(); renderHabits(); renderSwLaps(); } catch (e) {}
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
  wireStudyMagic();
  // silent instant paint: drop .booting on next frames, no animation
  raf(() => raf(() => {
    setTimeout(() => document.body.classList.remove('booting'), 30);
  }));
  window.addEventListener('resize', debounce(() => {}, 200));
}
/* Study wiring (Heros PDF parity + magic) — all null-safe, all local */
function wireStudyMagic() {
  try {
    if (D.selHighlight) D.selHighlight.addEventListener('click', () => addStudyMark('highlight'));
    if (D.selUnderline) D.selUnderline.addEventListener('click', () => addStudyMark('underline'));
    if (D.selStrike) D.selStrike.addEventListener('click', () => addStudyMark('strike'));
    if (D.selCopy) D.selCopy.addEventListener('click', copySelectionOrDoc);
    if (D.selNote) D.selNote.addEventListener('click', noteFromSelection);
    if (D.selClose) D.selClose.addEventListener('click', hideSelBar);
    if (D.btnMarkerClear) D.btnMarkerClear.addEventListener('click', () => {
      if (!S.docId) return;
      S.highlights[S.docId] = [];
      saveMarks(); renderMarkerList();
      if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize);
      toast('Markers cleared', 'ok', 1300);
    });
    if (D.btnMarkerExport) D.btnMarkerExport.addEventListener('click', exportMarkers);
    if (D.btnFlashGen) D.btnFlashGen.addEventListener('click', generateFlashcards);
    if (D.btnFlashQuiz) D.btnFlashQuiz.addEventListener('click', () => openQuiz());
    if (D.btnFlashExport) D.btnFlashExport.addEventListener('click', exportAnki);
    if (D.btnFlashClear) D.btnFlashClear.addEventListener('click', () => {
      if (!S.docId) return;
      S.flashcards[S.docId] = [];
      saveMarks(); renderFlashList();
      toast('Flashcards cleared', 'ok', 1300);
    });
    // Todo
    if (D.btnTodoAdd) D.btnTodoAdd.addEventListener('click', addTodo);
    if (D.todoInput) D.todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
    $$('#todoFilterSeg button').forEach(b => b.addEventListener('click', () => {
      $$('#todoFilterSeg button').forEach(x => x.classList.toggle('on', x === b));
      S.todoFilter = b.dataset.tf || 'open';
      renderTodos();
    }));
    if (D.btnTodoExport) D.btnTodoExport.addEventListener('click', exportTodos);
    if (D.btnTodoImport) D.btnTodoImport.addEventListener('click', importTodoChecklist);
    if (D.btnTodoClearDone) D.btnTodoClearDone.addEventListener('click', () => {
      S.todos = S.todos.filter(t => !t.done);
      savePower(); renderTodos();
      toast('Done tasks cleared', 'ok', 1300);
    });
    // Stopwatch
    if (D.btnSwStart) D.btnSwStart.addEventListener('click', swStartStop);
    if (D.btnSwLap) D.btnSwLap.addEventListener('click', swLap);
    if (D.btnSwReset) D.btnSwReset.addEventListener('click', swReset);
    // Counters
    if (D.btnCounterAdd) D.btnCounterAdd.addEventListener('click', addCounter);
    if (D.counterName) D.counterName.addEventListener('keydown', e => { if (e.key === 'Enter') addCounter(); });
    // Habits
    if (D.btnHabitAdd) D.btnHabitAdd.addEventListener('click', addHabit);
    if (D.habitName) D.habitName.addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
    // marker color swatches (PDF-style)
    $$('[data-mcolor]').forEach(b => b.addEventListener('click', () => {
      P.markerColor = b.dataset.mcolor; P.markerTool = b.dataset.mtool || P.markerTool || 'highlight';
      savePrefs();
      $$('[data-mcolor]').forEach(x => x.classList.toggle('on', x === b));
    }));
    $$('[data-mtool]').forEach(b => b.addEventListener('click', () => {
      P.markerTool = b.dataset.mtool;
      savePrefs();
      $$('[data-mtool]').forEach(x => x.classList.toggle('on', x === b));
      toast('Marker tool: ' + P.markerTool, null, 1200);
    }));
    const sw = (id, key, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', (e) => { P[key] = e.target.checked; savePrefs(); if (fn) fn(); });
    };
    sw('swBreaks', 'breaks', () => { if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize); });
    sw('swRtlAuto', 'rtlAuto', () => { if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize); });
    sw('swSectionTime', 'sectionTime', () => { if (S.raw) onDocReady(S.raw, S.fileName, S.fileSize); });
    sw('swFocusSent', 'focusSent', () => applyReadingPrefs());
    sw('swOutlineNum', 'outlineNum', () => buildOutline());
    sw('swPerf', 'perf');
    // Lab buttons
    if (D.btnLint) D.btnLint.addEventListener('click', labLint);
    if (D.btnSummary) D.btnSummary.addEventListener('click', labSummary);
    if (D.btnKeywords) D.btnKeywords.addEventListener('click', labKeywords);
    if (D.btnFreq) D.btnFreq.addEventListener('click', labFreq);
    if (D.btnReadability) D.btnReadability.addEventListener('click', labReadability);
    if (D.btnCopyHtml) D.btnCopyHtml.addEventListener('click', copyHtmlDoc);
    if (D.btnCopyOutline) D.btnCopyOutline.addEventListener('click', copyOutline);
    if (D.btnPrintSel) D.btnPrintSel.addEventListener('click', printSelection);
    if (D.btnShuffleFlash) D.btnShuffleFlash.addEventListener('click', shuffleFlash);
    // Templates
    $$('[data-template]').forEach(b => b.addEventListener('click', () => applyTemplate(b.dataset.template)));
    // Features Window shortcut F (no modifiers, not typing)
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') {
        if (D.modalBackdrop && D.modalBackdrop.classList.contains('show')) return;
        e.preventDefault();
        openFeaturesList();
      }
    });
    // selection  mini-bar (debounced, hides on scroll)
    const onSel = debounce(() => showSelBarNearSelection(), 120);
    document.addEventListener('selectionchange', onSel);
    if (D.viewer) D.viewer.addEventListener('scroll', () => hideSelBar(), { passive: true });
    document.addEventListener('mousedown', (e) => {
      if (D.selBar && !D.selBar.hidden && !D.selBar.contains(e.target)) hideSelBar();
    }, true);
    // study keyboard: H/U/S/C (no modifiers, not typing) — Heros PDF parity
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!S.raw || !D.mdDoc) return;
      const sel = currentSelText().trim();
      if (!sel) return;
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); addStudyMark('highlight'); }
      else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); addStudyMark('underline'); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); addStudyMark('strike'); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); copySelectionOrDoc(); }
    });
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
