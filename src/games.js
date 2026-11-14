import { lazy } from 'react'
import {
  Atom,
  Balloon,
  Bird,
  Blocks,
  Brain,
  BrickWall,
  CarFront,
  Castle,
  ChessKnight,
  CircleDot,
  Compass,
  Crosshair,
  Crown,
  Diamond,
  Dices,
  Drum,
  Earth,
  Disc3,
  DoorClosed,
  Flag,
  Footprints,
  Ghost,
  GraduationCap,
  Grid3x3,
  Music,
  Orbit,
  Palette,
  PawPrint,
  Pencil,
  Pickaxe,
  Rat,
  Sparkles,
  Rocket,
  Rotate3d,
  Shield,
  Sprout,
  Store,
  Swords,
  Trophy,
  TreePalm,
  Volleyball,
  Zap,
} from 'lucide-react'

/**
 * ジャンル一覧（トップページの切り替えボタンと見出しの順番）
 */
export const genres = [
  { id: 'race', label: 'レース', icon: Trophy },
  { id: 'action', label: 'アクション', icon: Zap },
  { id: 'adventure', label: 'ぼうけん・つくる', icon: Compass },
  { id: 'strategy', label: 'さくせん', icon: Shield },
  { id: 'manage', label: 'けいえい', icon: Store },
  { id: 'puzzle', label: 'パズル', icon: Brain },
  { id: 'board', label: 'ボードゲーム', icon: ChessKnight },
  { id: 'learn', label: '学習', icon: GraduationCap },
  { id: 'relax', label: 'のんびり・みんなで', icon: Sprout },
  { id: 'music', label: 'おと', icon: Music },
]

/**
 * ゲーム一覧（ここに1件足すとトップページに並びます）
 *
 * genre: 上の genres の id
 * type:  'react' … src/games/<id>/ に置いたReactコンポーネント（component に lazy(import) を書く）
 *        'html'  … public/games/<id>/index.html に置いたHTMLファイル
 * icon:  Lucideのアイコン（https://lucide.dev/icons/ で探して上で import する）
 * color: カードの背景色、iconColor: アイコンの色（Tailwindのクラス）
 */
