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
    font: 'pretendard',
    fontScale: 1,
    contentWidth: 47,
    lang: 'ko',
    maximized: false,
    sidebarOpen: false,
    headings: [],
  };

  /* ---------- Localization ---------- */

  const I18N = {
    ko: {
      ttSidebar: '목차 (Ctrl+B)', ttOpen: '파일 열기 (Ctrl+O)', ttSource: '원문 보기/편집 (Ctrl+E)',
      ttFind: '찾기 (Ctrl+F)', ttPdf: 'PDF로 내보내기 (Ctrl+P)', ttFont: '글꼴',
      ttTheme: '테마 전환 (Ctrl+Shift+L)', ttMinimize: '최소화', ttMaximize: '최대화', ttRestore: '이전 크기로',
      ttClose: '닫기', secBundledFonts: '기본 글꼴', fontSystem: '시스템 기본', secSystemFonts: '내 컴퓨터 글꼴',
      phFontSearch: '설치된 글꼴 검색…', secFontSize: '글자 크기', ttSmaller: '작게', ttLarger: '크게',
      secContentWidth: '본문 너비', ttNarrower: '좁게', ttWider: '넓게', secLanguage: '언어 / Language',
      phFind: '찾기…', ttFindPrev: '이전 (Shift+Enter)', ttFindNext: '다음 (Enter)', ttFindClose: '닫기 (Esc)',
      outline: '목차', welcomeSub: '마크다운 파일을 열거나 창으로 끌어다 놓으세요', openFile: '파일 열기',
      recentFiles: '최근 파일', ttShowInFolder: '클릭하면 폴더에서 보기', dropHere: '파일을 놓아서 열기',
      outlineEmpty: '제목이 없습니다', stats: '{0} 단어 · {1} 글자 · 약 {2}분', findNone: '없음',
      dotModified: '저장되지 않은 변경 (Ctrl+S)', dotChanged: '파일이 변경되어 새로고침됨',
      toastOpenFirst: '먼저 파일을 열어주세요', toastCopyFail: '복사에 실패했습니다', toastSaved: '저장됨',
      toastNoChanges: '저장할 변경 사항이 없습니다', toastSaveFail: '저장 실패: {0}', toastPdfGen: 'PDF 생성 중…',
      toastPdfSaved: '저장됨: {0}', toastPdfFail: '내보내기 실패: {0}', toastOpenFail: '파일을 열 수 없습니다: {0}',
      toastOpenFailMoved: '파일을 열 수 없습니다 (이동 또는 삭제됨)',
      toastWatchModified: '파일이 디스크에서 변경되었지만, 저장하지 않은 편집이 있어 반영하지 않았습니다',
      fontListFail: '글꼴 목록을 불러올 수 없습니다',
      confirmDiscard: '저장하지 않은 변경 사항이 있습니다. 버리고 계속할까요?',
      copy: '복사', coNOTE: '노트', coTIP: '팁', coIMPORTANT: '중요', coWARNING: '주의', coCAUTION: '경고',
    },
    en: {
      ttSidebar: 'Outline (Ctrl+B)', ttOpen: 'Open file (Ctrl+O)', ttSource: 'Source view / edit (Ctrl+E)',
      ttFind: 'Find (Ctrl+F)', ttPdf: 'Export to PDF (Ctrl+P)', ttFont: 'Font',
      ttTheme: 'Toggle theme (Ctrl+Shift+L)', ttMinimize: 'Minimize', ttMaximize: 'Maximize', ttRestore: 'Restore',
      ttClose: 'Close', secBundledFonts: 'Bundled fonts', fontSystem: 'System default', secSystemFonts: 'Installed fonts',
      phFontSearch: 'Search installed fonts…', secFontSize: 'Font size', ttSmaller: 'Smaller', ttLarger: 'Larger',
      secContentWidth: 'Content width', ttNarrower: 'Narrower', ttWider: 'Wider', secLanguage: '언어 / Language',
      phFind: 'Find…', ttFindPrev: 'Previous (Shift+Enter)', ttFindNext: 'Next (Enter)', ttFindClose: 'Close (Esc)',
      outline: 'Outline', welcomeSub: 'Open a markdown file, or drag one onto the window', openFile: 'Open File',
      recentFiles: 'Recent files', ttShowInFolder: 'Click to show in folder', dropHere: 'Drop to open',
      outlineEmpty: 'No headings', stats: '{0} words · {1} chars · ~{2} min', findNone: 'No results',
      dotModified: 'Unsaved changes (Ctrl+S)', dotChanged: 'File changed on disk — reloaded',
      toastOpenFirst: 'Open a file first', toastCopyFail: 'Copy failed', toastSaved: 'Saved',
      toastNoChanges: 'No changes to save', toastSaveFail: 'Save failed: {0}', toastPdfGen: 'Generating PDF…',
      toastPdfSaved: 'Saved: {0}', toastPdfFail: 'Export failed: {0}', toastOpenFail: 'Could not open file: {0}',
      toastOpenFailMoved: 'Could not open file (moved or deleted)',
      toastWatchModified: 'The file changed on disk, but your unsaved edits were kept',
      fontListFail: 'Could not load font list',
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
    await runMermaid();
    updateStats();

    const name = window.api.basename(path);
    el.title.textContent = name;
    document.title = `${name} — Mymd`;
    el.statusPath.textContent = path;

    el.scroll.scrollTop = keepScroll ? prevScroll : 0;
    updateScrollSpy();
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
  }

  async function setSourceMode(on, { applyEdits = true, prompt = true } = {}) {
    if (on && !state.path) {
      toast(t('toastOpenFirst'));
      return;
    }
    if (on === state.sourceMode) return;

    // Leaving the editor with unsaved edits: offer to save / discard / cancel.
    if (!on && prompt && state.modified) {
      const choice = await window.api.confirmUnsaved();
      if (choice === 2) return; // cancel — stay in the editor
      if (choice === 0) {
        await saveFile();
      } else {
        state.raw = state.savedRaw;
        el.editor.value = state.savedRaw;
        setModified(false);
      }
    }

    state.sourceMode = on;
    $('#btn-source').classList.toggle('active', on);
    if (on) {
      if (findOpen) closeFind();
      el.editor.value = state.raw;
      el.content.classList.add('hidden');
      el.sourceView.classList.remove('hidden');
      el.scroll.scrollTop = 0;
      el.editor.focus();
    } else {
      el.sourceView.classList.add('hidden');
      el.content.classList.remove('hidden');
      // Always re-render so the viewer reflects the current source text.
      if (applyEdits) display(state.path, state.raw, { keepScroll: true, fromDisk: false });
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
    try {
      const fonts = await window.api.listFonts();
      if (!fonts || !fonts.length) {
        list.innerHTML = `<div class="fm-empty">${t('fontListFail')}</div>`;
        return;
      }
      list.innerHTML = '';
      for (const fam of fonts) {
        const btn = document.createElement('button');
        btn.className = 'fm-sysitem';
        btn.dataset.family = fam;
        btn.textContent = fam;
        btn.style.fontFamily = `"${fam}"`;
        btn.title = fam;
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
      it.style.display = it.dataset.family.toLowerCase().includes(query) ? '' : 'none';
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
  });

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
    if (e.key === 'Escape' && fontMenuOpen) {
      toggleFontMenu(false);
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
    refreshRecent();
  })();
})();
