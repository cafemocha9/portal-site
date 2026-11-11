import React, { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================
// 定数定義
// ============================================================
const WHITE = "w";
const BLACK = "b";

// 駒のUnicodeシンボル
const GLYPH = {
  // 白黒で同じ字形（アウトライン型）を使い、色だけで区別する
  wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
  bK: "\u2654", bQ: "\u2655", bR: "\u2656", bB: "\u2657", bN: "\u2658", bP: "\u2659",
};

// 駒の評価値（AI用）
const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

// 難易度設定: 探索深さと「ミスをする確率」
const LEVELS = [
  { label: "やさしい", depth: 1, blunder: 0.45 },
  { label: "かんたん", depth: 2, blunder: 0.25 },
  { label: "ふつう",   depth: 2, blunder: 0.08 },
  { label: "むずかしい", depth: 3, blunder: 0.0 },
  { label: "達人",     depth: 4, blunder: 0.0 },
];

// ============================================================
// 初期盤面の生成
// 盤面は [row][col] の8x8。row=0 が上(黒側)、row=7 が下(白側)。
// 各マスは null か { c: 色, t: 種類 }
// ============================================================
function initialBoard() {
  const empty = () => Array(8).fill(null);
  const back = (c) => ["R", "N", "B", "Q", "K", "B", "N", "R"].map((t) => ({ c, t }));
  const pawns = (c) => Array(8).fill(null).map(() => ({ c, t: "P" }));
  return [
    back(BLACK),
    pawns(BLACK),
    empty(), empty(), empty(), empty(),
    pawns(WHITE),
    back(WHITE),
  ];
}

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const cloneBoard = (b) => b.map((row) => row.map((sq) => (sq ? { ...sq } : null)));
const opp = (c) => (c === WHITE ? BLACK : WHITE);

// ============================================================
// 攻撃判定: マス(r,c) が by色の駒に攻撃されているか
// キング自身の合法手判定（チェック回避）に使う
// ============================================================
function isAttacked(board, r, c, by) {
  // ポーンの攻撃方向: 白は上(-1)へ進むので白ポーンはrow+1から攻撃してくる
  const pDir = by === WHITE ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = r + pDir, pc = c + dc;
    if (inside(pr, pc)) {
      const sq = board[pr][pc];
      if (sq && sq.c === by && sq.t === "P") return true;
    }
  }
  // ナイト
  const kn = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of kn) {
    const nr = r + dr, nc = c + dc;
    if (inside(nr, nc)) {
      const sq = board[nr][nc];
      if (sq && sq.c === by && sq.t === "N") return true;
    }
  }
  // キング(隣接)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const kr = r + dr, kc = c + dc;
      if (inside(kr, kc)) {
        const sq = board[kr][kc];
        if (sq && sq.c === by && sq.t === "K") return true;
      }
    }
  }
  // 飛び駒: ルーク/クイーン(直線) と ビショップ/クイーン(斜め)
  const straight = [[-1,0],[1,0],[0,-1],[0,1]];
  const diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const scan = (dirs, types) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) {
        const sq = board[nr][nc];
        if (sq) {
          if (sq.c === by && types.includes(sq.t)) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    return false;
  };
  if (scan(straight, ["R", "Q"])) return true;
  if (scan(diag, ["B", "Q"])) return true;
  return false;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (sq && sq.c === color && sq.t === "K") return [r, c];
    }
  return null;
}

function inCheck(board, color) {
  const k = findKing(board, color);
  if (!k) return false;
  return isAttacked(board, k[0], k[1], opp(color));
}

