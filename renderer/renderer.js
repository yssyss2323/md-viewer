/* global DOMPurify, mermaid */
(() => {
  const $ = (sel) => document.querySelector(sel);

  const el = {
    body: document.body,
    title: $('#tb-title'),
    dot: $('#tb-dot'),
    sidebar: $('#sidebar'),
    outline: $('#outline'),
    scroll: $('#content-scroll'),
    content: $('#content'),
    welcome: $('#welcome'),
    recentSection: $('#recent-section'),
    recentList: $('#recent-list'),
    statusbar: $('#statusbar'),
    statusPath: $('#status-path'),
    statusStats: $('#status-stats'),
    sourceView: $('#source-view'),
    editor: $('#source-editor'),
    findBar: $('#find-bar'),
    findInput: $('#find-input'),
    findCount: $('#find-count'),
    dropOverlay: $('#drop-overlay'),
    toast: $('#toast'),
    iconMoon: $('#icon-moon'),
    iconSun: $('#icon-sun'),
  };

  const state = {
    path: null,
    raw: null,
    savedRaw: null,
    modified: false,
    sourceMode: false,
    theme: 'light',
    zoom: 0,
    sidebarOpen: false,
    headings: [],
  };

  // Allow local image URLs (mdimg:// scheme, see main.js) through sanitization.
  const SANITIZE_OPTS = {
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file|mdimg|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };

  /* ---------- Helpers ---------- */

  let toastTimer = null;
  function toast(msg, ms = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms);
  }

  function slugify(text) {
    return (
      text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-_]/gu, '') || 'section'
    );
  }

  function initMermaid() {
    mermaid.initialize({
      startOnLoad: false,
      theme: state.theme === 'dark' ? 'dark' : 'neutral',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
  }

  /* ---------- Rendering ---------- */

  async function display(path, content, { keepScroll = false, fromDisk = true } = {}) {
    const prevScroll = el.scroll.scrollTop;
    state.path = path;
    state.raw = content;
    if (fromDisk) {
      state.savedRaw = content;
      setModified(false);
      if (state.sourceMode) setSourceMode(false, { applyEdits: false });
    }

    const baseDir = window.api.dirname(path);
    const html = window.api.render(content, baseDir);
    el.content.innerHTML = DOMPurify.sanitize(html, SANITIZE_OPTS);

    // Local images (relative paths, file: URLs) are inlined as data: URLs.
    el.content.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !/^(https?:|data:)/i.test(src)) {
        const dataUrl = window.api.imageDataUrl(src, baseDir);
        if (dataUrl) img.setAttribute('src', dataUrl);
      }
    });

    el.welcome.classList.add('hidden');
    el.content.classList.toggle('hidden', state.sourceMode);
    el.statusbar.classList.remove('hidden');

    buildHeadings();
    buildOutline();
    decorateCodeBlocks();
    transformCallouts();
    await runMermaid();
    updateStats();

    const name = window.api.basename(path);
    el.title.textContent = name;
    document.title = `${name} — MD Viewer`;
    el.statusPath.textContent = path;

    el.scroll.scrollTop = keepScroll ? prevScroll : 0;
    updateScrollSpy();
  }

  function buildHeadings() {
    const used = new Map();
    state.headings = [];
    el.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const base = slugify(h.textContent);
      const n = used.get(base) || 0;
      used.set(base, n + 1);
      h.id = n === 0 ? base : `${base}-${n}`;
      state.headings.push(h);
    });
  }

  function buildOutline() {
    el.outline.innerHTML = '';
    if (state.headings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'outline-empty';
      empty.textContent = '제목이 없습니다';
      el.outline.appendChild(empty);
      return;
    }
    for (const h of state.headings) {
      const btn = document.createElement('button');
      btn.className = 'outline-item';
      btn.dataset.level = h.tagName[1];
      btn.dataset.target = h.id;
      btn.textContent = h.textContent;
      btn.title = h.textContent;
      btn.addEventListener('click', () => {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      el.outline.appendChild(btn);
    }
  }

  function decorateCodeBlocks() {
    el.content.querySelectorAll('.code-block').forEach((block) => {
      const lang = block.dataset.lang;
      if (lang) {
        const label = document.createElement('span');
        label.className = 'code-lang';
        label.textContent = lang;
        block.appendChild(label);
      }
      const btn = document.createElement('button');
      btn.className = 'code-copy';
      btn.title = '복사';
      btn.innerHTML =
        '<svg viewBox="0 0 16 16" width="13" height="13"><path fill="currentColor" d="M5 2.5A1.5 1.5 0 0 1 6.5 1h6A1.5 1.5 0 0 1 14 2.5v6A1.5 1.5 0 0 1 12.5 10h-6A1.5 1.5 0 0 1 5 8.5v-6ZM6.5 2a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-6ZM2 5.5c0-.5.3-.94.73-1.15a.5.5 0 1 1 .43.9.25.25 0 0 0-.16.25v7c0 .14.11.25.25.25h7a.25.25 0 0 0 .25-.25.5.5 0 0 1 1 0c0 .69-.56 1.25-1.25 1.25h-7C2.56 13.75 2 13.19 2 12.5v-7Z"/></svg>';
      btn.addEventListener('click', async () => {
        const code = block.querySelector('pre code, pre');
        try {
          await navigator.clipboard.writeText(code ? code.textContent : '');
          btn.classList.add('copied');
          btn.innerHTML =
            '<svg viewBox="0 0 16 16" width="13" height="13"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06l2.72 2.72 6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML =
              '<svg viewBox="0 0 16 16" width="13" height="13"><path fill="currentColor" d="M5 2.5A1.5 1.5 0 0 1 6.5 1h6A1.5 1.5 0 0 1 14 2.5v6A1.5 1.5 0 0 1 12.5 10h-6A1.5 1.5 0 0 1 5 8.5v-6ZM6.5 2a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-6ZM2 5.5c0-.5.3-.94.73-1.15a.5.5 0 1 1 .43.9.25.25 0 0 0-.16.25v7c0 .14.11.25.25.25h7a.25.25 0 0 0 .25-.25.5.5 0 0 1 1 0c0 .69-.56 1.25-1.25 1.25h-7C2.56 13.75 2 13.19 2 12.5v-7Z"/></svg>';
          }, 1400);
        } catch {
          toast('복사에 실패했습니다');
        }
      });
      block.appendChild(btn);
    });
  }

  const CALLOUTS = {
    NOTE: { label: '노트', icon: 'ℹ' },
    TIP: { label: '팁', icon: '💡' },
    IMPORTANT: { label: '중요', icon: '❗' },
    WARNING: { label: '주의', icon: '⚠' },
    CAUTION: { label: '경고', icon: '🛑' },
  };

  function transformCallouts() {
    el.content.querySelectorAll('blockquote').forEach((bq) => {
      const first = bq.querySelector('p');
      if (!first) return;
      const m = first.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
      if (!m) return;
      const type = m[1];
      const info = CALLOUTS[type];
      const div = document.createElement('div');
      div.className = `callout callout-${type.toLowerCase()}`;
      const title = document.createElement('div');
      title.className = 'callout-title';
      title.textContent = `${info.icon} ${info.label}`;
      div.appendChild(title);
      first.innerHTML = first.innerHTML.replace(/^\[!\w+\]\s*(<br\s*\/?>)?\s*/, '');
      while (bq.firstChild) div.appendChild(bq.firstChild);
      if (!first.textContent.trim()) first.remove();
      bq.replaceWith(div);
    });
  }

  async function runMermaid() {
    const nodes = el.content.querySelectorAll('.mermaid');
    if (nodes.length === 0) return;
    initMermaid();
    try {
      await mermaid.run({ nodes });
    } catch {
      /* invalid diagram source — leave as-is */
    }
  }

  function updateStats() {
    const text = (state.raw || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`\-|[\]()!]/g, ' ');
    const words = (text.trim().match(/\S+/g) || []).length;
    const chars = text.replace(/\s/g, '').length;
    const minutes = Math.max(1, Math.round(words / 250));
    el.statusStats.textContent = `${words.toLocaleString()} 단어 · ${chars.toLocaleString()} 글자 · 약 ${minutes}분`;
  }

  /* ---------- Scroll spy ---------- */

  function updateScrollSpy() {
    if (state.headings.length === 0) return;
    const top = el.scroll.scrollTop + 90;
    let current = state.headings[0];
    for (const h of state.headings) {
      if (h.offsetTop <= top) current = h;
      else break;
    }
    el.outline.querySelectorAll('.outline-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.target === current.id);
    });
  }

  let spyTimer = null;
  el.scroll.addEventListener('scroll', () => {
    if (spyTimer) return;
    spyTimer = setTimeout(() => {
      spyTimer = null;
      updateScrollSpy();
    }, 80);
  });

  /* ---------- File opening ---------- */

  // A file may open in a new window (returns null) or, when this is still the
  // empty welcome window, render here in place (returns { path, content }).
  async function openViaDialog() {
    try {
      const res = await window.api.openDialog();
      if (res) await display(res.path, res.content);
    } catch (err) {
      toast(`파일을 열 수 없습니다: ${err.message}`);
    }
  }

  async function openPath(p) {
    try {
      const res = await window.api.openFile(p);
      if (res) await display(res.path, res.content);
    } catch {
      toast('파일을 열 수 없습니다 (이동 또는 삭제됨)');
      refreshRecent();
    }
  }

  async function refreshRecent() {
    const s = await window.api.getSettings();
    const recent = (s.recent || []).slice(0, 6);
    el.recentList.innerHTML = '';
    if (recent.length === 0) {
      el.recentSection.classList.add('hidden');
      return;
    }
    el.recentSection.classList.remove('hidden');
    for (const p of recent) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      const name = document.createElement('span');
      name.className = 'recent-name';
      name.textContent = window.api.basename(p);
      const dir = document.createElement('span');
      dir.className = 'recent-dir';
      dir.textContent = window.api.dirname(p);
      btn.append(name, dir);
      btn.title = p;
      btn.addEventListener('click', () => openPath(p));
      li.appendChild(btn);
      el.recentList.appendChild(li);
    }
  }

  /* ---------- Link handling ---------- */

  el.content.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    e.preventDefault();

    if (href.startsWith('#')) {
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (/^https?:/i.test(href)) {
      window.api.openExternal(href);
      return;
    }
    if (/\.(md|markdown|mdown|mkd|txt)$/i.test(href.split('#')[0]) && state.path) {
      const target = window.api.resolvePath(
        window.api.dirname(state.path),
        decodeURIComponent(href.split('#')[0])
      );
      openPath(target);
    }
  });

  /* ---------- Source mode / save ---------- */

  let suppressWatch = 0;

  function setModified(on) {
    state.modified = on;
    el.dot.classList.toggle('modified', on);
    el.dot.title = on ? '저장되지 않은 변경 (Ctrl+S)' : '';
  }

  function setSourceMode(on, { applyEdits = true } = {}) {
    if (on && !state.path) {
      toast('먼저 파일을 열어주세요');
      return;
    }
    if (on === state.sourceMode) return;
    state.sourceMode = on;
    $('#btn-source').classList.toggle('active', on);
    if (on) {
      el.editor.value = state.raw;
      el.content.classList.add('hidden');
      el.sourceView.classList.remove('hidden');
      el.scroll.scrollTop = 0;
      el.editor.focus();
    } else {
      el.sourceView.classList.add('hidden');
      el.content.classList.remove('hidden');
      if (applyEdits && el.editor.value !== state.raw) {
        display(state.path, el.editor.value, { keepScroll: true, fromDisk: false });
      }
    }
  }

  el.editor.addEventListener('input', () => {
    state.raw = el.editor.value;
    setModified(state.raw !== state.savedRaw);
  });

  el.editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      el.editor.setRangeText('  ', el.editor.selectionStart, el.editor.selectionEnd, 'end');
      el.editor.dispatchEvent(new Event('input'));
    }
  });

  async function saveFile() {
    if (!state.path) return;
    if (!state.modified) {
      toast('저장할 변경 사항이 없습니다');
      return;
    }
    try {
      suppressWatch++;
      setTimeout(() => { suppressWatch = Math.max(0, suppressWatch - 1); }, 1500);
      await window.api.saveFile(state.path, state.raw);
      state.savedRaw = state.raw;
      setModified(false);
      if (!state.sourceMode) {
        await display(state.path, state.raw, { keepScroll: true, fromDisk: false });
      } else {
        updateStats();
      }
      toast('저장됨');
    } catch (err) {
      toast(`저장 실패: ${err.message}`);
    }
  }

  function confirmDiscard() {
    return !state.modified || window.confirm('저장하지 않은 변경 사항이 있습니다. 버리고 계속할까요?');
  }

  /* ---------- Sidebar / theme / zoom ---------- */

  function setSidebar(open) {
    state.sidebarOpen = open;
    el.sidebar.classList.toggle('collapsed', !open);
    $('#btn-sidebar').classList.toggle('active', open);
  }

  async function setTheme(theme, { persist = true } = {}) {
    state.theme = theme;
    el.body.dataset.theme = theme;
    el.iconMoon.classList.toggle('hidden', theme === 'dark');
    el.iconSun.classList.toggle('hidden', theme !== 'dark');
    if (persist) await window.api.setSettings({ theme });
    // Mermaid diagrams bake theme colors in — re-render the document if any exist.
    if (state.path && el.content.querySelector('.mermaid')) {
      await display(state.path, state.raw, { keepScroll: true, fromDisk: false });
    }
  }

  function setZoom(level, { persist = true } = {}) {
    state.zoom = Math.max(-4, Math.min(6, level));
    window.api.setZoom(state.zoom);
    if (persist) window.api.setSettings({ zoom: state.zoom });
  }

  /* ---------- Find ---------- */

  let findOpen = false;

  function openFind() {
    findOpen = true;
    el.findBar.classList.remove('hidden');
    el.findInput.focus();
    el.findInput.select();
  }

  function closeFind() {
    findOpen = false;
    el.findBar.classList.add('hidden');
    el.findCount.textContent = '';
    window.api.findStop('clearSelection');
  }

  el.findInput.addEventListener('input', () => {
    const text = el.findInput.value;
    if (text) window.api.findStart(text, true, false);
    else {
      el.findCount.textContent = '';
      window.api.findStop('clearSelection');
    }
  });

  el.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (el.findInput.value) window.api.findStart(el.findInput.value, !e.shiftKey, true);
    }
  });

  $('#find-next').addEventListener('click', () => {
    if (el.findInput.value) window.api.findStart(el.findInput.value, true, true);
  });
  $('#find-prev').addEventListener('click', () => {
    if (el.findInput.value) window.api.findStart(el.findInput.value, false, true);
  });
  $('#find-close').addEventListener('click', closeFind);

  window.api.onFindResult(({ activeMatchOrdinal, matches }) => {
    el.findCount.textContent = matches > 0 ? `${activeMatchOrdinal}/${matches}` : '없음';
  });

  /* ---------- Drag & drop ---------- */

  let dragDepth = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
      el.dropOverlay.classList.remove('hidden');
    }
  });
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) el.dropOverlay.classList.add('hidden');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    el.dropOverlay.classList.add('hidden');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const p = window.api.pathForFile(file);
    if (p) openPath(p);
  });

  /* ---------- Buttons ---------- */

  $('#btn-open').addEventListener('click', openViaDialog);
  $('#welcome-open').addEventListener('click', openViaDialog);
  $('#btn-sidebar').addEventListener('click', () => setSidebar(!state.sidebarOpen));
  $('#btn-source').addEventListener('click', () => setSourceMode(!state.sourceMode));
  $('#btn-search').addEventListener('click', () => (findOpen ? closeFind() : openFind()));
  $('#btn-theme').addEventListener('click', () =>
    setTheme(state.theme === 'dark' ? 'light' : 'dark')
  );
  $('#btn-pdf').addEventListener('click', exportPdf);
  el.statusPath.addEventListener('click', () => {
    if (state.path) window.api.showInFolder(state.path);
  });

  async function exportPdf() {
    if (!state.path) {
      toast('먼저 파일을 열어주세요');
      return;
    }
    if (state.sourceMode) setSourceMode(false);
    const name = window.api.basename(state.path).replace(/\.[^.]+$/, '') + '.pdf';
    toast('PDF 생성 중…', 8000);
    const res = await window.api.exportPdf(name);
    if (res.ok) toast(`저장됨: ${res.path}`);
    else if (!res.canceled) toast(`내보내기 실패: ${res.message}`);
    else el.toast.classList.add('hidden');
  }

  /* ---------- Keyboard shortcuts ---------- */

  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape' && findOpen) {
      closeFind();
      return;
    }
    if (!ctrl) return;
    switch (e.key.toLowerCase()) {
      case 'o':
        e.preventDefault();
        openViaDialog();
        break;
      case 'f':
        e.preventDefault();
        openFind();
        break;
      case 'b':
        e.preventDefault();
        setSidebar(!state.sidebarOpen);
        break;
      case 'e':
        e.preventDefault();
        setSourceMode(!state.sourceMode);
        break;
      case 's':
        e.preventDefault();
        saveFile();
        break;
      case 'p':
        e.preventDefault();
        exportPdf();
        break;
      case 'l':
        if (e.shiftKey) {
          e.preventDefault();
          setTheme(state.theme === 'dark' ? 'light' : 'dark');
        }
        break;
      case '=':
      case '+':
        e.preventDefault();
        setZoom(state.zoom + 0.5);
        break;
      case '-':
        e.preventDefault();
        setZoom(state.zoom - 0.5);
        break;
      case '0':
        e.preventDefault();
        setZoom(0);
        break;
    }
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(state.zoom + (e.deltaY < 0 ? 0.5 : -0.5));
    },
    { passive: false }
  );

  /* ---------- Main-process events ---------- */

  window.api.onOpenFile(({ path, content }) => {
    if (!confirmDiscard()) return;
    display(path, content);
  });

  window.api.onFileChanged(({ path, content }) => {
    if (path !== state.path) return;
    if (suppressWatch > 0) return;
    if (state.modified) {
      toast('파일이 디스크에서 변경되었지만, 저장하지 않은 편집이 있어 반영하지 않았습니다');
      return;
    }
    if (state.sourceMode) {
      el.editor.value = content;
      state.raw = content;
      state.savedRaw = content;
    } else {
      display(path, content, { keepScroll: true });
    }
    el.dot.classList.add('flash');
    setTimeout(() => el.dot.classList.remove('flash'), 1200);
  });

  window.api.onOpenError(({ message }) => toast(`파일을 열 수 없습니다: ${message}`));

  /* ---------- Init ---------- */

  (async () => {
    document.body.classList.add('platform-' + window.api.platform);
    const s = await window.api.getSettings();
    await setTheme(s.theme || 'light', { persist: false });
    if (typeof s.zoom === 'number') setZoom(s.zoom, { persist: false });
    refreshRecent();
  })();
})();
