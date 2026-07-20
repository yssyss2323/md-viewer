<p align="center">
  <img src="docs/logo.png" width="112" alt="MD Viewer logo" />
</p>

<h1 align="center">MD Viewer</h1>

A clean, distraction-free markdown viewer for Windows and macOS, built with Electron. Focused on whitespace and typography.

| Light | Dark |
| --- | --- |
| ![Light theme](docs/screenshot-light.png) | ![Dark theme](docs/screenshot-dark.png) |

## Download

Grab the latest installer from the [**Releases**](https://github.com/yssyss2323/md-viewer/releases/latest) page:

- **Windows** — `MD Viewer Setup <version>.exe`
- **macOS (Apple Silicon, M1+)** — `MD Viewer-<version>-arm64.dmg`
- **macOS (Intel)** — `MD Viewer-<version>.dmg`

> **macOS note:** the app is not signed with an Apple Developer certificate, so
> on first launch macOS shows *"MD Viewer can't be opened because Apple cannot
> check it for malicious software."* Right-click the app in Applications →
> **Open** → **Open**, and macOS will remember the choice. (Or run
> `xattr -dr com.apple.quarantine "/Applications/MD Viewer.app"`.)

## Getting Started

```
npm install   # first time only
npm start     # or: npm start -- path\to\file.md
```

You can also drag and drop a markdown file onto the window.

## Features

- Clean rendering with light / dark themes
- One window per file — open several documents side by side (they group under one taskbar/dock icon); opening a file already shown just focuses its window
- Source view with inline editing — save with `Ctrl+S`
- Choose a reading font — bundled Pretendard (default), Nanum Myeongjo, Gowun Dodum, or **any font installed on your computer** (searchable) — and adjust the font size
- Local images (including relative paths and non-ASCII filenames) render inline
- Outline sidebar with scroll-position highlighting
- Syntax-highlighted code blocks with a copy button
- Tables, task lists, and footnotes
- Math with KaTeX (`$...$`, `$$...$$`)
- Mermaid diagrams (```` ```mermaid ````)
- GitHub-style callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
- Auto-reload on file change, preserving scroll position
- Find in document, PDF export, recent files

## Keyboard Shortcuts

| Action | Keys |
| --- | --- |
| Open file | `Ctrl+O` |
| Find | `Ctrl+F` (close with `Esc`) |
| Toggle outline | `Ctrl+B` |
| Toggle source view / edit | `Ctrl+E` |
| Save | `Ctrl+S` |
| Toggle theme | `Ctrl+Shift+L` |
| Export to PDF | `Ctrl+P` |
| Zoom in / out / reset | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (or `Ctrl` + wheel) |

## Building the Installer

```
npm run dist       # Windows installer (.exe)  — run on Windows
npm run dist:mac   # macOS disk image (.dmg)    — run on macOS
```

The Windows build produces an NSIS installer at `dist\MD Viewer Setup <version>.exe`; installing associates `.md` / `.markdown` files with MD Viewer.

### Automated releases (CI/CD)

`.github/workflows/build.yml` builds both platforms on GitHub's runners. Pushing a version tag creates a Release with the installers attached:

```
npm version minor        # bumps package.json and creates a git tag
git push --follow-tags   # triggers the workflow
```

macOS can only be built on a macOS machine, so this workflow is how the `.dmg` is produced — no Mac required locally.

## App icon

`build/icon.png` (app icon) and `build/icon.ico` (multi-resolution, used for the Windows `.md` file-type icon) are generated from `logo.png` by `build/make-icon.ps1` — it trims to the artwork, centers it, makes the corners transparent, and emits a 1024px PNG plus a 16–256px `.ico`. Regenerate with:

```
powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
```

> A `.ico` (not a `.png`) is required for the file-type icon so Windows Explorer
> renders it crisply at every size. After updating it, Windows may keep showing
> the old icon from its cache until the icon cache is rebuilt (or you restart).

## Project Structure

- `main.js` — Electron main process (window, file open/watch, settings, PDF)
- `preload.js` — markdown rendering pipeline + IPC bridge
- `renderer/` — UI (HTML/CSS/JS)

## License

MIT
