import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import './lib/storage-shim.js'
import { findGame } from './games.js'
import './index.css'

/**
 * play.html?id=<ゲームID> で、Reactのゲームを1本だけ表示する。
 * iframeの中で動かすので、ゲームが 100vh などで画面いっぱいを前提にしていても、
 * そのまま上部バーの下に収まる。
 */
const id = new URLSearchParams(location.search).get('id')
const game = findGame(id)
const Game = game?.type === 'react' ? game.component : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {Game ? (
      <Suspense fallback={null}>
        <Game />
      </Suspense>
    ) : (
      <p style={{ padding: 24 }}>ゲームが見つかりません</p>
    )}
  </React.StrictMode>,
)
