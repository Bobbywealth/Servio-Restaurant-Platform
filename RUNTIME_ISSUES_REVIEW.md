# Runtime / Local Dev Failure Review (2026-04-25)

This review captures why the project may not be working right now in a fresh environment.

## Findings

1. **Dependencies are not currently installed (or are incomplete)**
   - `npm run typecheck` fails with:
     - `TS2688: Cannot find type definition file for 'node'`
   - This usually means `node_modules` is missing or broken, because `@types/node` is declared in `package.json`.

2. **Linting cannot resolve TypeScript ESLint parser**
   - `npm run lint` fails with:
     - `Cannot find module '@typescript-eslint/parser'`
   - That parser is listed in `devDependencies`, so this also points to dependency install issues.

3. **Lockfile is out of sync with package manifests**
   - `npm ci` fails with:
     - ``npm ci can only install packages when your package.json and package-lock.json ... are in sync``
     - Followed by a long list of missing packages from lockfile.
   - This means deterministic CI installs (`npm ci`) will fail until lockfiles are regenerated and committed.

4. **Potential workspace mismatch with frontend deps**
   - The missing packages include Next/React/Webpack ecosystem packages, suggesting dependency drift between root and frontend setup.

## Why this can make the app "not working"

- Build and dev scripts depend on TypeScript and ESLint packages being present.
- If lockfiles are stale, team members/CI runners cannot perform clean installs.
- Different environments may end up with different dependency trees, causing "works on my machine" problems.

## Recommended Fix Path

1. From repo root, run:
   - `npm install`
2. Validate core checks:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:unit`
3. If frontend has its own lifecycle, also run in `frontend/`:
   - `npm install`
   - `npm run build` or project-standard checks
4. Commit any lockfile updates (`package-lock.json` and/or `frontend/package-lock.json`) together with manifest changes.
5. In CI, keep using `npm ci` to enforce lockfile correctness.

## Optional hardening

- Add CI checks that fail when lockfile is out of sync.
- Consider npm workspaces (if intended) to centralize dependency management.

