import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Gamepad2, LayoutGrid } from 'lucide-react'
import { games, genres } from '../games.js'

function GameCard({ g }) {
  return (
    <li>
      <Link
        to={`/play/${g.id}`}
        className={`${g.color} flex aspect-square flex-col items-center justify-center gap-3 rounded-[2rem] px-2 text-center shadow-[0_6px_0_rgba(0,0,0,0.15)] transition active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.15)]`}
      >
        <g.icon className={`h-14 w-14 sm:h-16 sm:w-16 ${g.iconColor ?? 'text-slate-700'}`} strokeWidth={2} />
        <span className="text-lg font-bold leading-tight text-slate-800 sm:text-xl">{g.title}</span>
      </Link>
    </li>
  )
}

function Grid({ list }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {list.map((g) => (
        <GameCard key={g.id} g={g} />
      ))}
    </ul>
  )
}

export default function Home() {
  // 選んだジャンルはURL（?g=race など）に残すので、ゲームから「もどる」と同じ表示に戻る
  const [params, setParams] = useSearchParams()
  const current = genres.some((x) => x.id === params.get('g')) ? params.get('g') : 'all'
  const select = (id) => setParams(id === 'all' ? {} : { g: id }, { replace: true })

  // 選んでいるボタンが画面の外にあるときは、見える位置まで横にスクロールする
  const activeRef = useRef(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [current])

  const tabs = [{ id: 'all', label: 'すべて', icon: LayoutGrid }, ...genres]
  const count = (id) => (id === 'all' ? games.length : games.filter((g) => g.genre === id).length)

  return (
    <main className="min-h-full pb-12">
      <h1 className="flex items-center justify-center gap-3 px-5 pt-8 pb-5 text-4xl font-black tracking-wide text-amber-600 sm:text-5xl">
        <Gamepad2 className="h-11 w-11 sm:h-14 sm:w-14" strokeWidth={2.5} />
        あそびば
      </h1>

      {/* ジャンルの切り替え：横にスクロールできるボタン列。上に固定 */}
      <nav className="sticky top-0 z-10 bg-[#fff8ec]/95 py-3 backdrop-blur">
        <ul className="mx-auto flex max-w-5xl gap-2 overflow-x-auto scroll-px-5 px-5 [scrollbar-width:none]">
          {tabs.map((t) => {
            const on = current === t.id
            return (
              <li key={t.id} className="shrink-0" ref={on ? activeRef : null}>
                <button
                  onClick={() => select(t.id)}
                  className={`flex h-11 items-center gap-1.5 rounded-full px-4 font-bold transition active:scale-95 ${
                    on ? 'bg-amber-500 text-white shadow' : 'bg-white text-slate-600 shadow-sm'
                  }`}
                >
                  <t.icon size={20} strokeWidth={2.5} />
                  {t.label}
                  <span className={`text-sm ${on ? 'text-amber-100' : 'text-slate-400'}`}>{count(t.id)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mx-auto max-w-5xl px-5">
        {current === 'all' ? (
          genres.map((gen) => {
            const list = games.filter((g) => g.genre === gen.id)
            if (list.length === 0) return null
            return (
              <section key={gen.id} className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 text-2xl font-black text-slate-700">
                  <gen.icon size={26} strokeWidth={2.5} className="text-amber-500" />
                  {gen.label}
                </h2>
                <Grid list={list} />
              </section>
            )
          })
        ) : (
          <div className="mt-6">
            <Grid list={games.filter((g) => g.genre === current)} />
          </div>
        )}
      </div>
    </main>
  )
}
