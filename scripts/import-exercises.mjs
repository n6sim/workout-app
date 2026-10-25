// Builds the offline exercise library from free-exercise-db (public domain, Unlicense).
// Run: npm run import-exercises
// Keeps strength moves that need only dumbbells or body weight, body-only stretches, and the cardio machines
// this app supports. Images are shrunk to 400 px WebP and copied into public/exercises/ so the app works offline.
import { mkdir, writeFile, access, readdir, rm } from 'node:fs/promises'
import sharp from 'sharp'

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
const OUT_IMG = 'public/exercises'
const OUT_JSON = 'src/data/exercises.json'

// Cardio machines the app knows about. Everything else in the cardio category is skipped.
const CARDIO = {
  Bicycling_Stationary: 'standing bike',
  Walking_Treadmill: 'treadmill',
  Jogging_Treadmill: 'treadmill',
  Running_Treadmill: 'treadmill',
}

// Holds are timed, not counted (spec: manual override list).
const TIMED_OVERRIDES = [/^plank$/i, /^side plank/i, /isometric/i, /wall sit/i, /\bhold\b/i]
const DEFAULT_HOLD_SECONDS = 30

const exists = (p) => access(p).then(() => true, () => false)

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}

async function image(srcPath, destPath) {
  if (await exists(destPath)) return
  const res = await fetch(`${BASE}/exercises/${srcPath}`)
  if (!res.ok) throw new Error(`image ${srcPath}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await sharp(buf).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toFile(destPath)
}

const all = await getJson(`${BASE}/dist/exercises.json`)
const keep = []
for (const e of all) {
  if (e.level === 'expert') continue
  if (e.primaryMuscles.includes('neck')) continue // no focus area covers the neck
  if (e.category === 'cardio') {
    if (CARDIO[e.id]) keep.push({ e, kind: 'cardio', equipment: CARDIO[e.id] })
  } else if (e.category === 'stretching') {
    if (!e.equipment || e.equipment === 'body only') keep.push({ e, kind: 'stretch', equipment: 'body only' })
  } else if (e.category === 'strength' || e.category === 'powerlifting') {
    if (e.equipment === 'dumbbell' || e.equipment === 'body only') keep.push({ e, kind: 'strength', equipment: e.equipment })
  }
}

await mkdir(OUT_IMG, { recursive: true })
await mkdir('src/data', { recursive: true })

const out = []
let n = 0
for (const { e, kind, equipment } of keep) {
  if (!e.images || e.images.length < 2) continue // the motion loop needs a start and an end picture
  const dir = `${OUT_IMG}/${e.id}`
  await mkdir(dir, { recursive: true })
  await image(e.images[0], `${dir}/0.webp`)
  await image(e.images[1], `${dir}/1.webp`)
  const timed = kind !== 'strength' || TIMED_OVERRIDES.some((re) => re.test(e.name))
  out.push({
    id: e.id,
    name: e.name,
    kind,
    equipment,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    mechanic: e.mechanic ?? null,
    level: e.level,
    mode: timed ? 'timed' : 'reps',
    ...(timed ? { defaultSeconds: kind === 'stretch' ? 40 : DEFAULT_HOLD_SECONDS } : {}),
    images: [`exercises/${e.id}/0.webp`, `exercises/${e.id}/1.webp`],
    instructions: e.instructions,
    videoUrl: '', // optional YouTube reference link, filled in by the user. Never invented.
  })
  if (++n % 50 === 0) console.log(`${n} done`)
}

out.sort((a, b) => a.id.localeCompare(b.id))

// Remove pictures of exercises that are no longer kept, so reruns stay reproducible.
const wanted = new Set(out.map((x) => x.id))
for (const d of await readdir(OUT_IMG, { withFileTypes: true })) {
  if (d.isDirectory() && !wanted.has(d.name)) await rm(`${OUT_IMG}/${d.name}`, { recursive: true })
}
await writeFile(OUT_JSON, JSON.stringify(out, null, 1) + '\n')
await writeFile(
  `${OUT_IMG}/SOURCE.txt`,
  'Exercise data and images: free-exercise-db, https://github.com/yuhonas/free-exercise-db\nLicense: The Unlicense (public domain). See LICENSE.md in that repo.\nImages resized to 400 px wide WebP.\n',
)
const by = (k) => out.filter((x) => x.kind === k).length
console.log(`wrote ${out.length} exercises (strength ${by('strength')}, stretch ${by('stretch')}, cardio ${by('cardio')})`)
