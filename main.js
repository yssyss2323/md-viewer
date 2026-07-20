const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isMac = process.platform === 'darwin';
const MD_EXTS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt']);

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

function overlayFor(theme) {
  return theme === 'dark'
    ? { color: '#00000000', symbolColor: '#9aa0a8', height: 44 }
    : { color: '#00000000', symbolColor: '#57606a', height: 44 };
}

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
  const win = new BrowserWindow({
    width: 1160,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    show: false,
    backgroundColor: settings.theme === 'dark' ? '#1b1e23' : '#ffffff',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? false : overlayFor(settings.theme),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  win.mdPath = null;
  win.__watcher = null;
  windows.add(win);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => {
    if (filePath) {
      loadFileInto(win, filePath);
      filePath = null; // only on first load
    }
    maybeRunScreenshot(win);
  });

  win.webContents.on('found-in-page', (_e, result) => {
    if (!win.isDestroyed()) {
      win.webContents.send('find-result', {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
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
  setTimeout(async () => {
    try {
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
    app.quit();
  }, 2500);
}

// ---------- IPC ----------

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle('dialog:open', async (event) => {
  const win = senderWindow(event);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '마크다운 파일 열기',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '모든 파일', extensions: ['*'] },
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

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:set', (_e, patch) => {
  const s = { ...loadSettings(), ...patch };
  saveSettings(s);
  if (patch.theme) {
    for (const w of windows) {
      if (w.isDestroyed()) continue;
      if (!isMac) {
        try { w.setTitleBarOverlay(overlayFor(patch.theme)); } catch {}
      }
      w.setBackgroundColor(patch.theme === 'dark' ? '#1b1e23' : '#ffffff');
    }
  }
  return s;
});

ipcMain.handle('recent:clear', () => {
  const s = loadSettings();
  s.recent = [];
  saveSettings(s);
  return s;
});

ipcMain.on('find:start', (event, { text, forward, findNext }) => {
  const win = senderWindow(event);
  if (win && text) win.webContents.findInPage(text, { forward, findNext });
});

ipcMain.on('find:stop', (event, action) => {
  const win = senderWindow(event);
  if (win) win.webContents.stopFindInPage(action || 'clearSelection');
});

ipcMain.handle('pdf:export', async (event, suggestedName) => {
  const win = senderWindow(event);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'PDF로 내보내기',
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

ipcMain.on('shell:openExternal', (_e, url) => {
  if (/^https?:/i.test(url)) shell.openExternal(url);
});

ipcMain.on('shell:showInFolder', (_e, p) => {
  if (p) shell.showItemInFolder(p);
});
