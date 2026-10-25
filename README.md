# Workout App

Personal coach PWA for two profiles (Nasim, Kash). Spec: [docs/SPEC.md](docs/SPEC.md). Project rules: [CLAUDE.md](CLAUDE.md).

Status: **M1** (skeleton, profiles, targets), **M2** (GitHub sync) and **M3** (workouts).

## Develop

```
npm install
npm run dev        # http://localhost:5173/workout-app/
npm test           # Vitest
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173/workout-app/
npm run icons      # regenerate the placeholder PWA icons
npm run import-exercises   # rebuild the exercise library and pictures (needs internet)
```

## Layout

- `src/engine/`: pure coaching math (BMR, maintenance, deficit cap, calorie floor, protein) with tests.
- `src/storage/`: the only code that touches IndexedDB (Dexie). Entries, soft delete, export, import, merge.
- `src/sync/`: sync behind a `RemoteStore` interface; `GitHubSync` is the only implementation. Scheduler, token config, tests against a fake GitHub API.
- `src/engine/training/`: weekly templates, session builder, step order for the player, pilates picker, double progression.
- `src/data/`: `exercises.json` and `public/exercises/` (imported from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain / Unlicense), plus 20 hand-written pilates and mobility moves in `handmade.ts`. Video links are left empty on purpose.
- `src/screens/`: UI.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (test, build, publish to GitHub Pages).
One-time setup: repo **Settings > Pages > Source: GitHub Actions**. The site is served at `/workout-app/`.

## Sync setup (once per device)

1. Create a **private** repo `workout-data` on GitHub.
2. github.com > Settings > Developer settings > Fine-grained tokens > Generate new token. Repository access: only `workout-data`. Permission: Contents, read and write. Note the expiry date.
3. In the app: More > Sync and settings. Paste the token and the expiry date, then Save and sync.

The token is stored on the device only. It is never exported, synced, logged or committed.
