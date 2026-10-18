# FloorCanvas Redistribution Audit

This document records the public-release review of the FloorCanvas project.

## Summary

- The bundled example plans (`sample-small-office`, `sample-apartment`,
  `sample-cafe-shop`) are completely fictional layouts created for FloorCanvas.
  All coordinates, dimensions, room names, and labels were invented
  independently for this project; they do not reproduce any real building.
- All assets shipped with the repository were reviewed. The application icon is
  an original work for FloorCanvas. The repository bundles no raster images
  other than test artifacts that are regenerated during test runs (and are not
  part of the source tree).
- No git history was imported from any other project. This repository was
  initialized from scratch.
- Dependency licenses were reviewed (MIT/Apache-2.0/OFL) and are described in
  `../THIRD_PARTY_NOTICES.md`.
- FloorCanvas needs no backend or cloud service: it runs fully offline in the
  browser, as a locally hosted web app, and as an Electron desktop app.
- No external font service is used at runtime: the application loads no fonts
  from Google Fonts (or any other network source) and bundles no font
  binaries; UI and exported documents use local/system font stacks.
  FloorCanvas itself makes no intentional network request for fonts,
  telemetry, project storage, or application functionality.

## Review details

- A recursive content scan confirmed that no identifiers, layouts, images, or
  documentation derived from sample material of earlier private projects are
  present in this repository.
- Binary assets were compared by hash against the assets of previous private
  projects; no overlap exists.
- No secrets, credentials, tokens, personal email addresses, usernames, or
  machine-specific absolute paths are present in the source tree.
- The npm dependency audit reports 0 production vulnerabilities; remaining
  advisories (moderate) affect only the development-time packaging toolchain
  and are tracked as a non-blocking maintenance item.
