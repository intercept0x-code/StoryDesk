# StoryDesk

StoryDesk is a dependency-free story-writing workspace that runs entirely in the browser.

## Features

- Multiple story projects
- Project description + optional manuscript word goal
- Chapter creation, rename, duplicate, delete, reorder, status tracking
- Rich chapter editor with autosave
- Chapter notes
- Project and chapter word counts + estimated reading time
- Hideable **Idea Shelf** with categories:
  - Idea
  - Plot
  - Character
  - World
  - Thread to follow
  - Research
  - Fix later
- Pin / complete / delete idea cards
- Global search across chapters, notes, and ideas
- Focus mode
- Light / dark theme
- JSON project backup/import
- Markdown manuscript export
- Mobile-responsive layout
- Installable/offline-capable PWA when hosted over HTTPS
- No account, server, framework, or external dependency required

## Data & privacy

StoryDesk stores your projects in your browser's `localStorage` on the current device/browser profile. Use **Export** regularly for backups. Clearing browser site data can erase local projects.

## Run locally

The simplest option is to open `index.html` directly. For full PWA/offline behavior, use a tiny local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Put it on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/ (root)`.
6. Save.

GitHub Pages will host the app as a static site. Because the app has no backend, everything still saves locally in the visitor's browser.

## Keyboard shortcuts

- `Ctrl/Cmd + K` — global search
- `Ctrl/Cmd + Shift + I` — toggle Idea Shelf
- `Ctrl/Cmd + S` — force save
- `Esc` — close search / menus