// ============================================================
// 疑似合法手の生成（チェック回避フィルタ前）
// state は { board, castling, enPassant } を含む
// 戻り値: { fr, fc, tr, tc, capture, flag, promo? }
//   flag: "normal" | "double" | "enpassant" | "castle-k" | "castle-q"
// ============================================================
function pseudoMoves(state, color) {
  const { board, castling, enPassant } = state;
  const moves = [];
  const add = (fr, fc, tr, tc, flag = "normal") => {
    const target = board[tr][tc];
    moves.push({ fr, fc, tr, tc, capture: !!target, flag });
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.c !== color) continue;
      const { t } = p;

      if (t === "P") {
        const dir = color === WHITE ? -1 : 1;
        const startRow = color === WHITE ? 6 : 1;
        const oneR = r + dir;
        // 前進1マス
        if (inside(oneR, c) && !board[oneR][c]) {
          add(r, c, oneR, c, "normal");
          // 前進2マス
          if (r === startRow && !board[r + 2 * dir][c]) add(r, c, r + 2 * dir, c, "double");
        }
        // 斜め取り
        for (const dc of [-1, 1]) {
          const tr = r + dir, tc = c + dc;
          if (!inside(tr, tc)) continue;
          const target = board[tr][tc];
          if (target && target.c !== color) add(r, c, tr, tc, "normal");
          // アンパッサン
          else if (enPassant && enPassant.r === tr && enPassant.c === tc) {
            moves.push({ fr: r, fc: c, tr, tc, capture: true, flag: "enpassant" });
          }
        }
      } else if (t === "N") {
        const kn = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of kn) {
          const tr = r + dr, tc = c + dc;
          if (!inside(tr, tc)) continue;
          const target = board[tr][tc];
          if (!target || target.c !== color) add(r, c, tr, tc);
        }
      } else if (t === "K") {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const tr = r + dr, tc = c + dc;
            if (!inside(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target || target.c !== color) add(r, c, tr, tc);
          }
        // キャスリング: チェック中・通過マスが攻撃されている場合は不可
        const rights = castling[color];
        const homeRow = color === WHITE ? 7 : 0;
        if (r === homeRow && c === 4 && !isAttacked(board, r, 4, opp(color))) {
          // キングサイド
          if (rights.k && !board[homeRow][5] && !board[homeRow][6]
              && board[homeRow][7] && board[homeRow][7].t === "R"
              && !isAttacked(board, homeRow, 5, opp(color))
              && !isAttacked(board, homeRow, 6, opp(color))) {
            moves.push({ fr: r, fc: c, tr: homeRow, tc: 6, capture: false, flag: "castle-k" });
          }
          // クイーンサイド
          if (rights.q && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1]
              && board[homeRow][0] && board[homeRow][0].t === "R"
              && !isAttacked(board, homeRow, 3, opp(color))
              && !isAttacked(board, homeRow, 2, opp(color))) {
            moves.push({ fr: r, fc: c, tr: homeRow, tc: 2, capture: false, flag: "castle-q" });
          }
        }
      } else {
        // 飛び駒
        const dirs =
          t === "R" ? [[-1,0],[1,0],[0,-1],[0,1]]
          : t === "B" ? [[-1,-1],[-1,1],[1,-1],[1,1]]
          : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [dr, dc] of dirs) {
          let tr = r + dr, tc = c + dc;
          while (inside(tr, tc)) {
            const target = board[tr][tc];
            if (!target) add(r, c, tr, tc);
            else {
              if (target.c !== color) add(r, c, tr, tc);
              break;
            }
            tr += dr; tc += dc;
          }
        }
      }
    }
  }
  return moves;
}

