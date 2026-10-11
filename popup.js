'use strict';

const DEFAULTS = { autoFile: true, autoWeb: true };

async function load() {
  let s = { ...DEFAULTS };
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    s = { ...DEFAULTS, ...stored };
  } catch (e) { /* defaults */ }
  document.getElementById('autoFile').checked = s.autoFile !== false;
  document.getElementById('autoWeb').checked = s.autoWeb !== false;
  document.getElementById('fileNote').hidden = !(s.autoFile !== false);
}

async function save() {
  const s = {
    autoFile: document.getElementById('autoFile').checked,
    autoWeb: document.getElementById('autoWeb').checked
  };
  try { await chrome.storage.local.set(s); } catch (e) { /* ignore */ }
  document.getElementById('fileNote').hidden = !s.autoFile;
}

document.getElementById('autoFile').addEventListener('change', save);
document.getElementById('autoWeb').addEventListener('change', save);
document.getElementById('btnOpen').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'herosmd-open', query: '' });
  window.close();
});

load();
