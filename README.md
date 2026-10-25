# Workout App

Personal coach PWA for two profiles (Nasim, Kash). Spec: [docs/SPEC.md](docs/SPEC.md). Project rules: [CLAUDE.md](CLAUDE.md).

Status: **M1** (skeleton, profiles, targets).

## Develop

```
npm install
npm run dev        # http://localhost:5173/workout-app/
npm test           # Vitest
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173/workout-app/
npm run icons      # regenerate the placeholder PWA icons
```

## Layout

- `src/engine/`: pure coaching math (BMR, maintenance, deficit cap, calorie floor, protein) with tests.
- `src/storage/`: the only code that touches IndexedDB (Dexie). Entries, soft delete, export, import, merge.
- `src/screens/`: UI.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (test, build, publish to GitHub Pages).
One-time setup: repo **Settings > Pages > Source: GitHub Actions**. The site is served at `/workout-app/`.
