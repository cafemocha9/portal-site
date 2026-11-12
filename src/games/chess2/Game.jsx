import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

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
// UI定数
// ============================================================
const LEVEL_META = [
  { desc: "はじめてでも安心", color: "#58CC02", dark: "#58A700" },
  { desc: "ルールに慣れてきたら", color: "#1CB0F6", dark: "#1899D6" },
  { desc: "ちょうどいい勝負", color: "#CE82FF", dark: "#A568CC" },
  { desc: "しっかり読んでくる", color: "#FF9600", dark: "#E08600" },
  { desc: "手ごわい本気モード", color: "#FF4B4B", dark: "#EA2B2B" },
];
// 優勢バー用の簡易駒価値
const SCORE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const PRAISE = ["ナイス！", "いいね、その調子！", "すごい一手！"];

const SQ_COLOR = {
  light: "#F2FBE6", dark: "#9ED36A",
  lastLight: "#D7F0FF", lastDark: "#8CCDF0",
  sel: "#FFE680", check: "#FFB4B4",
};

const newGameState = () => ({
  board: initialBoard(),
  castling: { w: { k: true, q: true }, b: { k: true, q: true } },
  enPassant: null,
  turn: WHITE,
});
const colorName = (c) => (c === WHITE ? "白" : "黒");

