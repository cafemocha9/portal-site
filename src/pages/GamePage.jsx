import { Suspense } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { House } from 'lucide-react'
import { findGame } from '../games.js'

export default function GamePage() {
  const { id } = useParams()
  const game = findGame(id)
  if (!game) return <Navigate to="/" replace />

  const Game = game.component

  return (
    <div className="flex h-full w-full flex-col">
      {/* 上部の細いバー：ゲーム画面に重ならないよう、ゲームの外に置く */}
      <header className="flex h-12 shrink-0 items-center gap-3 bg-white px-2 shadow-sm">
        <Link
          to="/"
          aria-label="もどる"
          className="flex h-10 items-center gap-1 rounded-full bg-amber-100 px-4 font-bold text-amber-700 active:scale-95"
        >
          <House size={22} strokeWidth={2.5} />
          もどる
        </Link>
        <game.icon size={22} className={game.iconColor ?? 'text-slate-600'} />
        <span className="truncate font-bold text-slate-700">{game.title}</span>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {game.type === 'html' ? (
          <iframe
            src={`/games/${game.id}/index.html`}
            title={game.title}
            allow="autoplay; fullscreen; gamepad"
            className="h-full w-full border-0"
          />
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <game.icon className={`h-20 w-20 animate-pulse ${game.iconColor ?? 'text-slate-500'}`} />
              </div>
            }
          >
            <Game />
          </Suspense>
        )}
      </div>
    </div>
  )
}
