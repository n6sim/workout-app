# Workout App: rules for every session

The full product spec is in docs/SPEC.md. It is the source of truth.
If the spec is unclear or seems wrong, stop and ask. Do not guess.

## Scope
- Build only the milestone I name in the session. Do not start the next one.
- Nothing from the "v2 parking lot" section.

## Stack
Vite + React + TypeScript, Tailwind, vite-plugin-pwa, Dexie (IndexedDB),
Recharts, Vitest. Deployed to GitHub Pages via GitHub Actions
(base path /workout-app/).

## Architecture rules
- All persistence goes through src/storage/. All sync goes through src/sync/.
- All coaching math is pure functions in src/engine/ with Vitest tests.
- Metric units only. Data files carry a schemaVersion.

## Security rules
- Never ask me for tokens, passwords, or access to any repo other than this one.
- The sync token is entered by the user in the app's Settings at runtime and
  stored only on the device. Never commit it, log it, or include it in exports.
- No personal data in this repo.

## Data rules
- Never invent nutrition values or video URLs. Leave them empty for me to fill in.

## Working style
- Before coding a milestone, give me a short plan and list anything you need
  from me.
- Small commits with clear messages. Open a pull request at the end.
- At the end, give me plain-language steps to test it on my Android phone,
  and tick off which acceptance criteria pass.
