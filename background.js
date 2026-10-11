'use strict';

const VIEWER = 'viewer.html';
const MD_RE = /\.(md|markdown|mdown|mkd|mdx)($|[?#])/i;
const DEFAULTS = { autoFile: true, autoWeb: true };

/* tabId -> { url, at } — loop guard so we never bounce a tab twice */
const recentRedirects = new Map();

async function settings() {
  try {
    const s = await chrome.storage.local.get(DEFAULTS);
    return { autoFile: s.autoFile !== false, autoWeb: s.autoWeb !== false };
  } catch (e) {
    return { autoFile: true, autoWeb: true };
  }
}

function viewerUrl(mdUrl) {
  return VIEWER + '?md=' + encodeURIComponent(mdUrl);
}

function openViewer(query) {
  chrome.tabs.create({ url: VIEWER + query });
}

/* ---------------------------------------------------------------------------
   Auto-open: when a tab navigates to a Markdown file (file:// or http(s)),
   take over and open it in Heros Markdown instead of raw text.
   NOTE: for file:// URLs the extension needs "Allow access to file URLs"
   enabled on chrome://extensions.
--------------------------------------------------------------------------- */
async function maybeRedirect(details, stage) {
  try {
    if (!details || details.frameId !== 0) return;
    const url = details.url || '';
    if (url.startsWith('chrome-extension://') ||
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:')) return;
    if (url.indexOf('/' + VIEWER) !== -1) return;

    const isFile = url.startsWith('file://');
    const isWeb = url.startsWith('http://') || url.startsWith('https://');
    if (!isFile && !isWeb) return;
    if (!MD_RE.test(url)) return;

    const s = await settings();
    if (isFile && !s.autoFile) return;
    if (isWeb && !s.autoWeb) return;

    const prev = recentRedirects.get(details.tabId);
    const now = Date.now();
    if (prev && prev.url === url && (now - prev.at) < 5000) return;
    recentRedirects.set(details.tabId, { url, at: now });
    if (recentRedirects.size > 50) {
      for (const [k, v] of recentRedirects) {
        if (now - v.at > 30000) recentRedirects.delete(k);
      }
    }

    await chrome.tabs.update(details.tabId, { url: viewerUrl(url) });
  } catch (e) {
    console.warn('[HerosMD] auto-open redirect failed:', (e && e.message) || e);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  maybeRedirect(details, 'navigate');
});
chrome.webNavigation.onCommitted.addListener((details) => {
  maybeRedirect(details, 'committed');
});

/* Context menu: right-click on Markdown links or pages */
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'herosmd-open',
      title: 'Open with Heros Markdown',
      contexts: ['link', 'page']
    });
  } catch (e) {}
});

chrome.contextMenus.onClicked.addListener((info) => {
  let url = null;
  if (info.linkUrl && MD_RE.test(info.linkUrl)) url = info.linkUrl;
  else if (info.pageUrl && MD_RE.test(info.pageUrl)) url = info.pageUrl;
  if (url) openViewer('?md=' + encodeURIComponent(url));
  else openViewer('');
});

/* Popup "open" button */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'herosmd-open') {
    openViewer(msg.query || '');
    sendResponse({ ok: true });
    return true;
  }
});
