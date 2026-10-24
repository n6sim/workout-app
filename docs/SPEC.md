# Workout App Spec v1

Oct 24, 2026 · @Nas

## Overview

A personal coach app for two people (Nasim and Kash): it plans each day's workout and calorie budget, logs what actually happened, and adjusts the plan over months. It is built as a PWA, stores data on each device, and syncs to a private GitHub repo. Total running cost: $0.

**Users.** Two fixed profiles, Nasim and Kash, picked on launch. No signup. Each profile starts empty and has its own plan, logs and settings.

**Product principles**

- **Moderate by default.** Sustainable loss of at most 0.75% of body weight per week. No crash diets.
- **Strength-led in every phase.** Phases change volume and calories, never the type of training.
- **Honest numbers.** Exercise calories are credited at 50%. Decisions use trend weight, never a single weigh-in.
- **Forgiving.** Weekly calorie budget, flex days, rest days and a Pause mode. Missing a day never breaks the plan.
- **Never lose data.** Local-first storage, synced to GitHub with full history, plus manual export.
- **Metric only.** kg, cm, kcal, g.

**How to use this spec.** Build one milestone at a time (see Milestones). Finish each milestone's acceptance criteria before starting the next one.

## Architecture and stack

The app is a static PWA on GitHub Pages that works fully offline. It keeps data in the browser (IndexedDB) and syncs a JSON file per profile to a private GitHub repo through the GitHub REST API.

| Part | Choice | Why |
| --- | --- | --- |
| Framework | Vite + React + TypeScript | Simple, well known, typed data model |
| Styling | Tailwind CSS | Fast to build, mobile-first |
| PWA | vite-plugin-pwa (Workbox) | Installable, offline, auto-update |
| Local storage | IndexedDB via Dexie | Durable, handles years of logs |
| Charts | Recharts | Trend weight and strength charts |
| Hosting | GitHub Pages, public repo `workout-app` | Free; deployed by GitHub Actions on push to main |
| Sync | Private repo `workout-data`, files `nasim.json` and `kash.json` | Free, permanent, full commit history |
| Auth for sync | Fine-grained personal access token, Contents read/write on `workout-data` only | Pasted once per device in Settings, stored only on the device |

**Hard rules for the code**

- All storage goes through one module, `storage/` (interface: load profile, save entry, list entries, export, import). Sync lives behind a second interface, `sync/`, with a `GitHubSync` implementation. Swapping to Supabase later means writing one new `sync/` implementation.
- All coaching math lives in pure functions in `engine/` (no React, no storage). Each function gets unit tests (Vitest).
- The token is never committed, logged, or included in exports.
- No personal data in the public repo, ever.
- Call `navigator.storage.persist()` on first launch.

## Data model and sync

Each profile is one JSON document with a schema version, a settings object, and append-only lists of entries. Every entry has a unique ID and timestamps, so two devices merge cleanly.

**Profile document** (`nasim.json`, `kash.json`)

| Field | Contents |
| --- | --- |
| `schemaVersion` | Integer, starts at 1. Migrations upgrade old files on load. |
| `profile` | name, sex, birthDate, heightCm, activityLevel |
| `settings` | exerciseCreditPct (default 50), trainingDays (weekdays), sessionLengthMin, equipment list, mode (`moderate`, `aggressive` locked) |
| `goal` | type, targetWeightKg, targetDate, startDate, startTrendKg |
| `phases[]` | id, type, startDate, endDate, reason, calorieTargetKcal, proteinTargetG |
| `weighIns[]` | id, date, kg |
| `meals[]` | id, date, time, rawText, items[] (foodId, qty, unit, kcal, proteinG), totals |
| `activities[]` | id, date, type, minutes, estKcal, creditedKcal |
| `sessions[]` | id, date, planned plan, status (`done`, `partial`, `skipped`), sets[] (exerciseId, setNo, reps or seconds, weightKg) |
| `pauses[]` | id, startDate, endDate, reason (`holiday`, `sick`, `busy`), note |
| `foods[]` | the user's own pantry items (see Nutrition logging) |
| `savedMeals[]` | id, name, items[] |
| `pilatesLinks[]` | id, type, title, url (filled in by the user) |
| `events[]` | coach events: phase change offered, plateau detected, user choice |

**Common fields on every entry:** `id` (UUID), `createdAt`, `updatedAt`, `deleted` (soft delete flag), `deviceId`.

**Sync rules**

