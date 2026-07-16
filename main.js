const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let win = null;
let watcher = null;
let watchedPath = null;
let pendingFile = null;

const MD_EXTS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt']);

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

function readAndSend(filePath, channel) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    addRecent(filePath);
    startWatching(filePath);
    win.webContents.send(channel, { path: filePath, content });
  } catch (err) {
    win.webContents.send('open-error', { path: filePath, message: err.message });
  }
}

function startWatching(filePath) {
  stopWatching();
  watchedPath = filePath;
  let timer = null;
  const rearm = () => {
    try {
      watcher = fs.watch(filePath, (eventType) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!win || win.isDestroyed()) return;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            win.webContents.send('file-changed', { path: filePath, content });
          } catch {}
          if (eventType === 'rename') {
            stopWatching();
            setTimeout(() => {
              if (watchedPath === filePath && fs.existsSync(filePath)) rearm();
            }, 300);
          }
        }, 150);
      });
    } catch {}
  };
  rearm();
}

function stopWatching() {
  if (watcher) {
    try { watcher.close(); } catch {}
    watcher = null;
  }
}

function overlayFor(theme) {
  return theme === 'dark'
    ? { color: '#00000000', symbolColor: '#9aa0a8', height: 44 }
    : { color: '#00000000', symbolColor: '#57606a', height: 44 };
}

function createWindow() {
  const settings = loadSettings();
  win = new BrowserWindow({
    width: 1160,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    show: false,
    backgroundColor: settings.theme === 'dark' ? '#1b1e23' : '#ffffff',
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayFor(settings.theme),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      readAndSend(pendingFile, 'open-file');
      pendingFile = null;
    }
    const shotArg = process.argv.find((a) => a.startsWith('--screenshot='));
    if (shotArg) {
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
            await win.webContents.executeJavaScript(
              `document.querySelector('#btn-theme').click()`
            );
            await new Promise((r) => setTimeout(r, 1200));
          }
          if (sidebarArg) {
            await win.webContents.executeJavaScript(
              `document.querySelector('#btn-sidebar').click()`
            );
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
  });

  win.webContents.on('found-in-page', (_e, result) => {
    win.webContents.send('find-result', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
      finalUpdate: result.finalUpdate,
    });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    stopWatching();
    win = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const f = fileArgFrom(argv);
    if (f) readAndSend(f, 'open-file');
  });

  app.whenReady().then(() => {
    pendingFile = fileArgFrom(process.argv);
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());

// ---------- IPC ----------

ipcMain.handle('dialog:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '마크다운 파일 열기',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return null;
  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  addRecent(filePath);
  startWatching(filePath);
  return { path: filePath, content };
});

ipcMain.handle('file:open', (_e, filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  addRecent(filePath);
  startWatching(filePath);
  return { path: filePath, content };
});

ipcMain.handle('file:save', (_e, { path: filePath, content }) => {
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:set', (_e, patch) => {
  const s = { ...loadSettings(), ...patch };
  saveSettings(s);
  if (patch.theme && win) {
    try { win.setTitleBarOverlay(overlayFor(patch.theme)); } catch {}
    win.setBackgroundColor(patch.theme === 'dark' ? '#1b1e23' : '#ffffff');
  }
  return s;
});

ipcMain.handle('recent:clear', () => {
  const s = loadSettings();
  s.recent = [];
  saveSettings(s);
  return s;
});

ipcMain.on('find:start', (_e, { text, forward, findNext }) => {
  if (text) win.webContents.findInPage(text, { forward, findNext });
});

ipcMain.on('find:stop', (_e, action) => {
  win.webContents.stopFindInPage(action || 'clearSelection');
});

ipcMain.handle('pdf:export', async (_e, suggestedName) => {
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