export const games = [
  // --- レース ---
  { id: 'mame-kart', genre: 'race', title: 'まめカートGP', icon: CarFront, color: 'bg-orange-300', iconColor: 'text-orange-800', type: 'html' },
  { id: 'rush-kart', genre: 'race', title: 'ラッシュカート', icon: Flag, color: 'bg-red-300', iconColor: 'text-red-800', type: 'html' },

  // --- アクション ---
  { id: 'neon-hop', genre: 'action', title: 'NEON HOP', icon: Music, color: 'bg-pink-300', iconColor: 'text-pink-900', type: 'html' },
  { id: 'neon-survivor', genre: 'action', title: 'NEON SURVIVOR', icon: Zap, color: 'bg-lime-200', iconColor: 'text-lime-900', type: 'html' },
  { id: 'danmaku', genre: 'action', title: '幻想弾幕', icon: Crosshair, color: 'bg-purple-300', iconColor: 'text-purple-900', type: 'html' },
  { id: 'reverse-breakout', genre: 'action', title: '逆ブロック崩し', icon: BrickWall, color: 'bg-fuchsia-300', iconColor: 'text-fuchsia-900', type: 'html' },
  { id: 'kido', genre: 'action', title: '軌道 -KIDO-', icon: Rocket, color: 'bg-cyan-300', iconColor: 'text-cyan-900', type: 'html' },
  { id: 'zanzo', genre: 'action', title: '残像 -ZANZO-', icon: Ghost, color: 'bg-slate-300', iconColor: 'text-slate-800', type: 'html' },
  { id: 'singularity', genre: 'action', title: '特異点', icon: Atom, color: 'bg-blue-300', iconColor: 'text-blue-900', type: 'html' },
  { id: 'houkago-dodge', genre: 'action', title: '放課後ドッジ', icon: Volleyball, color: 'bg-orange-300', iconColor: 'text-orange-900', type: 'html' },
  { id: 'balloon', genre: 'action', title: 'ふうせん わり', icon: Balloon, color: 'bg-rose-200', iconColor: 'text-rose-700', type: 'react', component: lazy(() => import('./games/balloon/Balloon.jsx')) },

  // --- ぼうけん・つくる ---
  { id: 'craftbox', genre: 'adventure', title: 'CraftBox', icon: Pickaxe, color: 'bg-green-300', iconColor: 'text-green-900', type: 'html' },
  { id: 'pokapoka-island', genre: 'adventure', title: 'ぽかぽか島ぐらし', icon: TreePalm, color: 'bg-emerald-300', iconColor: 'text-emerald-900', type: 'html' },
  { id: 'mystery-dungeon', genre: 'adventure', title: '不思議の迷宮', icon: Dices, color: 'bg-lime-300', iconColor: 'text-lime-900', type: 'react', component: lazy(() => import('./games/mystery-dungeon/Game.jsx')) },

  { id: 'hikari-meikyu', genre: 'adventure', title: 'ひかりの迷宮', icon: Sparkles, color: 'bg-amber-100', iconColor: 'text-amber-700', type: 'html' },
  { id: 'eighth-passage', genre: 'adventure', title: '第八通路', icon: Footprints, color: 'bg-yellow-200', iconColor: 'text-yellow-900', type: 'html' },

  // --- さくせん ---
  { id: 'animal-defense', genre: 'strategy', title: 'どうぶつディフェンス', icon: PawPrint, color: 'bg-orange-200', iconColor: 'text-orange-900', type: 'html' },
  { id: 'rojo-3d', genre: 'strategy', title: '籠城戦 3D', icon: Castle, color: 'bg-amber-300', iconColor: 'text-amber-900', type: 'html' },
  { id: 'orbit-defense', genre: 'strategy', title: '軌道防衛線', icon: Orbit, color: 'bg-violet-300', iconColor: 'text-violet-900', type: 'html' },
  { id: 'breach', genre: 'strategy', title: 'BREACH', icon: Swords, color: 'bg-rose-300', iconColor: 'text-rose-900', type: 'react', component: lazy(() => import('./games/breach/Game.jsx')) },

  // --- けいえい ---
  { id: 'supermarket', genre: 'manage', title: 'スーパーマーケット経営記', icon: Store, color: 'bg-orange-100', iconColor: 'text-orange-800', type: 'html' },

  // --- パズル ---
  { id: 'white-room', genre: 'puzzle', title: '白い部屋からの脱出', icon: DoorClosed, color: 'bg-slate-100', iconColor: 'text-slate-700', type: 'html' },
  { id: 'mouse-rocket', genre: 'puzzle', title: 'Mouse Rocket', icon: Rat, color: 'bg-amber-200', iconColor: 'text-amber-900', type: 'html' },
  { id: 'futatsu-no-kage', genre: 'puzzle', title: 'ふたつの影', icon: Rotate3d, color: 'bg-indigo-300', iconColor: 'text-indigo-900', type: 'html' },
  { id: 'rensa-dojo', genre: 'learn', title: '連鎖道場', icon: Blocks, color: 'bg-red-200', iconColor: 'text-red-900', type: 'html' },
  { id: 'color-match', genre: 'puzzle', title: 'いろ あて', icon: Palette, color: 'bg-sky-300', iconColor: 'text-sky-800', type: 'html' },

  // --- ボードゲーム ---
  { id: 'flag-quiz', genre: 'learn', title: '国旗クイズ', icon: Earth, color: 'bg-blue-200', iconColor: 'text-blue-900', type: 'html' },
  { id: 'chess-dojo', genre: 'learn', title: 'チェス作戦道場', icon: ChessKnight, color: 'bg-stone-300', iconColor: 'text-stone-800', type: 'html' },
  { id: 'chess', genre: 'board', title: 'チェス', icon: Crown, color: 'bg-yellow-200', iconColor: 'text-yellow-900', type: 'react', component: lazy(() => import('./games/chess/Game.jsx')) },
  { id: 'chess2', genre: 'board', title: 'チェス2', icon: Crown, color: 'bg-amber-200', iconColor: 'text-amber-900', type: 'react', component: lazy(() => import('./games/chess2/Game.jsx')) },
  { id: 'reversi', genre: 'board', title: 'リバーシ', icon: CircleDot, color: 'bg-emerald-200', iconColor: 'text-emerald-900', type: 'html' },
  { id: 'diamond-game', genre: 'board', title: 'ダイヤモンドゲーム', icon: Diamond, color: 'bg-cyan-200', iconColor: 'text-cyan-900', type: 'html' },
  { id: 'line-protocol', genre: 'board', title: '五目並べ', icon: Grid3x3, color: 'bg-teal-300', iconColor: 'text-teal-900', type: 'react', component: lazy(() => import('./games/line-protocol/Game.jsx')) },

  // --- のんびり・みんなで ---
  { id: 'illust-shiritori', genre: 'relax', title: 'イラストしりとり', icon: Pencil, color: 'bg-yellow-300', iconColor: 'text-yellow-900', type: 'html' },
  { id: 'kotori-niwa', genre: 'relax', title: 'ことりの庭', icon: Bird, color: 'bg-sky-200', iconColor: 'text-sky-900', type: 'html' },

  // --- おと ---
  { id: 'hazumu-rhythm', genre: 'music', title: 'はずむリズム', icon: Drum, color: 'bg-pink-200', iconColor: 'text-pink-900', type: 'html' },
  { id: 'tech-house-loop', genre: 'music', title: 'Tech House Loop', icon: Disc3, color: 'bg-zinc-300', iconColor: 'text-zinc-800', type: 'html' },
]

export const findGame = (id) => games.find((g) => g.id === id)
