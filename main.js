const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const isMac = process.platform === 'darwin';
const MD_EXTS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt']);

// In development (running unpackaged), use a separate userData directory so the
// dev instance does NOT share the installed app's single-instance lock — a
// lingering dev process would otherwise hijack the file the user double-clicks.
if (!app.isPackaged) {
  try {
    app.setPath('userData', path.join(app.getPath('appData'), 'Mymd (dev)'));
  } catch {}
}

// ---------- Localization (main-process dialogs) ----------
const STRINGS = {
  ko: {
    openTitle: '마크다운 파일 열기',
    markdown: 'Markdown',
    allFiles: '모든 파일',
    pdfTitle: 'PDF로 내보내기',
    htmlTitle: 'HTML로 내보내기',
    unsavedMsg: '저장하지 않은 변경 사항이 있습니다.',
    unsavedDetail: '편집한 내용을 저장할까요?',
    save: '저장',
    dontSave: '저장 안 함',
    cancel: '취소',
  },
  en: {
    openTitle: 'Open Markdown File',
    markdown: 'Markdown',
    allFiles: 'All Files',
    pdfTitle: 'Export to PDF',
    htmlTitle: 'Export to HTML',
    unsavedMsg: 'You have unsaved changes.',
    unsavedDetail: 'Do you want to save your edits?',
    save: 'Save',
    dontSave: "Don't Save",
    cancel: 'Cancel',
  },
};
function mt(key) {
  const lang = loadSettings().lang === 'en' ? 'en' : 'ko';
  return (STRINGS[lang] || STRINGS.ko)[key];
}

/** All open windows. Each window owns one document (or the welcome screen). */
const windows = new Set();
/** Files requested before the app was ready (macOS open-file at launch). */
let pendingFiles = [];
let screenshotDone = false;

// ---------- Settings ----------

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
  } catch {
    return { theme: 'light', recent: [] };
  }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  } catch {}
}

function addRecent(filePath) {
  const s = loadSettings();
  s.recent = [filePath, ...(s.recent || []).filter((p) => p !== filePath)].slice(0, 10);
  saveSettings(s);
}

// ---------- Path helpers ----------

function fileArgFrom(argv) {
  for (const a of argv.slice(1)) {
    if (a.startsWith('-')) continue;
    try {
      const p = path.resolve(a);
      if (fs.existsSync(p) && MD_EXTS.has(path.extname(p).toLowerCase())) return p;
    } catch {}
  }
  return null;
}

function samePath(a, b) {
  if (!a || !b) return false;
  const na = path.resolve(a);
  const nb = path.resolve(b);
  return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

// ---------- Per-window file watching ----------

function startWatching(win, filePath) {
  stopWatching(win);
  let timer = null;
  const rearm = () => {
    try {
      const watcher = fs.watch(filePath, (eventType) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (win.isDestroyed()) return;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            win.webContents.send('file-changed', { path: filePath, content });
          } catch {}
          if (eventType === 'rename') {
            stopWatching(win);
            setTimeout(() => {
              if (!win.isDestroyed() && samePath(win.mdPath, filePath) && fs.existsSync(filePath)) {
                rearm();
              }
            }, 300);
          }
        }, 150);
      });
      win.__watcher = watcher;
    } catch {}
  };
  rearm();
}

function stopWatching(win) {
  if (win.__watcher) {
    try { win.__watcher.close(); } catch {}
    win.__watcher = null;
  }
}

// ---------- Window creation ----------

/** Load a file into a specific window and begin watching it. */
function loadFileInto(win, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    win.mdPath = filePath;
    addRecent(filePath);
    startWatching(win, filePath);
    win.webContents.send('open-file', { path: filePath, content });
  } catch (err) {
    win.webContents.send('open-error', { path: filePath, message: err.message });
  }
}

