import { lazy } from 'react'
import {
  Balloon,
  BrickWall,
  CarFront,
  Castle,
  ChessKnight,
  Flag,
  Orbit,
  Palette,
  Rotate3d,
  TreePalm,
} from 'lucide-react'

/**
 * ゲーム一覧（ここに1行足すとトップページに並びます）
 *
 * type: 'react' … src/games/ に置いたReactコンポーネント
 *       'html'  … public/games/<id>/index.html に置いたHTMLファイル
 * icon:  Lucideのアイコン（https://lucide.dev/icons/ で探して import する）
 * color: カードの背景色、iconColor: アイコンの色（Tailwindのクラス）
 */
export const games = [
  { id: 'mame-kart', title: 'まめカートGP', icon: CarFront, color: 'bg-orange-300', iconColor: 'text-orange-800', type: 'html' },
  { id: 'rush-kart', title: 'ラッシュカート', icon: Flag, color: 'bg-red-300', iconColor: 'text-red-800', type: 'html' },
  { id: 'chess-dojo', title: 'チェス作戦道場', icon: ChessKnight, color: 'bg-stone-300', iconColor: 'text-stone-800', type: 'html' },
  { id: 'futatsu-no-kage', title: 'ふたつの影', icon: Rotate3d, color: 'bg-indigo-300', iconColor: 'text-indigo-900', type: 'html' },
  { id: 'rojo-3d', title: '籠城戦 3D', icon: Castle, color: 'bg-amber-300', iconColor: 'text-amber-900', type: 'html' },
  { id: 'reverse-breakout', title: '逆ブロック崩し', icon: BrickWall, color: 'bg-fuchsia-300', iconColor: 'text-fuchsia-900', type: 'html' },
  { id: 'pokapoka-island', title: 'ぽかぽか島ぐらし', icon: TreePalm, color: 'bg-emerald-300', iconColor: 'text-emerald-900', type: 'html' },
  { id: 'orbit-defense', title: '軌道防衛線', icon: Orbit, color: 'bg-violet-300', iconColor: 'text-violet-900', type: 'html' },
  {
    id: 'balloon',
    title: 'ふうせん わり',
    icon: Balloon,
    color: 'bg-rose-300',
    iconColor: 'text-rose-700',
    type: 'react',
    component: lazy(() => import('./games/balloon/Balloon.jsx')),
  },
  { id: 'color-match', title: 'いろ あて', icon: Palette, color: 'bg-sky-300', iconColor: 'text-sky-800', type: 'html' },
]

export const findGame = (id) => games.find((g) => g.id === id)
