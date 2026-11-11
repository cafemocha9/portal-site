import { useState, useEffect, useCallback } from "react";

/* ============================================================
   LINE PROTOCOL — 五目並べ / 航空計器スタイル
   - 勝利条件 k を選択、盤サイズは N = 3(k−2) で自動決定
   - 対戦モード: VS AI / 2 PLAYERS
   - 盤の縦伸びバグ修正: grid-template-rows を明示し、
     石のサイズをセル寸法に従属させる(行高を内容が押し広げない)
   ============================================================ */

const P1 = 1; // 人間 / プレイヤー1 (GRAPHITE)
const P2 = 2; // AI / プレイヤー2 (SIGNAL ORANGE)
const INF = 1e9;

const MODES = [
  { k: 3, label: "三連", note: "BASIC", desc: "先手後手が拮抗する原点" },
  { k: 4, label: "四連", note: "TACTICAL", desc: "二重の脅威が生まれ始める" },
  { k: 5, label: "五連", note: "STANDARD", desc: "攻防が最も深い基準形" },
  { k: 6, label: "六連", note: "EXTENDED", desc: "広域の読み合いが要求される" },
];

const boardSizeOf = (k) => 3 * (k - 2);

/* ---------- 勝利判定: 最終着手点から4方向を双方向走査 O(k) ---------- */
function findWin(board, size, k, idx, player) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const cells = [[r, c]];
    for (let s = 1; ; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr * size + nc] !== player) break;
      cells.push([nr, nc]);
    }
    for (let s = 1; ; s++) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr * size + nc] !== player) break;
      cells.push([nr, nc]);
    }
    if (cells.length >= k) return cells.map(([rr, cc]) => rr * size + cc);
  }
  return null;
}

/* ---------- AI 評価関数 ----------
   空マス idx に player の石を置いた場合の価値。
   各方向で「連の長さ cnt」と「開放端の数 open」を計測し、
   8^cnt × open で指数加重。cnt ≥ k なら即勝ち(INF)。         */
function evalCell(b, size, k, idx, p) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let score = 0;
  for (const [dr, dc] of dirs) {
    let f = 0, g = 0, open = 0;
    for (;;) {
      const nr = r + dr * (f + 1), nc = c + dc * (f + 1);
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (b[nr * size + nc] === p) f++;
      else { if (b[nr * size + nc] === 0) open++; break; }
    }
    for (;;) {
      const nr = r - dr * (g + 1), nc = c - dc * (g + 1);
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (b[nr * size + nc] === p) g++;
      else { if (b[nr * size + nc] === 0) open++; break; }
    }
    const cnt = 1 + f + g;
    if (cnt >= k) return INF;
    if (open === 0) continue; // 両端封鎖の死に筋は無価値と近似
    score += Math.pow(8, cnt) * open;
  }
  return score;
}

/* ---------- AI 着手選択 ----------
   優先順位: (1)自分の即勝ち (2)相手の即勝ち阻止
   (3)攻撃×1.1 + 防御×1.0 + 中央バイアス のヒューリスティック */