function createWindow(filePath) {
  const settings = loadSettings();
  const opts = {
    width: 1160,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    show: false,
    backgroundColor: settings.theme === 'dark' ? '#1b1e23' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      // Keep painting at full rate during window animations.
      backgroundThrottling: false,
    },
  };
  // macOS keeps the native frame (smooth maximize) with inset traffic lights.
  // Windows uses a fully frameless window with custom caption buttons so that
  // maximize/restore is an instant resize — the native animated maximize made
  // the web contents lag a frame behind, showing a stutter/ghosting artifact.
  if (isMac) opts.titleBarStyle = 'hiddenInset';
  else opts.frame = false;

  const win = new BrowserWindow(opts);

  win.mdPath = null;
  win.__watcher = null;
  windows.add(win);

  // Custom maximize state. We resize instantly (see toggleMaximize) instead of
  // using the OS animated maximize, which stretched the stale frame and left a
  // ghost. __isMax tracks our custom-maximized state; native maximize (Aero
  // snap) is also reflected via isMaximized().
  win.__isMax = false;
  win.__normalBounds = null;
  win.__programmaticResize = false;
  win.__dirty = false;
  win.__forceClose = false;

  const sendWindowState = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window-state', { maximized: win.__isMax || win.isMaximized() });
    }
  };
  // Native maximize/unmaximize (e.g. Aero snap to top edge) keeps the icon in sync.
  win.on('maximize', () => { win.__isMax = false; sendWindowState(); });
  win.on('unmaximize', () => { win.__isMax = false; sendWindowState(); });
  // A manual drag-resize/move exits our custom-maximized state.
  win.on('resize', () => {
    if (!win.__programmaticResize && win.__isMax) { win.__isMax = false; sendWindowState(); }
  });
  win.on('move', () => {
    if (!win.__programmaticResize && win.__isMax) { win.__isMax = false; sendWindowState(); }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => {
    if (filePath) {
      loadFileInto(win, filePath);
      filePath = null; // only on first load
    }
    sendWindowState();
    maybeRunScreenshot(win);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prompt to save unsaved edits when the window is closed.
  win.on('close', async (e) => {
    if (win.__forceClose || !win.__dirty) return;
    e.preventDefault();
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [mt('save'), mt('dontSave'), mt('cancel')],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      message: mt('unsavedMsg'),
      detail: mt('unsavedDetail'),
    });
    if (response === 2) return; // cancel — keep the window open
    if (response === 1) {
      win.__forceClose = true;
      win.destroy();
    } else {
      win.webContents.send('save-then-close'); // renderer saves, then force-closes
    }
  });

  win.on('closed', () => {
    stopWatching(win);
    windows.delete(win);
  });

  return win;
}

/**
 * Open a file following the "one window per file" model:
 *  - if a window already shows it, focus that window;
 *  - else if the requesting window is still the empty welcome screen, use it;
 *  - else open a new window.
 * Returns { inPlace: {path, content} } when the caller's own window should
 * render it, otherwise null (a new/existing window handles it).
 */
function routeOpen(filePath, senderWin) {
  const resolved = path.resolve(filePath);

  for (const w of windows) {
    if (samePath(w.mdPath, resolved)) {
      if (w.isMinimized()) w.restore();
      w.focus();
      return null;
    }
  }

  if (senderWin && !senderWin.isDestroyed() && !senderWin.mdPath) {
    try {
      const content = fs.readFileSync(resolved, 'utf-8');
      senderWin.mdPath = resolved;
      addRecent(resolved);
      startWatching(senderWin, resolved);
      return { inPlace: { path: resolved, content } };
    } catch (err) {
      return { error: err.message };
    }
  }

  createWindow(resolved);
  return null;
}

/**
 * Toggle maximize with our own short eased resize animation. We step the window
 * bounds ourselves (rather than the OS animated maximize) so the web contents
 * repaints at each intermediate size — this keeps the growth animation but
 * avoids the stretched/ghosted frame the native animation produced.
 */
function animateBounds(win, target, onDone) {
  const from = win.getBounds();
  const dx = target.x - from.x, dy = target.y - from.y;
  const dw = target.width - from.width, dh = target.height - from.height;
  const duration = 150;
  const start = Date.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
  win.__animating = true;
  win.__programmaticResize = true;
  const step = () => {
    if (win.isDestroyed()) return;
    const t = Math.min(1, (Date.now() - start) / duration);
    const e = ease(t);
    win.setBounds(
      {
        x: Math.round(from.x + dx * e),
        y: Math.round(from.y + dy * e),
        width: Math.round(from.width + dw * e),
        height: Math.round(from.height + dh * e),
      },
      false
    );
    if (t < 1) {
      setTimeout(step, 8);
    } else {
      win.__animating = false;
      setTimeout(() => { win.__programmaticResize = false; }, 40);
      if (onDone) onDone();
    }
  };
  step();
}

