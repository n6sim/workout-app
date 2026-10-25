import type { Exercise } from '../engine/training/types'

// Hand-written moves for pilates days, cool-downs and warm-ups. The library is thin here (spec: Exercise library).
// `videoUrl` stays empty on purpose: the user fills in links, nothing is invented.

type Move = Pick<Exercise, 'id' | 'name' | 'kind' | 'primaryMuscles' | 'mode' | 'defaultSeconds' | 'instructions'> &
  Partial<Pick<Exercise, 'equipment' | 'secondaryMuscles'>>

const move = (m: Move): Exercise => ({
  equipment: 'body only', secondaryMuscles: [], images: [], videoUrl: '', ...m,
})

export const HANDMADE: Exercise[] = [
  // Pilates
  move({ id: 'pilates-dead-bug', name: 'Dead bug', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Lie on your back with arms pointing to the ceiling and knees bent over your hips.',
    'Press your lower back gently into the floor.',
    'Lower one arm overhead and the opposite leg toward the floor, then return and switch sides.' ] }),
  move({ id: 'pilates-glute-bridge', name: 'Glute bridge', kind: 'pilates', primaryMuscles: ['glutes'], mode: 'reps', instructions: [
    'Lie on your back, knees bent, feet flat and hip-width apart.',
    'Press through your heels and lift your hips until your body is a straight line from shoulders to knees.',
    'Squeeze your glutes at the top, then lower slowly.' ] }),
  move({ id: 'pilates-bird-dog', name: 'Bird dog', kind: 'pilates', primaryMuscles: ['lower back'], secondaryMuscles: ['glutes', 'abdominals'], mode: 'reps', instructions: [
    'Start on hands and knees, wrists under shoulders and knees under hips.',
    'Reach one arm forward and the opposite leg back, keeping your hips level.',
    'Hold a moment, return, and switch sides.' ] }),
  move({ id: 'pilates-clamshell', name: 'Clamshell', kind: 'pilates', primaryMuscles: ['abductors'], secondaryMuscles: ['glutes'], mode: 'reps', instructions: [
    'Lie on your side with knees bent and stacked, feet together.',
    'Keeping your feet touching, open the top knee like a clam without rolling your hips back.',
    'Lower slowly. Do all reps, then switch sides.' ] }),
  move({ id: 'pilates-side-lying-leg-lift', name: 'Side-lying leg lift', kind: 'pilates', primaryMuscles: ['abductors'], secondaryMuscles: ['glutes'], mode: 'reps', instructions: [
    'Lie on your side with your body in one line and the bottom arm supporting your head.',
    'Lift the top leg to about hip height with the toes pointing forward.',
    'Lower with control. Do all reps, then switch sides.' ] }),
  move({ id: 'pilates-the-hundred', name: 'The hundred', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'timed', defaultSeconds: 60, instructions: [
    'Lie on your back, curl your head and shoulders up, and reach your arms long by your sides.',
    'Keep your legs in tabletop or extended low, whichever you can hold without arching your back.',
    'Pump your arms in small, quick beats while breathing in for 5 counts and out for 5 counts.' ] }),
  move({ id: 'pilates-single-leg-stretch', name: 'Single-leg stretch', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Lie on your back with your head and shoulders curled up and one knee pulled in.',
    'Extend the other leg long and switch legs in a smooth rhythm.',
    'Keep your lower back pressed down and your hands on the shin and knee of the bent leg.' ] }),
  move({ id: 'pilates-double-leg-stretch', name: 'Double-leg stretch', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Lie on your back, head and shoulders curled up, knees hugged in.',
    'Reach your arms overhead and your legs long at the same time as you breathe in.',
    'Circle your arms around and pull your knees back in as you breathe out.' ] }),
  move({ id: 'pilates-roll-up', name: 'Roll-up', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Lie on your back with legs long and arms overhead.',
    'Lift your arms, then slowly peel your head, shoulders and spine off the floor one bone at a time.',
    'Reach over your legs, then roll back down with control. Bend your knees if it is too hard.' ] }),
  move({ id: 'pilates-criss-cross', name: 'Criss-cross', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Lie on your back with hands behind your head and knees over your hips.',
    'Curl up and rotate your chest toward one knee while extending the other leg.',
    'Switch sides in a slow, steady rhythm. Turn from your ribs, not your elbows.' ] }),
  move({ id: 'pilates-swimming', name: 'Swimming', kind: 'pilates', primaryMuscles: ['lower back'], secondaryMuscles: ['glutes'], mode: 'reps', instructions: [
    'Lie face down with arms reaching forward and legs long.',
    'Lift your arms, chest and legs slightly off the floor.',
    'Flutter opposite arm and leg up and down in small, quick movements while breathing steadily.' ] }),
  move({ id: 'pilates-side-plank', name: 'Side plank', kind: 'pilates', primaryMuscles: ['abdominals'], mode: 'timed', defaultSeconds: 30, instructions: [
    'Lie on your side with your elbow under your shoulder and legs stacked.',
    'Lift your hips so your body forms a straight line from head to feet.',
    'Hold, breathing steadily, then switch sides. Drop the bottom knee to make it easier.' ] }),
  move({ id: 'pilates-leg-circles', name: 'Leg circles', kind: 'pilates', primaryMuscles: ['abdominals'], secondaryMuscles: ['quadriceps'], mode: 'reps', instructions: [
    'Lie on your back with one leg pointing to the ceiling and the other long on the floor.',
    'Draw a small circle with the raised leg while keeping your pelvis still.',
    'Do all circles one way, reverse, then switch legs.' ] }),
  move({ id: 'pilates-spine-twist', name: 'Seated spine twist', kind: 'pilates', primaryMuscles: ['middle back'], secondaryMuscles: ['abdominals'], mode: 'reps', instructions: [
    'Sit tall with legs long and arms reaching out to the sides.',
    'Breathe in and grow taller, then breathe out and rotate your upper body to one side.',
    'Return to center and rotate to the other side. Keep both hips on the floor.' ] }),

  // Mobility and cool-down stretches (timed)
  move({ id: 'mobility-cat-cow', name: 'Cat-cow', kind: 'mobility', primaryMuscles: ['lower back'], secondaryMuscles: ['middle back'], mode: 'timed', defaultSeconds: 40, instructions: [
    'Start on hands and knees.',
    'Breathe in as you drop your belly and lift your chest and tailbone.',
    'Breathe out as you round your spine toward the ceiling and tuck your chin. Flow slowly between the two.' ] }),
  move({ id: 'mobility-hip-flexor-stretch', name: 'Hip flexor stretch', kind: 'mobility', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes'], mode: 'timed', defaultSeconds: 40, instructions: [
    'Kneel on one knee with the other foot forward, both knees at about 90 degrees.',
    'Tuck your tailbone under and shift your weight forward until you feel a stretch at the front of the back hip.',
    'Hold, then switch sides.' ] }),
  move({ id: 'mobility-pigeon', name: 'Pigeon pose', kind: 'mobility', primaryMuscles: ['glutes'], mode: 'timed', defaultSeconds: 40, instructions: [
    'From hands and knees, bring one knee forward behind your wrist and angle the shin across your body.',
    'Slide the other leg back and lower your hips toward the floor.',
    'Fold forward over the front leg and breathe. Hold, then switch sides.' ] }),
  move({ id: 'mobility-childs-pose', name: "Child's pose", kind: 'mobility', primaryMuscles: ['lats'], secondaryMuscles: ['lower back'], mode: 'timed', defaultSeconds: 40, instructions: [
    'Kneel with your big toes together and knees wide.',
    'Sit your hips back toward your heels and reach your arms forward along the floor.',
    'Rest your forehead down and breathe into your back.' ] }),
  move({ id: 'mobility-figure-four', name: 'Figure-four stretch', kind: 'mobility', primaryMuscles: ['glutes'], mode: 'timed', defaultSeconds: 40, instructions: [
    'Lie on your back with knees bent and feet flat.',
    'Cross one ankle over the opposite knee.',
    'Pull the bottom thigh toward your chest until you feel the stretch in the crossed-over hip. Hold, then switch sides.' ] }),
  move({ id: 'mobility-open-book', name: 'Open book', kind: 'mobility', primaryMuscles: ['middle back'], secondaryMuscles: ['chest'], mode: 'timed', defaultSeconds: 40, instructions: [
    'Lie on your side with knees bent and stacked and arms straight in front of you, palms together.',
    'Lift the top arm and open it across your body like a book, following your hand with your eyes.',
    'Return slowly. Do all of one side, then switch.' ] }),

  // Warm-up and finisher options the database does not cover
  move({ id: 'warmup-march', name: 'March on the spot', kind: 'warmup', primaryMuscles: ['quadriceps'], mode: 'timed', defaultSeconds: 300, instructions: [
    'March in place at an easy pace, lifting your knees and swinging your arms.',
    'Keep breathing comfortably. This is a warm-up, not a workout.' ] }),
  move({ id: 'cardio-step-platform', name: 'Step platform intervals', kind: 'cardio', equipment: 'step platform', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'calves'], mode: 'timed', defaultSeconds: 30, instructions: [
    'Step up onto the platform with one foot, then the other, and step back down.',
    'On the hard intervals, step quickly. On the easy intervals, slow to a walking pace.',
    'Alternate your leading foot every minute or so.' ] }),
]
