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
    <div className="relative h-full w-full overflow-hidden">
      {/* もどるボタン：どのゲームでも左上に固定 */}
      <Link
        to="/"
        aria-label="もどる"
        className="absolute left-3 top-3 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-amber-600 shadow-lg active:scale-95"
      >
        <House size={30} strokeWidth={2.5} />
      </Link>

      {game.type === 'html' ? (
        <iframe
          src={`/games/${game.id}/index.html`}
          title={game.title}
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
  )
}
