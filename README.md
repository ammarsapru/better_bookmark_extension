# Better Bookmarks

A Chrome extension that fixes the most common complaints about Chrome's built-in
bookmark manager:

- **Subfolders are a pain to create.** Every folder row has a visible `+ folder`
  button on hover — no hunting through a hidden "New" menu.
- **You have to open a full manager tab just to find one URL.** Everything lives
  in the toolbar popup: an instant search box filters titles and URLs across every
  folder as you type, showing the folder path next to each match so you don't have
  to click into anything.
- **Folders and bookmarks look the same, and everything is expanded by default.**
  Folders get a distinct icon, are collapsed by default, and remember their
  expand/collapse state between opens.
- **No quick way to save the current page into a specific folder.** The
  "Save current tab" button lets you pick (or search) any folder without leaving
  the popup.
- Drag-and-drop to move bookmarks/folders, inline rename, and delete are all
  available directly from hover actions on each row.

It uses Chrome's real `chrome.bookmarks` API, so it reads and writes your actual
bookmarks — nothing is siloed in a separate database, and your existing bookmarks
show up immediately.

## Loading the extension

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this folder.
4. Pin the extension and click its icon to open the popup.

## Files

- `manifest.json` — Manifest V3 config (bookmarks/tabs/storage/favicon permissions).
- `popup.html` / `popup.css` / `popup.js` — the entire UI, no build step required.