// ============================================================
// 手の適用（盤面状態を新規生成して返す）
// promo: プロモーション時の駒種（既定はクイーン）
// ============================================================
function applyMove(state, move, promo = "Q") {
  const board = cloneBoard(state.board);
  const piece = board[move.fr][move.fc];
  const color = piece.c;
  const castling = {
    w: { ...state.castling.w },
    b: { ...state.castling.b },
  };
  let enPassant = null;

  // 駒を移動
  board[move.tr][move.tc] = piece;
  board[move.fr][move.fc] = null;

  // アンパッサン: 取られるポーンを除去
  if (move.flag === "enpassant") {
    board[move.fr][move.tc] = null;
  }
  // 2マス前進: アンパッサン対象マスを登録
  if (move.flag === "double") {
    enPassant = { r: (move.fr + move.tr) / 2, c: move.fc };
  }
  // キャスリング: ルークも移動
  if (move.flag === "castle-k") {
    board[move.tr][5] = board[move.tr][7];
    board[move.tr][7] = null;
  }
  if (move.flag === "castle-q") {
    board[move.tr][3] = board[move.tr][0];
    board[move.tr][0] = null;
  }
  // プロモーション
  if (piece.t === "P" && (move.tr === 0 || move.tr === 7)) {
    board[move.tr][move.tc] = { c: color, t: promo };
  }

  // キャスリング権の更新
  if (piece.t === "K") { castling[color].k = false; castling[color].q = false; }
  if (piece.t === "R") {
    const homeRow = color === WHITE ? 7 : 0;
    if (move.fr === homeRow && move.fc === 0) castling[color].q = false;
    if (move.fr === homeRow && move.fc === 7) castling[color].k = false;
  }
  // ルークが取られた場合も権利消失
  const oc = opp(color);
  const ocHome = oc === WHITE ? 7 : 0;
  if (move.tr === ocHome && move.tc === 0) castling[oc].q = false;
  if (move.tr === ocHome && move.tc === 7) castling[oc].k = false;

  return { board, castling, enPassant, turn: oc };
}

// ============================================================
// 合法手の生成（チェック回避フィルタ済み）
// ============================================================
function legalMoves(state, color) {
  const pseudo = pseudoMoves(state, color);
  return pseudo.filter((m) => {
    const next = applyMove(state, m);
    return !inCheck(next.board, color);
  });
}

// ============================================================
// 局面評価（AI用）— 白優勢ほど正、黒優勢ほど負
// ============================================================
function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const v = PIECE_VALUE[sq.t];
      // 中央寄りの駒に軽い加点
      const centerBonus = (3.5 - Math.abs(3.5 - c)) + (3.5 - Math.abs(3.5 - r));
      const total = v + centerBonus * 2;
      score += sq.c === WHITE ? total : -total;
    }
  return score;
}

