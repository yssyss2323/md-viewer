const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const hljs = require('highlight.js');
const katex = require('katex');
const texmath = require('markdown-it-texmath');
const taskLists = require('markdown-it-task-lists');
const mark = require('markdown-it-mark');

const md = require('markdown-it')({
  html: true,
  linkify: true,
  // Smart-punctuation is off so the rendered text matches the source verbatim
  // (…/–/curly quotes would otherwise differ), which the highlighter relies on
  // to map a selection back to an exact source position.
  typographer: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {}
    }
    return md.utils.escapeHtml(code);
  },
});

md.use(taskLists, { label: true, enabled: true });
md.use(mark); // ==highlight== → <mark>

// Tag each block with its source line range (data-line / data-line-end) so the
// renderer can map a rendered-text selection back to an exact source offset for
// the highlighter. Line numbers survive \r\n vs \n differences (both count as
// one line), so the renderer converts them to char offsets against its own copy.
md.core.ruler.push('source_lines', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.type.endsWith('_open')) {
      token.attrSet('data-line', String(token.map[0]));
      token.attrSet('data-line-end', String(token.map[1]));
    }
  }
});
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false },
});

// Mermaid fences become plain divs; the renderer runs mermaid on them.
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = (token.info || '').trim().toLowerCase();
  if (info === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }
  const langName = info.split(/\s+/)[0] || '';
  const body = defaultFence(tokens, idx, options, env, self);
  return `<div class="code-block" data-lang="${md.utils.escapeHtml(langName)}">${body}</div>`;
};

// Chromium blocks file:// subresources on file:// pages, so local images are
// inlined as data: URLs. Paths stay untouched in the markdown output; the
// renderer swaps them via imageDataUrl() after sanitization.
const fsNode = require('fs');
const IMG_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.avif': 'image/avif', '.apng': 'image/apng', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};
const IMG_MAX_BYTES = 50 * 1024 * 1024;

function imageDataUrl(src, baseDir) {
  try {
    let p = src.split(/[?#]/)[0];
    if (/^file:/i.test(p)) p = fileURLToPath(p);
    else if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return null;
    const candidates = [p];
    try {
      const dec = decodeURIComponent(p);
      if (dec !== p) candidates.push(dec);
    } catch {}
    for (let cand of candidates) {
      if (!path.isAbsolute(cand)) cand = path.join(baseDir || '', cand);
      const ext = path.extname(cand).toLowerCase();
      const mime = IMG_MIME[ext];
      if (!mime || !fsNode.existsSync(cand)) continue;
      if (fsNode.statSync(cand).size > IMG_MAX_BYTES) return null;
      return `data:${mime};base64,${fsNode.readFileSync(cand).toString('base64')}`;
    }
    return null;
  } catch {
    return null;
  }
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  render: (text, baseDir) => md.render(text, { baseDir }),

  openDialog: () => ipcRenderer.invoke('dialog:open'),
  openFile: (p) => ipcRenderer.invoke('file:open', p),
  saveFile: (p, content) => ipcRenderer.invoke('file:save', { path: p, content }),
  confirmUnsaved: () => ipcRenderer.invoke('dialog:unsaved'),
  setDirty: (dirty) => ipcRenderer.send('doc:dirty', dirty),
  forceCloseWindow: () => ipcRenderer.send('win:force-close'),
  onSaveThenClose: (cb) => ipcRenderer.on('save-then-close', () => cb()),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  clearRecent: () => ipcRenderer.invoke('recent:clear'),
  exportPdf: (name) => ipcRenderer.invoke('pdf:export', name),
  exportHtml: (payload) => ipcRenderer.invoke('html:export', payload),
  listDir: (dirPath) => ipcRenderer.invoke('dir:list', dirPath),
  listAllFiles: (root) => ipcRenderer.invoke('dir:listAll', root),

  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  showInFolder: (p) => ipcRenderer.send('shell:showInFolder', p),

  minimizeWindow: () => ipcRenderer.send('win:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('win:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('win:close'),
  onWindowState: (cb) => ipcRenderer.on('window-state', (_e, data) => cb(data)),

  imageDataUrl: (src, baseDir) => imageDataUrl(src, baseDir),
  pathForFile: (file) => webUtils.getPathForFile(file),
  dirname: (p) => path.dirname(p),
  basename: (p) => path.basename(p),
  resolvePath: (base, rel) => path.resolve(base, rel),

  setZoom: (level) => webFrame.setZoomLevel(level),
  getZoom: () => webFrame.getZoomLevel(),

  onOpenFile: (cb) => ipcRenderer.on('open-file', (_e, data) => cb(data)),
  onFileChanged: (cb) => ipcRenderer.on('file-changed', (_e, data) => cb(data)),
  onOpenError: (cb) => ipcRenderer.on('open-error', (_e, data) => cb(data)),
});
