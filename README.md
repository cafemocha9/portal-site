# あそびば（子ども向けゲーム集）

Claudeで作ったHTML/Reactのゲームを1つのサイトにまとめるポータルです。
トップページのカードをタップするとゲームが開き、左上のホームボタンでトップに戻ります。
アイコンはすべてLucide（https://lucide.dev/icons/）を使い、絵文字は使っていません。

## ローカルで動かす

```bash
npm install
npm run dev
```

## ゲームの追加方法

### A. Reactのアーティファクト（.jsx）

1. `src/games/<id>/` フォルダを作り、アーティファクトのコードを `Game.jsx` などの名前で保存
   （`export default function ...` の形であればそのまま動きます）
2. `src/games.js` の先頭でアイコンを import し、一覧に1件追加

```js
import { Balloon, Palette, Shapes } from 'lucide-react'

{
  id: 'shapes',
  title: 'かたち パズル',
  icon: Shapes,
  iconColor: 'text-emerald-800',
  color: 'bg-emerald-300',
  type: 'react',
  component: lazy(() => import('./games/shapes/Game.jsx')),
},
```

3. 使っているライブラリが入っていなければ追加でインストール
   （例：`npm install recharts`）。Tailwindとlucide-reactは導入済みです。

### B. HTMLのアーティファクト（.html）

1. `public/games/<id>/index.html` として保存
2. `src/games.js` に `type: 'html'` で1行追加（`component` は不要）

```js
{ id: 'memory', title: 'しんけいすいじゃく', icon: Layers, color: 'bg-amber-300', iconColor: 'text-amber-800', type: 'html' },
```

### ゲームの中で絵文字を使わないために

Claudeにゲームを作ってもらうときは「絵文字は使わず、アイコンはlucide-reactを使って」と指示します。
HTMLのゲームは外部を読み込まずに動くように、LucideのSVGを直接埋め込みます
（例は `public/games/color-match/index.html`）。

## 保存機能（window.storage）について

Claudeのアーティファクト専用API `window.storage` は、`src/lib/storage-shim.js` が
localStorageで代替するため、コードを書き換えずに動きます。
保存先はその端末・そのブラウザだけです（端末間で共有はされません）。

## デプロイ（Vercel）

1. このフォルダをGitHubのリポジトリにpush
2. Vercelで「Add New → Project」からリポジトリを選択（設定は自動でViteと判定されます）
3. 以降は `git push` するたびに自動で再デプロイ

`vercel.json` で、`/play/xxx` を直接開いても404にならないよう設定済みです。

> Vercelの無料プラン（Hobby）は非商用利用に限られます。
> 収益化や宣伝に使う場合は、Cloudflare Pages（ビルドコマンド `npm run build`、出力先 `dist`）も同じ手順で使えます。
> Cloudflare Pagesでは `public/_redirects` に `/play/*  /index.html  200` を1行置いてください。