function toggleMaximize(win) {
  if (win.__animating) return;
  if (win.isMaximized()) {
    // Was maximized natively (Aero snap); let the OS restore it.
    win.unmaximize();
    return;
  }
  let target;
  if (win.__isMax) {
    target = win.__normalBounds || win.getBounds();
    win.__isMax = false;
  } else {
    win.__normalBounds = win.getBounds();
    target = screen.getDisplayMatching(win.getBounds()).workArea;
    win.__isMax = true;
  }
  // Update the caption icon immediately, then animate.
  if (!win.isDestroyed()) win.webContents.send('window-state', { maximized: win.__isMax });
  animateBounds(win, target);
}

function focusOrCreate() {
  const existing = [...windows].pop();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
  } else {
    createWindow(null);
  }
}

// ---------- Lifecycle ----------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileArgFrom(argv);
    if (f) routeOpen(f, null);
    else focusOrCreate();
  });

  // macOS: files opened from Finder / dropped on the dock icon.
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady()) routeOpen(filePath, null);
    else pendingFiles.push(filePath);
  });

  app.whenReady().then(() => {
    const argFile = fileArgFrom(process.argv);
    if (argFile) pendingFiles.push(argFile);

    if (pendingFiles.length) {
      pendingFiles.forEach((f) => createWindow(f));
      pendingFiles = [];
    } else {
      createWindow(null);
    }
  });

  app.on('activate', () => {
    if (windows.size === 0) createWindow(null);
  });
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

// ---------- Screenshot hook (used by the dev/test harness) ----------

