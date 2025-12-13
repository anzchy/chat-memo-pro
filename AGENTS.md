# Repository Guidelines

## Project Structure & Module Organization

- `chat-memo-pro/`: Chrome Extension (Manifest V3)
  - `manifest.json`: entry point; registers content scripts per platform
  - `js/background.js`: service worker (storage, side panel behavior, messaging)
  - `js/content_common.js`, `js/resizable-panel.js`: shared page-side scripts
  - `js/core/`: shared logic (`base.js`, `storage-manager.js`, `compatibility.js`)
  - `js/adapters/`: platform adapters (one file per site, e.g. `chatgpt.js`, `manus.js`)
  - `html/popup.html` + `js/popup.js`: side panel / UI logic
  - `css/content.css`: injected styles
  - `lib/`: vendored deps (`fuse.min.js`, `jszip.min.js`, `tailwind.min.css`, `fontawesome/`)
  - `_locales/`: i18n strings (`en/`, `zh_CN/`)
  - `icons/`: extension icons
- `specs/`: feature specs/plans; update for non-trivial changes.
- `TESTING_CHECKLIST.md`: manual test plan (source of truth for QA).

## Build, Test, and Development Commands

This repo has no Node build step. Develop by loading the unpacked extension:

- Load locally: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `chat-memo-pro/`
- Iterate: click **Reload** on the extension, then refresh the target tab.
- Debug:
  - Background: `chrome://extensions` → **Service worker** → Inspect
  - Page console: use `cmDebug.status()` / `cmDebug.getMessages()` (see `TESTING_CHECKLIST.md`)
- Package (optional): `zip -r chat-memo-pro.zip chat-memo-pro -x "**/.DS_Store"`

## Coding Style & Naming Conventions

- Vanilla JS/HTML/CSS only; do not introduce TypeScript, React, or bundlers.
- Match existing formatting: 2-space indentation, semicolons, and minimal diffs.
- New platforms: add `chat-memo-pro/js/adapters/<platform>.js` and register it in `chat-memo-pro/manifest.json` (see `HOW_TO_ADD_PLATFORM_SUPPORT.md`).
- Avoid editing minified files under `chat-memo-pro/lib/`; add small targeted code/CSS instead.

## Testing Guidelines

- No automated test suite; run relevant sections of `TESTING_CHECKLIST.md` before merging.
- For adapter changes, validate on the real site(s): correct platform detection, message capture, title extraction, auto-save, and no console errors.

## Commit & Pull Request Guidelines

- Commit subjects commonly use `Add:`, `Fix:`, `Update:` (keep this style and be specific).
- PRs should include: what changed, how to reproduce, platforms tested, and screenshots/GIFs for UI changes; link any updated specs/docs.

## Security & Configuration Tips

- The extension operates on broad host permissions; keep changes offline-first.
- Any new permissions, network requests, or data collection must be documented and explicitly reviewed.