1. On app open and every 5 minutes while open: pull the profile file from GitHub (GET contents, keep its `sha`).
2. Merge: union all entries by `id`; when an `id` exists in both copies, keep the one with the later `updatedAt`. Deletes are soft, so they merge like edits.
3. After any local change: wait 5 seconds, merge with the latest remote, then PUT with the remote `sha`. On a 409 or sha mismatch, pull, merge and retry (max 3 tries).
4. Offline: queue the push and retry on reconnect. Logging never waits for sync.
5. Show status in the header: "Synced 2 min ago", "Offline, will sync", or "Sync error". Warn if a device has not synced in 3 days.
6. Token expiry: read the expiry date the user enters in Settings; warn 7 days ahead. On a 401, show a clear "Token expired, paste a new one" screen.
7. Settings has Export (downloads the full profile JSON) and Import (merges a file using the same rules).

## Calculation rules

All coaching numbers come from these rules, implemented as pure, tested functions in `engine/`. Exercise is counted separately from daily life, so the base estimate must not include workouts.

**1. Resting energy (BMR), Mifflin-St Jeor.** Age is computed from birthDate.

```
BMR = 10 × kg + 6.25 × cm − 5 × age + s,   s = +5 (male), −161 (female)
```

**2. Base maintenance (no workouts).** BMR × daily-life factor: 1.2 desk-based, 1.3 on feet part of the day, 1.4 active job. Asked in onboarding. From milestone 5 on, the adaptive estimate (rule 8) replaces this.

**3. Daily calorie target.**

- Needed deficit = (current trend kg − target kg) × 7700 ÷ days to target date.
- Moderate mode caps the deficit at the lower of 500 kcal/day and 0.75% of body weight per week (× 7700 ÷ 7).
- If the goal needs more than the cap, show: "This goal needs a faster pace than moderate mode allows. At a moderate pace you'll reach it around <date>." Offer to move the date.
- Floor: never below 1,200 kcal (female) or 1,500 kcal (male).
- Maintenance phase: deficit = 0.

**4. Protein target.** 1.8 g per kg of current trend weight, rounded to 5 g. Shown every day; hitting it matters more than hitting calories exactly.

**5. Exercise calories.** Estimate = MET × body kg × hours. Starting MET values (editable in one table in code): strength with dumbbells 4.5, pilates 3.0, treadmill incline walk 5.0, bike moderate 6.8, stepper 8.0, easy walk 3.5. **Credited to budget = estimate × exerciseCreditPct (default 50%).** The UI always shows both numbers: "Burned ~220, counted 110".

**6. Weekly budget.** Week runs Monday to Sunday.

- Weekly budget = daily target × 7 + all credited exercise that week.
- Today's budget = (weekly budget − eaten so far this week) ÷ days left, clamped to ±20% of the daily target so no day becomes punishing.
- Flex day: the user can mark one day a week as flex. It gets +400 kcal, taken evenly from the other remaining days.
- An overshoot bigger than the clamp can absorb is not carried into next week. The weekly summary just shows it.

**7. Trend weight.** 7-day rolling average of weigh-ins, needing at least 3 weigh-ins in the window; otherwise show "Not enough weigh-ins". All coach decisions use trend weight only. Paused days are excluded from every calculation.

**8. Adaptive maintenance (milestone 5).** Every Monday, using the last 21 days:

- Use only fully logged days (the user taps "Done logging today"). Need at least 14 of 21.
- Estimate = average intake − (trend change kg × 7700 ÷ days).
- New maintenance = 0.7 × old + 0.3 × estimate, changing by at most 5% per week.
- Unlogged days are skipped, never treated as zero.

