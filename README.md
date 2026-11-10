# oncOS

oncOS is a clinical-reference suite delivered as one web application: Evidence (trials and maps), Staging (tables and practice cases), and the Appendix (Drugs, Tox, Acute).

The current release is the number in `VERSION`; `CHANGELOG.md` records each release.

## Release identity

- `VERSION` is the repository release marker.
- `package.json` carries the matching version.
- `CHANGELOG.md` records user-visible and operational changes.
- `index.html` exposes the version as the `application-version` meta value.

## Build

Module pages are generated in their source projects, converted to shell views by `fragmentize.py`, and assembled by `build_shell.py` (the oncOS One project). The maps under `maps/` and the drill under `drill/` are maintained in this repository. Vercel publishes `main`; branches under `claude/` build nothing.

Production: <https://oncos.vercel.app/>
