import type { ReactNode } from 'react'

export const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-base text-slate-100 outline-none focus:border-sky-500'
export const primaryBtn =
  'w-full rounded-xl bg-sky-500 py-3 text-base font-semibold text-slate-950 active:bg-sky-400 disabled:opacity-50'
export const secondaryBtn =
  'w-full rounded-xl bg-slate-800 py-3 text-base font-medium text-slate-100 active:bg-slate-700 disabled:opacity-50'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-slate-800 p-4 ${className}`}>{children}</section>
}
