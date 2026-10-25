import { useEffect, useState } from 'react'

const base = import.meta.env.BASE_URL

/** Start and end picture, swapped every second with a 300 ms crossfade (spec: Motion loop). */
export default function MotionLoop({ images, name }: { images: string[]; name: string }) {
  const [second, setSecond] = useState(false)

  useEffect(() => {
    setSecond(false)
    if (images.length < 2) return
    const id = setInterval(() => setSecond((s) => !s), 1000)
    return () => clearInterval(id)
  }, [images])

  if (images.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-slate-800 px-4 text-center text-slate-400">
        {name}
      </div>
    )
  }
  const cls = 'absolute inset-0 h-full w-full object-contain transition-opacity duration-300'
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-white">
      <img src={`${base}${images[0]}`} alt={`${name}, start position`} className={cls} style={{ opacity: second && images.length > 1 ? 0 : 1 }} />
      {images[1] && <img src={`${base}${images[1]}`} alt={`${name}, end position`} className={cls} style={{ opacity: second ? 1 : 0 }} />}
    </div>
  )
}
