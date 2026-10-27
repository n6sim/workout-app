import { useEffect, useRef, useState } from 'react'
import { storage } from '../storage/instance'
import type { ProfileHeader, ProfileId } from '../storage'
import { todayLocal } from '../util/today'
import { Card, primaryBtn, secondaryBtn } from './ui'

interface Props {
  profileId: ProfileId
  header: ProfileHeader
  onSwitch: () => void
  reload: () => void
  onOpenSettings: () => void
  onOpenPantry: () => void
}

export default function More({ profileId, header, onSwitch, reload, onOpenSettings, onOpenPantry }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  async function doExport() {
    const doc = await storage.exportProfile(profileId)
    if (!doc) return
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${profileId}-${todayLocal()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ ok: true, text: 'Exported. Check your Downloads folder.' })
  }

  async function doImport(file: File) {
    try {
      await storage.importProfile(profileId, await file.text())
      reload()
      setMessage({ ok: true, text: 'Imported and merged.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Import failed.' })
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">More</h1>

      <Card className="space-y-3">
        <p className="text-sm text-slate-400">Profile</p>
        <p className="text-lg font-semibold">{header.profile.name}</p>
        <button className={secondaryBtn} onClick={onSwitch}>Switch profile</button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">My pantry</h2>
        <p className="text-sm text-slate-400">Foods, calories and saved meals.</p>
        <button className={secondaryBtn} onClick={onOpenPantry}>Open pantry</button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Settings</h2>
        <p className="text-sm text-slate-400">Training days, equipment, dumbbells, pilates videos and GitHub backup.</p>
        <button className={primaryBtn} onClick={onOpenSettings}>Open settings</button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-sm text-slate-400">
          Export downloads everything for {header.profile.name} as a file. Import merges a file back in; nothing is
          overwritten unless the file has a newer edit.
        </p>
        <button className={primaryBtn} onClick={doExport}>Export</button>
        <button className={secondaryBtn} onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
            e.target.value = ''
          }}
        />
        {message && <p className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
      </Card>

      {persisted !== null && (
        <p className="text-xs text-slate-500">
          Storage protection: {persisted ? 'on (the browser will not clear your data)' : 'not granted. Installing the app to your home screen usually fixes this.'}
        </p>
      )}
    </div>
  )
}
