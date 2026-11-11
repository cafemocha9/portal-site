import { Link } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import { games } from '../games.js'

export default function Home() {
  return (
    <main className="min-h-full px-5 py-8 sm:px-10">
      <h1 className="mb-8 flex items-center justify-center gap-3 text-4xl font-black tracking-wide text-amber-600 sm:text-5xl">
        <Gamepad2 className="h-11 w-11 sm:h-14 sm:w-14" strokeWidth={2.5} />
        あそびば
      </h1>

      <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-5 sm:grid-cols-3">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              to={`/play/${g.id}`}
              className={`${g.color} flex aspect-square flex-col items-center justify-center gap-3 rounded-[2rem] shadow-[0_6px_0_rgba(0,0,0,0.15)] transition active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.15)]`}
            >
              <g.icon className={`h-16 w-16 sm:h-20 sm:w-20 ${g.iconColor ?? 'text-slate-700'}`} strokeWidth={2} />
              <span className="text-xl font-bold text-slate-800 sm:text-2xl">{g.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
