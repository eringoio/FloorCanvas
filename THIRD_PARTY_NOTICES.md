# Third-Party Notices

FloorCanvas is MIT-licensed. The runtime and build tooling dependencies below
are used and redistributed as unmodified package code where applicable. Their
license information comes from the installed package metadata.

## Runtime dependencies (bundled with the application)

| Component | Version | License |
| --- | --- | --- |
| React | 19.x | MIT |
| React DOM | 19.x | MIT |
| Zustand (state management) | 5.x | MIT |
| html2canvas (PNG export rendering) | 1.4.1 | MIT |
| jsPDF (PDF export) | 4.x | MIT |

## Desktop runtime

| Component | Version | License |
| --- | --- | --- |
| Electron | 43.x | MIT |

Electron follows its own licensing terms; see
https://www.electronjs.org/docs/latest/tutorial/sources#licensing for details.

## Fonts

No fonts are bundled or fetched at runtime. The UI and exported documents use
local/system font stacks (`-apple-system`, `Segoe UI`, `Hiragino Sans`,
`Yu Gothic`, `Meiryo`, etc.; `Inter` and `Noto Sans JP` are honored only if
already installed locally). FloorCanvas itself makes no network request for
fonts.

## Development-time dependencies (not redistributed)

Vite, oxlint, TypeScript, Playwright, concurrently, cross-env, wait-on,
electron-builder, related type definition packages. Licenses: MIT except
TypeScript and Playwright (`Playwright` installers are Apache-2.0).

TypeScript — Apache-2.0. Playwright — Apache-2.0. All others — MIT.

## Assets

The application icon (`public/favicon.svg`) and the fictional sample floor
plans (`src/data/samples/*.floormap.json`) are original works authored for
FloorCanvas and distributed under the project license. No third-party images,
icon sets, illustrations, or binary assets with uncertain provenance are
bundled.