// ============================================================
// ミニマックス + アルファベータ枝刈り
// 白を最大化プレイヤー、黒を最小化プレイヤーとする
// ============================================================
function minimax(state, depth, alpha, beta, maximizing) {
  const color = maximizing ? WHITE : BLACK;
  const moves = legalMoves(state, color);

  if (moves.length === 0) {
    if (inCheck(state.board, color)) {
      // チェックメイト: 手前の手ほど価値が高くなるよう depth を加味
      return maximizing ? -100000 - depth : 100000 + depth;
    }
    return 0; // ステイルメイト
  }
  if (depth === 0) return evaluate(state.board);

  // 取る手を優先して探索効率を上げる
  moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const next = applyMove(state, m);
      const val = minimax(next, depth - 1, alpha, beta, false);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const next = applyMove(state, m);
      const val = minimax(next, depth - 1, alpha, beta, true);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// AIの着手選択
function chooseAIMove(state, color, level) {
  const moves = legalMoves(state, color);
  if (moves.length === 0) return null;
  const { depth, blunder } = LEVELS[level];

  // 一定確率でランダムな手（弱さの演出）
  if (Math.random() < blunder) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const maximizing = color === WHITE;
  let best = null;
  let bestVal = maximizing ? -Infinity : Infinity;
  // 同点の手を集めてランダムに選ぶ（指し手の多様性）
  let ties = [];

  moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
  for (const m of moves) {
    const next = applyMove(state, m);
    const val = minimax(next, depth - 1, -Infinity, Infinity, !maximizing);
    if (maximizing) {
      if (val > bestVal) { bestVal = val; best = m; ties = [m]; }
      else if (val === bestVal) ties.push(m);
    } else {
      if (val < bestVal) { bestVal = val; best = m; ties = [m]; }
      else if (val === bestVal) ties.push(m);
    }
  }
  return ties.length ? ties[Math.floor(Math.random() * ties.length)] : best;
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function Chess() {
  const [screen, setScreen] = useState("menu"); // menu | game
  const [mode, setMode] = useState("two"); // one | two
  const [level, setLevel] = useState(2);

  const [state, setState] = useState(() => ({
    board: initialBoard(),
    castling: { w: { k: true, q: true }, b: { k: true, q: true } },
    enPassant: null,
    turn: WHITE,
  }));
  const [selected, setSelected] = useState(null); // { r, c }
  const [legalForSel, setLegalForSel] = useState([]); // 選択駒の合法手
  const [lastMove, setLastMove] = useState(null); // ハイライト用
  const [status, setStatus] = useState("playing"); // playing | check | checkmate | stalemate
  const [captured, setCaptured] = useState({ w: [], b: [] });
  const [promotion, setPromotion] = useState(null); // 保留中のプロモーション手
  const [aiThinking, setAiThinking] = useState(false);

  // 人間が操作する色（1人プレイ時は白固定）
  const humanColor = WHITE;
  const isHumanTurn = mode === "two" || state.turn === humanColor;

  // 新規ゲーム開始
  const startGame = useCallback((selectedMode, selectedLevel) => {
    setMode(selectedMode);
    setLevel(selectedLevel);
    setState({
      board: initialBoard(),
      castling: { w: { k: true, q: true }, b: { k: true, q: true } },
      enPassant: null,
      turn: WHITE,
    });
    setSelected(null);
    setLegalForSel([]);
    setLastMove(null);
    setStatus("playing");
    setCaptured({ w: [], b: [] });
    setPromotion(null);
    setScreen("game");
  }, []);

  // 着手を確定して状態へ反映する共通処理
  const commitMove = useCallback((move, promo = "Q") => {
    setState((prev) => {
      const moving = prev.board[move.fr][move.fc];
      const target = move.flag === "enpassant"
        ? prev.board[move.fr][move.tc]
        : prev.board[move.tr][move.tc];

      // 取った駒を記録
      if (target) {
        setCaptured((cap) => ({
          ...cap,
          [target.c]: [...cap[target.c], target.t],
        }));
      }

      const next = applyMove(prev, move, promo);

      // 次手番の状態を判定
      const nextColor = next.turn;
      const nextLegal = legalMoves(next, nextColor);
      const checked = inCheck(next.board, nextColor);
      if (nextLegal.length === 0) {
        setStatus(checked ? "checkmate" : "stalemate");
      } else {
        setStatus(checked ? "check" : "playing");
      }
      return next;
    });
    setLastMove({ fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc });
    setSelected(null);
    setLegalForSel([]);
  }, []);

  // マスをタップしたとき
  const onSquareTap = useCallback((r, c) => {
    if (!isHumanTurn || aiThinking || status === "checkmate" || status === "stalemate") return;
    if (promotion) return;

    const piece = state.board[r][c];

    // すでに選択中で、合法手のマスをタップ → 移動
    if (selected) {
      const move = legalForSel.find((m) => m.tr === r && m.tc === c);
      if (move) {
        const moving = state.board[selected.r][selected.c];
        // プロモーション判定
        if (moving.t === "P" && (r === 0 || r === 7)) {
          setPromotion(move); // 駒選択UIを表示
          return;
        }
        commitMove(move);
        return;
      }
    }

    // 自分の駒を選択（手番の色のみ）
    if (piece && piece.c === state.turn && (mode === "two" || piece.c === humanColor)) {
      const all = legalMoves(state, state.turn);
      const forThis = all.filter((m) => m.fr === r && m.fc === c);
      setSelected({ r, c });
      setLegalForSel(forThis);
    } else {
      // 空マスや相手駒 → 選択解除
      setSelected(null);
      setLegalForSel([]);
    }
  }, [isHumanTurn, aiThinking, status, promotion, selected, legalForSel, state, mode, commitMove]);

  // プロモーション駒を確定
  const confirmPromotion = useCallback((promoType) => {
    if (!promotion) return;
    commitMove(promotion, promoType);
    setPromotion(null);
  }, [promotion, commitMove]);

  // AIの手番処理
  useEffect(() => {
    if (mode !== "one") return;
    if (state.turn === humanColor) return;
    if (status === "checkmate" || status === "stalemate") return;

    setAiThinking(true);
    // 探索が重い場合UIをブロックしないよう遅延実行
    const timer = setTimeout(() => {
      const move = chooseAIMove(state, state.turn, level);
      if (move) {
        // AIのプロモーションは常にクイーン
        commitMove(move, "Q");
      }
      setAiThinking(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [state, mode, level, status, commitMove]);

  // ============================================================
  // 描画
  // ============================================================
  if (screen === "menu") {
    return <Menu onStart={startGame} initialMode={mode} initialLevel={level} />;
  }

  const turnLabel = state.turn === WHITE ? "白" : "黒";
  let banner = `${turnLabel}の手番`;
  if (status === "check") banner = `${turnLabel}：チェック`;
  if (status === "checkmate") banner = `チェックメイト — ${state.turn === WHITE ? "黒" : "白"}の勝ち`;
  if (status === "stalemate") banner = "ステイルメイト — 引き分け";
  if (aiThinking && status !== "checkmate") banner = "考え中…";

  return (
    <div style={styles.page}>
      <style>{globalCSS}</style>
      <div style={styles.shell}>
        {/* ヘッダー */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setScreen("menu")} aria-label="メニューに戻る">
            ‹ メニュー
          </button>
          <div style={styles.modeTag}>
            {mode === "one" ? `1人プレイ · ${LEVELS[level].label}` : "2人プレイ"}
          </div>
        </div>

        {/* 取った駒（黒が取った白駒） */}
        <CapturedRow pieces={captured.w} color="w" />

        {/* 盤面 */}
        <Board
          board={state.board}
          selected={selected}
          legalForSel={legalForSel}
          lastMove={lastMove}
          status={status}
          turn={state.turn}
          onTap={onSquareTap}
        />

        {/* 取った駒（白が取った黒駒） */}
        <CapturedRow pieces={captured.b} color="b" />

        {/* ステータスバナー */}
        <div style={{
          ...styles.banner,
          ...(status === "checkmate" || status === "stalemate" ? styles.bannerEnd : {}),
        }}>
          {banner}
        </div>

        {(status === "checkmate" || status === "stalemate") && (
          <button style={styles.primaryBtn} onClick={() => startGame(mode, level)}>
            もう一度プレイ
          </button>
        )}
      </div>

      {/* プロモーション選択 */}
      {promotion && (
        <div style={styles.overlay} onClick={() => setPromotion(null)}>
          <div style={styles.promoCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.promoTitle}>昇格する駒を選択</div>
            <div style={styles.promoRow}>
              {["Q", "R", "B", "N"].map((t) => (
                <button key={t} style={styles.promoBtn} onClick={() => confirmPromotion(t)}>
                  {GLYPH[state.turn + t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// メニュー画面
// ============================================================
function Menu({ onStart, initialMode, initialLevel }) {
  const [mode, setMode] = useState(initialMode);
  const [level, setLevel] = useState(initialLevel);

  return (
    <div style={styles.page}>
      <style>{globalCSS}</style>
      <div style={styles.menuShell}>
        <div style={styles.menuGlyph}>{GLYPH.bN}</div>
        <h1 style={styles.title}>Chess</h1>
        <p style={styles.subtitle}>駒をタップして、動ける場所を確かめながら指す</p>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>プレイ人数</div>
          <div style={styles.segment}>
            <button
              style={{ ...styles.segItem, ...(mode === "one" ? styles.segActive : {}) }}
              onClick={() => setMode("one")}
            >
              1人プレイ
            </button>
            <button
              style={{ ...styles.segItem, ...(mode === "two" ? styles.segActive : {}) }}
              onClick={() => setMode("two")}
            >
              2人プレイ
            </button>
          </div>
        </div>

        {mode === "one" && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>相手の強さ</div>
            <div style={styles.levelList}>
              {LEVELS.map((lv, i) => (
                <button
                  key={i}
                  style={{ ...styles.levelItem, ...(level === i ? styles.levelActive : {}) }}
                  onClick={() => setLevel(i)}
                >
                  <span>{lv.label}</span>
                  <span style={styles.levelDots}>
                    {"●".repeat(i + 1)}<span style={{ opacity: 0.2 }}>{"●".repeat(4 - i)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button style={styles.primaryBtn} onClick={() => onStart(mode, level)}>
          ゲーム開始
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 盤面コンポーネント
// ============================================================
function Board({ board, selected, legalForSel, lastMove, status, turn, onTap }) {
  // チェック中のキング位置
  const checkSquare = useMemo(() => {
    if (status !== "check" && status !== "checkmate") return null;
    return findKing(board, turn);
  }, [board, status, turn]);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  return (
    <div style={styles.boardWrap}>
      <div style={styles.board}>
        {board.map((row, r) =>
          row.map((sq, c) => {
            const dark = (r + c) % 2 === 1;
            const isSel = selected && selected.r === r && selected.c === c;
            const move = legalForSel.find((m) => m.tr === r && m.tc === c);
            const isLast = lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c));
            const isCheck = checkSquare && checkSquare[0] === r && checkSquare[1] === c;

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => onTap(r, c)}
                style={{
                  ...styles.square,
                  background: dark ? "#B7A78E" : "#EFE9DC",
                  ...(isLast ? { background: dark ? "#C8B97F" : "#E4DCA8" } : {}),
                  ...(isSel ? { background: "#A9C6E8" } : {}),
                  ...(isCheck ? { background: "#E6A8A0" } : {}),
                }}
                aria-label={`${files[c]}${8 - r}`}
              >
                {/* 座標ラベル（端のみ） */}
                {c === 0 && <span style={styles.rankLabel}>{8 - r}</span>}
                {r === 7 && <span style={styles.fileLabel}>{files[c]}</span>}

                {/* 駒 */}
                {sq && (
                  <span style={{
                    ...styles.piece,
                    color: sq.c === WHITE ? "#FAFAF7" : "#2B2B2B",
                    WebkitTextStroke: sq.c === WHITE
                      ? "1.2px #6B6B6B"
                      : "1.2px #1A1A1A",
                    textShadow: sq.c === WHITE
                      ? "0 1px 2px rgba(0,0,0,0.3)"
                      : "0 1px 2px rgba(0,0,0,0.25)",
                  }}>
                    {GLYPH[sq.c + sq.t]}
                  </span>
                )}

                {/* 移動可能マーカー: 空マスはドット、取れるマスはリング */}
                {move && !move.capture && <span style={styles.moveDot} />}
                {move && move.capture && <span style={styles.captureRing} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// 取った駒の表示行
function CapturedRow({ pieces, color }) {
  return (
    <div style={styles.capturedRow}>
      {pieces.map((t, i) => (
        <span key={i} style={{
          ...styles.capturedPiece,
          color: color === WHITE ? "#FAFAF7" : "#2B2B2B",
          WebkitTextStroke: color === WHITE ? "0.6px #9A958A" : "0.6px #1A1A1A",
        }}>
          {GLYPH[color + t]}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// スタイル
// ============================================================
const globalCSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  button { font-family: inherit; cursor: pointer; border: none; }
  @media (prefers-reduced-motion: no-preference) {
    .fade-in { animation: fade 0.25s ease; }
  }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
`;

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Hiragino Sans", "Noto Sans JP", sans-serif';

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#F5F5F7",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily: FONT,
    color: "#1D1D1F",
    padding: "24px 16px",
  },
  shell: {
    width: "100%",
    maxWidth: 440,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  // --- メニュー ---
  menuShell: {
    width: "100%",
    maxWidth: 380,
    marginTop: "6vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  menuGlyph: { fontSize: 64, textAlign: "center", color: "#1D1D1F", lineHeight: 1 },
  title: {
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    textAlign: "center",
    margin: "8px 0 0",
  },
  subtitle: {
    fontSize: 15,
    color: "#6E6E73",
    textAlign: "center",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6E6E73",
    margin: "0 0 8px 4px",
    letterSpacing: "0.01em",
  },
  segment: {
    display: "flex",
    background: "#E9E9EB",
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    padding: "11px 0",
    fontSize: 15,
    fontWeight: 500,
    background: "transparent",
    borderRadius: 9,
    color: "#1D1D1F",
    transition: "all 0.2s ease",
  },
  segActive: {
    background: "#FFFFFF",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    fontWeight: 600,
  },
  levelList: { display: "flex", flexDirection: "column", gap: 6 },
  levelItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 500,
    background: "#FFFFFF",
    borderRadius: 12,
    color: "#1D1D1F",
    border: "1px solid transparent",
    transition: "all 0.15s ease",
  },
  levelActive: {
    border: "1px solid #0071E3",
    background: "#F0F7FF",
  },
  levelDots: { fontSize: 11, letterSpacing: 2, color: "#0071E3" },
  primaryBtn: {
    width: "100%",
    padding: "15px 0",
    fontSize: 17,
    fontWeight: 600,
    background: "#0071E3",
    color: "#FFFFFF",
    borderRadius: 14,
    marginTop: 8,
    transition: "background 0.15s ease",
  },
  // --- ゲーム ---
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  backBtn: {
    fontSize: 16,
    color: "#0071E3",
    background: "transparent",
    padding: "4px 0",
    fontWeight: 400,
  },
  modeTag: { fontSize: 13, color: "#6E6E73", fontWeight: 500 },
  boardWrap: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gridTemplateRows: "repeat(8, 1fr)",
    aspectRatio: "1 / 1",
    width: "100%",
  },
  square: {
    position: "relative",
    width: "100%",
    height: "100%",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    transition: "background 0.12s ease",
  },
  piece: {
    fontSize: "min(8.5vw, 38px)",
    lineHeight: 1,
    userSelect: "none",
    pointerEvents: "none",
  },
  moveDot: {
    position: "absolute",
    width: "26%",
    height: "26%",
    borderRadius: "50%",
    background: "rgba(0,0,0,0.22)",
    pointerEvents: "none",
  },
  captureRing: {
    position: "absolute",
    width: "82%",
    height: "82%",
    borderRadius: "50%",
    border: "3px solid rgba(0,0,0,0.28)",
    pointerEvents: "none",
  },
  rankLabel: {
    position: "absolute",
    top: 2,
    left: 3,
    fontSize: 9,
    fontWeight: 600,
    color: "rgba(0,0,0,0.32)",
    pointerEvents: "none",
  },
  fileLabel: {
    position: "absolute",
    bottom: 2,
    right: 3,
    fontSize: 9,
    fontWeight: 600,
    color: "rgba(0,0,0,0.32)",
    pointerEvents: "none",
  },
  capturedRow: {
    minHeight: 24,
    display: "flex",
    flexWrap: "wrap",
    gap: 0,
    alignItems: "center",
    padding: "0 4px",
  },
  capturedPiece: { fontSize: 18, lineHeight: 1 },
  banner: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: 600,
    padding: "12px 0",
    color: "#1D1D1F",
  },
  bannerEnd: { fontSize: 20 },
  // --- プロモーション ---
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  promoCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "24px 20px",
    width: "100%",
    maxWidth: 320,
    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 600,
    textAlign: "center",
    marginBottom: 16,
    color: "#1D1D1F",
  },
  promoRow: { display: "flex", justifyContent: "space-around", gap: 8 },
  promoBtn: {
    flex: 1,
    aspectRatio: "1 / 1",
    fontSize: 34,
    background: "#F5F5F7",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s ease",
  },
};