**In-app copy (onboarding screen and the ⓘ next to Today's budget):**

> **Why only half your exercise counts**
> Treadmills, bikes, and calorie formulas often overestimate what you burn by 20 to 50%. If we added every exercise calorie back to your budget, your deficit would quietly disappear. So we credit 50% of exercise calories to today's budget. You can change this in Settings, but 50% is the honest default.

## Training engine

The app plans each week from the user's training days and phase. Every week is strength-led, with pilates for core and mobility and cardio mostly as short finishers. Equipment: dumbbells, treadmill, standing bike, step platform, body weight.

**Weekly templates** (picked by number of training days set in Settings)

| Days / week | Plan |
| --- | --- |
| 3 | Full body A · Pilates + steady cardio · Full body B |
| 4 | Upper · Lower · Pilates · Full body |
| 5 | Upper · Lower · Pilates · Full body · Steady cardio + mobility |

Non-training days are rest days. The app suggests an optional easy walk but never counts a rest day as missed. Two strength days are never placed back to back on the same muscle group.

**Session structure (strength days)**

1. Warm-up: 5 min easy bike.
2. 4 to 6 exercises from the session's focus areas.
3. Finisher: 8 to 12 min intervals on bike, treadmill or step (e.g. 30 s hard, 60 s easy).
4. Cool-down: 3 to 5 min of stretches from the mobility list.

**Focus areas.** Before starting, the user can change today's focus (chest, back, shoulders, arms, core, glutes, legs). The engine rebuilds the session and warns if a muscle group already got two sessions this week.

**Volume by phase**

| Phase | Sets per exercise | Rep range | Rest |
| --- | --- | --- | --- |
| Fat loss | 3 | 8 to 12 | 60 to 90 s |
| Recomposition | 3 | 8 to 12 | 60 to 90 s |
| Maintenance | 2 to 3 | 6 to 10 | 90 s |
| Aggressive (v2, locked) | defined later | defined later | defined later |

**Exercise library.** Import [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain; confirm the license file at import). Keep only exercises whose equipment is dumbbell, body only, or a cardio machine the user has. Copy the images into the app's assets so it works offline. Each exercise gets a `mode` field: `timed` for holds, stretches and cardio, `reps` for everything else, with a manual override list (e.g. plank = timed).

**Motion loop.** Each exercise has two images (start and end position). The player alternates them every 1 second with a 300 ms crossfade. Optional `videoUrl` field for a YouTube reference link.

**Pilates and mobility.** The library is thin here, so add 15 to 20 moves by hand (e.g. dead bug, glute bridge, bird dog, clamshell, side-lying leg lift, the hundred, single-leg stretch, side plank, cat-cow, hip flexor stretch, pigeon, child's pose), each with a text description and an empty `videoUrl` for the user to fill.

On pilates days the engine picks a session type and explains why in one line:

- Types: core, lower body strength, full body, low impact recovery, higher intensity.
- Rules: after heavy lower body → low impact or core. After a rest day or a light week → full body or higher intensity. In a maintenance phase → more lower body strength.
- Example reason: "Low impact today: you did heavy lower body yesterday."
- The session shows a MadFit video from `pilatesLinks` matching the type. If none exists: "Add a MadFit link for this type in Settings." Never invent video URLs.

**Player screen**

- Rep-based: set number, target reps, suggested weight, inputs for actual reps and kg. The rest timer starts when the set is saved.
- Timed: countdown with a 3-2-1 beep and vibration, then auto-advance.
- Keep the screen on with the Wake Lock API. Skip, pause and "swap exercise" (same muscle, same equipment) buttons.

**Progressive overload (double progression).** When every set hits the top of the rep range at the same weight, suggest the next dumbbell up next time (step size from the user's dumbbell list in Settings). If the bottom of the range is missed in two sessions in a row, suggest going down one step.

## Nutrition logging

The user types a meal in plain words, e.g. `2 eggs, 40g rye bread, 1 cucumber`. The app parses it against the profile's My Foods pantry, shows the totals, and saves after one confirm tap. It runs fully offline with no food API.

**Parser rules**

- Items split on commas, "and", or new lines.
- Each item = optional quantity + optional unit + food name. Units: g, kg, ml, l, tbsp, tsp, cup, slice, piece. No unit means piece.
- Food names match pantry names and aliases, ignoring case and plural endings ("eggs" matches "egg"). If several foods match, the user picks one and the choice is saved as an alias.
- Unknown food: ask once for kcal and protein per 100 g (from the label) or per piece, plus grams per piece if relevant. Then it's saved to the pantry.
- Confirm screen: one row per item with kcal and protein, each row editable, totals at the bottom.

**Pantry seed.** About 100 common staples (eggs, chicken breast, Greek yogurt, oats, rice, bread, common vegetables and fruit, beans, tuna, olive oil, nuts). Values come from Health Canada's Canadian Nutrient File. Nas downloads the CSV and a build script converts it to `seedFoods.json`. **Never type nutrition values from memory.** Users can edit any pantry item.

**Saved meals.** Any confirmed meal can be saved by name ("usual shake") and logged later in one tap, with an optional portion multiplier.

**Meal suggestions.** A built-in list of about 30 simple meal ideas, each tagged with kcal, protein and ingredients from the seed pantry. Today's screen suggests the 3 that best fit the remaining calories and protein, preferring protein when it is behind.

**"Done logging today."** A button on Today. Only days marked done count toward adaptive maintenance. If it's missing at midnight the day is stored as "incomplete" and skipped by the coach.

## Coach brain

The app decides when to change phase and proposes it on the Today screen. The user accepts with one tap or postpones once, for one week. Every decision uses trend weight and fully logged days only; paused days never count.

Phase flow: Fat loss → Recomposition (near target) → Maintenance (at target). From Fat loss, detours go to Diet break (after 12 deficit weeks, back in 1 to 2 weeks) or Plateau check (stall of 3+ weeks). From Maintenance, a new goal started by the user returns to Fat loss.

**Phases**

| Phase | Calories | Enters when | Leaves when |
| --- | --- | --- | --- |
| Fat loss | Maintenance minus deficit (rule 3) | User sets a goal below current trend weight | Within 1 kg of target → Recomposition. 12 straight deficit weeks → Diet break. Stall → Plateau check |
| Recomposition | Maintenance minus 250 | Trend within 1 kg of target | Trend reaches target → Maintenance |
| Maintenance | Maintenance. Raised 100 kcal per week until reached | Target reached | User sets a new goal |
| Diet break | Maintenance, 1 or 2 weeks (user picks) | 12 straight deficit weeks, or chosen at a plateau | Time is up → previous phase. Deficit-week counter resets |
| Aggressive block (v2) | Locked | Defined in v2 | Defined in v2 |

**Plateau check**

- Stall = trend weight drops less than 0.2 kg over 21 days, with at least 14 fully logged days, while in Fat loss.
- Fewer than 14 logged days: no plateau verdict. Show "Log every meal for a week so I can tell what's happening" instead.
- Options, shown in this order:
  1. **Logging check:** weigh and log everything for 7 days, then re-check.
  2. **Diet break:** 1 to 2 weeks at maintenance.
  3. **Small adjustment:** 100 to 150 kcal less per day (never below the floor), or a daily 20 min walk.
  4. **Short aggressive block:** shown disabled with "Coming in 2.0".
- The choice is saved in `events[]` and not offered again for 3 weeks.

**Pause mode** (holiday, sick, busy)

- Start from Today or Settings: pick a reason, optional end date, optional note.
- While paused: no workouts or targets are planned. Today shows "Paused: <reason>" and the maintenance number as a loose guide. Logging is still allowed, but nothing is judged.
- Paused days are excluded from trend weight, adaptive maintenance, plateau detection and the 12-week deficit count. Streaks freeze; they never break.
- After 14 days paused: a gentle prompt to extend or resume.
- **Coming back:**
  1. "Welcome back" screen asking for a weigh-in each morning for the next 5 days.
  2. The coach waits for 3 weigh-ins, then uses their average as the new baseline. The screen explains that post-holiday weight is often 1 to 2 kg of water and settles within a week, so the jump is never treated as fat.
  3. If the pause was longer than 7 days, the first week back uses one fewer set per exercise. Sick pauses always get a lighter first session.
  4. Then the plan picks up in the same phase, targets recalculated from the new baseline.

**Aggressive mode stub (build the structure now, no logic)**

- `settings.mode` accepts `moderate` (default) and `aggressive`. The Settings toggle for aggressive is visible but disabled, labelled "Coming in 2.0".
- `engine/modes.ts` exports a config per mode with: maxDeficitKcal, maxWeeksPerBlock, proteinGPerKg, calorieFloorKcal, volumeTable. Moderate is filled in from this spec. Aggressive has every field set to `null` with a `TODO(v2)` comment.
- The plateau screen's option 4 and the Aggressive block phase type exist in code but are never reachable in v1.

## Screens

Ten screens, reached through a bottom nav with five tabs: Today, Week, Log (+), Progress, More. Design for one-handed phone use first.

| Screen | What it shows and does |
| --- | --- |
| Profile picker | Two cards, Nasim and Kash. Remembers the last profile on each device. Switch from More. |
| Onboarding | First launch of a profile: sex, birth date, height, current weight, daily-life factor, goal (target kg + date, or "maintain"), training days, dumbbell weights owned, the 50% explainer, GitHub token setup (skippable). |
| Today | Phase badge. Plan card (session type, minutes, "burned ~X, counted Y"). Calorie budget ring with ⓘ. Protein bar. Quick-log buttons for meal, activity, weight. Coach message (phase proposals, plateau options, pause return). Three meal suggestions. "Done logging today". Pause button. |
| Workout player | Motion loop, exercise name, set and rep or countdown, weight input, rest timer, skip, swap, pause. Summary at the end. |
| Log meal | Free-text box, then the confirm screen with parsed rows. Saved meals as one-tap chips above the box. |
| Log activity | Type, minutes, estimated kcal and counted kcal. |
| Week | Monday to Sunday strip: planned, done, rest, flex, paused. Weekly budget used and left. Set the flex day here. |
| Progress | Trend weight line with daily dots, goal line and projected date. Adherence (sessions done vs planned, days fully logged). Strength chart per main lift. Phase history. |
| Pantry | My Foods list with search, edit and add. Saved meals. |
| Settings | Profile data, training days, equipment, exercise credit %, mode (aggressive disabled), pilates links, sync token and expiry, sync status, export and import. |

## Milestones

Five milestones, each one usable on the phone when it's done. Sync comes second so real data is safe from the first week of use. Build one milestone at a time; all its boxes must pass before starting the next.

**M1. Skeleton, profiles, targets** (sections: Architecture, Data model, Calculation rules 1 to 4, Screens)

- [ ] App deploys to GitHub Pages from `main` via GitHub Actions
- [ ] Installs on Android from Chrome ("Add to Home screen") and opens offline
- [ ] Profile picker with Nasim and Kash; each starts empty
- [ ] Onboarding saves to IndexedDB; data survives closing the app and restarting the phone
- [ ] Today shows daily calorie target and protein target, matching hand calculation for one test profile
- [ ] Weigh-in logging works
- [ ] Export and Import buttons work (round-trip test: export, clear, import, nothing lost)
- [ ] Unit tests for BMR, deficit cap, floor and protein

**M2. GitHub sync** (sections: Data model and sync)

- [ ] Token and expiry saved in Settings, never exported or logged
- [ ] Pull on open, push 5 s after a change, status shown in the header
- [ ] Two devices editing the same profile offline, then reconnecting: both sets of entries survive
- [ ] Offline logging queues and syncs on reconnect
- [ ] Expired or wrong token shows the "paste a new one" screen; 7-day expiry warning works

**M3. Workouts** (sections: Training engine)

- [ ] Exercise library imported with offline images, filtered to owned equipment
- [ ] Weekly plan generated from training days and phase; rest days placed
- [ ] Focus areas can be changed before a session
- [ ] Player handles rep-based and timed moves, rest timer, wake lock, skip and swap
- [ ] Sets logged with reps and kg; next-session weight suggestion follows double progression
- [ ] Pilates days show type, reason line and a matching link from Settings (or the "add a link" prompt)

**M4. Nutrition and weekly budget** (sections: Calculation rules 5 and 6, Nutrition logging)

- [ ] Free-text meal parsing with confirm screen; unknown foods added once and remembered
- [ ] Seed pantry generated from the Canadian Nutrient File CSV
- [ ] Saved meals log in one tap
- [ ] Activity logging shows burned and counted kcal; the ⓘ copy appears on Today
- [ ] Weekly budget, ±20% daily clamp and flex day behave as specified (unit tests)
- [ ] Three meal suggestions fit remaining calories and protein
- [ ] "Done logging today" marks the day complete

**M5. Coach brain** (sections: Calculation rules 7 and 8, Coach brain)

- [ ] Trend weight and Progress screen charts
- [ ] Phase transitions proposed per the Phases table; accept or postpone once
- [ ] Diet break after 12 deficit weeks; plateau check with the four options (option 4 disabled)
- [ ] Pause mode: start, exclusions, 14-day prompt, welcome-back baseline from 3 weigh-ins
- [ ] Adaptive maintenance runs weekly using only fully logged days (unit tests with sample data)
- [ ] Aggressive mode stub present: config with nulls, disabled toggle, unreachable in v1

## Later

**v2 parking lot** (out of scope for v1; do not build)

- Aggressive mode logic and the short aggressive block for plateaus
- Reminder notifications (log weight, workout time, sync overdue)
- AI-generated meal ideas from the pantry
- Custom motion loops for the pilates moves
- APK build via Capacitor, if the PWA ever falls short
- Swap GitHub sync for Supabase, if sync becomes a pain
