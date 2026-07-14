const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const hljs = require('highlight.js');
const katex = require('katex');
const texmath = require('markdown-it-texmath');
const taskLists = require('markdown-it-task-lists');

const md = require('markdown-it')({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {}
    }
    return md.utils.escapeHtml(code);
  },
});

md.use(taskLists, { label: true });
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

function resolveLocal(src, baseDir) {
  if (!baseDir) return src;
  if (/^(https?:|data:|file:|#|mailto:)/i.test(src)) return src;
  try {
    const abs = path.isAbsolute(src) ? src : path.join(baseDir, src);
    return pathToFileURL(abs).href;
  } catch {
    return src;
  }
}

const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  if (src) token.attrSet('src', resolveLocal(src, env.baseDir));
  return defaultImage(tokens, idx, options, env, self);
};

contextBridge.exposeInMainWorld('api', {
  render: (text, baseDir) => md.render(text, { baseDir }),

  openDialog: () => ipcRenderer.invoke('dialog:open'),
  openFile: (p) => ipcRenderer.invoke('file:open', p),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  clearRecent: () => ipcRenderer.invoke('recent:clear'),
  exportPdf: (name) => ipcRenderer.invoke('pdf:export', name),

  findStart: (text, forward, findNext) => ipcRenderer.send('find:start', { text, forward, findNext }),
  findStop: (action) => ipcRenderer.send('find:stop', action),

  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  showInFolder: (p) => ipcRenderer.send('shell:showInFolder', p),

  pathForFile: (file) => webUtils.getPathForFile(file),
  dirname: (p) => path.dirname(p),
  basename: (p) => path.basename(p),
  resolvePath: (base, rel) => path.resolve(base, rel),

  setZoom: (level) => webFrame.setZoomLevel(level),
  getZoom: () => webFrame.getZoomLevel(),

  onOpenFile: (cb) => ipcRenderer.on('open-file', (_e, data) => cb(data)),
  onFileChanged: (cb) => ipcRenderer.on('file-changed', (_e, data) => cb(data)),
  onOpenError: (cb) => ipcRenderer.on('open-error', (_e, data) => cb(data)),
  onFindResult: (cb) => ipcRenderer.on('find-result', (_e, data) => cb(data)),
});
