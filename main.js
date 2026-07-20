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

ipcMain.handle('fonts:list', async () => {
  try {
    const list = await require('font-list').getFonts({ disableQuoting: true });
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
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

ipcMain.on('shell:openExternal', (_e, url) => {
  if (/^https?:/i.test(url)) shell.openExternal(url);
});

ipcMain.on('shell:showInFolder', (_e, p) => {
  if (p) shell.showItemInFolder(p);
});
