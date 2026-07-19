# oncOS

oncOS is a private clinical-reference suite delivered as one persistent web application. The hub routes to Evidence, Staging, Drugs, Tox and Acute while preserving each module's URL and interaction model.

Current release: **v1.2.0**

## Release identity

- `VERSION` is the repository release marker.
- `package.json` carries the matching semantic version.
- `CHANGELOG.md` records user-visible and operational changes.
- The generated hub displays the version in its footer and exposes it as the `application-version` meta value.

## Build

Module pages are generated in their source projects, converted to shell views by `Projects/2026-07-18-oncos-one/fragmentize.py`, and assembled by `build_shell.py`. The generated deployment bundle in this repository is published from `main` to Vercel.

Production: <https://oncos.vercel.app/>
