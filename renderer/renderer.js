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
    filebar: $('#filebar'),
    fbTree: $('#fb-tree'),
    fbResults: $('#fb-results'),
    fbSearch: $('#fb-search'),
    fbRecentList: $('#fb-recent-list'),
    fbFolder: $('#fb-folder'),
    lightbox: $('#img-lightbox'),
    lightboxImg: $('#lightbox-img'),
    hlBar: $('#hl-bar'),
  };

  const state = {
    path: null,
    raw: null,
    savedRaw: null,
    modified: false,
    sourceMode: false,
    theme: 'light',
    zoom: 0,
    font: 'pretendard',
    fontScale: 1,
    contentWidth: 47,
    lang: 'ko',
    maximized: false,
    sidebarOpen: false,
    filebarOpen: false,
    headings: [],
  };

  // Per-file scroll fraction, remembered across sessions (loaded from settings).
  let scrollMem = {};

  // Undo/redo history for edits made in the rendered view (highlights,
  // checkboxes). Each entry is a full source snapshot. Source-editor typing has
  // its own native undo, so these are separate.
  let undoStack = [];
  let redoStack = [];

  /* ---------- Localization ---------- */

  const I18N = {
    ko: {
      ttSidebar: '목차 (Ctrl+B)', ttOpen: '파일 열기 (Ctrl+O)', ttSource: '원문 보기/편집 (Ctrl+E)',
      ttSave: '저장 (Ctrl+S)', ttFind: '찾기 (Ctrl+F)', ttPdf: 'PDF로 내보내기 (Ctrl+P)', ttFont: '글꼴', ttSettings: '설정',
      ttTheme: '테마 전환 (Ctrl+Shift+L)', ttMinimize: '최소화', ttMaximize: '최대화', ttRestore: '이전 크기로',
      ttClose: '닫기', secBundledFonts: '기본 글꼴', fontSystem: '시스템 기본', secSystemFonts: '내 컴퓨터 글꼴',
      phFontSearch: '설치된 글꼴 검색…', secFontSize: '글자 크기', ttSmaller: '작게', ttLarger: '크게',
      secContentWidth: '본문 너비', ttNarrower: '좁게', ttWider: '넓게', secLanguage: '언어 / Language',
      phFind: '찾기…', ttFindPrev: '이전 (Shift+Enter)', ttFindNext: '다음 (Enter)', ttFindClose: '닫기 (Esc)',
      outline: '목차', welcomeSub: '마크다운 파일을 열거나 창으로 끌어다 놓으세요', openFile: '파일 열기',
      recentFiles: '최근 파일', ttShowInFolder: '클릭하면 폴더에서 보기', dropHere: '파일을 놓아서 열기',
      ttFiles: '파일 목록', files: '파일', ttHighlight: '형광펜 (Ctrl+H)', ttHlRemove: '형광펜 지우기',
      ttExport: '내보내기', secExport: '내보내기', exportPdf: 'PDF로 내보내기', exportHtml: 'HTML로 내보내기', copyRendered: '서식 유지하여 복사',
      fbNoFolder: '파일을 열면 이 폴더의 문서가 여기 표시됩니다',
      phFbSearch: '파일 검색…', fbNoMatch: '일치하는 파일이 없습니다',
      toastCopied: '복사됨 (서식 유지)', toastHtmlSaved: '저장됨: {0}', toastHtmlFail: '내보내기 실패: {0}',
      toastNoSelection: '먼저 형광펜 칠할 텍스트를 선택하세요', toastHlFail: '선택한 부분을 원문에서 찾지 못했습니다',
      outlineEmpty: '제목이 없습니다', stats: '{0} 단어 · {1} 글자 · 약 {2}분', findNone: '없음',
      dotModified: '저장되지 않은 변경 (Ctrl+S)', dotChanged: '파일이 변경되어 새로고침됨',
      toastOpenFirst: '먼저 파일을 열어주세요', toastCopyFail: '복사에 실패했습니다', toastSaved: '저장됨',
      toastNoChanges: '저장할 변경 사항이 없습니다', toastSaveFail: '저장 실패: {0}', toastPdfGen: 'PDF 생성 중…',
      toastPdfSaved: '저장됨: {0}', toastPdfFail: '내보내기 실패: {0}', toastOpenFail: '파일을 열 수 없습니다: {0}',
      toastOpenFailMoved: '파일을 열 수 없습니다 (이동 또는 삭제됨)',
      toastWatchModified: '파일이 디스크에서 변경되었지만, 저장하지 않은 편집이 있어 반영하지 않았습니다',
      fontListFail: '글꼴 목록을 불러올 수 없습니다', fontLoading: '글꼴 불러오는 중…',
      confirmDiscard: '저장하지 않은 변경 사항이 있습니다. 버리고 계속할까요?',
      copy: '복사', coNOTE: '노트', coTIP: '팁', coIMPORTANT: '중요', coWARNING: '주의', coCAUTION: '경고',
    },
    en: {
      ttSidebar: 'Outline (Ctrl+B)', ttOpen: 'Open file (Ctrl+O)', ttSource: 'Source view / edit (Ctrl+E)',
      ttSave: 'Save (Ctrl+S)', ttFind: 'Find (Ctrl+F)', ttPdf: 'Export to PDF (Ctrl+P)', ttFont: 'Font', ttSettings: 'Settings',
      ttTheme: 'Toggle theme (Ctrl+Shift+L)', ttMinimize: 'Minimize', ttMaximize: 'Maximize', ttRestore: 'Restore',
      ttClose: 'Close', secBundledFonts: 'Bundled fonts', fontSystem: 'System default', secSystemFonts: 'Installed fonts',
      phFontSearch: 'Search installed fonts…', secFontSize: 'Font size', ttSmaller: 'Smaller', ttLarger: 'Larger',
      secContentWidth: 'Content width', ttNarrower: 'Narrower', ttWider: 'Wider', secLanguage: '언어 / Language',
      phFind: 'Find…', ttFindPrev: 'Previous (Shift+Enter)', ttFindNext: 'Next (Enter)', ttFindClose: 'Close (Esc)',
      outline: 'Outline', welcomeSub: 'Open a markdown file, or drag one onto the window', openFile: 'Open File',
      recentFiles: 'Recent files', ttShowInFolder: 'Click to show in folder', dropHere: 'Drop to open',
      ttFiles: 'Files', files: 'Files', ttHighlight: 'Highlight (Ctrl+H)', ttHlRemove: 'Remove highlight',
      ttExport: 'Export', secExport: 'Export', exportPdf: 'Export to PDF', exportHtml: 'Export to HTML', copyRendered: 'Copy with formatting',
      fbNoFolder: 'Open a file to browse its folder here',
      phFbSearch: 'Search files…', fbNoMatch: 'No matching files',
      toastCopied: 'Copied (with formatting)', toastHtmlSaved: 'Saved: {0}', toastHtmlFail: 'Export failed: {0}',
      toastNoSelection: 'Select the text you want to highlight first', toastHlFail: "Couldn't find the selection in the source",
      outlineEmpty: 'No headings', stats: '{0} words · {1} chars · ~{2} min', findNone: 'No results',
      dotModified: 'Unsaved changes (Ctrl+S)', dotChanged: 'File changed on disk — reloaded',
      toastOpenFirst: 'Open a file first', toastCopyFail: 'Copy failed', toastSaved: 'Saved',
      toastNoChanges: 'No changes to save', toastSaveFail: 'Save failed: {0}', toastPdfGen: 'Generating PDF…',
      toastPdfSaved: 'Saved: {0}', toastPdfFail: 'Export failed: {0}', toastOpenFail: 'Could not open file: {0}',
      toastOpenFailMoved: 'Could not open file (moved or deleted)',
      toastWatchModified: 'The file changed on disk, but your unsaved edits were kept',
      fontListFail: 'Could not load font list', fontLoading: 'Loading fonts…',
      confirmDiscard: 'You have unsaved changes. Discard and continue?',
      copy: 'Copy', coNOTE: 'Note', coTIP: 'Tip', coIMPORTANT: 'Important', coWARNING: 'Warning', coCAUTION: 'Caution',
    },
  };

  function t(key, ...args) {
    let s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.ko[key] || key;
    args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
    return s;
  }

  function applyLang(l, { persist = true } = {}) {
    state.lang = l === 'en' ? 'en' : 'ko';
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
    document.querySelectorAll('.fm-lang').forEach((b) => b.classList.toggle('active', b.dataset.lang === state.lang));
    $('#wc-max').title = state.maximized ? t('ttRestore') : t('ttMaximize');
    el.dot.title = state.modified ? t('dotModified') : '';
    if (state.headings && state.headings.length === 0 && !el.content.classList.contains('hidden')) buildOutline();
    if (state.raw != null) updateStats();
    if (findOpen) updateFindCount();
    if (persist) window.api.setSettings({ lang: state.lang });
  }

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
      undoStack = [];
      redoStack = [];
      if (state.sourceMode) setSourceMode(false, { applyEdits: false, prompt: false });
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
    wireTaskCheckboxes();
    await runMermaid();
    updateStats();

    const name = window.api.basename(path);
    el.title.textContent = name;
    document.title = `${name} — Mymd`;
    el.statusPath.textContent = path;

    if (keepScroll) {
      el.scroll.scrollTop = prevScroll;
    } else if (fromDisk && scrollMem[path]) {
      restoreScrollFraction(scrollMem[path]); // reopen where we left off
    } else {
      el.scroll.scrollTop = 0;
    }
    updateScrollSpy();
    if (state.filebarOpen && window.api.dirname(path) !== fbRoot) buildFilebar();
    else updateFilebarActive();
    if (findOpen) runFind(el.findInput.value); // re-index matches against fresh DOM
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
      empty.textContent = t('outlineEmpty');
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
      btn.title = t('copy');
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
          toast(t('toastCopyFail'));
        }
      });
      block.appendChild(btn);
    });
  }

  const CALLOUT_ICONS = { NOTE: 'ℹ', TIP: '💡', IMPORTANT: '❗', WARNING: '⚠', CAUTION: '🛑' };

  function transformCallouts() {
    el.content.querySelectorAll('blockquote').forEach((bq) => {
      const first = bq.querySelector('p');
      if (!first) return;
      const m = first.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
      if (!m) return;
      const type = m[1];
      const div = document.createElement('div');
      div.className = `callout callout-${type.toLowerCase()}`;
      const title = document.createElement('div');
      title.className = 'callout-title';
      title.textContent = `${CALLOUT_ICONS[type]} ${t('co' + type)}`;
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
    el.statusStats.textContent = t('stats', words.toLocaleString(), chars.toLocaleString(), minutes);
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
    rememberScroll();
    hideHlBar();
    if (spyTimer) return;
    spyTimer = setTimeout(() => {
      spyTimer = null;
      updateScrollSpy();
    }, 80);
  });

  /* ---------- Scroll position memory (per file) ---------- */

  let scrollSaveTimer = null;
  function rememberScroll() {
    if (!state.path || state.sourceMode) return; // only track the rendered view
    scrollMem[state.path] = scrollFraction();
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(persistScroll, 700);
  }
  function persistScroll() {
    const keys = Object.keys(scrollMem);
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete scrollMem[k]);
    window.api.setSettings({ scroll: scrollMem });
  }
  window.addEventListener('beforeunload', () => {
    if (state.path && !state.sourceMode) scrollMem[state.path] = scrollFraction();
    persistScroll();
  });

  /* ---------- File opening ---------- */

  // A file may open in a new window (returns null) or, when this is still the
  // empty welcome window, render here in place (returns { path, content }).
  async function openViaDialog() {
    try {
      const res = await window.api.openDialog();
      if (res) await display(res.path, res.content);
    } catch (err) {
      toast(t('toastOpenFail', err.message));
    }
  }

  async function openPath(p) {
    try {
      const res = await window.api.openFile(p);
      if (res) await display(res.path, res.content);
    } catch {
      toast(t('toastOpenFailMoved'));
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

  /* ---------- In-view editing helpers ---------- */

  function samePath(a, b) {
    if (!a || !b) return false;
    return window.api.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  }

  // Apply an edited source string: snapshot for undo, sync the editor, mark
  // modified, and re-render (unless in source mode, where the editor already
  // shows the text).
  async function applyRawEdit(newRaw, { rerender = true } = {}) {
    undoStack.push(state.raw);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    state.raw = newRaw;
    el.editor.value = newRaw;
    setModified(state.raw !== state.savedRaw);
    if (rerender && !state.sourceMode) {
      await display(state.path, state.raw, { keepScroll: true, fromDisk: false });
    }
  }

  async function undoEdit() {
    if (state.sourceMode || !undoStack.length) return; // textarea has native undo
    redoStack.push(state.raw);
    state.raw = undoStack.pop();
    el.editor.value = state.raw;
    setModified(state.raw !== state.savedRaw);
    await display(state.path, state.raw, { keepScroll: true, fromDisk: false });
  }

  async function redoEdit() {
    if (state.sourceMode || !redoStack.length) return;
    undoStack.push(state.raw);
    state.raw = redoStack.pop();
    el.editor.value = state.raw;
    setModified(state.raw !== state.savedRaw);
    await display(state.path, state.raw, { keepScroll: true, fromDisk: false });
  }

  /* ---------- Task-list checkbox toggle ---------- */

  function wireTaskCheckboxes() {
    el.content.querySelectorAll('.task-list-item input[type="checkbox"]').forEach((cb, i) => {
      cb.dataset.taskIndex = String(i);
      cb.addEventListener('change', onTaskToggle);
    });
  }

  // The Nth checkbox in the document maps to the Nth task marker in the source.
  function onTaskToggle(e) {
    const cb = e.currentTarget;
    const index = Number(cb.dataset.taskIndex);
    let i = 0;
    const re = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])(\])/gm;
    const newRaw = state.raw.replace(re, (m, pre, mk, post) =>
      i++ === index ? pre + (cb.checked ? 'x' : ' ') + post : m
    );
    applyRawEdit(newRaw, { rerender: false }); // native toggle already updated the DOM
  }

  /* ---------- Highlighter (== ==) ---------- */

  // Char offset of (node, offset) within root.textContent.
  function textOffsetWithin(root, node, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let n;
    while ((n = walker.nextNode())) {
      if (n === node) return acc + offset;
      acc += n.nodeValue.length;
    }
    return acc;
  }

  // Byte-independent start offset of every source line, so a block's data-line
  // (a line number) maps to a char offset in our own copy of the source.
  function lineStartOffsets(text) {
    const offs = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') offs.push(i + 1);
    return offs;
  }

  // Align a block's rendered text to its markdown source, char by char, and
  // return map[i] = source index of the i-th rendered char (or -1 if it can't
  // be placed). Rendered text is essentially the source with markdown syntax
  // (**, [], `, <tags>, …) removed, so we walk the source skipping those. This
  // lets the highlighter map a selection to an exact source range even when it
  // overlaps bold/italic/links/code — the wrapped range simply includes that
  // syntax (e.g. **==foo==**). Whitespace is matched loosely (rendered \n / a
  // space matches any source whitespace run) to absorb \r\n and soft wraps.
  function alignRenderedToSource(rendered, source) {
    const map = new Array(rendered.length).fill(-1);
    let j = 0;
    for (let i = 0; i < rendered.length; i++) {
      const rc = rendered[i];
      if (/\s/.test(rc)) {
        let k = j;
        while (k < source.length && !/\s/.test(source[k])) k++;
        map[i] = k < source.length ? k : Math.max(0, source.length - 1);
        j = k;
        while (j < source.length && /\s/.test(source[j])) j++;
      } else {
        let k = j;
        while (k < source.length && source[k] !== rc) k++;
        if (k < source.length) { map[i] = k; j = k + 1; }
        // else leave -1: this rendered char isn't in the remaining source
      }
    }
    return map;
  }

  // Source char range [bs, be) of the nearest block (data-line) containing node.
  function blockSourceRange(node) {
    let e = node.nodeType === 3 ? node.parentElement : node;
    e = e && e.closest ? e.closest('[data-line]') : null;
    if (!e || !el.content.contains(e)) return null;
    const startLine = parseInt(e.getAttribute('data-line'), 10);
    const endLine = parseInt(e.getAttribute('data-line-end'), 10);
    if (Number.isNaN(startLine)) return null;
    const offs = lineStartOffsets(state.raw);
    const bs = startLine < offs.length ? offs[startLine] : 0;
    const be = !Number.isNaN(endLine) && endLine < offs.length ? offs[endLine] : state.raw.length;
    return { el: e, bs, be };
  }

  // Apply / recolor / remove a highlight over the current selection, editing the
  // source so it survives reload. `color` is yellow | green | pink | blue |
  // remove. Yellow uses portable ==marks==; other colors use <mark class="mk-…">.
  // Picking the same color again toggles it off.
  //
  // The selection is scoped to the block it lands in (via data-line) and mapped
  // to an exact source range by char-aligning that block's rendered text to its
  // source. This works even when the selection overlaps inline formatting, and
  // uses the real selection position (not text search) so repeats never confuse
  // it.
  async function applyHighlight(color) {
    if (state.sourceMode || !state.path) { toast(t('toastNoSelection')); return; }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { toast(t('toastNoSelection')); return; }
    const range = sel.getRangeAt(0);
    if (!el.content.contains(range.commonAncestorContainer)) { toast(t('toastNoSelection')); return; }

    const block = blockSourceRange(range.startContainer);
    if (!block) { toast(t('toastHlFail')); return; }
    const raw = state.raw;
    const rendered = block.el.textContent;
    const source = raw.slice(block.bs, block.be);

    // Selection bounds as offsets into the block's rendered text.
    let a = textOffsetWithin(block.el, range.startContainer, range.startOffset);
    let b = textOffsetWithin(block.el, range.endContainer, range.endOffset);
    if (b < a) [a, b] = [b, a];
    b = Math.min(b, rendered.length);
    while (a < b && /\s/.test(rendered[a])) a++; // trim whitespace at the edges
    while (b > a && /\s/.test(rendered[b - 1])) b--;
    if (a >= b) { toast(t('toastNoSelection')); return; }

    const map = alignRenderedToSource(rendered, source);
    const s0 = map[a];
    const s1 = map[b - 1];
    if (s0 < 0 || s1 < 0) { toast(t('toastHlFail')); return; }
    let srcStart = block.bs + s0;
    let srcEnd = block.bs + s1 + 1;
    if (srcEnd <= srcStart) { toast(t('toastHlFail')); return; }

    // Keep the wrapped range from splitting inline formatting, which would
    // produce broken markup (e.g. **==bold** → literal ==). Inline code is
    // verbatim, so wrap outside its backticks; for emphasis/strike, expand the
    // range just enough over adjacent delimiters to keep them balanced.
    const balanced = (s) =>
      (s.match(/\*\*/g) || []).length % 2 === 0 &&
      (s.replace(/\*\*/g, '').match(/\*/g) || []).length % 2 === 0 &&
      (s.match(/~~/g) || []).length % 2 === 0 &&
      (s.match(/`/g) || []).length % 2 === 0;
    let codeEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    codeEl = codeEl && codeEl.closest ? codeEl.closest('code') : null;
    if (codeEl && codeEl.contains(range.endContainer) && el.content.contains(codeEl)) {
      while (srcStart > block.bs && raw[srcStart - 1] === '`') srcStart--;
      while (srcEnd < block.be && raw[srcEnd] === '`') srcEnd++;
    } else if (!balanced(raw.slice(srcStart, srcEnd))) {
      const DELIM = /[*~`]/;
      let ls = srcStart;
      while (ls > block.bs && DELIM.test(raw[ls - 1])) ls--;
      let re = srcEnd;
      while (re < block.be && DELIM.test(raw[re])) re++;
      for (const [a2, b2] of [[ls, srcEnd], [srcStart, re], [ls, re]]) {
        if (balanced(raw.slice(a2, b2))) { srcStart = a2; srcEnd = b2; break; }
      }
    }
    const text = raw.slice(srcStart, srcEnd); // exact source (may include inline syntax / a soft wrap)

    // Detect an existing wrapper around this range: == == or <mark …>.
    let wrapStart = -1;
    let wrapEnd = -1;
    let curColor = null;
    if (raw.slice(srcStart - 2, srcStart) === '==' && raw.slice(srcEnd, srcEnd + 2) === '==') {
      wrapStart = srcStart - 2;
      wrapEnd = srcEnd + 2;
      curColor = 'yellow';
    } else {
      const openTag = raw.slice(0, srcStart).match(/<mark\b([^>]*)>$/i);
      if (openTag && /^<\/mark>/i.test(raw.slice(srcEnd))) {
        wrapStart = srcStart - openTag[0].length;
        wrapEnd = srcEnd + '</mark>'.length;
        curColor = (openTag[1].match(/class\s*=\s*["']mk-(\w+)["']/i) || [])[1] || 'yellow';
      }
    }
    const wrapped = wrapStart !== -1;
    const wrap = (co) => (co === 'yellow' ? `==${text}==` : `<mark class="mk-${co}">${text}</mark>`);

    let newRaw;
    if (color === 'remove' || (wrapped && curColor === color)) {
      if (!wrapped) { sel.removeAllRanges(); hideHlBar(); return; }
      newRaw = raw.slice(0, wrapStart) + text + raw.slice(wrapEnd);
    } else if (wrapped) {
      newRaw = raw.slice(0, wrapStart) + wrap(color) + raw.slice(wrapEnd);
    } else {
      newRaw = raw.slice(0, srcStart) + wrap(color) + raw.slice(srcEnd);
    }
    sel.removeAllRanges();
    hideHlBar();
    await applyRawEdit(newRaw);
  }

  /* ---------- Floating highlight palette ---------- */

  function hideHlBar() {
    el.hlBar.classList.add('hidden');
  }

  function showHlBar() {
    if (state.sourceMode) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideHlBar(); return; }
    const range = sel.getRangeAt(0);
    if (!el.content.contains(range.commonAncestorContainer) || !sel.toString().trim()) {
      hideHlBar();
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) { hideHlBar(); return; }
    el.hlBar.classList.remove('hidden');
    const bw = el.hlBar.offsetWidth;
    const bh = el.hlBar.offsetHeight;
    let left = rect.left + rect.width / 2 - bw / 2;
    left = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
    let top = rect.top - bh - 8;
    if (top < 46) top = rect.bottom + 8; // flip below when near the titlebar
    el.hlBar.style.left = left + 'px';
    el.hlBar.style.top = top + 'px';
  }

  el.content.addEventListener('mouseup', () => setTimeout(showHlBar, 0));
  el.hlBar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
  el.hlBar.querySelectorAll('[data-color]').forEach((b) => {
    b.addEventListener('click', () => applyHighlight(b.dataset.color));
  });
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideHlBar();
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#hl-bar')) hideHlBar();
  });
  // Right-click on a selection paints it with the default (yellow) highlight.
  el.content.addEventListener('contextmenu', (e) => {
    const sel = window.getSelection();
    if (state.sourceMode || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    if (!el.content.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    e.preventDefault();
    applyHighlight('yellow');
  });

  /* ---------- Image lightbox ---------- */

  function openLightbox(src) {
    el.lightboxImg.src = src;
    el.lightbox.classList.remove('hidden');
  }
  function closeLightbox() {
    el.lightbox.classList.add('hidden');
    el.lightboxImg.removeAttribute('src');
  }
  el.lightbox.addEventListener('click', closeLightbox);
  el.content.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (img && !img.closest('a')) {
      e.preventDefault();
      openLightbox(img.currentSrc || img.src);
    }
  });

  /* ---------- Export HTML / copy rendered ---------- */

  async function exportHtmlNow() {
    if (!state.path) { toast(t('toastOpenFirst')); return; }
    if (state.sourceMode) await setSourceMode(false);
    const title = window.api.basename(state.path).replace(/\.[^.]+$/, '');
    const res = await window.api.exportHtml({
      content: el.content.innerHTML,
      theme: state.theme,
      title,
      contentWidth: state.contentWidth,
      fontScale: state.fontScale,
    });
    if (res.ok) toast(t('toastHtmlSaved', res.path));
    else if (!res.canceled) toast(t('toastHtmlFail', res.message));
  }

  async function copyRendered() {
    if (!state.path || state.sourceMode) { toast(t('toastOpenFirst')); return; }
    try {
      const html = el.content.innerHTML;
      const text = el.content.innerText;
      if (window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast(t('toastCopied'));
    } catch {
      toast(t('toastCopyFail'));
    }
  }

  /* ---------- File-explorer sidebar ---------- */

  let fbRoot = null;
  let fbAll = []; // recursive md-file index for search
  let fbAllRoot = null;

  function setFilebar(open) {
    state.filebarOpen = open;
    el.filebar.classList.toggle('collapsed', !open);
    $('#btn-files').classList.toggle('active', open);
    if (open) {
      setSidebar(false);
      buildFilebar();
    }
  }

  async function buildFilebar() {
    refreshFbRecent();
    el.fbSearch.value = '';
    el.fbResults.classList.add('hidden');
    el.fbResults.innerHTML = '';
    el.fbTree.classList.remove('hidden');
    el.fbTree.innerHTML = '';
    const root = state.path ? window.api.dirname(state.path) : null;
    fbRoot = root;
    el.fbFolder.textContent = t('files');
    if (!root) {
      el.fbTree.innerHTML = `<div class="fb-empty">${t('fbNoFolder')}</div>`;
      return;
    }
    const entries = await window.api.listDir(root);
    // Show the current directory itself as an expandable root node, so you can
    // always see which folder you're in (full path on hover) — even a leaf
    // folder no longer looks like a bare file list.
    const rootRow = document.createElement('div');
    rootRow.className = 'fb-row fb-dir fb-root expanded';
    rootRow.dataset.path = root;
    rootRow.title = root;
    rootRow.style.paddingLeft = '8px';
    const caret = document.createElement('span');
    caret.className = 'fb-caret';
    caret.textContent = '▶';
    const ico = document.createElement('span');
    ico.className = 'fb-ico';
    ico.innerHTML = FB_ICON.dir;
    const name = document.createElement('span');
    name.className = 'fb-name';
    name.textContent = window.api.basename(root) || root;
    rootRow.append(caret, ico, name);
    const kids = document.createElement('div');
    kids.className = 'fb-children';
    renderTreeEntries(kids, entries, 1);
    rootRow.addEventListener('click', () => {
      const opening = kids.hidden;
      kids.hidden = !opening;
      rootRow.classList.toggle('expanded', opening);
    });
    el.fbTree.append(rootRow, kids);
  }

  // Build (once per folder) the recursive index used by the search box.
  async function ensureFbIndex() {
    if (fbAllRoot === fbRoot && fbAll.length) return;
    fbAllRoot = fbRoot;
    fbAll = fbRoot ? await window.api.listAllFiles(fbRoot) : [];
  }

  async function fbSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      el.fbResults.classList.add('hidden');
      el.fbResults.innerHTML = '';
      el.fbTree.classList.remove('hidden');
      return;
    }
    await ensureFbIndex();
    el.fbTree.classList.add('hidden');
    el.fbResults.classList.remove('hidden');
    el.fbResults.innerHTML = '';
    const matches = fbAll
      .filter((f) => f.name.toLowerCase().includes(q) || f.rel.toLowerCase().includes(q))
      .slice(0, 300);
    if (!matches.length) {
      el.fbResults.innerHTML = `<div class="fb-empty">${t('fbNoMatch')}</div>`;
      return;
    }
    for (const f of matches) {
      const row = document.createElement('div');
      row.className = 'fb-row fb-file' + (samePath(f.path, state.path) ? ' active' : '');
      row.dataset.path = f.path;
      row.title = f.rel;
      const ico = document.createElement('span');
      ico.className = 'fb-ico';
      ico.innerHTML = FB_ICON.file;
      const name = document.createElement('span');
      name.className = 'fb-name';
      name.textContent = f.name;
      row.append(ico, name);
      const dir = f.rel.slice(0, f.rel.length - f.name.length).replace(/[\\/]+$/, '');
      if (dir) {
        const rel = document.createElement('span');
        rel.className = 'fb-rel';
        rel.textContent = dir;
        row.append(rel);
      }
      row.addEventListener('click', () => openPath(f.path));
      el.fbResults.appendChild(row);
    }
  }

  const FB_ICON = {
    dir: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M1.75 3A1.75 1.75 0 0 0 0 4.75v6.5C0 12.2.8 13 1.75 13h12.5A1.75 1.75 0 0 0 16 11.25v-5.5A1.75 1.75 0 0 0 14.25 4H7.4L6.15 2.68A1.5 1.5 0 0 0 5.06 2.2H1.75Z"/></svg>',
    file: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.62a1.5 1.5 0 0 0-.44-1.06l-2.62-2.62A1.5 1.5 0 0 0 9.38 1.5H4Z" opacity=".85"/></svg>',
  };

  function renderTreeEntries(container, entries, depth) {
    for (const ent of entries) {
      const row = document.createElement('div');
      row.className = 'fb-row ' + (ent.isDir ? 'fb-dir' : 'fb-file');
      row.style.paddingLeft = 8 + depth * 14 + 'px';
      row.dataset.path = ent.path;
      row.title = ent.name;
      if (!ent.isDir && samePath(ent.path, state.path)) row.classList.add('active');

      const caret = document.createElement('span');
      caret.className = 'fb-caret';
      caret.textContent = ent.isDir ? '▶' : '';
      const ico = document.createElement('span');
      ico.className = 'fb-ico';
      ico.innerHTML = ent.isDir ? FB_ICON.dir : FB_ICON.file;
      const name = document.createElement('span');
      name.className = 'fb-name';
      name.textContent = ent.name;
      row.append(caret, ico, name);

      if (ent.isDir) {
        const kids = document.createElement('div');
        kids.className = 'fb-children';
        kids.hidden = true;
        let loaded = false;
        row.addEventListener('click', async () => {
          const opening = kids.hidden;
          kids.hidden = !opening;
          row.classList.toggle('expanded', opening);
          if (opening && !loaded) {
            loaded = true;
            const sub = await window.api.listDir(ent.path);
            renderTreeEntries(kids, sub, depth + 1);
          }
        });
        container.append(row, kids);
      } else {
        row.addEventListener('click', () => openPath(ent.path));
        container.append(row);
      }
    }
  }

  function updateFilebarActive() {
    if (!state.filebarOpen) return;
    el.filebar.querySelectorAll('.fb-row.fb-file[data-path]').forEach((r) => {
      r.classList.toggle('active', samePath(r.dataset.path, state.path));
    });
    el.fbRecentList.querySelectorAll('button[data-path]').forEach((b) => {
      b.classList.toggle('active', samePath(b.dataset.path, state.path));
    });
  }

  async function refreshFbRecent() {
    const s = await window.api.getSettings();
    const recent = (s.recent || []).slice(0, 10);
    el.fbRecentList.innerHTML = '';
    for (const p of recent) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.dataset.path = p;
      btn.title = p;
      const name = document.createElement('span');
      name.className = 'fb-recent-name';
      name.textContent = window.api.basename(p);
      btn.appendChild(name);
      if (samePath(p, state.path)) btn.classList.add('active');
      btn.addEventListener('click', () => openPath(p));
      li.appendChild(btn);
      el.fbRecentList.appendChild(li);
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
    el.dot.title = on ? t('dotModified') : '';
    $('#btn-save').disabled = !on;
    window.api.setDirty(on); // let main prompt on window close if unsaved
  }

  // Keep the same relative position when switching between rendered and source
  // views (their pixel heights differ, so map by scroll fraction).
  function scrollFraction() {
    const d = el.scroll.scrollHeight - el.scroll.clientHeight;
    return d > 0 ? el.scroll.scrollTop / d : 0;
  }
  function restoreScrollFraction(frac) {
    requestAnimationFrame(() => {
      const d = el.scroll.scrollHeight - el.scroll.clientHeight;
      el.scroll.scrollTop = frac * (d > 0 ? d : 0);
    });
  }

  async function setSourceMode(on, { applyEdits = true } = {}) {
    if (on && !state.path) {
      toast(t('toastOpenFirst'));
      return;
    }
    if (on === state.sourceMode) return;
    const frac = scrollFraction();

    state.sourceMode = on;
    $('#btn-source').classList.toggle('active', on);
    if (on) {
      if (findOpen) closeFind();
      el.editor.value = state.raw;
      el.content.classList.add('hidden');
      el.sourceView.classList.remove('hidden');
      el.editor.focus({ preventScroll: true });
      restoreScrollFraction(frac);
    } else {
      el.sourceView.classList.add('hidden');
      el.content.classList.remove('hidden');
      // Re-render so the viewer reflects the current source text, then keep the
      // same relative position. (applyEdits is false only for the internal
      // switch during a fresh file load, which manages its own scroll.)
      if (applyEdits) {
        await display(state.path, state.raw, { keepScroll: false, fromDisk: false });
        restoreScrollFraction(frac);
      }
    }
  }

  el.editor.addEventListener('input', () => {
    state.raw = el.editor.value;
    setModified(state.raw !== state.savedRaw);
    // Manual edits use the textarea's own undo; drop the rendered-view history.
    undoStack = [];
    redoStack = [];
  });

  el.editor.addEventListener('keydown', (e) => {
    const ta = el.editor;
    if (e.key === 'Tab') {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
      return;
    }
    // Enter → insert a real markdown hard break ("  \n") so the line break is
    // preserved when the file is opened in any other markdown viewer. Skipped
    // inside code fences and on structural lines (lists / headings / quotes /
    // tables), and when the line is empty or already ends with a hard break.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && ta.selectionStart === ta.selectionEnd) {
      const before = ta.value.slice(0, ta.selectionStart);
      const curLine = before.slice(before.lastIndexOf('\n') + 1);
      const inCodeFence = (before.match(/^```/gm) || []).length % 2 === 1;
      const structural = /^\s*([-*+]\s|\d+[.)]\s|#{1,6}\s|>|\||\t| {4,})/.test(curLine);
      const alreadyBreak = /(\s{2,}|\\)$/.test(curLine);
      if (curLine.trim() && !inCodeFence && !structural && !alreadyBreak) {
        e.preventDefault();
        ta.setRangeText('  \n', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    }
  });

  async function saveFile() {
    if (!state.path) return;
    if (!state.modified) {
      toast(t('toastNoChanges'));
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
      toast(t('toastSaved'));
    } catch (err) {
      toast(t('toastSaveFail', err.message));
    }
  }

  function confirmDiscard() {
    return !state.modified || window.confirm(t('confirmDiscard'));
  }

  /* ---------- Reading font ---------- */

  const FONTS = {
    pretendard: "'Pretendard', var(--font-sans)",
    'nanum-myeongjo': "'Nanum Myeongjo', serif",
    'gowun-dodum': "'Gowun Dodum', var(--font-sans)",
    // A genuine OS-font stack (deliberately without Pretendard) so it differs
    // from the Pretendard option.
    system: '"Segoe UI Variable Text", "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  };

  function fontStack(key) {
    if (key && key.startsWith('sys:')) return `"${key.slice(4)}", var(--font-sans)`;
    return FONTS[key] || FONTS.pretendard;
  }

  function applyFont(key, { persist = true } = {}) {
    if (!key || (!FONTS[key] && !key.startsWith('sys:'))) key = 'pretendard';
    state.font = key;
    el.body.style.setProperty('--reading-font', fontStack(key));
    document.querySelectorAll('.fm-item').forEach((it) => {
      it.classList.toggle('active', it.dataset.font === key);
    });
    document.querySelectorAll('.fm-sysitem').forEach((it) => {
      it.classList.toggle('active', 'sys:' + it.dataset.family === key);
    });
    if (persist) window.api.setSettings({ font: key });
  }

  function applyContentWidth(rem, { persist = true } = {}) {
    state.contentWidth = Math.max(34, Math.min(100, Math.round(rem)));
    el.body.style.setProperty('--content-w', state.contentWidth + 'rem');
    const val = $('#fm-width-val');
    if (val) val.textContent = Math.round(state.contentWidth * 16) + 'px';
    if (persist) window.api.setSettings({ contentWidth: state.contentWidth });
  }

  let sysFontsLoaded = false;
  async function loadSystemFonts() {
    if (sysFontsLoaded) return;
    sysFontsLoaded = true;
    const list = $('#fm-syslist');
    list.innerHTML = `<div class="fm-empty">${t('fontLoading')}</div>`;
    try {
      const fonts = await window.api.listFonts();
      if (!fonts || !fonts.length) {
        list.innerHTML = `<div class="fm-empty">${t('fontListFail')}</div>`;
        return;
      }
      list.innerHTML = '';
      for (const it of fonts) {
        // Back-compat: entries may be plain strings or { family, label }.
        const fam = typeof it === 'string' ? it : it.family;
        const label = typeof it === 'string' ? it : it.label || it.family;
        const btn = document.createElement('button');
        btn.className = 'fm-sysitem';
        btn.dataset.family = fam;
        btn.dataset.label = label;
        btn.textContent = label;
        btn.style.fontFamily = `"${fam}"`;
        btn.title = label === fam ? fam : `${label} · ${fam}`;
        if (state.font === 'sys:' + fam) btn.classList.add('active');
        btn.addEventListener('click', () => applyFont('sys:' + fam));
        list.appendChild(btn);
      }
    } catch {
      list.innerHTML = `<div class="fm-empty">${t('fontListFail')}</div>`;
    }
  }

  function filterSystemFonts(q) {
    const query = q.trim().toLowerCase();
    document.querySelectorAll('.fm-sysitem').forEach((it) => {
      const hay = (it.dataset.family + ' ' + (it.dataset.label || '')).toLowerCase();
      it.style.display = hay.includes(query) ? '' : 'none';
    });
  }

  function applyFontScale(scale, { persist = true } = {}) {
    state.fontScale = Math.max(0.8, Math.min(1.6, Math.round(scale * 100) / 100));
    el.body.style.setProperty('--reading-scale', String(state.fontScale));
    const val = $('#fm-size-val');
    if (val) val.textContent = Math.round(state.fontScale * 100) + '%';
    if (persist) window.api.setSettings({ fontScale: state.fontScale });
  }

  let fontMenuOpen = false;
  function toggleFontMenu(open) {
    fontMenuOpen = open ?? !fontMenuOpen;
    $('#font-menu').classList.toggle('hidden', !fontMenuOpen);
    $('#btn-font').classList.toggle('active', fontMenuOpen);
    if (fontMenuOpen) toggleExportMenu(false);
  }

  let exportMenuOpen = false;
  function toggleExportMenu(open) {
    exportMenuOpen = open ?? !exportMenuOpen;
    const m = $('#export-menu');
    m.classList.toggle('hidden', !exportMenuOpen);
    $('#btn-export').classList.toggle('active', exportMenuOpen);
    if (exportMenuOpen) {
      toggleFontMenu(false);
      const r = $('#btn-export').getBoundingClientRect();
      const w = m.offsetWidth || 200;
      m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    }
  }

  $('#btn-font').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFontMenu();
    if (fontMenuOpen) loadSystemFonts();
  });
  $('#fm-search').addEventListener('input', (e) => filterSystemFonts(e.target.value));
  $('#fm-search').addEventListener('click', (e) => e.stopPropagation());
  document.querySelectorAll('.fm-item').forEach((it) => {
    it.addEventListener('click', () => applyFont(it.dataset.font));
  });
  $('#fm-size-down').addEventListener('click', () => applyFontScale(state.fontScale - 0.1));
  $('#fm-size-up').addEventListener('click', () => applyFontScale(state.fontScale + 0.1));
  $('#fm-width-down').addEventListener('click', () => applyContentWidth(state.contentWidth - 4));
  $('#fm-width-up').addEventListener('click', () => applyContentWidth(state.contentWidth + 4));
  document.querySelectorAll('.fm-lang').forEach((b) => {
    b.addEventListener('click', () => applyLang(b.dataset.lang));
  });
  document.addEventListener('click', (e) => {
    if (fontMenuOpen && !e.target.closest('#font-menu') && !e.target.closest('#btn-font')) {
      toggleFontMenu(false);
    }
    if (exportMenuOpen && !e.target.closest('#export-menu') && !e.target.closest('#btn-export')) {
      toggleExportMenu(false);
    }
  });

  /* ---------- Sidebar / theme / zoom ---------- */

  function setSidebar(open) {
    state.sidebarOpen = open;
    el.sidebar.classList.toggle('collapsed', !open);
    $('#btn-sidebar').classList.toggle('active', open);
    if (open) setFilebar(false);
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

  /* ---------- Find (searches only the rendered markdown) ---------- */

  let findOpen = false;
  let findRanges = [];
  let findIndex = -1;
  const findSupported = typeof CSS !== 'undefined' && CSS.highlights;

  function openFind() {
    findOpen = true;
    el.findBar.classList.remove('hidden');
    el.findInput.focus();
    el.findInput.select();
    runFind(el.findInput.value);
  }

  function clearFind() {
    if (findSupported) {
      CSS.highlights.delete('find');
      CSS.highlights.delete('find-current');
    }
    findRanges = [];
    findIndex = -1;
  }

  function closeFind() {
    findOpen = false;
    el.findBar.classList.add('hidden');
    el.findCount.textContent = '';
    clearFind();
  }

  // Collect matches of `query` among the text nodes inside #content only —
  // never the title bar path, status bar, or the search box itself.
  function runFind(query) {
    clearFind();
    const q = (query || '').toLowerCase();
    if (!q || el.content.classList.contains('hidden')) {
      updateFindCount();
      return;
    }
    const walker = document.createTreeWalker(el.content, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.toLowerCase();
      let from = 0;
      let idx;
      while ((idx = text.indexOf(q, from)) !== -1) {
        const r = document.createRange();
        r.setStart(node, idx);
        r.setEnd(node, idx + q.length);
        findRanges.push(r);
        from = idx + q.length;
      }
    }
    findIndex = findRanges.length ? 0 : -1;
    paintFind();
    if (findIndex >= 0) scrollToMatch();
    updateFindCount();
  }

  function paintFind() {
    if (!findSupported) return;
    if (!findRanges.length) {
      CSS.highlights.delete('find');
      CSS.highlights.delete('find-current');
      return;
    }
    CSS.highlights.set('find', new Highlight(...findRanges.filter((_, i) => i !== findIndex)));
    if (findIndex >= 0) CSS.highlights.set('find-current', new Highlight(findRanges[findIndex]));
    else CSS.highlights.delete('find-current');
  }

  function scrollToMatch() {
    const r = findRanges[findIndex];
    if (!r) return;
    const c = el.scroll.getBoundingClientRect();
    const b = r.getBoundingClientRect();
    if (b.top < c.top + 56 || b.bottom > c.bottom - 24) {
      el.scroll.scrollTop += b.top - c.top - el.scroll.clientHeight * 0.4;
    }
  }

  function moveFind(dir) {
    if (!findRanges.length) return;
    findIndex = (findIndex + dir + findRanges.length) % findRanges.length;
    paintFind();
    scrollToMatch();
    updateFindCount();
  }

  function updateFindCount() {
    if (!el.findInput.value) {
      el.findCount.textContent = '';
      return;
    }
    el.findCount.textContent = findRanges.length ? `${findIndex + 1}/${findRanges.length}` : t('findNone');
  }

  el.findInput.addEventListener('input', () => runFind(el.findInput.value));
  el.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      moveFind(e.shiftKey ? -1 : 1);
    }
  });
  $('#find-next').addEventListener('click', () => moveFind(1));
  $('#find-prev').addEventListener('click', () => moveFind(-1));
  $('#find-close').addEventListener('click', closeFind);

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

  $('#btn-files').addEventListener('click', () => setFilebar(!state.filebarOpen));
  $('#fb-open').addEventListener('click', openViaDialog);
  el.fbSearch.addEventListener('input', (e) => fbSearch(e.target.value));
  $('#welcome-open').addEventListener('click', openViaDialog);
  $('#btn-save').addEventListener('click', () => saveFile());
  $('#btn-sidebar').addEventListener('click', () => setSidebar(!state.sidebarOpen));
  $('#btn-source').addEventListener('click', () => setSourceMode(!state.sourceMode));
  $('#btn-export').addEventListener('click', (e) => { e.stopPropagation(); toggleExportMenu(); });
  $('#ex-pdf').addEventListener('click', () => { toggleExportMenu(false); exportPdf(); });
  $('#ex-html').addEventListener('click', () => { toggleExportMenu(false); exportHtmlNow(); });
  $('#ex-copy').addEventListener('click', () => { toggleExportMenu(false); copyRendered(); });
  $('#btn-search').addEventListener('click', () => (findOpen ? closeFind() : openFind()));
  $('#btn-theme').addEventListener('click', () =>
    setTheme(state.theme === 'dark' ? 'light' : 'dark')
  );
  el.statusPath.addEventListener('click', () => {
    if (state.path) window.api.showInFolder(state.path);
  });

  /* ---------- Window caption controls (Windows) ---------- */

  $('#wc-min').addEventListener('click', () => window.api.minimizeWindow());
  $('#wc-max').addEventListener('click', () => window.api.toggleMaximizeWindow());
  $('#wc-close').addEventListener('click', () => window.api.closeWindow());

  $('#titlebar').addEventListener('dblclick', (e) => {
    if (window.api.platform === 'darwin') return; // macOS handles this natively
    if (e.target.closest('button, #win-controls')) return;
    window.api.toggleMaximizeWindow();
  });

  window.api.onWindowState(({ maximized }) => {
    state.maximized = maximized;
    $('.wc-ico-max').classList.toggle('hidden', maximized);
    $('.wc-ico-restore').classList.toggle('hidden', !maximized);
    $('#wc-max').title = maximized ? t('ttRestore') : t('ttMaximize');
  });

  async function exportPdf() {
    if (!state.path) {
      toast(t('toastOpenFirst'));
      return;
    }
    if (state.sourceMode) await setSourceMode(false, { prompt: false });
    const name = window.api.basename(state.path).replace(/\.[^.]+$/, '') + '.pdf';
    toast(t('toastPdfGen'), 8000);
    const res = await window.api.exportPdf(name);
    if (res.ok) toast(t('toastPdfSaved', res.path));
    else if (!res.canceled) toast(t('toastPdfFail', res.message));
    else el.toast.classList.add('hidden');
  }

  /* ---------- Keyboard shortcuts ---------- */

  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape' && !el.lightbox.classList.contains('hidden')) {
      closeLightbox();
      return;
    }
    if (e.key === 'Escape' && !el.hlBar.classList.contains('hidden')) {
      hideHlBar();
      return;
    }
    if (e.key === 'Escape' && fontMenuOpen) {
      toggleFontMenu(false);
      return;
    }
    if (e.key === 'Escape' && exportMenuOpen) {
      toggleExportMenu(false);
      return;
    }
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
      case 'h':
        e.preventDefault();
        applyHighlight('yellow');
        break;
      case 'z':
        if (state.sourceMode) break; // let the textarea's native undo run
        e.preventDefault();
        if (e.shiftKey) redoEdit();
        else undoEdit();
        break;
      case 'y':
        if (state.sourceMode) break;
        e.preventDefault();
        redoEdit();
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
      toast(t('toastWatchModified'));
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

  window.api.onOpenError(({ message }) => toast(t('toastOpenFail', message)));

  // Main asked us to save before the window closes (user chose "Save").
  window.api.onSaveThenClose(async () => {
    try {
      if (state.modified) await window.api.saveFile(state.path, state.raw);
    } catch {}
    window.api.forceCloseWindow();
  });

  /* ---------- Init ---------- */

  (async () => {
    document.body.classList.add('platform-' + window.api.platform);
    const s = await window.api.getSettings();
    applyLang(s.lang || 'ko', { persist: false });
    await setTheme(s.theme || 'light', { persist: false });
    if (typeof s.zoom === 'number') setZoom(s.zoom, { persist: false });
    applyFont(s.font || 'pretendard', { persist: false });
    applyFontScale(typeof s.fontScale === 'number' ? s.fontScale : 1, { persist: false });
    applyContentWidth(typeof s.contentWidth === 'number' ? s.contentWidth : 47, { persist: false });
    scrollMem = s.scroll && typeof s.scroll === 'object' ? s.scroll : {};
    refreshRecent();
    // Warm the system-font list in the background so the settings menu opens
    // instantly the first time (font enumeration + localized names take ~1s).
    setTimeout(() => loadSystemFonts(), 800);
  })();
})();
