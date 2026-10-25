import { PROFILES, type ProfileId } from '../storage'

export default function ProfilePicker({ onPick }: { onPick: (id: ProfileId) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="mb-2 text-center text-2xl font-semibold">Who's training?</h1>
      {PROFILES.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className="rounded-2xl bg-slate-800 py-10 text-2xl font-semibold active:bg-slate-700"
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
