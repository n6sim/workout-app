import { useEffect, useState } from 'react'
import { storage } from '../storage/instance'
import type { PilatesLink, ProfileId } from '../storage'
import { PILATES_LABEL } from '../engine/training/pilates'
import type { PilatesType } from '../engine/training/types'
import { Card, inputCls, secondaryBtn } from './ui'

const TYPES = Object.keys(PILATES_LABEL) as PilatesType[]

function isWebUrl(text: string) {
  try {
    const u = new URL(text)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** One MadFit link per pilates type, entered by the user. The app never supplies a link. */
export default function PilatesLinksSettings({ profileId, links, reload }: { profileId: ProfileId; links: PilatesLink[]; reload: () => void }) {
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Pilates videos</h2>
      <p className="text-sm text-slate-400">Paste a MadFit video link for each type. It shows on pilates days when that type is picked.</p>
      {TYPES.map((t) => (
        <LinkRow key={t} type={t} profileId={profileId} link={links.find((l) => l.type === t)} reload={reload} />
      ))}
    </Card>
  )
}

function LinkRow({ type, profileId, link, reload }: { type: PilatesType; profileId: ProfileId; link?: PilatesLink; reload: () => void }) {
  const [title, setTitle] = useState(link?.title ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setTitle(link?.title ?? '')
    setUrl(link?.url ?? '')
  }, [link?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!url.trim()) {
      if (link) await storage.deleteEntry('pilatesLinks', profileId, link.id)
      setTitle('')
      setError('')
      setSaved(false)
      return reload()
    }
    if (!isWebUrl(url.trim())) return setError('That does not look like a web link (https://…).')
    setError('')
    await storage.saveEntry('pilatesLinks', profileId, { ...(link ?? {}), type, title: title.trim(), url: url.trim() })
    setSaved(true)
    reload()
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{PILATES_LABEL[type]}</p>
      <input className={inputCls} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={inputCls} placeholder="https://…" autoCapitalize="none" autoCorrect="off" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-400">Saved.</p>}
      <button className={secondaryBtn} onClick={() => void save()}>{url.trim() ? 'Save link' : link ? 'Remove link' : 'Save link'}</button>
    </div>
  )
}
