# MD Viewer

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
- Source view with inline editing — save with `Ctrl+S`
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

`build/icon.png` is generated from `logo.png` by `build/make-icon.ps1` (trims to the artwork, centers it, and makes the corners transparent). Regenerate with:

```
powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
```

## Project Structure

- `main.js` — Electron main process (window, file open/watch, settings, PDF)
- `preload.js` — markdown rendering pipeline + IPC bridge
- `renderer/` — UI (HTML/CSS/JS)

## License

MIT