function chooseAiMove(b, size, k, ai) {
  const hu = ai === P1 ? P2 : P1;
  const empties = [];
  b.forEach((v, i) => { if (v === 0) empties.push(i); });

  for (const i of empties) if (evalCell(b, size, k, i, ai) >= INF) return i;
  for (const i of empties) if (evalCell(b, size, k, i, hu) >= INF) return i;

  const mid = (size - 1) / 2;
  let best = empties[0], bestScore = -1;
  for (const i of empties) {
    const r = Math.floor(i / size), c = i % size;
    const centerBias = (size - (Math.abs(r - mid) + Math.abs(c - mid))) * 2;
    const s = evalCell(b, size, k, i, ai) * 1.1 + evalCell(b, size, k, i, hu) + centerBias + Math.random();
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

const colLabel = (c) => String.fromCharCode(65 + c);

export default function LineProtocol() {
  const [screen, setScreen] = useState("menu"); // menu | game
  const [opponent, setOpponent] = useState("ai"); // ai | human
  const [k, setK] = useState(5);
  const [board, setBoard] = useState([]);
  const [turn, setTurn] = useState(P1);
  const [winner, setWinner] = useState(0); // 0 | 1 | 2 | 3(draw)
  const [winCells, setWinCells] = useState([]);
  const [lastMove, setLastMove] = useState(-1);
  const [thinking, setThinking] = useState(false);

  const size = boardSizeOf(k);
  const moves = board.filter((v) => v !== 0).length;

  const startGame = (kk) => {
    const n = boardSizeOf(kk);
    setK(kk);
    setBoard(Array(n * n).fill(0));
    setTurn(P1);
    setWinner(0);
    setWinCells([]);
    setLastMove(-1);
    setThinking(false);
    setScreen("game");
  };

  const applyMove = useCallback((idx) => {
    setBoard((prev) => {
      if (prev[idx] !== 0) return prev;
      const next = prev.slice();
      next[idx] = turn;
      const win = findWin(next, size, k, idx, turn);
      setLastMove(idx);
      if (win) {
        setWinner(turn);
        setWinCells(win);
      } else if (next.every((v) => v !== 0)) {
        setWinner(3);
      } else {
        setTurn(turn === P1 ? P2 : P1);
      }
      return next;
    });
  }, [turn, size, k]);

  const humanClick = (idx) => {
    if (winner || board[idx] !== 0 || thinking) return;
    if (opponent === "ai" && turn === P2) return;
    applyMove(idx);
  };

  /* AI の手番: 短い遅延を挟んで思考中表示 → 着手 */
  useEffect(() => {
    if (screen !== "game" || opponent !== "ai" || winner || turn !== P2) return;
    setThinking(true);
    const t = setTimeout(() => {
      const mv = chooseAiMove(board, size, k, P2);
      if (mv != null && mv >= 0) applyMove(mv);
      setThinking(false);
    }, 420);
    return () => clearTimeout(t);
  }, [screen, opponent, winner, turn, board, size, k, applyMove]);

  const lastLabel = lastMove < 0 ? "—"
    : `${colLabel(lastMove % size)}${Math.floor(lastMove / size) + 1}`;

  const nameOf = (p) =>
    opponent === "ai" ? (p === P1 ? "PILOT" : "UNIT-02") : (p === P1 ? "PLAYER 1" : "PLAYER 2");

  return (
    <div className="lp-root">
      <style>{css}</style>

      {screen === "menu" ? (
        <main className="menu">
          <header className="mast">
            <div className="reg">LINE PROTOCOL / REV.2</div>
            <h1 className="title">五目並べ<span className="tsub">CONSOLE</span></h1>
          </header>

          <section className="panel">
            <div className="prow">
              <span className="plabel">01 — 対戦モード</span>
              <div className="seg" role="radiogroup" aria-label="対戦モード">
                <button
                  className={`segbtn ${opponent === "ai" ? "on" : ""}`}
                  role="radio" aria-checked={opponent === "ai"}
                  onClick={() => setOpponent("ai")}
                >VS AI</button>
                <button
                  className={`segbtn ${opponent === "human" ? "on" : ""}`}
                  role="radio" aria-checked={opponent === "human"}
                  onClick={() => setOpponent("human")}
                >2 PLAYERS</button>
              </div>
            </div>

            <div className="prow col">
              <span className="plabel">02 — 勝利条件 <em>盤サイズは N = 3(k−2) で自動決定</em></span>
              <div className="modes">
                {MODES.map((m) => {
                  const n = boardSizeOf(m.k);
                  return (
                    <button key={m.k} className="mode" onClick={() => startGame(m.k)}>
                      <span className="corner tl" /><span className="corner tr" />
                      <span className="corner bl" /><span className="corner br" />
                      <span className="knum">{m.k}</span>
                      <span className="mlabel">{m.label}</span>
                      <span className="mnote">{m.note} · {n}×{n}</span>
                      <span className="mdesc">{m.desc}</span>
                      <span className="go">START →</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <footer className="mfoot">
            連の長さに比例して場を拡張し、攻撃余白と防御密度の均衡を保つ設計。
          </footer>
        </main>
      ) : (
        <main className="game">
          <header className="hud">
            <button className="ghost" onClick={() => setScreen("menu")}>← 設定</button>
            <div className="telemetry" aria-live="polite">
              <span>MODE <b>{opponent === "ai" ? "AI" : "2P"}</b></span>
              <span>RULE <b>{k}連 / {size}×{size}</b></span>
              <span>MOVE <b>{String(moves).padStart(3, "0")}</b></span>
              <span>LAST <b>{lastLabel}</b></span>
            </div>
            <button className="ghost" onClick={() => startGame(k)}>再戦 ↻</button>
          </header>

          <div className="players">
            <div className={`pl ${!winner && turn === P1 ? "live" : ""} ${winner === P1 ? "won" : ""}`}>
              <span className="chip c1" />{nameOf(P1)}
            </div>
            <div className="status">
              {winner ? "COMPLETE" : thinking ? "COMPUTING…" : "STANDBY"}
            </div>
            <div className={`pl ${!winner && turn === P2 ? "live" : ""} ${winner === P2 ? "won" : ""}`}>
              {nameOf(P2)}<span className="chip c2" />
            </div>
          </div>

          <div className="board-frame">
            <span className="fcorner tl" /><span className="fcorner tr" />
            <span className="fcorner bl" /><span className="fcorner br" />

            <div className="board" style={{ "--n": size }} role="grid" aria-label={`${size}×${size}の盤面`}>
              {board.map((v, i) => {
                const isWin = winCells.includes(i);
                const isLast = i === lastMove;
                return (
                  <button
                    key={i}
                    role="gridcell"
                    className={`cell ${v ? (v === P1 ? "s1" : "s2") : ""} ${isWin ? "win" : ""} ${isLast ? "last" : ""}`}
                    onClick={() => humanClick(i)}
                    disabled={!!winner || v !== 0 || (opponent === "ai" && turn === P2)}
                    aria-label={
                      v === 0
                        ? `空きマス ${colLabel(i % size)}${Math.floor(i / size) + 1}`
                        : `${nameOf(v)} の石`
                    }
                  >
                    {v !== 0 && <span className="stone" />}
                  </button>
                );
              })}
            </div>

            {winner !== 0 && (
              <div className="verdict" role="status">
                <div className={`vtitle ${winner === 3 ? "vd" : winner === P1 ? "v1" : "v2"}`}>
                  {winner === 3 ? "STALEMATE" : "LINE COMPLETE"}
                </div>
                <div className="vsub">
                  {winner === 3 ? "引き分け — 全区画が埋まりました" : `${nameOf(winner)} が ${k} 連を達成`}
                </div>
                <div className="vbtns">
                  <button className="solid" onClick={() => startGame(k)}>もう一局</button>
                  <button className="ghost" onClick={() => setScreen("menu")}>設定へ戻る</button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root { color-scheme: light; }

.lp-root{
  --paper:#E9EBED;
  --panel:#F6F7F8;
  --ink:#171B1F;
  --steel:#7C858E;
  --hair:#C3C9CF;
  --signal:#FF4D00;
  min-height:100vh;
  background:
    linear-gradient(rgba(23,27,31,.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23,27,31,.045) 1px, transparent 1px),
    var(--paper);
  background-size:28px 28px, 28px 28px, auto;
  color:var(--ink);
  font-family:'Rajdhani','Hiragino Sans','Noto Sans JP',sans-serif;
  display:flex; justify-content:center;
}
main{width:100%; max-width:920px; padding:32px 20px 56px;}

/* ---------- メニュー ---------- */
.mast{margin:14px 0 26px; border-bottom:2px solid var(--ink); padding-bottom:18px;}
.reg{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.3em; color:var(--steel); margin-bottom:10px;}
.title{
  font-size:clamp(34px,7vw,60px); font-weight:700; margin:0;
  letter-spacing:.06em; line-height:1;
  display:flex; align-items:baseline; gap:16px; flex-wrap:wrap;
}
.tsub{font-size:.34em; font-weight:600; letter-spacing:.5em; color:var(--signal);}

.panel{background:var(--panel); border:1px solid var(--hair); padding:22px;}
.prow{display:flex; justify-content:space-between; align-items:center; gap:14px; padding:14px 0;}
.prow.col{flex-direction:column; align-items:stretch;}
.prow + .prow{border-top:1px dashed var(--hair);}
.plabel{font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.22em; color:var(--ink);}
.plabel em{font-style:normal; color:var(--steel); margin-left:10px; letter-spacing:.1em;}

.seg{display:flex; border:1px solid var(--ink);}
.segbtn{
  padding:9px 20px; background:transparent; border:none; cursor:pointer;
  font-family:'Rajdhani'; font-weight:600; font-size:14px; letter-spacing:.18em;
  color:var(--ink); transition:background .15s,color .15s;
}
.segbtn + .segbtn{border-left:1px solid var(--ink);}
.segbtn.on{background:var(--ink); color:var(--panel);}
.segbtn:focus-visible{outline:2px solid var(--signal); outline-offset:2px; z-index:1;}

.modes{display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-top:14px;}
.mode{
  position:relative; text-align:left; cursor:pointer;
  background:#fff; border:1px solid var(--hair);
  padding:20px 16px 16px;
  display:flex; flex-direction:column; gap:5px;
  color:var(--ink); font-family:inherit;
  transition:border-color .18s, transform .18s;
}
.mode:hover, .mode:focus-visible{border-color:var(--ink); transform:translateY(-3px); outline:none;}
.mode:focus-visible{outline:2px solid var(--signal); outline-offset:3px;}
.corner{position:absolute; width:10px; height:10px; border:0 solid var(--signal); opacity:0; transition:opacity .18s;}
.corner.tl{top:4px; left:4px; border-top-width:2px; border-left-width:2px;}
.corner.tr{top:4px; right:4px; border-top-width:2px; border-right-width:2px;}
.corner.bl{bottom:4px; left:4px; border-bottom-width:2px; border-left-width:2px;}
.corner.br{bottom:4px; right:4px; border-bottom-width:2px; border-right-width:2px;}
.mode:hover .corner, .mode:focus-visible .corner{opacity:1;}
.knum{font-size:44px; font-weight:700; line-height:1;}
.mlabel{font-size:16px; font-weight:600; letter-spacing:.3em;}
.mnote{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.14em; color:var(--signal);}
.mdesc{font-size:12.5px; color:var(--steel); line-height:1.7;}
.go{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.2em; margin-top:8px; color:var(--ink);}
.mfoot{margin-top:22px; font-size:12px; color:var(--steel); letter-spacing:.08em;}

/* ---------- ゲーム ---------- */
.hud{display:flex; justify-content:space-between; align-items:center; gap:12px; margin:6px 0 16px; flex-wrap:wrap;}
.telemetry{
  display:flex; gap:18px; flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.12em; color:var(--steel);
}
.telemetry b{color:var(--ink); font-weight:500; margin-left:4px;}

.ghost{
  background:transparent; border:1px solid var(--ink); color:var(--ink);
  padding:8px 16px; font-size:12px; letter-spacing:.16em; cursor:pointer;
  font-family:'Rajdhani'; font-weight:600;
  transition:background .15s,color .15s;
}
.ghost:hover{background:var(--ink); color:var(--panel);}
.ghost:focus-visible{outline:2px solid var(--signal); outline-offset:2px;}
.solid{
  background:var(--signal); border:1px solid var(--signal); color:#fff;
  padding:9px 22px; font-size:13px; font-weight:700; letter-spacing:.16em; cursor:pointer;
  font-family:'Rajdhani';
}
.solid:focus-visible{outline:2px solid var(--ink); outline-offset:2px;}

.players{
  display:flex; justify-content:space-between; align-items:center;
  border-top:1px solid var(--hair); border-bottom:1px solid var(--hair);
  padding:10px 4px; margin-bottom:20px;
  font-weight:600; letter-spacing:.22em; font-size:14px;
}
.pl{display:flex; align-items:center; gap:10px; color:var(--steel); transition:color .2s;}
.pl.live, .pl.won{color:var(--ink);}
.pl.live{text-decoration:underline; text-decoration-color:var(--signal); text-underline-offset:6px; text-decoration-thickness:2px;}
.chip{width:14px; height:14px; border-radius:50%;}
.c1{background:var(--ink);}
.c2{background:var(--signal);}
.status{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.3em; color:var(--steel);}

.board-frame{position:relative; display:flex; justify-content:center; padding:14px;}
.fcorner{position:absolute; width:18px; height:18px; border:0 solid var(--ink);}
.fcorner.tl{top:0; left:0; border-top-width:2px; border-left-width:2px;}
.fcorner.tr{top:0; right:0; border-top-width:2px; border-right-width:2px;}
.fcorner.bl{bottom:0; left:0; border-bottom-width:2px; border-left-width:2px;}
.fcorner.br{bottom:0; right:0; border-bottom-width:2px; border-right-width:2px;}

/* 縦伸びバグ対策:
   rows も 1fr で明示し、セルは min-width/height:0。
   石は % 寸法のみでセル内に収まり、行高を押し広げない。 */
.board{
  width:min(92vw, 540px);
  aspect-ratio:1/1;
  display:grid;
  grid-template-columns:repeat(var(--n), 1fr);
  grid-template-rows:repeat(var(--n), 1fr);
  gap:3px;
  background:var(--hair);
  border:1px solid var(--ink);
  padding:3px;
}
.cell{
  min-width:0; min-height:0;
  position:relative; overflow:hidden;
  background:var(--panel);
  border:none; padding:0; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background .12s;
}
.cell:disabled{cursor:default;}
.cell:focus-visible{outline:2px solid var(--signal); outline-offset:-2px; z-index:2;}
@media (hover:hover){ .cell:not(:disabled):hover{background:#fff;} }

.cell.last::after{
  content:""; position:absolute; inset:0;
  border:2px solid var(--signal); pointer-events:none;
}
.stone{
  width:70%; height:70%; border-radius:50%;
  animation:drop .22s cubic-bezier(.2,.9,.4,1.1);
}
.s1 .stone{background:var(--ink); box-shadow:inset 0 2px 3px rgba(255,255,255,.25), 0 1px 2px rgba(0,0,0,.3);}
.s2 .stone{background:var(--signal); box-shadow:inset 0 2px 3px rgba(255,255,255,.35), 0 1px 2px rgba(0,0,0,.25);}
@keyframes drop{0%{transform:scale(.4); opacity:0;} 100%{transform:scale(1); opacity:1;}}

.cell.win{background:#fff;}
.cell.win .stone{outline:3px solid var(--signal); outline-offset:2px; animation:none;}

.verdict{
  position:absolute; inset:14px; z-index:5;
  display:flex; flex-direction:column; justify-content:center; align-items:center; gap:8px;
  background:rgba(246,247,248,.94);
  border:1px solid var(--ink);
  animation:fadein .4s ease .35s both;
}
@keyframes fadein{from{opacity:0} to{opacity:1}}
.vtitle{font-size:clamp(24px,5vw,40px); font-weight:700; letter-spacing:.18em;}
.v1{color:var(--ink);}
.v2{color:var(--signal);}
.vd{color:var(--steel);}
.vsub{font-size:14px; letter-spacing:.12em; color:var(--ink);}
.vbtns{display:flex; gap:12px; margin-top:14px;}

@media (prefers-reduced-motion: reduce){
  .stone{animation:none;}
  .mode, .mode:hover{transform:none; transition:none;}
}
`;
