import { useEffect, useRef, useState } from 'react'
import { Balloon as BalloonIcon, Sparkles, Trophy } from 'lucide-react'

// サンプルのReactゲーム：のぼってくる風船をタップしてわる
const COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']

let nextId = 0
const makeBalloon = () => ({
  id: nextId++,
  x: 5 + Math.random() * 80,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  duration: 5 + Math.random() * 3,
})

export default function Balloon() {
  const [balloons, setBalloons] = useState([])
  const [pops, setPops] = useState([])
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const loaded = useRef(false)

  // ベストスコアを読み込む（window.storage は互換レイヤー経由でlocalStorageに保存）
  useEffect(() => {
    window.storage.get('balloon-best').then((r) => {
      if (r) setBest(Number(r.value))
      loaded.current = true
    })
  }, [])

  useEffect(() => {
    if (loaded.current && score > best) {
      setBest(score)
      window.storage.set('balloon-best', String(score))
    }
  }, [score, best])

  useEffect(() => {
    const t = setInterval(() => setBalloons((b) => [...b.slice(-12), makeBalloon()]), 900)
    return () => clearInterval(t)
  }, [])

  const pop = (b, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setBalloons((list) => list.filter((x) => x.id !== b.id))
    setPops((p) => [...p, { id: b.id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }])
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== b.id)), 500)
    setScore((s) => s + 1)
  }

  const escaped = (id) => setBalloons((list) => list.filter((x) => x.id !== id))

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-200 to-sky-50">
      <style>{`
        @keyframes rise { from { transform: translateY(0) } to { transform: translateY(-120vh) } }
        @keyframes sway { 0%,100% { margin-left: 0 } 50% { margin-left: 18px } }
        @keyframes burst { from { transform: translate(-50%,-50%) scale(.5); opacity: 1 } to { transform: translate(-50%,-50%) scale(1.8); opacity: 0 } }
      `}</style>

      <div className="absolute right-4 top-4 z-40 flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-2xl font-black text-rose-500 shadow">
        <BalloonIcon size={26} strokeWidth={2.5} />
        {score}
        <span className="ml-2 flex items-center gap-1 text-base text-slate-400">
          <Trophy size={16} strokeWidth={2.5} />
          {best}
        </span>
      </div>

      {balloons.map((b) => (
        <button
          key={b.id}
          onPointerDown={(e) => pop(b, e)}
          onAnimationEnd={(e) => e.animationName === 'rise' && escaped(b.id)}
          className="absolute -bottom-32"
          style={{ left: `${b.x}%`, animation: `rise ${b.duration}s linear forwards, sway 2s ease-in-out infinite` }}
          aria-label="ふうせん"
        >
          <svg width="80" height="110" viewBox="0 0 80 110">
            <ellipse cx="40" cy="40" rx="32" ry="38" fill={b.color} />
            <ellipse cx="28" cy="26" rx="8" ry="12" fill="white" opacity=".45" />
            <path d="M36 77 L44 77 L40 84 Z" fill={b.color} />
            <path d="M40 84 Q34 95 40 110" stroke="#64748b" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      ))}

      {pops.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed text-amber-400"
          style={{ left: p.x, top: p.y, animation: 'burst .5s ease-out forwards' }}
        >
          <Sparkles size={64} strokeWidth={2.5} />
        </div>
      ))}
    </div>
  )
}
