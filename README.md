# FloorCanvas

**English** | [日本語](README.ja.md)

FloorCanvas is a lightweight visual floor-plan and room-layout editor built with React and SVG.
FloorCanvas は、React と SVG で構築された軽量なビジュアル間取り作成アプリです。

Draw and edit floor plans as fully editable vector objects — rooms, walls, doors, windows, furniture, text labels, and dimensions — on a metric sheet with a drawing scale, then export to PNG, SVG, or PDF. FloorCanvas runs as a normal web application, a locally hosted web application, and a Windows desktop application (Electron).

## Download

Ready-to-use packages are published on the [GitHub Releases](https://github.com/eringoio/FloorCanvas/releases) page:

- **Windows desktop (recommended):** `FloorCanvas-<version>-win-x64-portable.exe` — a self-contained portable app; download and run, no installation needed. On first start you choose a Workspace Folder for your projects.
- **Web build:** `FloorCanvas-<version>-web.zip` — a static build of the browser version. Because browsers block ES modules from `file://`, serve the extracted folder with any static server (e.g. `npx serve .` or `python -m http.server`) and open it locally. The web build keeps everything local: no backend, no account.

You can also run FloorCanvas from source with the commands below.

## Major features

- **Rooms & walls** — smart rooms with per-side wall thickness/style, walls (straight, rectangular, polyline), columns.
- **Openings** — doors with hinge/swing/angle and windows placed on room walls or standalone walls.
- **Furniture & symbols** — seating, desks, tables, storage, and sanitary plan symbols with wall-facing logic.
- **Text & dimensions** — Japanese-safe text objects (Japanese system font stacks) and dimension lines with auto/manual labels.
- **Shapes** — lines, rectangles, circles, ellipses, polylines/polygons.
- **Editing** — selection, move, free stretch, resize, rotate (15° steps + snap), copy/cut/paste/duplicate, undo/redo.
- **Grid & snapping** — metric alignment grid, snap to grid/elements, smart guides.
- **Scale & calibration** — 2-point calibration and drawing scales (1:50 … 1:300), mm/cm/m units.
- **Layers** — visibility/lock/order per layer, common structural layer presets.
- **Background images** — trace over an imported plan image (raster).
- **Import/merge** — merge objects/settings from another project JSON.
- **Export** — SVG, PNG, and PDF (A4/A3/custom, portrait/landscape).
- **Mobile/touch support** — drawers and touch editing on small screens/finger touch.

## Versions

### Browser version
No backend, no account, no cloud database. Projects open/save as `.floormap.json` files via file picking; in Chrome/Edge a "Save/Open file" system dialog is used when available (progressive enhancement), otherwise a download/upload fallback is used. Background images are embedded into the project file when saved in the browser.

### Local web version
```bash
npm install
npm run dev
```
Serves the same application locally. The web build does not depend on Electron at all.

### Desktop version (Electron / Windows)
```bash
npm run electron:preview   # run the built app in Electron
npm run electron:pack      # package (unpacked dir)
npm run electron:dist      # portable Windows x64 build → dist-electron/
```

## Project format

A FloorCanvas project is a single JSON document:

```text
<something>.floormap.json
```

It contains the project title, unit, scale, sheet config, grid, layers, objects, and backgrounds. Published sample projects (see below) double as format examples.

## Workspace behavior (desktop)

Desktop projects use a **folder-per-project** layout inside one user-selected **Workspace Folder**:

```text
D:\FloorCanvas Projects\
    My Office\
        project.floormap.json
        assets\          ← project-owned images
    Apartment\
        project.floormap.json
        assets\
```

### First-run workspace selection
On first desktop start (or when no workspace is configured), FloorCanvas asks the user to choose a Workspace Folder and remembers it (`userData` settings file; no credentials stored). If a remembered folder no longer exists, a recovery screen offers **Retry** and **Choose Another Workspace**.

### Last-project reopening
The most recently opened/saved project is remembered and automatically reopened at startup after validation. If it was moved, deleted, corrupted, or fails validation, the stale reference is cleared and the welcome/start screen is shown — the app never crashes.

### Start screen
When no project reopens, a lightweight welcome state offers: **New Project**, **Open Project**, recent workspace projects, and **Choose/Change Workspace**.

### Save and Save As
- **Save** overwrites the known `project.floormap.json` directly — no repetitive overwrite confirmation. A new project, or a built-in sample, has no workspace-backed file yet: its **first Save creates a normal workspace project** (exactly one folder) and makes it the active project; every later Save overwrites that same project.
- **Save As** always creates a new project folder inside the workspace (collision-safe naming), creates/copies the `assets/` folder, writes the JSON, and switches the active project. Names are sanitized for the filesystem (invalid characters and Windows reserved names are rejected/replaced; Unicode names are preserved).
- A cancelled or failed save never marks the project as saved: unsaved-change state stays on until persistence actually succeeds.

### Unsaved-change protection
Opening, switching, new-project, workspace changes, and window/application closing all check for unsaved changes; desktop close offers **Save / Don't Save / Cancel**. The application only closes on **Save** after the save actually succeeds — a failed or cancelled save keeps the app open and the project dirty.

## Browser file behavior
- **Open** → `.floormap.json` (file input everywhere; File System Access picker on Chrome/Edge when granted).
- **Save** → download `.floormap.json` as the universal fallback; overwriting the same file via File System Access when available.
- Browser file handles are kept in memory for the session only and never become part of project data.

## Background assets
- Desktop: persistent images are stored in the project's `assets/` folder and referenced via a workspace-constrained local asset protocol.
- Browser: images are embedded as data URLs in the `.floormap.json`.
- Saving a browser-created project (with an embedded image) as a desktop project migrates the image into the project `assets/` folder automatically.

## Fictional samples

Three built-in example plans, **completely fictional**, are bundled as static frontend resources and load in every mode (browser / local / desktop) with no filesystem or Electron dependency:

| ID | Contents |
| --- | --- |
| `sample-small-office` | Reception, open office, meeting room, private office, kitchenette, storage, restroom, lounge; workstations, meeting furniture, dimensions, multiple layers |
| `sample-apartment` | Entry, living/dining, kitchen, bedroom, study/guest, bathroom, WC, storage, hall, balcony; residential furniture and door swings |
| `sample-cafe-shop` | Entrance, customer area, counter, kitchen/prep, storage, staff/WC; tables and chairs, service counter, display fixtures, annotations |

Built-in samples load as editable templates; the first **Save** (desktop) creates a normal project in the workspace.

## Import / export
- Import JSON merges objects/settings from another project with a selection dialog.
- Export to PNG/PDF/SVG (PNG and PDF include embedded background rendering; UI overlays are excluded).

## Privacy

FloorCanvas is a local/offline application: it does not require a backend, cloud database, account, telemetry, or an external font service, and projects stay on your machine. FloorCanvas itself makes no intentional external runtime requests — core editing, project storage, and fonts (local/system font stacks) all work without network access. (As with any web technology, the browser or OS may still make requests outside the application's control.) Bundled sample plans are fictional and contain no real-building data.

## Development

```bash
npm install
npm run dev             # Vite dev server
npm run build           # type-check + production web build
npm run preview         # serve the production build
npm run lint            # oxlint

npm run electron:dev    # Vite dev server + Electron dev window
npm run electron:preview
npm run electron:pack
npm run electron:dist

npm run test:e2e        # Playwright end-to-end tests (web mode)
npm run test:storage    # Node tests for desktop storage/settings layer
```

GitHub Actions CI (`.github/workflows/ci.yml`) runs lint, build, storage tests, and the Playwright e2e suite on every push/PR to `main`. Releases are built and published manually (see the GitHub Releases page); no release is triggered by a normal push.

The Vite web build never requires Electron. Electron code lives in `electron/*.cjs`.

## Licensing

FloorCanvas is released under the [MIT License](LICENSE). Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
