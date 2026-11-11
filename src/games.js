import { lazy } from 'react'
import { Balloon, Palette } from 'lucide-react'

/**
 * ゲーム一覧（ここに1行足すとトップページに並びます）
 *
 * type: 'react' … src/games/ に置いたReactコンポーネント
 *       'html'  … public/games/<id>/index.html に置いたHTMLファイル
 * icon:  Lucideのアイコン（https://lucide.dev/icons/ で探して import する）
 * color: カードの背景色、iconColor: アイコンの色（Tailwindのクラス）
 */
export const games = [
  {
    id: 'balloon',
    title: 'ふうせん わり',
    icon: Balloon,
    color: 'bg-rose-300',
    iconColor: 'text-rose-700',
    type: 'react',
    component: lazy(() => import('./games/balloon/Balloon.jsx')),
  },
  {
    id: 'color-match',
    title: 'いろ あて',
    icon: Palette,
    color: 'bg-sky-300',
    iconColor: 'text-sky-800',
    type: 'html',
  },
]

export const findGame = (id) => games.find((g) => g.id === id)