function maybeRunScreenshot(win) {
  const shotArg = process.argv.find((a) => a.startsWith('--screenshot='));
  if (!shotArg || screenshotDone) return;
  screenshotDone = true;
  const execArg = process.argv.find((a) => a.startsWith('--exec-b64='));
  const scrollArg = process.argv.find((a) => a.startsWith('--scroll='));
  const themeArg = process.argv.find((a) => a.startsWith('--theme='));
  const sidebarArg = process.argv.includes('--sidebar');
  const fitArg = process.argv.includes('--capfit');
  setTimeout(async () => {
    try {
      if (fitArg) {
        // Grow the window to fit the whole document so one capture shows it all.
        const h = await win.webContents.executeJavaScript(
          `Math.ceil(document.querySelector('#content').getBoundingClientRect().height) - 60`
        );
        win.setContentSize(1160, Math.min(4000, 44 + Math.max(300, h)));
        await new Promise((r) => setTimeout(r, 500));
      }
      const caphArg = process.argv.find((a) => a.startsWith('--caph='));
      if (caphArg) {
        // Fixed content height — lets two captures come out identically sized.
        win.setContentSize(1160, parseInt(caphArg.split('=')[1], 10));
        await new Promise((r) => setTimeout(r, 500));
      }
      if (execArg) {
        const js = Buffer.from(execArg.split('=')[1], 'base64').toString('utf-8');
        await win.webContents.executeJavaScript(`(async () => { ${js} })()`);
        await new Promise((r) => setTimeout(r, 800));
      }
      if (themeArg) {
        await win.webContents.executeJavaScript(`document.querySelector('#btn-theme').click()`);
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (sidebarArg) {
        await win.webContents.executeJavaScript(`document.querySelector('#btn-sidebar').click()`);
        await new Promise((r) => setTimeout(r, 500));
      }
      if (scrollArg) {
        await win.webContents.executeJavaScript(
          `document.querySelector('#content-scroll').scrollTo({top: ${Number(scrollArg.split('=')[1])}, behavior: 'instant'})`
        );
        await new Promise((r) => setTimeout(r, 500));
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(shotArg.split('=')[1], img.toPNG());
    } catch (e) {
      console.error(e);
    }
    // Never let the unsaved-changes prompt block the headless test harness.
    windows.forEach((w) => { w.__forceClose = true; });
    app.quit();
  }, 2500);
}

// ---------- HTML export ----------

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// KaTeX renders math with its own web fonts. For a self-contained export we
// inline the woff2 files as data URIs (and drop the woff/ttf fallbacks) so the
// math still looks right when the .html is opened anywhere.
let katexCssCache = null;
function inlineKatexCss() {
  if (katexCssCache != null) return katexCssCache;
  const dir = path.join(__dirname, 'node_modules', 'katex', 'dist');
  let css = '';
  try {
    css = fs.readFileSync(path.join(dir, 'katex.min.css'), 'utf-8').replace(/url\(([^)]+)\)/g, (m, ref) => {
      const r = ref.trim().replace(/^['"]|['"]$/g, '').split(/[?#]/)[0];
      if (/^data:/.test(r)) return m;
      if (!/\.woff2$/i.test(r)) return "url('')"; // keep woff2 only
      try {
        const fp = path.join(dir, r);
        if (fs.existsSync(fp)) {
          return `url(data:font/woff2;base64,${fs.readFileSync(fp).toString('base64')})`;
        }
      } catch {}
      return "url('')";
    });
  } catch {}
  katexCssCache = css;
  return css;
}

function composeExportHtml({ content, theme, title, contentWidth, fontScale }) {
  const appCss = fs.readFileSync(path.join(__dirname, 'renderer', 'styles.css'), 'utf-8');
  const th = theme === 'dark' ? 'dark' : 'light';
  const w = typeof contentWidth === 'number' ? contentWidth : 47;
  const scale = typeof fontScale === 'number' ? fontScale : 1;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title || 'document')}</title>
<style>${inlineKatexCss()}</style>
<style>${appCss}</style>
<style>
  html, body { overflow: auto !important; height: auto !important; }
  body { --content-w: ${w}rem; --reading-scale: ${scale}; }
</style>
</head>
<body data-theme="${th}">
<article class="markdown-body">
${content}
</article>
</body>
</html>`;
}

// ---------- IPC ----------

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle('dialog:open', async (event) => {
  const win = senderWindow(event);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: mt('openTitle'),
    filters: [
      { name: mt('markdown'), extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: mt('allFiles'), extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || !filePaths.length) return null;

  // First file may render in the current (welcome) window; the rest always
  // open in their own windows.
  let inPlace = null;
  filePaths.forEach((fp, i) => {
    const res = routeOpen(fp, i === 0 ? win : null);
    if (i === 0 && res && res.inPlace) inPlace = res.inPlace;
  });
  return inPlace;
});

ipcMain.handle('file:open', (event, filePath) => {
  const res = routeOpen(filePath, senderWindow(event));
  return res && res.inPlace ? res.inPlace : null;
});

ipcMain.handle('file:save', (_e, { path: filePath, content }) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

// 0 = save, 1 = don't save, 2 = cancel
ipcMain.handle('dialog:unsaved', async (event) => {
  const win = senderWindow(event);
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [mt('save'), mt('dontSave'), mt('cancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    message: mt('unsavedMsg'),
    detail: mt('unsavedDetail'),
  });
  return response;
});

// Windows font families often surface under their internal English name
// (e.g. "NanumSquareRoundOTF"). WPF exposes the same family's localized name
// ("나눔스퀘어라운드OTF"), which is what apps like HWP show. We build a map
// {englishFamily -> localizedName} once and use it purely as a friendlier
// label; the English family is still what CSS matches against.
// Async + promise-cached so it never blocks the main process (the PowerShell
// call takes ~1s). Concurrent callers share the one in-flight promise.
let fontNameMapPromise = null;
function loadFontNameMap() {
  if (fontNameMapPromise) return fontNameMapPromise;
  fontNameMapPromise = new Promise((resolve) => {
    const map = {};
    if (process.platform !== 'win32') return resolve(map);
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      'Add-Type -AssemblyName PresentationCore',
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
      '$ci=[System.Globalization.CultureInfo]::CurrentUICulture.IetfLanguageTag',
      '$out=foreach($f in [System.Windows.Media.Fonts]::SystemFontFamilies){',
      '  $n=$null',
      '  foreach($k in $f.FamilyNames.Keys){ if($k.IetfLanguageTag -eq $ci){$n=$f.FamilyNames[$k];break} }',
      "  if(-not $n){ foreach($k in $f.FamilyNames.Keys){ if($k.IetfLanguageTag -like 'ko*'){$n=$f.FamilyNames[$k];break} } }",
      '  if(-not $n){ $n=$f.Source }',
      '  [pscustomobject]@{s=$f.Source;n=$n}',
      '}',
      '$out | ConvertTo-Json -Compress',
    ].join('\n');
    const { execFile } = require('child_process');
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (!err && stdout) {
          try {
            const arr = JSON.parse(stdout);
            for (const it of Array.isArray(arr) ? arr : [arr]) {
              if (it && it.s && it.n && it.s !== it.n) map[it.s] = it.n;
            }
          } catch {}
        }
        resolve(map);
      }
    );
  });
  return fontNameMapPromise;
}

let fontListCache = null;
ipcMain.handle('fonts:list', async () => {
  if (fontListCache) return fontListCache;
  try {
    const [list, map] = await Promise.all([
      require('font-list').getFonts({ disableQuoting: true }),
      loadFontNameMap(),
    ]);
    const items = [...new Set(list)].map((f) => ({ family: f, label: map[f] || f }));
    items.sort((a, b) => a.label.localeCompare(b.label));
    fontListCache = items;
    return items;
  } catch {
    return [];
  }
});

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:set', (_e, patch) => {
  const s = { ...loadSettings(), ...patch };
  saveSettings(s);
  if (patch.theme) {
    for (const w of windows) {
      if (w.isDestroyed()) continue;
      w.setBackgroundColor(patch.theme === 'dark' ? '#1b1e23' : '#ffffff');
    }
  }
  return s;
});

ipcMain.on('doc:dirty', (event, dirty) => {
  const win = senderWindow(event);
  if (win) win.__dirty = !!dirty;
});

ipcMain.on('win:force-close', (event) => {
  const win = senderWindow(event);
  if (win) { win.__forceClose = true; win.close(); }
});

ipcMain.on('win:minimize', (event) => {
  const win = senderWindow(event);
  if (win) win.minimize();
});

ipcMain.on('win:toggle-maximize', (event) => {
  const win = senderWindow(event);
  if (win) toggleMaximize(win);
});

ipcMain.on('win:close', (event) => {
  const win = senderWindow(event);
  if (win) win.close();
});

ipcMain.handle('recent:clear', () => {
  const s = loadSettings();
  s.recent = [];
  saveSettings(s);
  return s;
});

ipcMain.handle('pdf:export', async (event, suggestedName) => {
  const win = senderWindow(event);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: mt('pdfTitle'),
    defaultPath: suggestedName || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const data = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      pageSize: 'A4',
    });
    fs.writeFileSync(filePath, data);
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('html:export', async (event, payload) => {
  const win = senderWindow(event);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: mt('htmlTitle'),
    defaultPath: (payload.title || 'document') + '.html',
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, composeExportHtml(payload), 'utf-8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// List a directory for the file-explorer sidebar: sub-folders first, then
// markdown files, each sorted by name. Hidden entries are skipped. Called
// lazily as folders are expanded, so large trees stay cheap.
ipcMain.handle('dir:list', (_e, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs = [];
    const files = [];
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dirPath, ent.name);
      let isDir = ent.isDirectory();
      if (ent.isSymbolicLink()) {
        try { isDir = fs.statSync(full).isDirectory(); } catch { continue; }
      }
      if (isDir) dirs.push({ name: ent.name, path: full, isDir: true });
      else if (MD_EXTS.has(path.extname(ent.name).toLowerCase())) {
        files.push({ name: ent.name, path: full, isDir: false });
      }
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    dirs.sort(byName);
    files.sort(byName);
    return [...dirs, ...files];
  } catch {
    return [];
  }
});

// Recursively collect markdown files under a folder for the sidebar's file
// search. Bounded in depth/count and skips heavy or hidden folders so it stays
// fast; the renderer caches the result per folder.
ipcMain.handle('dir:listAll', (_e, root) => {
  const out = [];
  const SKIP = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.cache', '.next']);
  const MAX = 8000;
  const MAX_DEPTH = 24;
  const walk = (dir, depth) => {
    if (out.length >= MAX || depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= MAX) return;
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      let isDir = ent.isDirectory();
      if (ent.isSymbolicLink()) {
        try { isDir = fs.statSync(full).isDirectory(); } catch { continue; }
      }
      if (isDir) {
        if (!SKIP.has(ent.name.toLowerCase())) walk(full, depth + 1);
      } else if (MD_EXTS.has(path.extname(ent.name).toLowerCase())) {
        out.push({ name: ent.name, path: full, rel: path.relative(root, full) });
      }
    }
  };
  try { walk(root, 0); } catch {}
  return out;
});

ipcMain.on('shell:openExternal', (_e, url) => {
  if (/^https?:/i.test(url)) shell.openExternal(url);
});

ipcMain.on('shell:showInFolder', (_e, p) => {
  if (p) shell.showItemInFolder(p);
});
