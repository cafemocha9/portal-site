import { lazy } from 'react'
import {
  Atom,
  Balloon,
  Bird,
  Blocks,
  BrickWall,
  CarFront,
  Castle,
  ChessKnight,
  Crosshair,
  Crown,
  Dices,
  Disc3,
  Flag,
  Ghost,
  Grid3x3,
  Music,
  Orbit,
  Palette,
  PawPrint,
  Pencil,
  Pickaxe,
  Rat,
  Rocket,
  Rotate3d,
  Swords,
  TreePalm,
  Zap,
} from 'lucide-react'

/**
 * ゲーム一覧（ここに1件足すとトップページに並びます）
 *
 * type: 'react' … src/games/<id>/ に置いたReactコンポーネント（component に lazy(import) を書く）
 *       'html'  … public/games/<id>/index.html に置いたHTMLファイル
 * icon:  Lucideのアイコン（https://lucide.dev/icons/ で探して上で import する）
 * color: カードの背景色、iconColor: アイコンの色（Tailwindのクラス）
 */
export const games = [
  // --- 3D・アクション ---
  { id: 'mame-kart', title: 'まめカートGP', icon: CarFront, color: 'bg-orange-300', iconColor: 'text-orange-800', type: 'html' },
  { id: 'rush-kart', title: 'ラッシュカート', icon: Flag, color: 'bg-red-300', iconColor: 'text-red-800', type: 'html' },
  { id: 'craftbox', title: 'CraftBox', icon: Pickaxe, color: 'bg-green-300', iconColor: 'text-green-900', type: 'html' },
  { id: 'pokapoka-island', title: 'ぽかぽか島ぐらし', icon: TreePalm, color: 'bg-emerald-300', iconColor: 'text-emerald-900', type: 'html' },
  { id: 'neon-hop', title: 'NEON HOP', icon: Music, color: 'bg-pink-300', iconColor: 'text-pink-900', type: 'html' },
  { id: 'mouse-rocket', title: 'Mouse Rocket', icon: Rat, color: 'bg-amber-200', iconColor: 'text-amber-900', type: 'html' },
  { id: 'neon-survivor', title: 'NEON SURVIVOR', icon: Zap, color: 'bg-lime-200', iconColor: 'text-lime-900', type: 'html' },
  { id: 'danmaku', title: '幻想弾幕', icon: Crosshair, color: 'bg-purple-300', iconColor: 'text-purple-900', type: 'html' },
  { id: 'reverse-breakout', title: '逆ブロック崩し', icon: BrickWall, color: 'bg-fuchsia-300', iconColor: 'text-fuchsia-900', type: 'html' },
  { id: 'kido', title: '軌道 -KIDO-', icon: Rocket, color: 'bg-cyan-300', iconColor: 'text-cyan-900', type: 'html' },
  { id: 'zanzo', title: '残像 -ZANZO-', icon: Ghost, color: 'bg-slate-300', iconColor: 'text-slate-800', type: 'html' },
  { id: 'singularity', title: '特異点', icon: Atom, color: 'bg-blue-300', iconColor: 'text-blue-900', type: 'html' },

  // --- 作戦・パズル ---
  { id: 'animal-defense', title: 'どうぶつディフェンス', icon: PawPrint, color: 'bg-orange-200', iconColor: 'text-orange-900', type: 'html' },
  { id: 'rojo-3d', title: '籠城戦 3D', icon: Castle, color: 'bg-amber-300', iconColor: 'text-amber-900', type: 'html' },
  { id: 'orbit-defense', title: '軌道防衛線', icon: Orbit, color: 'bg-violet-300', iconColor: 'text-violet-900', type: 'html' },
  { id: 'breach', title: 'BREACH', icon: Swords, color: 'bg-rose-300', iconColor: 'text-rose-900', type: 'react', component: lazy(() => import('./games/breach/Game.jsx')) },
  { id: 'mystery-dungeon', title: '不思議の迷宮', icon: Dices, color: 'bg-lime-300', iconColor: 'text-lime-900', type: 'react', component: lazy(() => import('./games/mystery-dungeon/Game.jsx')) },
  { id: 'futatsu-no-kage', title: 'ふたつの影', icon: Rotate3d, color: 'bg-indigo-300', iconColor: 'text-indigo-900', type: 'html' },
  { id: 'rensa-dojo', title: '連鎖道場', icon: Blocks, color: 'bg-red-200', iconColor: 'text-red-900', type: 'html' },
  { id: 'chess-dojo', title: 'チェス作戦道場', icon: ChessKnight, color: 'bg-stone-300', iconColor: 'text-stone-800', type: 'html' },
  { id: 'chess', title: 'チェス', icon: Crown, color: 'bg-yellow-200', iconColor: 'text-yellow-900', type: 'react', component: lazy(() => import('./games/chess/Game.jsx')) },
  { id: 'chess2', title: 'チェス2', icon: Crown, color: 'bg-amber-200', iconColor: 'text-amber-900', type: 'react', component: lazy(() => import('./games/chess2/Game.jsx')) },
  { id: 'line-protocol', title: '五目並べ', icon: Grid3x3, color: 'bg-teal-300', iconColor: 'text-teal-900', type: 'react', component: lazy(() => import('./games/line-protocol/Game.jsx')) },

  // --- のんびり・ことば ---
  { id: 'illust-shiritori', title: 'イラストしりとり', icon: Pencil, color: 'bg-yellow-300', iconColor: 'text-yellow-900', type: 'html' },
  { id: 'kotori-niwa', title: 'ことりの庭', icon: Bird, color: 'bg-sky-200', iconColor: 'text-sky-900', type: 'html' },

  // --- 音・おためし ---
  { id: 'tech-house-loop', title: 'Tech House Loop', icon: Disc3, color: 'bg-zinc-300', iconColor: 'text-zinc-800', type: 'html' },
  { id: 'balloon', title: 'ふうせん わり', icon: Balloon, color: 'bg-rose-200', iconColor: 'text-rose-700', type: 'react', component: lazy(() => import('./games/balloon/Balloon.jsx')) },
  { id: 'color-match', title: 'いろ あて', icon: Palette, color: 'bg-sky-300', iconColor: 'text-sky-800', type: 'html' },
]

export const findGame = (id) => games.find((g) => g.id === id)
