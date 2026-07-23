<p align="center">
  <img src="docs/logo.png" width="112" alt="Mymd logo" />
</p>

<h1 align="center">Mymd</h1>

<p align="center">
  <a href="https://github.com/yssyss2323/md-viewer/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/yssyss2323/md-viewer?label=release&color=3b7cd4"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

<div align="center">
  <strong>A clean, distraction-free markdown viewer.</strong><br>
  Focused on whitespace and typography.<br>
  <sub>Available for Windows and macOS.</sub>
</div>

<br>

| Light | Dark |
| --- | --- |
| ![Light theme](docs/screenshot-light.png?v=3) | ![Dark theme](docs/screenshot-dark.png?v=3) |

## Download

Grab the latest installer from the [**Releases**](https://github.com/yssyss2323/md-viewer/releases/latest) page — no setup or dependencies needed:

- **Windows** — download `Mymd Setup <version>.exe` and run it.
- **macOS (Apple Silicon, M1+)** — download `Mymd-<version>-arm64.dmg`, open it, and drag **Mymd** into Applications.
- **macOS (Intel)** — same, using `Mymd-<version>.dmg`.

> **macOS note:** the app is ad-hoc signed, not notarized with an Apple
> Developer certificate, so macOS quarantines it on download. After dragging
> **Mymd** into Applications, remove the quarantine flag once from Terminal:
>
> ```
> xattr -cr "/Applications/Mymd.app"
> ```
>
> Then open it normally. (Without this, macOS — especially on Apple Silicon —
> may refuse to launch it with *"Mymd is damaged and can't be opened."*)

## Features

- **Clean, distraction-free reading** in light or dark themes
- **Source view & editing** — flip to the raw markdown, edit, and save (`Ctrl+E` / `Ctrl+S`)
- **File browser sidebar** — browse the current folder's markdown files as a tree, search them by name, and jump to recent files
- **Highlighter & checkboxes** — select text to highlight it in several colors (or right-click / `Ctrl+H`) and tick task-list boxes right from the reading view; edits save into the file and `Ctrl+Z` undoes them
- **Full markdown** — KaTeX math, Mermaid diagrams, syntax-highlighted code, tables, task lists, and GitHub-style callouts
- **Any reading font** — bundled fonts or anything installed on your computer, with adjustable size and width
- **Export to PDF or self-contained HTML**, plus outline sidebar, find, image zoom, and live auto-reload
- **One window per file** and a **Korean / English** interface

## Keyboard Shortcuts

| Action | Keys |
| --- | --- |
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Find | `Ctrl+F` (close with `Esc`) |
| Toggle outline | `Ctrl+B` |
| Toggle source view / edit | `Ctrl+E` |
| Highlight selection | `Ctrl+H` (or select text → palette / right-click) |
| Undo / redo (highlight, checkbox) | `Ctrl+Z` / `Ctrl+Y` |
| Toggle theme | `Ctrl+Shift+L` |
| Export to PDF | `Ctrl+P` |
| Zoom in / out / reset | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (or `Ctrl` + wheel) |

## Development

<details>
<summary>Build from source, package installers, and customize the icon (for contributors — not needed to just use the app).</summary>

### Run from source

```
npm install   # first time only
npm start     # or: npm start -- path\to\file.md
```

### Build installers

```
npm run dist       # Windows installer (.exe)  — run on Windows
npm run dist:mac   # macOS disk image (.dmg)    — run on macOS
```

The Windows build produces an NSIS installer at `dist\Mymd Setup <version>.exe`; installing associates `.md` / `.markdown` files with Mymd.

### Automated releases (CI/CD)

`.github/workflows/build.yml` builds both platforms on GitHub's runners. Pushing a version tag creates a Release with the installers attached:

```
npm version minor        # bumps package.json and creates a git tag
git push --follow-tags   # triggers the workflow
```

macOS can only be built on a macOS machine, so this workflow is how the `.dmg` is produced — no Mac required locally.

### App icon

`build/icon.png` (app icon) and `build/icon.ico` (multi-resolution, used for the Windows `.md` file-type icon) are generated from `logo.png` by `build/make-icon.ps1` — it trims to the artwork, centers it, makes the corners transparent, and emits a 1024px PNG plus a 16–256px `.ico`. Regenerate with:

```
powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
```

### Project structure

- `main.js` — Electron main process (windows, file open/watch, settings, PDF)
- `preload.js` — markdown rendering pipeline + IPC bridge
- `renderer/` — UI (HTML/CSS/JS)

</details>

## License

MIT