// 駒の描画：同じ形の「塗り字形」と「線字形」を重ねる。
// 線字形(♙)だけだと中が透けるため、下に塗り字形(♟)を敷いて中身を塗る。
// \uFE0E は絵文字表示を防ぐテキスト表示指定。
const SOLID = { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" };
const OUTLINE = { K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659" };
const PIECE_INK = {
  w: { fill: "#FFFFFF", line: "#4B4B4B" },
  b: { fill: "#3C3C3C", line: "#9A9A9A" },
};
function Piece({ color, type, className = "", style }) {
  const ink = PIECE_INK[color];
  return (
    <span className={`cq-glyph ${className}`} style={style}>
      <span className="cq-glyph-fill" style={{ color: ink.fill }}>{SOLID[type] + "\uFE0E"}</span>
      <span className="cq-glyph-line" style={{ color: ink.line }}>{OUTLINE[type] + "\uFE0E"}</span>
    </span>
  );
}

// ============================================================
// マスコットのセリフと表情を状態から決める
// ============================================================
function mascotLine({ mode, status, turn, aiThinking, lastMove, humanColor, rewound }) {
  const solo = mode === "one";
  if (status === "checkmate") {
    const winner = opp(turn);
    if (!solo) return { text: `${colorName(winner)}の勝ち！`, mood: "celebrate" };
    return winner === humanColor
      ? { text: "やったね！勝ったよ！", mood: "celebrate" }
      : { text: "ざんねん…次はがんばろう！", mood: "sad" };
  }
  if (status === "stalemate") return { text: "引き分けだね！", mood: "idle" };
  if (rewound && status !== "check") return { text: "一手もどしたよ！じっくり考えてね", mood: "happy" };

  // 直前の手で駒を取った場合のリアクション（AI思考中も表示を優先）
  if (lastMove && lastMove.captured && status !== "check") {
    if (!solo) return { text: `${colorName(lastMove.by)}がナイスキャッチ！`, mood: "happy" };
    if (lastMove.by === humanColor) return { text: PRAISE[lastMove.id % PRAISE.length], mood: "happy" };
    if (!aiThinking) return { text: "あっ、取られちゃった！", mood: "sad" };
  }
  if (aiThinking) return { text: "うーん、考え中", mood: "thinking" };
  if (status === "check") {
    if (!solo) return { text: `${colorName(turn)}の王さまがチェック！`, mood: "surprised" };
    return turn === humanColor
      ? { text: "チェック！王さまを守って！", mood: "surprised" }
      : { text: "チェック！いい感じ！", mood: "happy" };
  }
  if (!lastMove) return { text: "駒をタップしてみよう！", mood: "idle" };
  return solo
    ? { text: "あなたの番だよ！", mood: "idle" }
    : { text: `${colorName(turn)}の番だよ！`, mood: "idle" };
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function Chess() {
  const [screen, setScreen] = useState("menu"); // menu | game
  const [mode, setMode] = useState("one"); // one | two
  const [level, setLevel] = useState(2);

  const [state, setState] = useState(newGameState);
  const stateRef = useRef(state); // 非同期処理（AI）から常に最新盤面を参照するため
  const moveIdRef = useRef(0);

  const [selected, setSelected] = useState(null);
  const [legalForSel, setLegalForSel] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [status, setStatus] = useState("playing");
  const [captured, setCaptured] = useState({ w: [], b: [] });
  const [promotion, setPromotion] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 一手戻す用の履歴。各手を指す直前の局面一式を積み上げる。
  // 盤面だけでなく取った駒・直前の手・状態も保存し、戻した後の表示を一致させる。
  const historyRef = useRef([]);
  const [historyLen, setHistoryLen] = useState(0);
  const capturedRef = useRef({ w: [], b: [] });
  const lastMoveRef = useRef(null);
  const statusRef = useRef("playing");
  const [rewind, setRewind] = useState(null); // 戻した手のアニメーション情報

  const humanColor = WHITE;
  const gameOver = status === "checkmate" || status === "stalemate";
  const isHumanTurn = mode === "two" || state.turn === humanColor;

  const startGame = useCallback((m, lv) => {
    const fresh = newGameState();
    stateRef.current = fresh;
    moveIdRef.current = 0;
    historyRef.current = [];
    setHistoryLen(0);
    capturedRef.current = { w: [], b: [] };
    lastMoveRef.current = null;
    statusRef.current = "playing";
    setRewind(null);
    setMode(m);
    setLevel(lv);
    setState(fresh);
    setSelected(null);
    setLegalForSel([]);
    setLastMove(null);
    setStatus("playing");
    setCaptured({ w: [], b: [] });
    setPromotion(null);
    setAiThinking(false);
    setShowResult(false);
    setScreen("game");
  }, []);

  // 着手の確定（人間・AI共通）
  const commitMove = useCallback((move, promo = "Q") => {
    const prev = stateRef.current;
    const moving = prev.board[move.fr][move.fc];
    const target = move.flag === "enpassant"
      ? prev.board[move.fr][move.tc]
      : prev.board[move.tr][move.tc];

    // 指す前の局面を履歴に保存
    historyRef.current.push({
      state: prev,
      captured: capturedRef.current,
      lastMove: lastMoveRef.current,
      status: statusRef.current,
    });
    setHistoryLen(historyRef.current.length);

    const next = applyMove(prev, move, promo);
    stateRef.current = next;
    setState(next);

    const cap = capturedRef.current;
    const nextCaptured = target ? { ...cap, [target.c]: [...cap[target.c], target.t] } : cap;
    capturedRef.current = nextCaptured;
    setCaptured(nextCaptured);

    const nextLegal = legalMoves(next, next.turn);
    const checked = inCheck(next.board, next.turn);
    const nextStatus = nextLegal.length === 0
      ? (checked ? "checkmate" : "stalemate")
      : (checked ? "check" : "playing");
    statusRef.current = nextStatus;
    setStatus(nextStatus);

    // id はアニメーションを毎手リセットするためのキー
    const lm = { ...move, by: moving.c, captured: !!target, id: ++moveIdRef.current };
    lastMoveRef.current = lm;
    setLastMove(lm);
    setRewind(null);
    setSelected(null);
    setLegalForSel([]);
  }, []);

  // 一手戻す
  // 1人プレイでは「自分の番」になるまで戻す（AIの応手と自分の手をまとめて取り消す）。
  // AIの応手だけを戻すと、すぐAIが指し直して意味がないため。
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.length || promotion) return;
    const undone = [lastMoveRef.current]; // 取り消す手（スライドで戻すアニメーション用）
    let snap = h.pop();
    if (mode === "one") {
      while (snap.state.turn !== humanColor && h.length) {
        undone.push(snap.lastMove);
        snap = h.pop();
      }
    }
    stateRef.current = snap.state;
    capturedRef.current = snap.captured;
    lastMoveRef.current = snap.lastMove;
    statusRef.current = snap.status;
    setState(snap.state);
    setCaptured(snap.captured);
    setLastMove(snap.lastMove);
    setStatus(snap.status);
    setHistoryLen(h.length);
    setRewind({ id: ++moveIdRef.current, moves: undone.filter(Boolean) });
    setSelected(null);
    setLegalForSel([]);
    setAiThinking(false); // 思考待ちのタイマーは盤面変更でクリアされる
    setShowResult(false);
  }, [mode, promotion]);

  // 終局：最後の一手の動きを見せてから結果を出す
  useEffect(() => {
    if (!gameOver) return;
    const t = setTimeout(() => setShowResult(true), 800);
    return () => clearTimeout(t);
  }, [gameOver]);

  const onSquareTap = useCallback((r, c) => {
    if (!isHumanTurn || aiThinking || gameOver || promotion) return;
    const piece = state.board[r][c];

    if (selected) {
      // 同じ駒をもう一度タップ → 選択解除
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        setLegalForSel([]);
        return;
      }
      const move = legalForSel.find((m) => m.tr === r && m.tc === c);
      if (move) {
        const moving = state.board[selected.r][selected.c];
        if (moving.t === "P" && (r === 0 || r === 7)) {
          setPromotion(move);
          return;
        }
        commitMove(move);
        return;
      }
    }

    if (piece && piece.c === state.turn && (mode === "two" || piece.c === humanColor)) {
      const forThis = legalMoves(state, state.turn).filter((m) => m.fr === r && m.fc === c);
      setSelected({ r, c });
      setLegalForSel(forThis);
    } else {
      setSelected(null);
      setLegalForSel([]);
    }
  }, [isHumanTurn, aiThinking, gameOver, promotion, selected, legalForSel, state, mode, commitMove]);

  const confirmPromotion = useCallback((t) => {
    if (!promotion) return;
    commitMove(promotion, t);
    setPromotion(null);
  }, [promotion, commitMove]);

  // AIの手番
  useEffect(() => {
    if (screen !== "game" || mode !== "one") return;
    if (state.turn === humanColor || gameOver) return;

    setAiThinking(true);
    // 人間の手のアニメーションとリアクションを見せてから考え始める
    const timer = setTimeout(() => {
      const move = chooseAIMove(stateRef.current, stateRef.current.turn, level);
      if (move) commitMove(move, "Q");
      setAiThinking(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [state, screen, mode, level, gameOver, commitMove]);

  if (screen === "menu") {
    return <Menu onStart={startGame} initialMode={mode} initialLevel={level} />;
  }

  // 優勢バー：白が取った駒の価値 − 黒が取った駒の価値
  const sum = (arr) => arr.reduce((s, t) => s + SCORE[t], 0);
  const adv = sum(captured.b) - sum(captured.w);
  const advPct = Math.max(6, Math.min(94, 50 + adv * 4));

  const line = mascotLine({ mode, status, turn: state.turn, aiThinking, lastMove, humanColor, rewound: !!rewind });
  const canUndo = historyLen > 0 && !promotion;
  const solo = mode === "one";

  // 結果モーダルの内容
  let outcome = null;
  if (gameOver) {
    if (status === "stalemate") {
      outcome = { title: "引き分け！", sub: "ステイルメイトで決着つかず", mood: "idle", confetti: false, win: false };
    } else {
      const winner = opp(state.turn);
      if (!solo) outcome = { title: `${colorName(winner)}の勝ち！`, sub: "チェックメイト！", mood: "celebrate", confetti: true, win: true };
      else if (winner === humanColor) outcome = { title: "勝利！", sub: `Lv.${level + 1}「${LEVELS[level].label}」に勝ったよ`, mood: "celebrate", confetti: true, win: true };
      else outcome = { title: "ざんねん…", sub: "次はきっと勝てるよ", mood: "sad", confetti: false, win: false };
    }
  }

  return (
    <div className="cq-page">
      <style>{CSS}</style>
      <div className="cq-shell">
        <header className="cq-topbar">
          <button className="cq-close" onClick={() => setScreen("menu")} aria-label="メニューに戻る">✕</button>
          <div className="cq-progress" role="img" aria-label="駒の損得（白の優勢）">
            <div className="cq-progress-fill" style={{ width: `${advPct}%` }} />
          </div>
          <span className="cq-chip">{solo ? `Lv.${level + 1}` : "2人"}</span>
        </header>

        <MascotBubble line={line} />

        <PlayerBar
          color={BLACK}
          name={solo ? "コンピュータ" : "黒"}
          sub={solo ? LEVELS[level].label : null}
          active={!gameOver && state.turn === BLACK}
          thinking={aiThinking}
          pieces={captured.w}
        />

        <Board
          board={state.board}
          selected={selected}
          legalForSel={legalForSel}
          lastMove={lastMove}
          rewind={rewind}
          status={status}
          turn={state.turn}
          onTap={onSquareTap}
        />

        <PlayerBar
          color={WHITE}
          name={solo ? "あなた" : "白"}
          active={!gameOver && state.turn === WHITE}
          pieces={captured.b}
        />

        <button className="cq-btn cq-btn-ghost cq-undo" onClick={undo} disabled={!canUndo}>
          <span className="cq-undo-icon" aria-hidden="true">↶</span>一手もどる
        </button>
      </div>

      {promotion && (
        <div className="cq-overlay" onClick={() => setPromotion(null)}>
          <div className="cq-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cq-modal-small">どの駒に進化する？</h3>
            <div className="cq-promo-grid">
              {["Q", "R", "B", "N"].map((t, i) => (
                <button
                  key={t}
                  className="cq-promo"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => confirmPromotion(t)}
                >
                  <Piece color={state.turn} type={t} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showResult && outcome && (
        <div className="cq-overlay">
          {outcome.confetti && <Confetti />}
          <div className="cq-modal cq-result">
            <div className="cq-modal-mascot"><Mascot mood={outcome.mood} size={112} /></div>
            <h2 className={outcome.win ? "is-win" : ""}>{outcome.title}</h2>
            <p>{outcome.sub}</p>
            <button className="cq-btn cq-btn-green" onClick={() => startGame(mode, level)}>もう一度あそぶ</button>
            <button className="cq-btn cq-btn-ghost" onClick={() => setScreen("menu")}>メニューへもどる</button>
            {canUndo && <button className="cq-textlink" onClick={undo}>↶ 一手もどってやり直す</button>}
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
    <div className="cq-page">
      <style>{CSS}</style>
      <div className="cq-menu">
        <div className="cq-hero">
          <div className="cq-hero-mascot"><Mascot mood="happy" size={116} /></div>
          <h1 className="cq-title">チェス</h1>
          <p className="cq-sub">駒をタップすると、動ける場所が光るよ</p>
        </div>

        <section>
          <h2 className="cq-label">だれとあそぶ？</h2>
          <div className="cq-mode-grid">
            <button className={`cq-card ${mode === "one" ? "is-on" : ""}`} onClick={() => setMode("one")}>
              <span className="cq-card-emoji" aria-hidden="true">🤖</span>
              <span className="cq-card-title">ひとりで</span>
              <span className="cq-card-desc">コンピュータと対戦</span>
            </button>
            <button className={`cq-card ${mode === "two" ? "is-on" : ""}`} onClick={() => setMode("two")}>
              <span className="cq-card-emoji" aria-hidden="true">👥</span>
              <span className="cq-card-title">ふたりで</span>
              <span className="cq-card-desc">となりの人と対戦</span>
            </button>
          </div>
        </section>

        {mode === "one" && (
          <section className="cq-reveal">
            <h2 className="cq-label">相手の強さ</h2>
            <div className="cq-levels">
              {LEVELS.map((lv, i) => (
                <button
                  key={i}
                  className={`cq-level ${level === i ? "is-on" : ""}`}
                  style={{ "--lc": LEVEL_META[i].color, "--ld": LEVEL_META[i].dark, animationDelay: `${i * 45}ms` }}
                  onClick={() => setLevel(i)}
                >
                  <span className="cq-level-badge">{i + 1}</span>
                  <span className="cq-level-text">
                    <b>{lv.label}</b>
                    <small>{LEVEL_META[i].desc}</small>
                  </span>
                  <span className="cq-level-check" aria-hidden="true">✓</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <button className="cq-btn cq-btn-green" onClick={() => onStart(mode, level)}>はじめる</button>
      </div>
    </div>
  );
}

// ============================================================
// マスコット（オリジナルの「ナイトくん」：ナイトの駒をモチーフにした馬）
// mood: idle | happy | celebrate | surprised | sad | thinking
// ============================================================
function Mascot({ mood = "idle", size = 80 }) {
  const ink = "#4B4B4B";
  const C = { coat: "#FFC94D", coatD: "#E8A93A", snout: "#FFEBC2", mane: "#1CB0F6", maneD: "#1899D6", nose: "#C98A3E" };
  const happy = mood === "happy" || mood === "celebrate";

  const eye = (cx) => {
    if (happy) {
      return <path d={`M${cx - 5.5} 38 Q${cx} 31 ${cx + 5.5} 38`} stroke={ink} strokeWidth="3.4" fill="none" strokeLinecap="round" />;
    }
    const r = mood === "surprised" ? 7.5 : 6.5;
    const off = mood === "thinking" ? [2, -2.5] : mood === "sad" ? [0, 2] : [1, 1];
    return (
      <g>
        <circle cx={cx} cy={37} r={r} fill="#FFFFFF" />
        <circle cx={cx + off[0]} cy={37 + off[1]} r={mood === "surprised" ? 3.8 : 3.6} fill={ink} />
        <circle cx={cx + off[0] + 1.3} cy={37 + off[1] - 1.3} r={1.2} fill="#FFFFFF" />
      </g>
    );
  };

  // 口は鼻づらの下側
  const mouth = {
    idle: <path d="M45 67 Q50 71 55 67" stroke={ink} strokeWidth="2.8" fill="none" strokeLinecap="round" />,
    happy: <path d="M43 65 Q50 75 57 65 Z" fill={ink} />,
    celebrate: <path d="M42 64 Q50 77 58 64 Z" fill={ink} />,
    surprised: <ellipse cx="50" cy="68" rx="3.5" ry="4.5" fill={ink} />,
    sad: <path d="M45 70 Q50 66 55 70" stroke={ink} strokeWidth="2.8" fill="none" strokeLinecap="round" />,
    thinking: <path d="M45 68 L55 66.5" stroke={ink} strokeWidth="2.8" fill="none" strokeLinecap="round" />,
  }[mood];

  return (
    <svg className="cq-mascot" width={size} height={size * 1.1} viewBox="0 0 100 110" aria-hidden="true">
      <ellipse cx="50" cy="105" rx="30" ry="5" fill="rgba(0,0,0,0.08)" />
      {/* 台座（チェスの駒らしさ） */}
      <rect x="20" y="88" width="60" height="14" rx="7" fill={C.mane} />
      <rect x="20" y="96" width="60" height="6" rx="3" fill={C.maneD} />
      {/* 首 */}
      <path d="M35 62 Q33 78 28 90 L72 90 Q67 78 65 62 Z" fill={C.coatD} />
      {/* 耳 */}
      <path d="M29 30 L31 6 L45 20 Z" fill={C.coat} />
      <path d="M71 30 L69 6 L55 20 Z" fill={C.coat} />
      <path d="M32 24 L33 12 L41 20 Z" fill="#FF9EAA" />
      <path d="M68 24 L67 12 L59 20 Z" fill="#FF9EAA" />
      {/* 頭と鼻づら */}
      <ellipse cx="50" cy="38" rx="24" ry="22" fill={C.coat} />
      <ellipse cx="50" cy="61" rx="17" ry="13" fill={C.snout} />
      <ellipse cx="44" cy="59" rx="2.4" ry="1.8" fill={C.nose} />
      <ellipse cx="56" cy="59" rx="2.4" ry="1.8" fill={C.nose} />
      {/* たてがみ（前髪） */}
      <path d="M36 22 Q38 8 46 13 Q49 2 55 12 Q62 6 64 21 Q57 16 50 19 Q43 16 36 22 Z" fill={C.mane} />
      {mood === "sad" && (
        <g stroke={ink} strokeWidth="2.8" strokeLinecap="round">
          <path d="M33 27 L43 30" /><path d="M67 27 L57 30" />
        </g>
      )}
      <g className={happy ? "" : "cq-blink"}>
        {eye(39)}
        {eye(61)}
      </g>
      <ellipse cx="29" cy="47" rx="4.5" ry="2.8" fill="#FF9EAA" opacity="0.75" />
      <ellipse cx="71" cy="47" rx="4.5" ry="2.8" fill="#FF9EAA" opacity="0.75" />
      {mouth}
      {mood === "celebrate" && (
        <g fill="#58CC02">
          <path className="cq-twinkle" d="M10 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path className="cq-twinkle cq-tw2" d="M90 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
        </g>
      )}
    </svg>
  );
}

function MascotBubble({ line }) {
  return (
    <div className="cq-mascot-row">
      <div key={line.mood + line.text} className={`cq-mascot-wrap mood-${line.mood}`}>
        <Mascot mood={line.mood} size={68} />
      </div>
      <div key={line.text} className="cq-bubble" aria-live="polite">
        {line.text}
        {line.mood === "thinking" && <span className="cq-dots"><i /><i /><i /></span>}
      </div>
    </div>
  );
}

// ============================================================
// プレイヤー表示（手番・取った駒）
// ============================================================
function PlayerBar({ color, name, sub, active, thinking, pieces }) {
  const capColor = opp(color); // 取った相手の駒の色
  return (
    <div className={`cq-player ${active ? "is-active" : ""}`}>
      <span className="cq-avatar"><Piece color={color} type="K" /></span>
      <span className="cq-player-name">
        {name}
        {sub && <small>{sub}</small>}
      </span>
      {active && thinking && <span className="cq-dots"><i /><i /><i /></span>}
      <span className="cq-caps">
        {pieces.map((t, i) => (
          <Piece key={i} color={capColor} type={t} />
        ))}
      </span>
    </div>
  );
}

// ============================================================
// 盤面
// ============================================================
function Board({ board, selected, legalForSel, lastMove, rewind, status, turn, onTap }) {
  const checkSquare = useMemo(() => {
    if (status !== "check" && status !== "checkmate") return null;
    return findKing(board, turn);
  }, [board, status, turn]);

  // 直前の手で動いた駒の「移動元からのずれ」を計算（スライドアニメーション用）
  const anim = useMemo(() => {
    const map = {};
    if (rewind) {
      // 戻した手：駒は今「移動元」にいるので、移動先の位置から元へ滑らせる
      for (const m of rewind.moves) {
        map[`${m.fr}-${m.fc}`] = { dx: m.tc - m.fc, dy: m.tr - m.fr, key: `u${rewind.id}` };
        if (m.flag === "castle-k") map[`${m.tr}-7`] = { dx: -2, dy: 0, key: `u${rewind.id}` };
        if (m.flag === "castle-q") map[`${m.tr}-0`] = { dx: 3, dy: 0, key: `u${rewind.id}` };
      }
      return map;
    }
    if (!lastMove) return map;
    map[`${lastMove.tr}-${lastMove.tc}`] = { dx: lastMove.fc - lastMove.tc, dy: lastMove.fr - lastMove.tr };
    if (lastMove.flag === "castle-k") map[`${lastMove.tr}-5`] = { dx: 2, dy: 0 };
    if (lastMove.flag === "castle-q") map[`${lastMove.tr}-3`] = { dx: -3, dy: 0 };
    return map;
  }, [lastMove, rewind]);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  return (
    <div className="cq-board-frame">
      <div className="cq-board">
        {board.map((row, r) =>
          row.map((sq, c) => {
            const dark = (r + c) % 2 === 1;
            const isSel = selected && selected.r === r && selected.c === c;
            const moveIdx = legalForSel.findIndex((m) => m.tr === r && m.tc === c);
            const move = moveIdx >= 0 ? legalForSel[moveIdx] : null;
            const isLast = lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c));
            const isCheck = checkSquare && checkSquare[0] === r && checkSquare[1] === c;
            const a = anim[`${r}-${c}`];
            const landed = lastMove && lastMove.tr === r && lastMove.tc === c;

            let bg = dark ? SQ_COLOR.dark : SQ_COLOR.light;
            if (isLast) bg = dark ? SQ_COLOR.lastDark : SQ_COLOR.lastLight;
            if (isSel) bg = SQ_COLOR.sel;
            if (isCheck) bg = SQ_COLOR.check;

            return (
              <button
                key={`${r}-${c}`}
                className={`cq-sq ${move ? "is-target" : ""}`}
                style={{ background: bg }}
                onClick={() => onTap(r, c)}
                aria-label={`${files[c]}${8 - r}${sq ? ` ${colorName(sq.c)}の駒` : ""}`}
              >
                {c === 0 && <span className="cq-rank">{8 - r}</span>}
                {r === 7 && <span className="cq-file">{files[c]}</span>}

                {sq && (
                  <span
                    key={a ? (a.key || `m${lastMove.id}`) : "still"}
                    className={`cq-pc-wrap ${a ? "slide" : ""}`}
                    style={a ? { "--dx": `${a.dx * 100}%`, "--dy": `${a.dy * 100}%` } : undefined}
                  >
                    <Piece
                      color={sq.c}
                      type={sq.t}
                      className={`cq-pc ${isSel ? "sel" : ""} ${isCheck ? "shake" : ""} ${a && !isSel ? "land" : ""}`}
                    />
                  </span>
                )}

                {move && !move.capture && <span className="cq-dot" style={{ animationDelay: `${moveIdx * 25}ms` }} />}
                {move && move.capture && <span className="cq-ring" style={{ animationDelay: `${moveIdx * 25}ms` }} />}
                {landed && lastMove.captured && !rewind && <Burst key={lastMove.id} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// 駒を取ったときの星の飛び散り
function Burst() {
  return (
    <span className="cq-burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--a": `${i * 45}deg` }} />)}
    </span>
  );
}

// 勝利時の紙吹雪
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.8 + Math.random() * 1.4,
    color: ["#58CC02", "#1CB0F6", "#FFC800", "#FF4B4B", "#CE82FF"][i % 5],
    rot: Math.random() * 360,
    w: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 140,
  })), []);
  return (
    <div className="cq-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`, background: p.color, width: p.w, height: p.w * 1.6,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
            "--rot": `${p.rot}deg`, "--drift": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// スタイル（アニメーションを含むためCSS文字列で定義）
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap');

.cq-page {
  --green:#58CC02; --green-d:#58A700; --blue:#1CB0F6; --blue-d:#1899D6;
  --red:#FF4B4B; --gold:#FFC800; --ink:#4B4B4B; --muted:#AFAFAF; --line:#E5E5E5; --soft:#F7F7F7;
  min-height:100vh; width:100%; background:#FFFFFF; color:var(--ink);
  font-family:"Nunito","M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif;
  display:flex; justify-content:center; padding:20px 16px 32px;
}
.cq-page *, .cq-page *::before, .cq-page *::after { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
.cq-page button { font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; padding:0; }
.cq-page button:focus-visible { outline:3px solid var(--blue); outline-offset:2px; }
.cq-shell { width:100%; max-width:460px; display:flex; flex-direction:column; gap:10px; }

/* ---------- 立体ボタン ---------- */
.cq-btn { width:100%; padding:14px 0 !important; border-radius:16px; font-size:17px; font-weight:900; letter-spacing:.06em;
  transition:transform .08s, box-shadow .08s, filter .15s; }
.cq-btn-green { background:var(--green) !important; color:#fff !important; box-shadow:0 5px 0 var(--green-d); }
.cq-btn-green:hover { filter:brightness(1.06); }
.cq-btn-green:active { transform:translateY(5px); box-shadow:0 0 0 var(--green-d); }
.cq-btn-ghost { background:#fff !important; color:var(--blue) !important; border:2px solid var(--line) !important; box-shadow:0 4px 0 var(--line); }
.cq-btn-ghost:active { transform:translateY(4px); box-shadow:0 0 0 var(--line); }

.cq-btn:disabled { opacity:.4; cursor:default; transform:none !important; }
.cq-undo { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px; padding:11px 0 !important; font-size:15px; }
.cq-undo-icon { font-size:20px; line-height:1; transition:transform .3s cubic-bezier(.34,1.56,.64,1); }
.cq-undo:not(:disabled):hover .cq-undo-icon { transform:rotate(-40deg); }
.cq-textlink { margin-top:2px; font-size:14px; font-weight:800; color:var(--muted) !important; }
.cq-textlink:hover { color:var(--ink) !important; }

/* ---------- 上部バー ---------- */
.cq-topbar { display:flex; align-items:center; gap:14px; }
.cq-close { font-size:22px; font-weight:900; color:var(--muted) !important; padding:4px 6px !important; transition:transform .2s, color .2s; }
.cq-close:hover { transform:scale(1.15) rotate(90deg); color:var(--ink) !important; }
.cq-progress { flex:1; height:16px; background:var(--line); border-radius:999px; overflow:hidden; }
.cq-progress-fill { position:relative; height:100%; background:var(--green); border-radius:999px;
  transition:width .6s cubic-bezier(.34,1.56,.64,1); }
.cq-progress-fill::after { content:""; position:absolute; left:8px; right:8px; top:4px; height:4px; border-radius:999px; background:rgba(255,255,255,.35); }
.cq-chip { font-size:13px; font-weight:900; color:#D89B00; background:#FFF4CC; padding:4px 10px; border-radius:999px; }

/* ---------- マスコットと吹き出し ---------- */
.cq-mascot-row { display:flex; align-items:flex-end; gap:12px; min-height:80px; margin-top:4px; }
.cq-mascot-wrap { flex-shrink:0; transform-origin:50% 100%; }
.cq-mascot { display:block; overflow:visible; transform-origin:50% 100%; animation:bob 2.4s ease-in-out infinite; }
.mood-happy { animation:jump .55s cubic-bezier(.34,1.56,.64,1); }
.mood-celebrate { animation:jump .6s cubic-bezier(.34,1.56,.64,1) 3; }
.mood-surprised { animation:shake .45s ease; }
.mood-sad { animation:droop .6s ease forwards; }
.cq-blink { transform-box:fill-box; transform-origin:center; animation:blink 4s infinite; }
.cq-twinkle { transform-box:fill-box; transform-origin:center; animation:twinkle 1s ease-in-out infinite; }
.cq-tw2 { animation-delay:.4s; }
.cq-bubble { position:relative; flex:1; background:#fff; border:2px solid var(--line); border-radius:16px;
  padding:12px 16px; margin-bottom:20px; font-size:16px; font-weight:800; line-height:1.4;
  transform-origin:0% 100%; animation:pop .32s cubic-bezier(.34,1.56,.64,1); }
.cq-bubble::before { content:""; position:absolute; left:-9px; bottom:12px; width:14px; height:14px; background:#fff;
  border-left:2px solid var(--line); border-bottom:2px solid var(--line); transform:rotate(45deg); }
.cq-dots { display:inline-flex; gap:3px; margin-left:6px; vertical-align:middle; }
.cq-dots i { width:5px; height:5px; border-radius:50%; background:var(--muted); animation:dot 1s ease-in-out infinite; }
.cq-dots i:nth-child(2) { animation-delay:.15s; }
.cq-dots i:nth-child(3) { animation-delay:.3s; }

/* ---------- プレイヤーバー ---------- */
.cq-player { display:flex; align-items:center; gap:10px; padding:8px 12px; border:2px solid var(--line); border-radius:16px;
  transition:border-color .2s, background .2s; }
.cq-player.is-active { border-color:var(--green); background:#F1FCE6; }
.cq-avatar { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-size:22px; line-height:1;
  background:var(--soft); flex-shrink:0; }
.cq-player.is-active .cq-avatar { animation:hop 1.2s ease-in-out infinite; }
.cq-player-name { display:flex; flex-direction:column; font-weight:900; font-size:15px; white-space:nowrap; line-height:1.2; }
.cq-player-name small { font-size:11px; color:#999; font-weight:700; }
.cq-caps { display:flex; flex-wrap:wrap; justify-content:flex-end; margin-left:auto; min-height:22px; }
.cq-caps .cq-glyph { font-size:19px; animation:popIn .4s cubic-bezier(.34,1.56,.64,1); }

/* ---------- 盤面 ---------- */
.cq-board-frame { background:var(--green); padding:6px; border-radius:22px; box-shadow:0 6px 0 var(--green-d); margin:4px 0 8px; }
.cq-board { display:grid; grid-template-columns:repeat(8,1fr); aspect-ratio:1/1; border-radius:16px; overflow:hidden; }
.cq-sq { position:relative; display:flex; align-items:center; justify-content:center; width:100%; height:100%; transition:background-color .15s; }
.cq-rank, .cq-file { position:absolute; font-size:10px; font-weight:900; color:rgba(0,0,0,.28); pointer-events:none; }
.cq-rank { top:2px; left:4px; }
.cq-file { bottom:1px; right:4px; }
.cq-pc-wrap { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
.cq-pc-wrap.slide { z-index:5; animation:slide .3s cubic-bezier(.34,1.3,.64,1) both; }
.cq-glyph { position:relative; display:inline-block; line-height:1; user-select:none; }
.cq-glyph-fill { display:block; }
.cq-glyph-line { position:absolute; left:0; top:0; }
.cq-pc { font-size:min(9.5vw,44px); }
.cq-pc .cq-glyph-fill { text-shadow:0 3px 0 rgba(0,0,0,.16); }
.cq-pc.sel { animation:lift .4s cubic-bezier(.34,1.56,.64,1) forwards, float 1.4s ease-in-out .4s infinite; }
.cq-pc.land { animation:land .35s ease .26s both; }
.cq-pc.shake { animation:kingShake .5s ease 2; }
.cq-dot { position:absolute; z-index:2; width:28%; height:28%; border-radius:50%; background:rgba(28,176,246,.6);
  pointer-events:none; animation:popIn .28s cubic-bezier(.34,1.56,.64,1) both; }
.cq-ring { position:absolute; z-index:3; inset:5%; border-radius:50%; border:4px solid rgba(255,75,75,.8); pointer-events:none;
  animation:popIn .28s cubic-bezier(.34,1.56,.64,1) both, pulse 1.2s ease-in-out .3s infinite; }
.cq-sq.is-target:hover .cq-dot { transform:scale(1.25); }
.cq-burst { position:absolute; inset:0; z-index:6; pointer-events:none; }
.cq-burst i { position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px; border-radius:2px; background:var(--gold);
  animation:burst .6s ease-out .2s both; }
.cq-burst i:nth-child(even) { background:var(--blue); width:6px; height:6px; margin:-3px; border-radius:50%; }

/* ---------- モーダル ---------- */
.cq-overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.45); display:grid; place-items:center; padding:16px;
  animation:fade .2s ease; }
.cq-modal { position:relative; width:100%; max-width:340px; background:#fff; border-radius:24px; padding:22px 20px 20px;
  display:flex; flex-direction:column; gap:10px; text-align:center; animation:modalIn .45s cubic-bezier(.34,1.56,.64,1); }
.cq-result { padding-top:12px; }
.cq-modal-mascot { display:flex; justify-content:center; margin-top:-80px; }
.cq-modal h2 { margin:0; font-size:30px; font-weight:900; }
.cq-modal h2.is-win { color:var(--green); }
.cq-modal p { margin:0 0 10px; color:#777; font-weight:700; }
.cq-modal-small { margin:0 0 6px; font-size:18px; font-weight:900; }
.cq-promo-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.cq-promo { aspect-ratio:1/1; font-size:36px !important; line-height:1; border:2px solid var(--line) !important; border-radius:16px;
  box-shadow:0 4px 0 var(--line); animation:popIn .32s cubic-bezier(.34,1.56,.64,1) both; transition:transform .08s, box-shadow .08s; }
.cq-promo:hover { border-color:#84D8FF !important; background:#DDF4FF !important; }
.cq-promo:active { transform:translateY(4px); box-shadow:0 0 0 var(--line); }
.cq-confetti { position:fixed; inset:0; z-index:101; pointer-events:none; overflow:hidden; }
.cq-confetti span { position:absolute; top:0; border-radius:2px; animation-name:confetti; animation-timing-function:linear; animation-fill-mode:both; }

/* ---------- メニュー ---------- */
.cq-menu { width:100%; max-width:420px; display:flex; flex-direction:column; gap:22px; }
.cq-hero { display:flex; flex-direction:column; align-items:center; text-align:center; }
.cq-hero-mascot { animation:heroIn .7s cubic-bezier(.34,1.56,.64,1) both; }
.cq-title { margin:6px 0 2px; font-size:42px; font-weight:900; color:var(--green); letter-spacing:.08em; animation:rise .5s .12s both; }
.cq-sub { margin:0; color:#777; font-weight:700; animation:rise .5s .2s both; }
.cq-label { margin:0 0 10px; font-size:18px; font-weight:900; }
.cq-mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.cq-card { display:flex; flex-direction:column; align-items:center; gap:4px; padding:18px 10px 16px !important;
  border:2px solid var(--line) !important; border-radius:18px; box-shadow:0 4px 0 var(--line);
  transition:transform .08s, box-shadow .08s, border-color .15s, background .15s; }
.cq-card:active { transform:translateY(4px); box-shadow:0 0 0 var(--line); }
.cq-card.is-on { border-color:#84D8FF !important; background:#DDF4FF !important; box-shadow:0 4px 0 #84D8FF; }
.cq-card.is-on:active { box-shadow:0 0 0 #84D8FF; }
.cq-card-emoji { font-size:40px; transition:transform .35s cubic-bezier(.34,1.56,.64,1); }
.cq-card.is-on .cq-card-emoji { transform:scale(1.15) rotate(-8deg); }
.cq-card-title { font-size:17px; font-weight:900; }
.cq-card.is-on .cq-card-title { color:var(--blue-d); }
.cq-card-desc { font-size:12px; color:#777; font-weight:700; }
.cq-reveal { animation:rise .35s both; }
.cq-levels { display:flex; flex-direction:column; gap:10px; }
.cq-level { display:flex; align-items:center; gap:12px; padding:10px 14px !important; text-align:left;
  border:2px solid var(--line) !important; border-radius:16px; box-shadow:0 4px 0 var(--line);
  animation:rise .35s both; transition:transform .08s, box-shadow .08s, border-color .15s, background .15s; }
.cq-level:active { transform:translateY(4px); box-shadow:0 0 0 var(--line); }
.cq-level-badge { width:36px; height:36px; border-radius:50%; flex-shrink:0; display:grid; place-items:center;
  background:var(--lc); color:#fff; font-size:17px; font-weight:900; box-shadow:0 3px 0 var(--ld); }
.cq-level-text { display:flex; flex-direction:column; flex:1; }
.cq-level-text b { font-size:16px; font-weight:900; }
.cq-level-text small { font-size:12px; color:#999; font-weight:700; }
.cq-level-check { width:26px; height:26px; border-radius:50%; display:grid; place-items:center; background:var(--lc); color:#fff;
  font-size:14px; font-weight:900; transform:scale(0); transition:transform .3s cubic-bezier(.34,1.56,.64,1); }
.cq-level.is-on { border-color:var(--lc) !important; background:color-mix(in srgb, var(--lc) 10%, white) !important; box-shadow:0 4px 0 var(--lc); }
.cq-level.is-on .cq-level-check { transform:scale(1); }
.cq-level.is-on .cq-level-badge { animation:wiggle .5s ease; }

/* ---------- キーフレーム ---------- */
@keyframes bob { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
@keyframes jump { 0% { transform:translateY(0) scale(1); } 35% { transform:translateY(-18px) scale(.95,1.05); }
  65% { transform:translateY(0) scale(1.1,.9); } 100% { transform:translateY(0) scale(1); } }
@keyframes shake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-6px) rotate(-5deg); }
  40% { transform:translateX(6px) rotate(5deg); } 60% { transform:translateX(-4px); } 80% { transform:translateX(4px); } }
@keyframes droop { to { transform:translateY(3px) rotate(-6deg); } }
@keyframes blink { 0%,92%,100% { transform:scaleY(1); } 95% { transform:scaleY(.1); } }
@keyframes twinkle { 0%,100% { transform:scale(.6); opacity:.5; } 50% { transform:scale(1.15); opacity:1; } }
@keyframes pop { from { opacity:0; transform:scale(.6); } to { opacity:1; transform:scale(1); } }
@keyframes popIn { from { opacity:0; transform:scale(0); } to { opacity:1; transform:scale(1); } }
@keyframes dot { 0%,80%,100% { transform:translateY(0); opacity:.4; } 40% { transform:translateY(-4px); opacity:1; } }
@keyframes hop { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
@keyframes slide { from { transform:translate(var(--dx), var(--dy)); } to { transform:translate(0,0); } }
@keyframes lift { from { transform:translateY(0) scale(1); } to { transform:translateY(-6%) scale(1.15); } }
@keyframes float { 0%,100% { transform:translateY(-6%) scale(1.15); } 50% { transform:translateY(-13%) scale(1.15); } }
@keyframes land { 0% { transform:scale(1,1); } 40% { transform:scale(1.15,.85); } 70% { transform:scale(.95,1.05); } 100% { transform:scale(1,1); } }
@keyframes kingShake { 0%,100% { transform:translateX(0) rotate(0); } 20% { transform:translateX(-8%) rotate(-8deg); }
  40% { transform:translateX(8%) rotate(8deg); } 60% { transform:translateX(-5%) rotate(-4deg); } 80% { transform:translateX(5%) rotate(4deg); } }
@keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(.9); } }
@keyframes burst { 0% { opacity:0; transform:rotate(var(--a)) translateY(0) scale(1); } 10% { opacity:1; }
  100% { opacity:0; transform:rotate(var(--a)) translateY(-30px) scale(.3); } }
@keyframes fade { from { opacity:0; } to { opacity:1; } }
@keyframes modalIn { from { opacity:0; transform:translateY(40px) scale(.9); } to { opacity:1; transform:none; } }
@keyframes confetti { from { transform:translate(0,-10vh) rotate(var(--rot)); }
  to { transform:translate(var(--drift),110vh) rotate(calc(var(--rot) + 720deg)); } }
@keyframes heroIn { from { opacity:0; transform:translateY(30px) scale(.3); } to { opacity:1; transform:none; } }
@keyframes rise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes wiggle { 0%,100% { transform:rotate(0); } 25% { transform:rotate(-12deg); } 75% { transform:rotate(12deg); } }

/* 動きを減らす設定のユーザーにはアニメーションを止める */
@media (prefers-reduced-motion: reduce) {
  .cq-page *, .cq-page *::before, .cq-page *::after, .cq-overlay * {
    animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important;
  }
}
`;
