import React, { useState, useRef, useEffect, useCallback } from "react";

/* ============================================================================
   不思議の迷宮 ─ 賽ノ螺旋 (Sai-no-Rasen)
   風来のシレン型 2Dランダムダンジョン・ローグライク
   ---------------------------------------------------------------------------
   設計方針
   1. 完全ターン制  : プレイヤーが1行動 → 敵全員が1行動 → 環境処理(空腹/回復/湧き)
   2. 区画分割生成  : マップを2〜3×2〜3の区画に割り、各区画に部屋を1つ。
                      Union-Findで全部屋の連結を保証し、余剰通路でループを作る。
   3. 部屋単位の視界: 部屋にいれば部屋全体が見える。通路では隣接1マスのみ。
   4. 未識別システム: 草・巻物・杖は毎回ランダムな見た目名になる。
   ========================================================================== */

/* ---------------------------------- 定数 --------------------------------- */
const MAP_W = 38;
const MAP_H = 28;
const WALL = 0, ROOM = 1, CORR = 2, STAIRS = 3;
const FINAL_FLOOR = 20;
const INV_MAX = 16;

/* --------------------------------- 難易度 --------------------------------- */
// 調整軸を「敵の強さ」「資源の量」「時間の圧力」の3系統に分け、それぞれ独立に動かす
const DIFFS = {
  easy: {
    key: "easy", name: "やさしい", tag: "EASY", color: "#7fae4a",
    desc: "敵が弱く、お腹も減りにくい。持ち物も多めでスタート",
    mobHp: 0.75, mobAtk: 0.7, mobCount: 0.8, // 敵の強さ
    items: 2, exp: 1.25, hp: 32, startItems: ["herb", "herb", "rice", "arrow", "ident"], // 資源
    hunger: 7, regen: 4, spawn: 60, // 時間の圧力（満腹度-1の間隔 / HP+1の間隔 / 湧き間隔）
  },
  normal: {
    key: "normal", name: "ふつう", tag: "NORMAL", color: "#d9a441",
    desc: "標準のバランス。道具の使い方が問われる",
    mobHp: 1, mobAtk: 1, mobCount: 1,
    items: 0, exp: 1, hp: 25, startItems: ["herb", "rice", "stone"],
    hunger: 5, regen: 6, spawn: 45,
  },
  hard: {
    key: "hard", name: "むずかしい", tag: "HARD", color: "#cf4a2c",
    desc: "敵は硬く数も多い。腹は減り、回復は遅い。一手の重さを味わう",
    mobHp: 1.25, mobAtk: 1.2, mobCount: 1.2,
    items: -1, exp: 1, hp: 25, startItems: ["rice", "herb"],
    hunger: 4, regen: 9, spawn: 30,
  },
};

// 0:上 1:右上 2:右 3:右下 4:下 5:左下 6:左 7:左上
const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const DIR_LABEL = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

const EXP_TABLE = [0, 10, 25, 50, 90, 150, 240, 370, 550, 800, 1150, 1600, 2200, 3000, 4000, 5300, 7000, 9200, 12000, 15500];

/* ------------------------------- 配色トークン ----------------------------- */
const C = {
  ink: "#0c1016",       // 墨
  panel: "#141b25",     // 藍鉄
  panelHi: "#1d2735",
  line: "#2c3949",
  paper: "#e7e0cf",     // 生成り
  sub: "#8d97a6",
  vermilion: "#cf4a2c", // 朱
  gold: "#d9a441",      // 金
  hp: "#d4544a",
  belly: "#7fae4a",
  floorLit: "#2a3444",
  floorDim: "#161d27",
  corrLit: "#222b39",
  wallLit: "#3c4a5e",
  wallDim: "#1a212c",
};

/* --------------------------------- ドット絵 ------------------------------- */
const PAL = {
  k: "#12121a", w: "#f6f4ee", d: "#4a5568", l: "#c9c6bd", r: "#c8442a",
  y: "#e8c33a", s: "#e8b088", n: "#7a5a3a", c: "#5ec8d8", g: "#6bbf59",
  o: "#d9a441", p: "#9b6bd1", b: "#3a6ed4", C: "#bdf2fa",
};

const PLAYER_SPR = [
  "..kkkk..",
  ".krrrrk.",
  ".rssssr.",
  ".skkkks.",
  ".ssssss.",
  ".oooooo.",
  "o.oooo.o",
  "..k..k..",
];

const SHAPES = {
  blob: [
    "........",
    "..AAAA..",
    ".AAAAAA.",
    "AAwAAwAA",
    "AAkAAkAA",
    "AAAAAAAA",
    ".BABBAB.",
    "..B..B..",
  ],
  humanoid: [
    "..AAAA..",
    ".AAAAAA.",
    ".AwAAwA.",
    "..AAAA..",
    ".BBBBBB.",
    "B.BBBB.B",
    "..BBBB..",
    "..B..B..",
  ],
  bat: [
    "........",
    "A......A",
    "AA.AA.AA",
    "AAAAAAAA",
    ".AwAAwA.",
    "..AAAA..",
    "...BB...",
    "........",
  ],
  beast: [
    "........",
    "..A.....",
    ".AAAAAA.",
    "AwAAAAAA",
    "AAAAAAAB",
    ".AAAAAA.",
    ".B.BB.B.",
    "........",
  ],
  ghost: [
    "..AAAA..",
    ".AAAAAA.",
    ".AwAAwA.",
    ".AAAAAA.",
    ".AAAAAA.",
    "BABABABA",
    ".B.B.B.B",
    "........",
  ],
  dragon: [
    ".....AA.",
    "..A.AAAA",
    ".AAAAwAA",
    "AAAAAAAA",
    "AAAAAAA.",
    ".BAAAB..",
    ".B...B..",
    "........",
  ],
};

const ITEM_SPR = {
  weapon: [".....ll.", "....ll..", "...ll...", "..ll....", ".ll.....", "yll.....", "yy......", "n......."],
  shield: [".llllll.", ".lyyyyl.", ".lyddyl.", ".lyddyl.", ".lyyyyl.", "..llll..", "...ll...", "........"],
  grass: ["...g....", "..ggg...", ".gg.gg..", "..ggg.g.", "...g.gg.", "...ggg..", "...nn...", "...nn..."],
  scroll: ["........", ".wwwwww.", ".wllllw.", ".wllllw.", ".wllllw.", ".wwwwww.", "..r..r..", "........"],
  staff: [".....cc.", "....cccc", ".....cc.", "....n...", "...n....", "..n.....", ".n......", "n......."],
  food: ["...ww...", "..wwww..", "..wwww..", ".wwwwww.", ".wwwwww.", "wwwkwwww", "wwkkkkww", "kkkkkkkk"],
  stone: ["........", "..dll...", ".dllldd.", ".dllldd.", "..dddd..", "........", "........", "........"],
  arrow: ["........", "......ww", ".....ll.", "....ll..", "...ll...", "n.ll....", ".nn.....", "n.n....."],
  ring: ["...cc...", "..ycCy..", ".y....y.", "y......y", "y......y", ".y....y.", "..yyyy..", "........"],
};

const STAIRS_SPR = ["........", ".....lll", ".....l..", "..llll..", "..l.....", "llll....", "l.......", "........"];

/* -------------------------------- アイテム -------------------------------- */
const ITEMS = {
  // ── 武器
  club: { cat: "weapon", name: "こん棒", atk: 2, info: "攻撃力 +2" },
  copper: { cat: "weapon", name: "銅の剣", atk: 4, info: "攻撃力 +4" },
  gale: { cat: "weapon", name: "疾風の刀", atk: 5, crit: 0.25, info: "攻撃力 +5・会心の一撃が出やすい" },
  steel: { cat: "weapon", name: "鋼の大剣", atk: 7, info: "攻撃力 +7" },
  moon: { cat: "weapon", name: "月影の太刀", atk: 11, info: "攻撃力 +11" },
  // ── 盾
  leather: { cat: "shield", name: "皮の盾", def: 2, info: "防御力 +2" },
  spiky: { cat: "shield", name: "トゲの盾", def: 3, thorns: 0.3, info: "防御力 +3・受けたダメージの3割を返す" },
  bronze: { cat: "shield", name: "青銅の盾", def: 4, info: "防御力 +4" },
  iron: { cat: "shield", name: "鉄鋼の盾", def: 6, info: "防御力 +6" },
  moonsh: { cat: "shield", name: "月影の盾", def: 9, info: "防御力 +9" },
  // ── 腕輪
  rregen: { cat: "ring", name: "癒しの腕輪", info: "HPの自然回復が2倍になる" },
  rpower: { cat: "ring", name: "剛力の腕輪", info: "攻撃力 +3" },
  rsight: { cat: "ring", name: "見透しの腕輪", info: "フロアの敵と道具の位置が見える" },
  rfull: { cat: "ring", name: "腹持ちの腕輪", info: "満腹度の減りが半分になる" },
  // ── 食料
  rice: { cat: "food", name: "おにぎり", full: 50, info: "満腹度 +50" },
  bigrice: { cat: "food", name: "大きなおにぎり", full: 100, info: "満腹度 +100" },
  special: { cat: "food", name: "特製おにぎり", full: 100, maxUp: 5, info: "満腹度 +100・最大満腹度 +5" },
  // ── 投擲
  stone: { cat: "ammo", name: "石", stack: true, dmg: 5, info: "投げて 5 ダメージ" },
  arrow: { cat: "ammo", name: "木の矢", stack: true, dmg: 4, info: "投げて 4 ダメージ" },
  iarrow: { cat: "ammo", name: "鉄の矢", stack: true, dmg: 9, info: "投げて 9 ダメージ" },
  // ── 草
  herb: { cat: "grass", name: "薬草", info: "HP25回復。満タンなら最大HP+2。投げると敵が回復" },
  gherb: { cat: "grass", name: "回生草", info: "HP100回復。満タンなら最大HP+4。投げると敵が回復" },
  poison: { cat: "grass", name: "毒草", info: "力が1下がる。投げると敵の攻撃力を下げる" },
  power: { cat: "grass", name: "ちからの草", info: "力が1上がる" },
  sleepg: { cat: "grass", name: "眠り草", info: "自分が眠る。投げると敵が眠る" },
  life: { cat: "grass", name: "命の草", info: "最大HP +5" },
  fruit: { cat: "grass", name: "ふくらみの実", info: "最大満腹度 +10、満腹になる" },
  haste: { cat: "grass", name: "疾風の実", info: "20ターンの間、倍速で動ける" },
  eye: { cat: "grass", name: "千里の草", info: "フロアの地形と道具の位置が分かる" },
  antidote: { cat: "grass", name: "毒消し草", info: "下がった力を元に戻す" },
  // ── 巻物
  ident: { cat: "scroll", name: "識別の巻物", info: "アイテム1つを識別する" },
  confuse: { cat: "scroll", name: "混乱の巻物", info: "同じ部屋の敵を混乱させる" },
  warp: { cat: "scroll", name: "ワープの巻物", info: "自分がフロア内をランダム移動" },
  blast: { cat: "scroll", name: "爆発の巻物", info: "周囲2マスの敵に20ダメージ" },
  sleeps: { cat: "scroll", name: "眠りの巻物", info: "同じ部屋の敵を眠らせる" },
  map: { cat: "scroll", name: "地図の巻物", info: "フロアの地形と階段の位置が分かる" },
  bless: { cat: "scroll", name: "強化の巻物", info: "装備中の武器と盾が +1 される" },
  bigroom: { cat: "scroll", name: "大部屋の巻物", info: "フロア全体が一つの大部屋になる" },
  // ── 杖
  bind: { cat: "staff", name: "かなしばりの杖", info: "敵の動きを20ターン止める" },
  swap: { cat: "staff", name: "場所替えの杖", info: "敵と位置を入れ替える" },
  blow: { cat: "staff", name: "ふきとばしの杖", info: "敵を吹き飛ばし10ダメージ" },
  slow: { cat: "staff", name: "鈍足の杖", info: "敵の行動を2回に1回にする" },
  thunder: { cat: "staff", name: "いかずちの杖", info: "敵に雷を落とし20ダメージ" },
  seal: { cat: "staff", name: "封印の杖", info: "敵の特殊能力を封じる" },
  hstaff: { cat: "staff", name: "回復の杖", info: "当たった相手のHPを30回復する" },
};

const APPEARANCE = {
  grass: ["赤い草", "青い草", "黄色い草", "紫の草", "白い草", "黒い草", "桃色の草", "銀の草", "縞模様の草", "ぎざぎざの草"],
  scroll: ["古びた巻物", "汚れた巻物", "分厚い巻物", "破れた巻物", "光る巻物", "焦げた巻物", "湿った巻物", "金縁の巻物"],
  staff: ["樫の杖", "竹の杖", "黒い杖", "白い杖", "ねじれた杖", "骨の杖", "水晶の杖"],
  ring: ["翡翠の腕輪", "琥珀の腕輪", "瑠璃の腕輪", "珊瑚の腕輪"],
};

const STAFF_COLOR = {
  bind: "#d9a441", swap: "#9b6bd1", blow: "#c9e6ff", slow: "#5ec8d8",
  thunder: "#ffe066", seal: "#8d97a6", hstaff: "#7fdc6a",
};

/* --------------------------------- モンスター ------------------------------ */
const MOBS = [
  { id: "koro", name: "ころまる", shape: "blob", a: "#8fd14f", b: "#4d8b2a", hp: 6, atk: 3, def: 0, exp: 3, min: 1, max: 5, ai: "normal" },
  { id: "dogu", name: "どぐう兵", shape: "humanoid", a: "#c9a06a", b: "#7a5a33", hp: 12, atk: 5, def: 4, exp: 8, min: 2, max: 8, ai: "normal" },
  { id: "bat", name: "よたコウモリ", shape: "bat", a: "#9b6bd1", b: "#4e2f6b", hp: 10, atk: 5, def: 2, exp: 7, min: 3, max: 9, ai: "erratic" },
  { id: "nusu", name: "ぬすっとネズミ", shape: "beast", a: "#b0b0c0", b: "#5a5a6a", hp: 14, atk: 4, def: 3, exp: 14, min: 4, max: 12, ai: "thief" },
  { id: "gaze", name: "まどわし目", shape: "blob", a: "#d1c14f", b: "#7a6a1a", hp: 20, atk: 8, def: 5, exp: 24, min: 7, max: 16, ai: "normal", onHit: "confuse" },
  { id: "wolf", name: "疾風狼", shape: "beast", a: "#6ba3d1", b: "#2f5a7a", hp: 22, atk: 7, def: 5, exp: 26, min: 9, max: 18, ai: "fast" },
  { id: "mage", name: "呪術師", shape: "ghost", a: "#d15f9b", b: "#6b2f4e", hp: 20, atk: 11, def: 4, exp: 32, min: 10, max: 19, ai: "ranged" },
  { id: "bone", name: "骨の剣士", shape: "humanoid", a: "#e8e4d8", b: "#8a8578", hp: 34, atk: 15, def: 9, exp: 45, min: 11, max: 20, ai: "normal" },
  { id: "dragon", name: "溶岩竜", shape: "dragon", a: "#e05a3a", b: "#7a2a1a", hp: 55, atk: 20, def: 13, exp: 90, min: 15, max: 20, ai: "ranged" },
];

// スプライトが元々どちらを向いて描かれているか（1:右 / -1:左）
const SHAPE_FACE = { beast: -1, dragon: 1 };

/* ----------------------------------- 乱数 --------------------------------- */
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
      return b;
    },
  };
}

/* ------------------------------ ダンジョン生成 ----------------------------- */
function generateFloor(rng) {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const roomOf = new Int8Array(MAP_W * MAP_H).fill(-1);
  const cols = rng.pick([2, 3, 3]);
  const rows = rng.pick([2, 2, 3]);
  const secW = Math.floor(MAP_W / cols);
  const secH = Math.floor(MAP_H / rows);
  const rooms = [];
  const grid = [];

  for (let ry = 0; ry < rows; ry++) {
    grid.push([]);
    for (let rx = 0; rx < cols; rx++) {
      const sx = rx * secW, sy = ry * secH;
      const maxW = Math.max(4, Math.min(9, secW - 4));
      const maxH = Math.max(3, Math.min(7, secH - 4));
      const w = rng.range(4, maxW);
      const h = rng.range(3, maxH);
      const x = sx + 2 + rng.int(Math.max(1, secW - w - 3));
      const y = sy + 2 + rng.int(Math.max(1, secH - h - 3));
      const id = rooms.length;
      const room = { id, x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
      rooms.push(room);
      grid[ry].push(id);
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) { tiles[j * MAP_W + i] = ROOM; roomOf[j * MAP_W + i] = id; }
      }
    }
  }

  const carve = (x, y) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    if (tiles[y * MAP_W + x] === WALL) tiles[y * MAP_W + x] = CORR;
  };
  const hLine = (x1, x2, y) => { const a = Math.min(x1, x2), b = Math.max(x1, x2); for (let x = a; x <= b; x++) carve(x, y); };
  const vLine = (y1, y2, x) => { const a = Math.min(y1, y2), b = Math.max(y1, y2); for (let y = a; y <= b; y++) carve(x, y); };

  const connect = (A, B, horizontal) => {
    if (horizontal) {
      const y1 = rng.range(A.y, A.y + A.h - 1);
      const y2 = rng.range(B.y, B.y + B.h - 1);
      const mx = rng.range(A.x + A.w, Math.max(A.x + A.w, B.x - 1));
      hLine(A.x + A.w, mx, y1);
      vLine(y1, y2, mx);
      hLine(mx, B.x - 1, y2);
    } else {
      const x1 = rng.range(A.x, A.x + A.w - 1);
      const x2 = rng.range(B.x, B.x + B.w - 1);
      const my = rng.range(A.y + A.h, Math.max(A.y + A.h, B.y - 1));
      vLine(A.y + A.h, my, x1);
      hLine(x1, x2, my);
      vLine(my, B.y - 1, x2);
    }
  };

  // Union-Find で全部屋の連結を保証しつつ、余剰通路でループを作る
  const parent = rooms.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (i, j) => { const a = find(i), b = find(j); if (a === b) return false; parent[a] = b; return true; };

  const pairs = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      if (rx + 1 < cols) pairs.push([grid[ry][rx], grid[ry][rx + 1], true]);
      if (ry + 1 < rows) pairs.push([grid[ry][rx], grid[ry + 1][rx], false]);
    }
  }
  for (const [a, b, h] of rng.shuffle(pairs)) {
    if (union(a, b)) connect(rooms[a], rooms[b], h);
    else if (rng.chance(0.3)) connect(rooms[a], rooms[b], h);
  }

  return { tiles, roomOf, rooms };
}

/* ------------------------------- 汎用ヘルパー ------------------------------ */
const idx = (x, y) => y * MAP_W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

function walkable(G, x, y) {
  return inMap(x, y) && G.tiles[idx(x, y)] !== WALL;
}

/** 斜め移動は「移動元・移動先がともに部屋」の場合のみ許可（通路は直進のみ）。 */
function canStep(G, x, y, nx, ny) {
  if (!walkable(G, nx, ny)) return false;
  const dx = nx - x, dy = ny - y;
  if (dx !== 0 && dy !== 0) {
    if (G.roomOf[idx(x, y)] < 0 || G.roomOf[idx(nx, ny)] < 0) return false;
    if (!walkable(G, nx, y) || !walkable(G, x, ny)) return false;
  }
  return true;
}

function mobAt(G, x, y) { return G.mobs.find((m) => m.x === x && m.y === y && m.hp > 0); }
function itemAt(G, x, y) { return G.ground.find((g) => g.x === x && g.y === y); }
function occupied(G, x, y) {
  if (G.player.x === x && G.player.y === y) return true;
  return !!mobAt(G, x, y);
}

function log(G, text, kind) {
  G.log.push({ text, kind: kind || "normal" });
  if (G.log.length > 40) G.log.shift();
}

/* --------------------------------- 生成物 --------------------------------- */
function makeItem(rng, id) {
  const d = ITEMS[id];
  const it = { id, uid: Math.floor(rng.next() * 1e9) };
  if (d.cat === "weapon" || d.cat === "shield") {
    const r = rng.next();
    it.plus = r < 0.12 ? -1 : r < 0.6 ? 0 : r < 0.85 ? 1 : r < 0.96 ? 2 : 3;
  }
  if (d.cat === "staff") it.charges = rng.range(3, 6);
  if (d.cat === "ammo") it.count = id === "stone" ? rng.range(2, 5) : rng.range(3, 8);
  return it;
}

function rollItemId(rng, floor) {
  const f = floor;
  const table = [
    ["herb", 14], ["rice", 10], ["stone", 7], ["arrow", 7], ["iarrow", f >= 6 ? 5 : 0],
    ["gherb", 4], ["poison", 5], ["power", 3], ["sleepg", 5], ["life", 2], ["fruit", 3],
    ["haste", 3], ["eye", 3], ["antidote", 3],
    ["ident", 7], ["confuse", 5], ["warp", 5], ["blast", 4], ["sleeps", 4],
    ["map", 4], ["bless", 3], ["bigroom", 2],
    ["bind", 5], ["swap", 4], ["blow", 5], ["slow", 4], ["thunder", 4], ["seal", 3], ["hstaff", 3],
    ["club", f < 6 ? 6 : 2], ["copper", f >= 4 ? 5 : 1], ["gale", f >= 6 ? 3 : 0],
    ["steel", f >= 10 ? 4 : 0], ["moon", f >= 14 ? 3 : 0],
    ["leather", f < 6 ? 6 : 2], ["bronze", f >= 4 ? 5 : 1], ["spiky", f >= 5 ? 3 : 0],
    ["iron", f >= 10 ? 4 : 0], ["moonsh", f >= 14 ? 3 : 0],
    ["rregen", 2], ["rpower", 2], ["rsight", 2], ["rfull", 2],
    ["bigrice", f >= 6 ? 4 : 1], ["special", f >= 8 ? 2 : 0],
  ].filter((t) => t[1] > 0);
  const total = table.reduce((s, t) => s + t[1], 0);
  let r = rng.next() * total;
  for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
  return "herb";
}

function makeMob(rng, defId, x, y, D) {
  const d = MOBS.find((m) => m.id === defId);
  const hp = Math.max(1, Math.round(d.hp * (D ? D.mobHp : 1)));
  return {
    kind: d, name: d.name, x, y, px: x, py: y,
    hp, maxHp: hp, atk: Math.max(1, Math.round(d.atk * (D ? D.mobAtk : 1))), def: d.def,
    sleep: 0, bind: 0, confuse: 0, slow: 0, fleeing: 0, stolen: null, dir: 2,
    face: 1, seed: rng.next() * 6.28, lunge: null, hitT: 0, hitDelay: 0,
  };
}

function randomFloorTile(G, rng, avoid) {
  for (let tries = 0; tries < 400; tries++) {
    const rm = rng.pick(G.rooms);
    const x = rng.range(rm.x, rm.x + rm.w - 1);
    const y = rng.range(rm.y, rm.y + rm.h - 1);
    if (G.tiles[idx(x, y)] !== ROOM) continue;
    if (occupied(G, x, y)) continue;
    if (itemAt(G, x, y)) continue;
    if (avoid && cheb(x, y, avoid.x, avoid.y) < 6) continue;
    return { x, y };
  }
  return { x: G.rooms[0].cx, y: G.rooms[0].cy };
}

/* ------------------------------ フロア初期化 ------------------------------- */
function enterFloor(G, rng) {
  const { tiles, roomOf, rooms } = generateFloor(rng);
  G.tiles = tiles; G.roomOf = roomOf; G.rooms = rooms;
  G.visible = new Uint8Array(MAP_W * MAP_H);
  G.known = new Uint8Array(MAP_W * MAP_H);
  G.mobs = []; G.ground = []; G.fx = []; G.reveal = false;

  const start = randomFloorTile(G, rng, null);
  G.player.x = start.x; G.player.y = start.y; G.player.px = start.x; G.player.py = start.y;
  G.player.lunge = null;

  const st = randomFloorTile(G, rng, G.player);
  tiles[idx(st.x, st.y)] = STAIRS;
  G.stairs = st;

  const nItems = Math.max(2, rng.range(3, 6) + G.D.items);
  for (let i = 0; i < nItems; i++) {
    const p = randomFloorTile(G, rng, null);
    G.ground.push({ x: p.x, y: p.y, item: makeItem(rng, rollItemId(rng, G.floor)) });
  }

  const pool = MOBS.filter((m) => G.floor >= m.min && G.floor <= m.max);
  const nMobs = Math.max(2, Math.round(Math.min(9, 3 + Math.floor(G.floor / 2.5)) * G.D.mobCount));
  for (let i = 0; i < nMobs; i++) {
    const p = randomFloorTile(G, rng, G.player);
    const d = pool.length ? rng.pick(pool) : MOBS[0];
    G.mobs.push(makeMob(rng, d.id, p.x, p.y, G.D));
  }
  computeVis(G);
}

function newGame(seed, diffKey) {
  const D = DIFFS[diffKey] || DIFFS.normal;
  const rng = makeRng(seed);
  const appear = {};
  for (const cat of ["grass", "scroll", "staff", "ring"]) {
    const ids = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === cat);
    const names = rng.shuffle(APPEARANCE[cat]);
    ids.forEach((id, i) => { appear[id] = names[i % names.length]; });
  }
  const G = {
    seed, rng, D, diffKey: D.key, floor: 1, turn: 0, status: "play",
    player: {
      x: 0, y: 0, px: 0, py: 0, lv: 1, hp: D.hp, maxHp: D.hp, str: 8, maxStr: 8, exp: 0,
      fullness: 100, maxFullness: 100, weapon: null, shield: null, ring: null,
      confuse: 0, sleep: 0, haste: 0, dir: 4, face: 1, seed: 0, lunge: null, hitT: 0, hitDelay: 0,
    },
    inv: D.startItems.map((id) => makeItem(rng, id)),
    ident: {}, appear, log: [], kills: 0, deepest: 1,
    tiles: null, roomOf: null, rooms: [], mobs: [], ground: [], visible: null, known: null, stairs: null,
    fx: [], seq: 0, reveal: false, hasteFlip: false,
  };
  enterFloor(G, rng);
  log(G, `賽ノ螺旋 地下1階に降り立った。（${D.name}）`, "info");
  return G;
}

/* --------------------------------- 視界 ----------------------------------- */
function computeVis(G) {
  G.visible.fill(0);
  const p = G.player;
  const r = G.roomOf[idx(p.x, p.y)];
  const mark = (x, y) => { if (inMap(x, y)) { G.visible[idx(x, y)] = 1; G.known[idx(x, y)] = 1; } };
  if (r >= 0) {
    const rm = G.rooms[r];
    for (let j = rm.y - 1; j <= rm.y + rm.h; j++) for (let i = rm.x - 1; i <= rm.x + rm.w; i++) mark(i, j);
  } else {
    for (let j = p.y - 1; j <= p.y + 1; j++) for (let i = p.x - 1; i <= p.x + 1; i++) mark(i, j);
  }
}

function sameRoom(G, a, b) {
  const ra = G.roomOf[idx(a.x, a.y)];
  return ra >= 0 && ra === G.roomOf[idx(b.x, b.y)];
}

/* ------------------------------- 演出イベント ------------------------------- */
// ゲームロジックは演出を「予約」するだけ。描画側が時間経過で再生する。
// こうしておくと、ヘッドレスのシミュレーションでもロジックがそのまま動く。
const LUNGE_TIME = 0.16;

function fx(G, e) {
  if (!G.fx) return;
  e.t = 0;
  e.delay = e.delay || 0;
  if (e.seed == null) e.seed = G.rng.next() * 6.28;
  G.fx.push(e);
}
function lunge(ent, tx, ty, delay) {
  const dx = Math.sign(tx - ent.x), dy = Math.sign(ty - ent.y);
  if (dx !== 0) ent.face = dx;
  ent.lunge = { dx, dy, t: 0, delay: delay || 0 };
}
function flashHit(ent, delay) { ent.hitT = 0.32; ent.hitDelay = delay || 0; }

/* --------------------------------- 戦闘 ----------------------------------- */
/** ダメージ = 攻撃力 × (15/16)^防御力 × 乱数(0.875〜1.125) */
function calcDamage(G, atk, def) {
  const base = atk * Math.pow(15 / 16, Math.max(0, def));
  return Math.max(1, Math.round(base * (0.875 + G.rng.next() * 0.25)));
}

function ringIs(G, id) { return !!(G.player.ring && G.player.ring.id === id); }

function playerAtk(G) {
  const w = G.player.weapon;
  return G.player.str + (w ? ITEMS[w.id].atk + w.plus : 0) + (ringIs(G, "rpower") ? 3 : 0);
}
function playerDef(G) {
  const s = G.player.shield;
  return s ? ITEMS[s.id].def + s.plus : 0;
}

function gainExp(G, amount) {
  const p = G.player;
  p.exp += Math.max(1, Math.round(amount * G.D.exp));
  while (p.lv < EXP_TABLE.length && p.exp >= EXP_TABLE[p.lv]) {
    p.lv += 1;
    p.maxHp += 6;
    p.hp += 6;
    if (p.lv % 2 === 0) { p.str += 1; p.maxStr += 1; }
    log(G, `レベルが ${p.lv} に上がった！`, "good");
    fx(G, { type: "burst", x: p.x, y: p.y, color: C.gold, life: 0.7, r: 1.8, delay: 0.25 });
    fx(G, { type: "num", x: p.x, y: p.y, text: "LEVEL UP", color: C.gold, life: 1.3, big: true, delay: 0.25 });
  }
}

/** 敵へのダメージは必ずここを通す（演出・撃破・経験値・盗品返却を一元化） */
function hurtMob(G, m, dmg, opts) {
  const o = opts || {};
  const delay = o.delay || 0;
  m.hp -= dmg;
  m.sleep = 0;
  flashHit(m, delay);
  fx(G, { type: "num", x: m.x, y: m.y, text: String(dmg), color: o.color || "#ffffff", big: !!o.big, life: 0.8, delay });
  if (o.msg !== false) log(G, o.msg || `${m.name}に ${dmg} のダメージ。`, "normal");
  if (m.hp <= 0) {
    m.hp = 0;
    G.kills += 1;
    log(G, `${m.name}を倒した。`, "good");
    fx(G, { type: "die", x: m.x, y: m.y, kind: m.kind, face: m.face, life: 0.5, delay });
    fx(G, { type: "spark", x: m.x, y: m.y, color: m.kind.a, life: 0.6, n: 8, delay: delay + 0.1 });
    if (m.stolen) {
      G.ground.push({ x: m.x, y: m.y, item: m.stolen });
      log(G, "盗まれたアイテムを取り戻した。", "good");
      m.stolen = null;
    }
    gainExp(G, m.kind.exp);
  }
}

function attackMob(G, m) {
  const p = G.player;
  lunge(p, m.x, m.y, 0);
  G.seq = Math.max(G.seq, 1);
  if (G.rng.chance(0.05)) {
    log(G, "攻撃を外した。", "normal");
    fx(G, { type: "num", x: m.x, y: m.y, text: "MISS", color: C.sub, life: 0.7, delay: 0.08 });
    return;
  }
  let dmg = calcDamage(G, playerAtk(G), m.def);
  const w = p.weapon;
  const crit = (w && ITEMS[w.id].crit) || 0.04;
  if (G.rng.chance(crit)) {
    dmg = Math.round(dmg * 1.5) + 1;
    log(G, "会心の一撃！", "good");
    hurtMob(G, m, dmg, { delay: 0.08, color: C.gold, big: true });
    fx(G, { type: "burst", x: m.x, y: m.y, color: C.gold, life: 0.35, r: 0.9, delay: 0.08 });
  } else {
    hurtMob(G, m, dmg, { delay: 0.08 });
  }
}

function damagePlayer(G, dmg, src, delay) {
  const p = G.player;
  p.hp -= dmg;
  flashHit(p, delay || 0);
  fx(G, { type: "num", x: p.x, y: p.y, text: String(dmg), color: "#ff6b5e", life: 0.85, delay: delay || 0 });
  fx(G, { type: "shake", life: 0.28, delay: delay || 0, power: Math.min(1, 0.35 + dmg / p.maxHp * 2) });
  log(G, `${src}の攻撃！ ${dmg} のダメージ。`, "bad");
  if (p.hp <= 0) {
    p.hp = 0;
    G.status = "dead";
    log(G, "力尽きてしまった……", "bad");
  }
}

function healPlayer(G, amount) {
  const p = G.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  fx(G, { type: "num", x: p.x, y: p.y, text: `+${p.hp - before}`, color: "#8be27a", life: 0.9 });
  fx(G, { type: "spark", x: p.x, y: p.y, color: "#8be27a", life: 0.7, n: 7, rise: true });
}

/* ------------------------------- アイテム名 -------------------------------- */
function isUnidentifiedCat(cat) { return cat === "grass" || cat === "scroll" || cat === "staff" || cat === "ring"; }

function itemName(G, it) {
  const d = ITEMS[it.id];
  const unid = isUnidentifiedCat(d.cat) && !G.ident[it.id];
  let name = unid ? G.appear[it.id] : d.name;
  if (d.cat === "weapon" || d.cat === "shield") {
    if (it.plus > 0) name += `+${it.plus}`;
    else if (it.plus < 0) name += `${it.plus}`;
  }
  if (d.cat === "staff" && !unid) name += `[${it.charges}]`;
  if (d.cat === "ammo" && it.count > 1) name += ` ${it.count}${it.id === "stone" ? "個" : "本"}`;
  const p = G.player;
  if (p.weapon === it || p.shield === it || p.ring === it) name += "（装備中）";
  return name;
}

function itemInfo(G, it) {
  const d = ITEMS[it.id];
  if (isUnidentifiedCat(d.cat) && !G.ident[it.id]) return "未識別 ─ 効果は使ってみるまで分からない";
  return d.info;
}

/* -------------------------------- 持ち物操作 ------------------------------- */
function addToInv(G, item) {
  const d = ITEMS[item.id];
  if (d.stack) {
    const found = G.inv.find((i) => i.id === item.id);
    if (found) { found.count += item.count || 1; return true; }
  }
  if (G.inv.length >= INV_MAX) return false;
  G.inv.push(item);
  return true;
}

function removeFromInv(G, item, amount) {
  const d = ITEMS[item.id];
  if (d.stack && item.count > (amount || 1)) { item.count -= amount || 1; return; }
  const i = G.inv.indexOf(item);
  if (i >= 0) G.inv.splice(i, 1);
  const p = G.player;
  if (p.weapon === item) p.weapon = null;
  if (p.shield === item) p.shield = null;
  if (p.ring === item) p.ring = null;
}

function identify(G, id) {
  if (!G.ident[id]) { G.ident[id] = true; log(G, `${ITEMS[id].name}だ！`, "info"); }
}

/* ------------------------------- 効果の適用 -------------------------------- */
function revealTerrain(G) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) {
        if (inMap(x + i, y + j) && G.tiles[idx(x + i, y + j)] !== WALL) { near = true; break; }
      }
      if (near) G.known[idx(x, y)] = 1;
    }
  }
}

function makeBigRoom(G) {
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const i = idx(x, y);
      if (G.tiles[i] !== STAIRS) G.tiles[i] = ROOM;
      G.roomOf[i] = 0;
    }
  }
  G.rooms = [{ id: 0, x: 1, y: 1, w: MAP_W - 2, h: MAP_H - 2, cx: MAP_W >> 1, cy: MAP_H >> 1 }];
  computeVis(G);
}

function useItem(G, item) {
  const d = ITEMS[item.id];
  const p = G.player;

  if (d.cat === "weapon" || d.cat === "shield" || d.cat === "ring") {
    const slot = d.cat;
    if (p[slot] === item) { p[slot] = null; log(G, `${itemName(G, item)}を外した。`, "normal"); }
    else {
      p[slot] = item;
      if (d.cat === "ring") identify(G, item.id);
      log(G, `${itemName(G, item)}を装備した。`, "normal");
      fx(G, { type: "spark", x: p.x, y: p.y, color: C.gold, life: 0.5, n: 6 });
    }
    return { consumed: false, turn: true };
  }

  if (d.cat === "food") {
    if (d.maxUp) p.maxFullness = Math.min(200, p.maxFullness + d.maxUp);
    p.fullness = Math.min(p.maxFullness, p.fullness + d.full);
    log(G, `${d.name}を食べた。満腹度が回復した。`, "good");
    fx(G, { type: "spark", x: p.x, y: p.y, color: C.belly, life: 0.6, n: 6, rise: true });
    return { consumed: true, turn: true };
  }

  if (d.cat === "grass") {
    identify(G, item.id);
    const good = (color) => fx(G, { type: "spark", x: p.x, y: p.y, color, life: 0.7, n: 8, rise: true });
    switch (item.id) {
      case "herb":
      case "gherb": {
        const heal = item.id === "herb" ? 25 : 100;
        const bonus = item.id === "herb" ? 2 : 4;
        if (p.hp >= p.maxHp) {
          p.maxHp += bonus; p.hp = p.maxHp;
          log(G, `最大HPが ${bonus} 増えた。`, "good");
          good("#8be27a");
        } else { healPlayer(G, heal); log(G, "HPが回復した。", "good"); }
        break;
      }
      case "life":
        p.maxHp += 5; p.hp += 5;
        log(G, "最大HPが 5 増えた！", "good"); good("#8be27a");
        break;
      case "poison":
        p.str = Math.max(1, p.str - 1);
        log(G, "体がしびれる。力が下がった。", "bad");
        fx(G, { type: "spark", x: p.x, y: p.y, color: "#9b6bd1", life: 0.6, n: 6 });
        break;
      case "power":
        p.str = Math.min(30, p.str + 1);
        p.maxStr = Math.max(p.maxStr, p.str);
        log(G, "力がみなぎってきた！", "good"); good(C.vermilion);
        break;
      case "antidote":
        if (p.str < p.maxStr) { p.str = p.maxStr; log(G, "力が元に戻った。", "good"); good("#8be27a"); }
        else log(G, "特に何も起こらなかった。", "normal");
        break;
      case "sleepg":
        p.sleep = 8;
        log(G, "眠ってしまった……", "bad");
        break;
      case "fruit":
        p.maxFullness = Math.min(200, p.maxFullness + 10);
        p.fullness = p.maxFullness;
        log(G, "お腹がふくらんだ。最大満腹度が増えた。", "good"); good(C.belly);
        break;
      case "haste":
        p.haste = 20;
        log(G, "体が軽くなった！ 倍速で動ける。", "good"); good("#c9e6ff");
        break;
      case "eye":
        revealTerrain(G); G.reveal = true;
        log(G, "フロアの様子が見えるようになった。", "good"); good("#5ec8d8");
        break;
      default: break;
    }
    return { consumed: true, turn: true };
  }

  if (d.cat === "scroll") {
    identify(G, item.id);
    switch (item.id) {
      case "ident":
        log(G, "識別したいアイテムを選ぼう。", "info");
        return { consumed: true, turn: true, pending: "identify" };
      case "warp": {
        fx(G, { type: "spark", x: p.x, y: p.y, color: "#c9e6ff", life: 0.5, n: 8 });
        const t = randomFloorTile(G, G.rng, null);
        p.x = t.x; p.y = t.y; p.px = t.x; p.py = t.y;
        computeVis(G);
        fx(G, { type: "burst", x: p.x, y: p.y, color: "#c9e6ff", life: 0.5, r: 1.2 });
        log(G, "体が浮き上がり、どこかへ飛ばされた。", "info");
        break;
      }
      case "confuse":
      case "sleeps": {
        const targets = G.mobs.filter((m) => m.hp > 0 && sameRoom(G, m, p));
        for (const m of targets) {
          if (item.id === "confuse") m.confuse = 15; else m.sleep = 15;
          fx(G, { type: "spark", x: m.x, y: m.y, color: item.id === "confuse" ? "#d15f9b" : "#5ec8d8", life: 0.7, n: 6 });
        }
        log(G, targets.length ? `部屋の敵が${item.id === "confuse" ? "混乱した" : "眠りに落ちた"}。` : "何も起こらなかった。", targets.length ? "good" : "normal");
        break;
      }
      case "blast": {
        fx(G, { type: "burst", x: p.x, y: p.y, color: "#ff9b4a", life: 0.55, r: 2.6, fill: true });
        fx(G, { type: "shake", life: 0.35, power: 0.8, noFlash: true });
        log(G, "轟音とともに爆発が起きた！", "good");
        const targets = G.mobs.filter((m) => m.hp > 0 && cheb(m.x, m.y, p.x, p.y) <= 2);
        for (const m of targets) hurtMob(G, m, 20, { delay: 0.12, color: "#ffb36b" });
        G.mobs = G.mobs.filter((m) => m.hp > 0);
        break;
      }
      case "map":
        revealTerrain(G);
        log(G, "フロアの地形が頭に浮かんだ。", "good");
        fx(G, { type: "spark", x: p.x, y: p.y, color: C.gold, life: 0.6, n: 6 });
        break;
      case "bless": {
        let any = false;
        if (p.weapon) { p.weapon.plus += 1; any = true; }
        if (p.shield) { p.shield.plus += 1; any = true; }
        log(G, any ? "装備が光に包まれ、強くなった！" : "装備していないので何も起こらなかった。", any ? "good" : "normal");
        if (any) fx(G, { type: "burst", x: p.x, y: p.y, color: C.gold, life: 0.6, r: 1.1 });
        break;
      }
      case "bigroom":
        makeBigRoom(G);
        log(G, "壁が崩れ去り、フロアが大部屋になった！", "info");
        fx(G, { type: "shake", life: 0.45, power: 0.7, noFlash: true });
        break;
      default: break;
    }
    return { consumed: true, turn: true };
  }

  if (d.cat === "staff") {
    if (item.charges <= 0) { log(G, "杖は何の反応も示さない。", "normal"); return { consumed: false, turn: true }; }
    return { consumed: false, turn: false, pending: "staff" };
  }

  if (d.cat === "ammo") return { consumed: false, turn: false, pending: "throw" };
  return { consumed: true, turn: true };
}

function firstMobInLine(G, dir, range) {
  const [dx, dy] = DIRS[dir];
  let x = G.player.x, y = G.player.y;
  for (let i = 0; i < range; i++) {
    x += dx; y += dy;
    if (!walkable(G, x, y)) return { hit: null, x: x - dx, y: y - dy };
    const m = mobAt(G, x, y);
    if (m) return { hit: m, x, y };
  }
  return { hit: null, x, y };
}

function projTime(G, x, y) { return 0.06 + 0.035 * cheb(G.player.x, G.player.y, x, y); }

function applyStaff(G, item, dir) {
  const p = G.player;
  const { hit, x, y } = firstMobInLine(G, dir, 10);
  item.charges -= 1;
  const tx = hit ? hit.x : x, ty = hit ? hit.y : y;
  const t0 = projTime(G, tx, ty);
  if (DIRS[dir][0] !== 0) p.face = DIRS[dir][0];
  fx(G, { type: "proj", x0: p.x, y0: p.y, x1: tx, y1: ty, color: STAFF_COLOR[item.id] || "#fff", life: t0 });
  if (!hit) { log(G, "杖の光は空を切った。", "normal"); return; }
  identify(G, item.id);
  const col = STAFF_COLOR[item.id];
  switch (item.id) {
    case "bind":
      hit.bind = 20; log(G, `${hit.name}の動きが止まった。`, "good");
      fx(G, { type: "spark", x: hit.x, y: hit.y, color: col, life: 0.6, n: 6, delay: t0 });
      break;
    case "slow":
      hit.slow = 1; log(G, `${hit.name}の動きが鈍くなった。`, "good");
      fx(G, { type: "spark", x: hit.x, y: hit.y, color: col, life: 0.6, n: 6, delay: t0 });
      break;
    case "swap": {
      const px = p.x, py = p.y;
      p.x = hit.x; p.y = hit.y;
      hit.x = px; hit.y = py;
      computeVis(G);
      log(G, `${hit.name}と場所が入れ替わった。`, "info");
      break;
    }
    case "blow": {
      const [dx, dy] = DIRS[dir];
      let bx = hit.x, by = hit.y;
      for (let i = 0; i < 6; i++) {
        const nx = bx + dx, ny = by + dy;
        if (!walkable(G, nx, ny) || occupied(G, nx, ny)) break;
        bx = nx; by = ny;
      }
      hit.x = bx; hit.y = by; // 表示座標はあえて残し、滑って飛んでいく様子を見せる
      log(G, `${hit.name}を吹き飛ばした！`, "good");
      hurtMob(G, hit, 10, { delay: t0 + 0.15, msg: false });
      break;
    }
    case "thunder":
      fx(G, { type: "bolt", x: hit.x, y: hit.y, color: col, life: 0.35, delay: t0 });
      hurtMob(G, hit, 20, { delay: t0 + 0.05, color: col, big: true });
      break;
    case "seal":
      hit.kind = { ...hit.kind, ai: "normal", onHit: null };
      log(G, `${hit.name}の能力が封印された。`, "good");
      fx(G, { type: "spark", x: hit.x, y: hit.y, color: col, life: 0.6, n: 6, delay: t0 });
      break;
    case "hstaff": {
      const before = hit.hp;
      hit.hp = Math.min(hit.maxHp, hit.hp + 30);
      log(G, `${hit.name}のHPが回復してしまった……`, "bad");
      fx(G, { type: "num", x: hit.x, y: hit.y, text: `+${hit.hp - before}`, color: "#8be27a", life: 0.8, delay: t0 });
      break;
    }
    default: break;
  }
  G.mobs = G.mobs.filter((m) => m.hp > 0);
}

function applyThrow(G, item, dir) {
  const d = ITEMS[item.id];
  const p = G.player;
  const { hit, x, y } = firstMobInLine(G, dir, 10);
  const tx = hit ? hit.x : x, ty = hit ? hit.y : y;
  const t0 = projTime(G, tx, ty);
  if (DIRS[dir][0] !== 0) p.face = DIRS[dir][0];
  fx(G, { type: "proj", x0: p.x, y0: p.y, x1: tx, y1: ty, item: item.id, life: t0, arc: d.cat !== "ammo" });

  if (!hit) {
    const drop = { ...item };
    if (d.stack) drop.count = 1;
    if (!itemAt(G, x, y) && walkable(G, x, y)) G.ground.push({ x, y, item: drop });
    log(G, `${itemName(G, item).replace("（装備中）", "")}を投げた。地面に落ちた。`, "normal");
    removeFromInv(G, item, 1);
    return;
  }
  hit.sleep = 0;
  if (d.cat === "ammo") {
    hurtMob(G, hit, d.dmg, { delay: t0, msg: `${d.name}が${hit.name}に当たった。${d.dmg} のダメージ。` });
  } else if (item.id === "sleepg") {
    identify(G, item.id);
    hit.sleep = 12;
    log(G, `${hit.name}は眠り込んだ。`, "good");
    fx(G, { type: "spark", x: hit.x, y: hit.y, color: "#5ec8d8", life: 0.6, n: 6, delay: t0 });
  } else if (item.id === "poison") {
    identify(G, item.id);
    hit.atk = Math.max(1, hit.atk - 3);
    log(G, `${hit.name}の攻撃力が下がった。`, "good");
    fx(G, { type: "spark", x: hit.x, y: hit.y, color: "#9b6bd1", life: 0.6, n: 6, delay: t0 });
  } else if (item.id === "herb" || item.id === "gherb") {
    identify(G, item.id);
    const before = hit.hp;
    hit.hp = Math.min(hit.maxHp, hit.hp + (item.id === "herb" ? 25 : 100));
    log(G, `${hit.name}のHPが回復してしまった。`, "bad");
    fx(G, { type: "num", x: hit.x, y: hit.y, text: `+${hit.hp - before}`, color: "#8be27a", life: 0.8, delay: t0 });
  } else {
    hurtMob(G, hit, 3, { delay: t0, msg: `${itemName(G, item).replace("（装備中）", "")}が${hit.name}に当たった。3 のダメージ。` });
  }
  G.mobs = G.mobs.filter((m) => m.hp > 0);
  removeFromInv(G, item, 1);
}

/* --------------------------------- 敵の行動 -------------------------------- */
function stepTo(m, d) {
  m.x += DIRS[d][0]; m.y += DIRS[d][1]; m.dir = d;
  if (DIRS[d][0] !== 0) m.face = DIRS[d][0];
}

function moveToward(G, m, tx, ty) {
  let best = -1, bestScore = Infinity;
  for (let d = 0; d < 8; d++) {
    const nx = m.x + DIRS[d][0], ny = m.y + DIRS[d][1];
    if (!canStep(G, m.x, m.y, nx, ny)) continue;
    if (occupied(G, nx, ny)) continue;
    const score = cheb(nx, ny, tx, ty) * 10 + Math.abs(nx - tx) + Math.abs(ny - ty);
    if (score < bestScore) { bestScore = score; best = d; }
  }
  if (best >= 0) { stepTo(m, best); return true; }
  return false;
}

function moveRandom(G, m) {
  const order = [];
  for (let i = 0; i < 8; i++) order.push((m.dir + i) % 8);
  const shuffled = G.rng.shuffle(order);
  const tryDirs = G.rng.chance(0.6) ? [m.dir, ...shuffled] : shuffled;
  for (const d of tryDirs) {
    const nx = m.x + DIRS[d][0], ny = m.y + DIRS[d][1];
    if (canStep(G, m.x, m.y, nx, ny) && !occupied(G, nx, ny)) { stepTo(m, d); return true; }
  }
  return false;
}

/** 敵の行動は少しずつ時間をずらして再生する（同時に殴られて何が起きたか分からない、を防ぐ） */
function nextDelay(G) { const d = G.seq * 0.14; G.seq += 1; return d; }

function mobAttack(G, m) {
  const p = G.player;
  const delay = nextDelay(G);
  lunge(m, p.x, p.y, delay);
  if (G.rng.chance(0.08)) {
    log(G, `${m.name}の攻撃は外れた。`, "normal");
    fx(G, { type: "num", x: p.x, y: p.y, text: "MISS", color: C.sub, life: 0.7, delay: delay + 0.08 });
    return;
  }
  const dmg = calcDamage(G, m.atk, playerDef(G));
  damagePlayer(G, dmg, m.name, delay + 0.08);
  if (G.status !== "play") return;
  if (m.kind.onHit === "confuse" && G.rng.chance(0.3)) {
    p.confuse = 10;
    log(G, "目がまわる！ 混乱した。", "bad");
    fx(G, { type: "spark", x: p.x, y: p.y, color: "#d15f9b", life: 0.6, n: 6, delay: delay + 0.1 });
  }
  const sh = p.shield ? ITEMS[p.shield.id] : null;
  if (sh && sh.thorns && m.hp > 0) {
    const back = Math.max(1, Math.round(dmg * sh.thorns));
    hurtMob(G, m, back, { delay: delay + 0.16, color: "#ffb36b", msg: `トゲが${m.name}に刺さった。${back} のダメージ。` });
  }
}

function alignedDir(G, m) {
  const dx = G.player.x - m.x, dy = G.player.y - m.y;
  if (dx === 0 && dy === 0) return -1;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return -1;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  if (dist > 7) return -1;
  let x = m.x, y = m.y;
  for (let i = 0; i < dist - 1; i++) {
    x += sx; y += sy;
    if (!walkable(G, x, y) || mobAt(G, x, y)) return -1;
  }
  return DIRS.findIndex((d) => d[0] === sx && d[1] === sy);
}

function actMob(G, m) {
  if (m.hp <= 0 || G.status !== "play") return;
  const p = G.player;

  if (m.sleep > 0) {
    m.sleep -= 1;
    if (cheb(m.x, m.y, p.x, p.y) <= 1 && G.rng.chance(0.5)) { m.sleep = 0; log(G, `${m.name}が目を覚ました。`, "normal"); }
    return;
  }
  if (m.bind > 0) { m.bind -= 1; return; }

  if (m.fleeing > 0) {
    m.fleeing -= 1;
    if (m.fleeing === 0) {
      log(G, `${m.name}は闇に消えた……`, "bad");
      fx(G, { type: "spark", x: m.x, y: m.y, color: "#5a5a6a", life: 0.6, n: 6 });
      m.hp = 0; m.stolen = null;
      return;
    }
    moveToward(G, m, m.x * 2 - p.x, m.y * 2 - p.y);
    return;
  }

  if (m.confuse > 0) { m.confuse -= 1; moveRandom(G, m); return; }

  const canSee = sameRoom(G, m, p) || cheb(m.x, m.y, p.x, p.y) <= 1;

  if (m.kind.ai === "ranged" && canSee) {
    const dir = alignedDir(G, m);
    if (dir >= 0 && cheb(m.x, m.y, p.x, p.y) > 1) {
      const delay = nextDelay(G);
      if (p.x !== m.x) m.face = Math.sign(p.x - m.x);
      const travel = 0.06 + 0.035 * cheb(m.x, m.y, p.x, p.y);
      const color = m.kind.id === "dragon" ? "#ff7a3a" : "#e07ad1";
      fx(G, { type: "proj", x0: m.x, y0: m.y, x1: p.x, y1: p.y, color, life: travel, delay, big: m.kind.id === "dragon" });
      const dmg = calcDamage(G, m.atk, Math.floor(playerDef(G) / 2));
      damagePlayer(G, dmg, m.name, delay + travel);
      G.seq += 1;
      return;
    }
  }

  if (cheb(m.x, m.y, p.x, p.y) === 1 && canStep(G, m.x, m.y, p.x, p.y)) {
    if (m.kind.ai === "thief") {
      if (G.inv.length > 0) {
        const target = G.rng.pick(G.inv);
        const name = itemName(G, target).replace("（装備中）", "");
        removeFromInv(G, target, 99);
        m.stolen = target;
        m.fleeing = 30;
        const delay = nextDelay(G);
        lunge(m, p.x, p.y, delay);
        fx(G, { type: "num", x: p.x, y: p.y, text: "盗まれた！", color: "#b0b0c0", life: 0.9, delay: delay + 0.08 });
        log(G, `${m.name}に${name}を盗まれた！`, "bad");
      } else {
        mobAttack(G, m);
      }
      return;
    }
    mobAttack(G, m);
    return;
  }

  if (canSee) {
    if (m.kind.ai === "erratic" && G.rng.chance(0.4)) moveRandom(G, m);
    else moveToward(G, m, p.x, p.y);
  } else {
    moveRandom(G, m);
  }
}

function spawnMob(G) {
  const pool = MOBS.filter((m) => G.floor >= m.min && G.floor <= m.max);
  if (!pool.length) return;
  for (let t = 0; t < 60; t++) {
    const rm = G.rng.pick(G.rooms);
    const x = G.rng.range(rm.x, rm.x + rm.w - 1);
    const y = G.rng.range(rm.y, rm.y + rm.h - 1);
    if (G.visible[idx(x, y)]) continue;
    if (occupied(G, x, y) || G.tiles[idx(x, y)] !== ROOM) continue;
    G.mobs.push(makeMob(G.rng, G.rng.pick(pool).id, x, y, G.D));
    return;
  }
}

/* ------------------------------ ターンの進行 ------------------------------- */
function endTurn(G) {
  if (G.status !== "play") return;
  const p = G.player;

  // 倍速中は、プレイヤー2行動につき敵1行動
  let enemiesAct = true;
  if (p.haste > 0) {
    G.hasteFlip = !G.hasteFlip;
    enemiesAct = !G.hasteFlip;
    p.haste -= 1;
    if (p.haste === 0) log(G, "動きが元に戻った。", "info");
  }

  if (enemiesAct) {
    for (const m of G.mobs) {
      if (m.hp <= 0) continue;
      const times = m.kind.ai === "fast" ? 2 : m.slow ? (G.turn % 2 === 0 ? 1 : 0) : 1;
      for (let i = 0; i < times; i++) actMob(G, m);
      if (G.status !== "play") break;
    }
    G.mobs = G.mobs.filter((m) => m.hp > 0);
  }

  G.turn += 1;

  const hungerEvery = G.D.hunger * (ringIs(G, "rfull") ? 2 : 1);
  if (G.turn % hungerEvery === 0) {
    const before = p.fullness;
    p.fullness = Math.max(0, p.fullness - 1);
    if (before > 20 && p.fullness <= 20) log(G, "お腹が減ってきた。", "bad");
    if (before > 0 && p.fullness === 0) log(G, "お腹が空きすぎて倒れそうだ！", "bad");
  }
  const regenEvery = ringIs(G, "rregen") ? Math.max(1, Math.floor(G.D.regen / 2)) : G.D.regen;
  if (p.fullness > 0) {
    if (G.turn % regenEvery === 0 && p.hp < p.maxHp && G.status === "play") p.hp = Math.min(p.maxHp, p.hp + 1);
  } else if (G.turn % 3 === 0 && G.status === "play") {
    p.hp -= 1;
    if (p.hp <= 0) { p.hp = 0; G.status = "dead"; log(G, "空腹で力尽きた……", "bad"); }
  }

  if (p.sleep > 0) p.sleep -= 1;
  if (p.confuse > 0) { p.confuse -= 1; if (p.confuse === 0) log(G, "混乱がおさまった。", "info"); }

  if (G.turn % G.D.spawn === 0) spawnMob(G);

  computeVis(G);
  G.seq = 0;
}

function tryMove(G, dir) {
  const p = G.player;
  G.seq = 0;
  if (p.sleep > 0) { log(G, "眠っていて動けない。", "bad"); endTurn(G); return; }
  let d = dir;
  if (p.confuse > 0 && G.rng.chance(0.6)) d = G.rng.int(8);
  p.dir = d;
  if (DIRS[d][0] !== 0) p.face = DIRS[d][0];
  const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];

  const m = mobAt(G, nx, ny);
  if (m) { attackMob(G, m); G.mobs = G.mobs.filter((x) => x.hp > 0); endTurn(G); return; }
  if (!canStep(G, p.x, p.y, nx, ny)) {
    if (p.confuse > 0) { endTurn(G); return; }
    return; // 壁 → ターンを消費しない
  }
  p.x = nx; p.y = ny;
  computeVis(G);

  const g = itemAt(G, p.x, p.y);
  if (g) {
    if (addToInv(G, g.item)) {
      log(G, `${itemName(G, g.item)}を拾った。`, "info");
      G.ground = G.ground.filter((x) => x !== g);
      fx(G, { type: "spark", x: p.x, y: p.y, color: C.gold, life: 0.45, n: 5, rise: true, delay: 0.08 });
    } else {
      log(G, "持ち物がいっぱいで拾えない。", "bad");
    }
  }
  endTurn(G);
}

function descend(G) {
  G.floor += 1;
  if (G.floor > FINAL_FLOOR) { G.status = "clear"; G.floor = FINAL_FLOOR; return; }
  G.deepest = Math.max(G.deepest, G.floor);
  enterFloor(G, G.rng);
  log(G, `地下${G.floor}階に降りた。`, "info");
}

/* --------------------------------- 描画 ----------------------------------- */
function drawSprite(ctx, rows, sx, sy, size, colorOf, flip) {
  const u = size / 8;
  for (let j = 0; j < 8; j++) {
    const row = rows[j];
    for (let i = 0; i < 8; i++) {
      const ch = row[flip ? 7 - i : i];
      if (ch === "." || ch === undefined) continue;
      const col = colorOf(ch);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.floor(sx + i * u), Math.floor(sy + j * u), Math.ceil(u), Math.ceil(u));
    }
  }
}

const palOf = (ch) => PAL[ch] || null;
const whiteOf = () => "#ffffff";

function itemSprite(id) {
  const cat = ITEMS[id].cat;
  if (cat === "ammo") return id === "stone" ? ITEM_SPR.stone : ITEM_SPR.arrow;
  return ITEM_SPR[cat] || ITEM_SPR.grass;
}

/** 時間経過で演出を進める（ゲームの状態そのものは変えない） */
function stepAnim(G, dt) {
  const k = 1 - Math.pow(0.65, dt * 60); // 60fpsで1フレーム35%追従
  const ents = [G.player, ...G.mobs];
  for (const o of ents) {
    o.px += (o.x - o.px) * k;
    o.py += (o.y - o.py) * k;
    if (Math.abs(o.x - o.px) < 0.01) o.px = o.x;
    if (Math.abs(o.y - o.py) < 0.01) o.py = o.y;
    if (o.lunge) {
      if (o.lunge.delay > 0) o.lunge.delay -= dt;
      else { o.lunge.t += dt; if (o.lunge.t >= LUNGE_TIME) o.lunge = null; }
    }
    if (o.hitT > 0) {
      if (o.hitDelay > 0) o.hitDelay -= dt;
      else o.hitT -= dt;
    }
  }
  for (const e of G.fx) {
    if (e.delay > 0) e.delay -= dt;
    else e.t += dt;
  }
  G.fx = G.fx.filter((e) => e.t < e.life);
}

function render(canvas, G, now) {
  if (!canvas || !G || !G.tiles) return;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, chh = canvas.clientHeight;
  if (cw === 0 || chh === 0) return;
  if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(chh * dpr)) {
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(chh * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // 画面揺れ・被弾フラッシュ
  let shake = 0, flash = 0;
  for (const e of G.fx) {
    if (e.type !== "shake" || e.delay > 0) continue;
    const k = 1 - e.t / e.life;
    shake = Math.max(shake, e.power * k);
    if (!e.noFlash) flash = Math.max(flash, k * 0.32);
  }

  const TILE = Math.max(18, Math.min(34, Math.floor(cw / 14)));
  const viewTilesX = cw / TILE, viewTilesY = chh / TILE;
  let camX = G.player.px - viewTilesX / 2 + 0.5;
  let camY = G.player.py - viewTilesY / 2 + 0.5;
  camX = Math.max(0, Math.min(MAP_W - viewTilesX, camX));
  camY = Math.max(0, Math.min(MAP_H - viewTilesY, camY));
  if (MAP_W < viewTilesX) camX = (MAP_W - viewTilesX) / 2;
  if (MAP_H < viewTilesY) camY = (MAP_H - viewTilesY) / 2;
  const shx = shake ? Math.sin(now * 90) * shake * 0.18 : 0;
  const shy = shake ? Math.cos(now * 77) * shake * 0.18 : 0;
  camX += shx; camY += shy;

  const sx = (x) => Math.floor((x - camX) * TILE);
  const sy = (y) => Math.floor((y - camY) * TILE);
  const visAt = (x, y) => inMap(Math.round(x), Math.round(y)) && G.visible[idx(Math.round(x), Math.round(y))];

  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, cw, chh);

  const x0 = Math.max(0, Math.floor(camX) - 1), x1 = Math.min(MAP_W - 1, Math.ceil(camX + viewTilesX) + 1);
  const y0 = Math.max(0, Math.floor(camY) - 1), y1 = Math.min(MAP_H - 1, Math.ceil(camY + viewTilesY) + 1);

  /* ---- 地形 ---- */
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (!G.known[i]) continue;
      const lit = G.visible[i];
      const t = G.tiles[i];
      const px = sx(x), py = sy(y);
      if (t === WALL) {
        ctx.fillStyle = lit ? C.wallLit : C.wallDim;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = lit ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)";
        ctx.fillRect(px, py, TILE, Math.max(2, TILE / 8));
      } else {
        ctx.fillStyle = t === CORR ? (lit ? C.corrLit : C.floorDim) : lit ? C.floorLit : C.floorDim;
        ctx.fillRect(px, py, TILE, TILE);
        if (lit) {
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, TILE, 1);
          if (((x * 7 + y * 13) % 5) === 0) ctx.fillRect(px + TILE / 3, py + TILE / 2, 2, 2);
        }
        if (t === STAIRS) {
          if (lit) {
            const pulse = 0.12 + 0.1 * Math.sin(now * 3);
            ctx.fillStyle = `rgba(217,164,65,${pulse})`;
            ctx.fillRect(px, py, TILE, TILE);
          }
          drawSprite(ctx, STAIRS_SPR, px, py, TILE, (ch) => (lit ? palOf(ch) : "#4b525e"));
        }
      }
    }
  }

  /* ---- 落ちているアイテム ---- */
  const seeItems = G.reveal || ringIs(G, "rsight");
  for (const g of G.ground) {
    const i = idx(g.x, g.y);
    if (!G.known[i] && !seeItems) continue;
    const lit = G.visible[i];
    const float = lit ? Math.sin(now * 2.4 + g.x * 1.3 + g.y) * TILE * 0.04 : 0;
    drawSprite(ctx, itemSprite(g.item.id), sx(g.x), sy(g.y) + float, TILE, (ch) => (lit ? palOf(ch) : "#46505e"));
  }

  /* ---- キャラクター ---- */
  const drawActor = (ent, rows, colorOf, flip, alpha) => {
    let ox = 0, oy = 0;
    if (ent.lunge && ent.lunge.delay <= 0) {
      const k = Math.sin(Math.PI * Math.min(1, ent.lunge.t / LUNGE_TIME));
      ox = ent.lunge.dx * k * 0.4; oy = ent.lunge.dy * k * 0.4;
    }
    const moving = Math.abs(ent.x - ent.px) + Math.abs(ent.y - ent.py) > 0.04;
    const bob = moving ? -Math.abs(Math.sin(now * 20)) * TILE * 0.09 : Math.sin(now * 3 + (ent.seed || 0)) * TILE * 0.03;
    const px = sx(ent.px + ox), base = sy(ent.py + oy);
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(px + TILE / 2, base + TILE * 0.92, TILE * 0.3, TILE * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    const white = ent.hitT > 0 && ent.hitDelay <= 0 && Math.floor(ent.hitT * 24) % 2 === 0;
    drawSprite(ctx, rows, px, base + bob, TILE, white ? whiteOf : colorOf, flip);
    ctx.globalAlpha = 1;
    return { px, py: base + bob };
  };

  const seeMobs = ringIs(G, "rsight");
  for (const m of G.mobs) {
    const vis = G.visible[idx(m.x, m.y)];
    if (!vis && !seeMobs) continue;
    const shape = m.kind.shape;
    const flip = (m.face || 1) !== (SHAPE_FACE[shape] || 1);
    const colorOf = (ch) => (ch === "A" ? m.kind.a : ch === "B" ? m.kind.b : palOf(ch));
    const { px, py } = drawActor(m, SHAPES[shape], colorOf, flip, vis ? 1 : 0.35);
    if (!vis) continue;
    if (m.sleep > 0) {
      ctx.fillStyle = "#c9e6ff";
      ctx.font = `bold ${Math.floor(TILE * 0.34)}px system-ui`;
      const zz = (now * 1.2 + m.seed) % 1;
      ctx.globalAlpha = 1 - zz;
      ctx.fillText("z", px + TILE * 0.72, py + TILE * 0.2 - zz * TILE * 0.35);
      ctx.globalAlpha = 1;
    } else if (m.bind > 0 || m.confuse > 0) {
      ctx.fillStyle = m.bind > 0 ? C.gold : "#d15f9b";
      const a = now * 6 + m.seed;
      ctx.fillRect(px + TILE / 2 + Math.cos(a) * TILE * 0.3 - 2, py + 1 + Math.sin(a) * 2, 4, 4);
    }
    if (m.hp < m.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(px + 2, py + TILE - 3, TILE - 4, 3);
      ctx.fillStyle = C.hp;
      ctx.fillRect(px + 2, py + TILE - 3, (TILE - 4) * Math.max(0, m.hp / m.maxHp), 3);
    }
  }

  const p = G.player;
  const pv = drawActor(p, PLAYER_SPR, palOf, (p.face || 1) < 0, 1);
  if (p.haste > 0) {
    ctx.globalAlpha = 0.25;
    drawSprite(ctx, PLAYER_SPR, pv.px - (p.face || 1) * TILE * 0.18, pv.py, TILE, () => "#c9e6ff", (p.face || 1) < 0);
    ctx.globalAlpha = 1;
  }

  /* ---- 演出 ---- */
  for (const e of G.fx) {
    if (e.type === "shake") continue;
    if (e.type === "die") {
      if (!visAt(e.x, e.y)) continue;
      const k = e.delay > 0 ? 0 : e.t / e.life;
      const shape = e.kind.shape;
      const flip = (e.face || 1) !== (SHAPE_FACE[shape] || 1);
      const colorOf = k < 0.3 ? whiteOf : (ch) => (ch === "A" ? e.kind.a : ch === "B" ? e.kind.b : palOf(ch));
      ctx.save();
      ctx.globalAlpha = 1 - k;
      const cx = sx(e.x) + TILE / 2, by = sy(e.y) + TILE;
      ctx.translate(cx, by);
      ctx.scale(1 + k * 0.4, Math.max(0.05, 1 - k));
      drawSprite(ctx, SHAPES[shape], -TILE / 2, -TILE, TILE, colorOf, flip);
      ctx.restore();
      continue;
    }
    if (e.delay > 0) continue;
    const k = e.t / e.life;

    if (e.type === "proj") {
      const q = Math.min(1, k);
      const fx0 = e.x0 + (e.x1 - e.x0) * q, fy0 = e.y0 + (e.y1 - e.y0) * q;
      const arc = e.arc ? -Math.sin(Math.PI * q) * 0.6 : 0;
      if (!visAt(fx0, fy0) && !visAt(e.x0, e.y0)) continue;
      const cx = sx(fx0) + TILE / 2, cy = sy(fy0 + arc) + TILE / 2;
      if (e.item) {
        drawSprite(ctx, itemSprite(e.item), cx - TILE * 0.35, cy - TILE * 0.35, TILE * 0.7, palOf);
      } else {
        const r = TILE * (e.big ? 0.28 : 0.16);
        for (let s = 3; s >= 0; s--) {
          const tq = Math.max(0, q - s * 0.08);
          const tx = sx(e.x0 + (e.x1 - e.x0) * tq) + TILE / 2, ty = sy(e.y0 + (e.y1 - e.y0) * tq) + TILE / 2;
          ctx.globalAlpha = s === 0 ? 1 : 0.35 / s;
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.arc(tx, ty, r * (1 - s * 0.18), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.fill();
      }
      continue;
    }

    if (!visAt(e.x, e.y)) continue;
    const cx = sx(e.x) + TILE / 2, cy = sy(e.y) + TILE / 2;

    if (e.type === "num") {
      const ease = 1 - Math.pow(1 - Math.min(1, k * 2), 3);
      const y = cy - TILE * 0.35 - ease * TILE * 0.55;
      const size = Math.floor(TILE * (e.big ? 0.5 : 0.42));
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(e.text, cx, y);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, cx, y);
      ctx.textAlign = "start";
      ctx.globalAlpha = 1;
    } else if (e.type === "burst") {
      const ease = 1 - Math.pow(1 - k, 3);
      const r = Math.max(1, e.r * TILE * ease);
      ctx.globalAlpha = 1 - k;
      if (e.fill) {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1 - k;
      }
      ctx.strokeStyle = e.color;
      ctx.lineWidth = Math.max(1, 4 * (1 - k));
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.type === "spark") {
      const n = e.n || 6;
      ctx.fillStyle = e.color;
      ctx.globalAlpha = 1 - k;
      for (let s = 0; s < n; s++) {
        const a = e.seed + (s / n) * Math.PI * 2;
        const dist = TILE * (0.15 + k * 0.5);
        const px = cx + Math.cos(a) * dist * (e.rise ? 0.6 : 1);
        const py = cy + (e.rise ? -k * TILE * 0.7 + Math.sin(a) * TILE * 0.2 : Math.sin(a) * dist);
        const sz = Math.max(2, TILE * 0.1 * (1 - k * 0.5));
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    } else if (e.type === "bolt") {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
      ctx.beginPath();
      let lx = cx, ly = cy - TILE * 3;
      ctx.moveTo(lx, ly);
      for (let s = 1; s <= 6; s++) {
        ly = cy - TILE * 3 + (TILE * 3 * s) / 6;
        lx = cx + (s === 6 ? 0 : Math.sin(e.seed * 7 + s * 2.3) * TILE * 0.35);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.globalAlpha *= 0.3;
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(207,74,44,${flash})`;
    ctx.fillRect(0, 0, cw, chh);
  }
  // 周辺減光（ビネット）
  const vg = ctx.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.35, cw / 2, chh / 2, Math.max(cw, chh) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, chh);
}

/* ================================ UI 部品 ================================= */
function Bar({ value, max, color, label, sub }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.sub, letterSpacing: "0.08em" }}>
        <span>{label}</span>
        <span style={{ color: C.paper }}>{sub}</span>
      </div>
      <div style={{ height: 6, background: "#0a0d12", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, transition: "width 160ms linear" }} />
      </div>
    </div>
  );
}

function Btn({ children, onClick, tone, style, disabled }) {
  const bg = tone === "primary" ? C.vermilion : tone === "ghost" ? "transparent" : C.panelHi;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: disabled ? C.sub : C.paper,
        border: `1px solid ${tone === "primary" ? C.vermilion : C.line}`,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, background: "rgba(6,9,13,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 14, zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          width: "100%", maxWidth: 420, maxHeight: "88%", overflowY: "auto", animation: "md-pop 180ms ease-out",
          boxShadow: "0 18px 50px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================================ メイン ================================== */
export default function MysteryDungeon() {
  const gameRef = useRef(null);
  const canvasRef = useRef(null);
  const [, setTick] = useState(0);
  const [screen, setScreen] = useState("title");
  const [menu, setMenu] = useState(null); // null | 'inv' | 'item' | 'dir' | 'stairs' | 'help'
  const [sel, setSel] = useState(null);
  const [pending, setPending] = useState(null); // {kind:'throw'|'staff'|'identify', item}
  const [seedInput, setSeedInput] = useState("");
  const [banner, setBanner] = useState(null);
  const [diff, setDiff] = useState("normal");

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  /* ---- 描画ループ（表示座標を補間して滑らかに動かす） ---- */
  useEffect(() => {
    let raf, last = 0;
    const loop = () => {
      const G = gameRef.current;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - (last || now));
      last = now;
      if (G) {
        stepAnim(G, dt);
        render(canvasRef.current, G, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  const start = (seed, diffKey) => {
    const s = seed != null ? seed : Math.floor(Math.random() * 1e9);
    gameRef.current = newGame(s, diffKey || diff);
    setScreen("play");
    setMenu(null); setSel(null); setPending(null);
    setBanner("地下 1 階");
    setTimeout(() => setBanner(null), 1100);
    refresh();
  };

  const afterAction = () => {
    const G = gameRef.current;
    if (!G) return;
    if (G.status === "dead") { setMenu(null); setTimeout(() => setScreen("dead"), 900); }
    if (G.status === "clear") { setScreen("clear"); setMenu(null); }
    refresh();
  };

  const doMove = (dir) => {
    const G = gameRef.current;
    if (!G || G.status !== "play" || menu) return;
    tryMove(G, dir);
    // 階段に乗ったら確認
    if (G.status === "play" && G.tiles[idx(G.player.x, G.player.y)] === STAIRS) setMenu("stairs");
    afterAction();
  };

  const doWait = () => {
    const G = gameRef.current;
    if (!G || G.status !== "play" || menu) return;
    endTurn(G);
    afterAction();
  };

  const doDescend = () => {
    const G = gameRef.current;
    setMenu(null);
    descend(G);
    if (G.status === "clear") { setScreen("clear"); refresh(); return; }
    setBanner(`地下 ${G.floor} 階`);
    setTimeout(() => setBanner(null), 1100);
    refresh();
  };

  const onSelectItem = (item) => {
    const G = gameRef.current;
    if (pending && pending.kind === "identify") {
      identify(G, item.id);
      setPending(null); setMenu(null); setSel(null);
      endTurn(G); afterAction();
      return;
    }
    setSel(item); setMenu("item");
  };

  const runItemAction = (action) => {
    const G = gameRef.current;
    const item = sel;
    if (!item) return;

    if (action === "use") {
      const res = useItem(G, item);
      if (res.pending === "staff") { setPending({ kind: "staff", item }); setMenu("dir"); return; }
      if (res.pending === "throw") { setPending({ kind: "throw", item }); setMenu("dir"); return; }
      if (res.consumed) removeFromInv(G, item, 1);
      if (res.pending === "identify") { setPending({ kind: "identify" }); setMenu("inv"); setSel(null); refresh(); return; }
      setMenu(null); setSel(null);
      if (res.turn) endTurn(G);
      afterAction();
      return;
    }
    if (action === "throw") { setPending({ kind: "throw", item }); setMenu("dir"); return; }
    if (action === "drop") {
      if (itemAt(G, G.player.x, G.player.y)) { log(G, "足元にはすでに何か置いてある。", "bad"); setMenu(null); setSel(null); refresh(); return; }
      const drop = { ...item };
      removeFromInv(G, item, 99);
      G.ground.push({ x: G.player.x, y: G.player.y, item: drop });
      log(G, `${itemName(G, drop)}を置いた。`, "normal");
      setMenu(null); setSel(null);
      endTurn(G); afterAction();
      return;
    }
    setMenu(null); setSel(null);
  };

  const chooseDir = (dir) => {
    const G = gameRef.current;
    if (!pending) { setMenu(null); return; }
    if (pending.kind === "staff") applyStaff(G, pending.item, dir);
    if (pending.kind === "throw") applyThrow(G, pending.item, dir);
    setPending(null); setMenu(null); setSel(null);
    endTurn(G); afterAction();
  };

  /* ---- キーボード ---- */
  useEffect(() => {
    const keyDir = {
      ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6,
      k: 0, l: 2, j: 4, h: 6, y: 7, u: 1, b: 5, n: 3,
      "8": 0, "9": 1, "6": 2, "3": 3, "2": 4, "1": 5, "4": 6, "7": 7,
    };
    const onKey = (e) => {
      if (screen !== "play") return;
      if (menu === "dir") {
        const d = keyDir[e.key];
        if (d !== undefined) { e.preventDefault(); chooseDir(d); }
        if (e.key === "Escape") { setPending(null); setMenu(null); refresh(); }
        return;
      }
      if (menu) {
        if (e.key === "Escape") { setMenu(null); setSel(null); setPending(null); refresh(); }
        return;
      }
      const d = keyDir[e.key];
      if (d !== undefined) { e.preventDefault(); doMove(d); return; }
      if (e.key === "." || e.key === "5") { e.preventDefault(); doWait(); }
      if (e.key === "i" || e.key === "Enter") { e.preventDefault(); setMenu("inv"); }
      if (e.key === "?") setMenu("help");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const G = gameRef.current;

  /* --------------------------- タイトル画面 --------------------------- */
  if (screen === "title" || !G) {
    return (
      <div style={shell}>
      <style>{`
        @keyframes md-banner { 0% { opacity: 0; letter-spacing: 0.6em; } 25% { opacity: 1; letter-spacing: 0.2em; } 75% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes md-line { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
        @keyframes md-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes md-pop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
        <div style={{ ...panelCol, justifyContent: "center", gap: 22, padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.5em", color: C.gold }}>MYSTERY DUNGEON</div>
            <h1 style={{ fontSize: 30, margin: "8px 0 4px", color: C.paper, letterSpacing: "0.15em", fontWeight: 800 }}>
              賽ノ<span style={{ color: C.vermilion }}>螺旋</span>
            </h1>
            <div style={{ fontSize: 12, color: C.sub }}>地下{FINAL_FLOOR}階、たどり着けるか。</div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
            <div style={{ color: C.paper, fontWeight: 700, marginBottom: 6 }}>迷宮の掟</div>
            ・ダンジョンは入るたびに形が変わる<br />
            ・自分が1歩動くと、敵も1歩動く（完全ターン制）<br />
            ・敵に向かって進むと攻撃になる<br />
            ・満腹度が0になるとHPが減り続ける<br />
            ・倒れたら持ち物を失い、地下1階からやり直し
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.sub, letterSpacing: "0.12em", marginBottom: 8 }}>難易度</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {Object.values(DIFFS).map((d) => {
                const on = diff === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setDiff(d.key)}
                    style={{
                      background: on ? C.panelHi : C.panel, cursor: "pointer", textAlign: "left",
                      border: `1.5px solid ${on ? d.color : C.line}`, borderRadius: 10, padding: "10px 10px 9px",
                      transform: on ? "translateY(-2px)" : "none", transition: "all 160ms ease",
                      boxShadow: on ? `0 6px 18px ${d.color}33` : "none",
                    }}
                  >
                    <div style={{ fontSize: 9, letterSpacing: "0.2em", color: d.color, fontWeight: 800 }}>{d.tag}</div>
                    <div style={{ fontSize: 14, color: C.paper, fontWeight: 800, margin: "2px 0 4px" }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.45 }}>{d.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
              placeholder="シード値（任意）"
              style={{
                flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                color: C.paper, padding: "10px 12px", fontSize: 13, outline: "none",
              }}
            />
            <Btn tone="primary" onClick={() => start(seedInput ? parseInt(seedInput, 10) : null, diff)} style={{ padding: "10px 20px" }}>
              潜る
            </Btn>
          </div>
          <div style={{ fontSize: 11, color: C.sub, textAlign: "center" }}>
            同じシード値なら、まったく同じ迷宮が生成されます。
          </div>
        </div>
      </div>
    );
  }

  const p = G.player;
  const recent = G.log.slice(-3);
  const nextExp = p.lv < EXP_TABLE.length ? EXP_TABLE[p.lv] : null;

  /* ------------------------------ 本編 ------------------------------ */
  return (
    <div style={shell}>
      <style>{`
        @keyframes md-banner { 0% { opacity: 0; letter-spacing: 0.6em; } 25% { opacity: 1; letter-spacing: 0.2em; } 75% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes md-line { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
        @keyframes md-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes md-pop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
      <div style={panelCol}>
        {/* ステータス */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", background: C.panel, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ textAlign: "center", minWidth: 44 }}>
            <div style={{ fontSize: 9, color: C.sub, letterSpacing: "0.1em" }}>FLOOR</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.gold, lineHeight: 1 }}>B{G.floor}</div>
            <div style={{ fontSize: 8, color: G.D.color, letterSpacing: "0.12em", marginTop: 2, fontWeight: 800 }}>{G.D.tag}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 34 }}>
            <div style={{ fontSize: 9, color: C.sub, letterSpacing: "0.1em" }}>LV</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.paper, lineHeight: 1 }}>{p.lv}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ animation: p.hp / p.maxHp < 0.25 ? "md-pulse 0.9s ease-in-out infinite" : "none" }}>
              <Bar value={p.hp} max={p.maxHp} color={C.hp} label="HP" sub={`${p.hp}/${p.maxHp}`} />
            </div>
            <Bar value={p.fullness} max={p.maxFullness} color={C.belly} label="満腹度" sub={`${p.fullness}/${p.maxFullness}`} />
          </div>
        </div>

        {/* マップ */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", background: C.ink }} />
          {banner && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(6,9,13,0.75)", color: C.paper, fontSize: 24, fontWeight: 800, letterSpacing: "0.2em",
              animation: "md-banner 1.1s ease forwards",
            }}>
              {banner}
            </div>
          )}
          <div style={{
            position: "absolute", left: 8, top: 8, fontSize: 10, color: C.sub,
            background: "rgba(12,16,22,0.7)", padding: "3px 7px", borderRadius: 6, letterSpacing: "0.06em",
          }}>
            力 {p.str}{p.str < p.maxStr ? `(${p.maxStr})` : ""} / 攻 {playerAtk(G)} / 防 {playerDef(G)}
            {p.haste > 0 ? " / 倍速" : ""}{p.confuse > 0 ? " / 混乱" : ""}{p.sleep > 0 ? " / 睡眠" : ""}
            {p.ring ? <span style={{ color: C.gold }}>{" / " + ITEMS[p.ring.id].name}</span> : null}
          </div>
        </div>

        {/* メッセージ */}
        <div style={{
          background: "#101720", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
          padding: "6px 10px", height: 58, overflow: "hidden", fontSize: 12, lineHeight: 1.55,
        }}>
          {recent.map((m, i) => (
            <div key={G.log.length - recent.length + i} style={{
              color: m.kind === "good" ? C.belly : m.kind === "bad" ? C.hp : m.kind === "info" ? C.gold : C.paper,
              opacity: i === recent.length - 1 ? 1 : 0.5,
              animation: i === recent.length - 1 ? "md-line 220ms ease-out" : "none",
            }}>
              {m.text}
            </div>
          ))}
        </div>

        {/* 操作 */}
        <div style={{ display: "flex", gap: 12, padding: 10, alignItems: "center", background: C.ink }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 46px)", gridTemplateRows: "repeat(3, 40px)", gap: 4 }}>
            {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d, i) =>
              d === -1 ? (
                <Btn key={i} onClick={doWait} style={{ padding: 0, fontSize: 11, background: C.panel }}>足踏</Btn>
              ) : (
                <Btn key={i} onClick={() => doMove(d)} style={{ padding: 0, fontSize: 16, background: C.panelHi }}>{DIR_LABEL[d]}</Btn>
              )
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <Btn tone="primary" onClick={() => setMenu("inv")}>持ち物（{G.inv.length}/{INV_MAX}）</Btn>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={() => setMenu("help")} style={{ flex: 1, fontSize: 12 }}>操作</Btn>
              <Btn
                onClick={() => { if (G.tiles[idx(p.x, p.y)] === STAIRS) { setMenu("stairs"); } else { log(G, "ここに階段はない。", "normal"); refresh(); } }}
                style={{ flex: 1, fontSize: 12 }}
              >
                階段
              </Btn>
            </div>
            <div style={{ fontSize: 10, color: C.sub, textAlign: "center" }}>
              経験値 {p.exp}{nextExp ? ` / 次 ${nextExp}` : ""} ・ {G.turn}ターン
            </div>
          </div>
        </div>

        {/* ------------------------- モーダル群 ------------------------- */}
        {menu === "inv" && (
          <Overlay onClose={() => { setMenu(null); setPending(null); }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: C.paper, fontWeight: 700 }}>
                {pending && pending.kind === "identify" ? "識別するアイテムを選ぶ" : "持ち物"}
              </span>
              <span style={{ fontSize: 11, color: C.sub }}>{G.inv.length} / {INV_MAX}</span>
            </div>
            {G.inv.length === 0 && <div style={{ padding: 20, color: C.sub, fontSize: 13 }}>何も持っていない。</div>}
            {G.inv.map((it, i) => (
              <button
                key={it.uid + "-" + i}
                onClick={() => onSelectItem(it)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  borderBottom: `1px solid ${C.line}`, padding: "11px 14px", cursor: "pointer",
                }}
              >
                <div style={{ color: C.paper, fontSize: 13, fontWeight: 600 }}>{itemName(G, it)}</div>
                <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{itemInfo(G, it)}</div>
              </button>
            ))}
            <div style={{ padding: 10 }}>
              <Btn onClick={() => { setMenu(null); setPending(null); }} style={{ width: "100%" }}>閉じる</Btn>
            </div>
          </Overlay>
        )}

        {menu === "item" && sel && (
          <Overlay onClose={() => { setMenu("inv"); setSel(null); }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ color: C.paper, fontWeight: 700 }}>{itemName(G, sel)}</div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>{itemInfo(G, sel)}</div>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn tone="primary" onClick={() => runItemAction("use")}>
                {["weapon", "shield", "ring"].includes(ITEMS[sel.id].cat)
                  ? (p.weapon === sel || p.shield === sel || p.ring === sel ? "外す" : "装備する")
                  : ITEMS[sel.id].cat === "food" ? "食べる"
                    : ITEMS[sel.id].cat === "staff" ? "振る"
                      : ITEMS[sel.id].cat === "ammo" ? "投げる" : "使う"}
              </Btn>
              {ITEMS[sel.id].cat !== "ammo" && <Btn onClick={() => runItemAction("throw")}>投げる</Btn>}
              <Btn onClick={() => runItemAction("drop")}>足元に置く</Btn>
              <Btn tone="ghost" onClick={() => { setMenu("inv"); setSel(null); }}>戻る</Btn>
            </div>
          </Overlay>
        )}

        {menu === "dir" && (
          <Overlay onClose={() => { setMenu(null); setPending(null); }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}`, color: C.paper, fontWeight: 700 }}>
              どの向きに？
            </div>
            <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 56px)", gridTemplateRows: "repeat(3, 50px)", gap: 6 }}>
                {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d, i) =>
                  d === -1 ? (
                    <Btn key={i} tone="ghost" onClick={() => { setMenu(null); setPending(null); }} style={{ padding: 0, fontSize: 11 }}>やめる</Btn>
                  ) : (
                    <Btn key={i} onClick={() => chooseDir(d)} style={{ padding: 0, fontSize: 18 }}>{DIR_LABEL[d]}</Btn>
                  )
                )}
              </div>
            </div>
          </Overlay>
        )}

        {menu === "stairs" && (
          <Overlay onClose={() => setMenu(null)}>
            <div style={{ padding: "18px 16px", color: C.paper, fontSize: 14 }}>
              階段だ。地下{G.floor + 1}階へ進む？
            </div>
            <div style={{ padding: 12, display: "flex", gap: 8 }}>
              <Btn tone="primary" onClick={doDescend} style={{ flex: 1 }}>進む</Btn>
              <Btn onClick={() => setMenu(null)} style={{ flex: 1 }}>まだ探索する</Btn>
            </div>
          </Overlay>
        )}

        {menu === "help" && (
          <Overlay onClose={() => setMenu(null)}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}`, color: C.paper, fontWeight: 700 }}>操作方法</div>
            <div style={{ padding: 16, fontSize: 12, color: C.sub, lineHeight: 1.9 }}>
              <b style={{ color: C.paper }}>スマホ</b><br />
              十字パッドで8方向に移動。中央の「足踏」でその場で1ターン待機。<br /><br />
              <b style={{ color: C.paper }}>キーボード</b><br />
              矢印キー / テンキー / hjklyubn で移動、「.」で足踏み、「i」で持ち物、Escで閉じる。<br /><br />
              <b style={{ color: C.paper }}>ルール</b><br />
              ・斜め移動は部屋の中だけ。通路は直進のみ。<br />
              ・敵のいるマスへ進むと攻撃。<br />
              ・草・巻物・杖は未識別。使うか識別の巻物で正体が分かる。<br />
              ・ぬすっとネズミは持ち物を盗んで逃げる。逃げ切られる前に倒せば取り返せる。<br />
              ・腕輪は1つだけ装備できる。矢と石は何本でも1枠にまとまる。<br />
              ・薬草を敵に投げると敵が回復してしまう。
            </div>
            <div style={{ padding: 12 }}>
              <Btn onClick={() => setMenu(null)} style={{ width: "100%" }}>閉じる</Btn>
            </div>
          </Overlay>
        )}

        {(screen === "dead" || screen === "clear") && (
          <Overlay>
            <div style={{ padding: 22, textAlign: "center" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.4em", color: screen === "clear" ? C.gold : C.vermilion }}>
                {screen === "clear" ? "COMPLETE" : "GAME OVER"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.paper, margin: "8px 0 14px" }}>
                {screen === "clear" ? "螺旋を踏破した" : "力尽きた"}
              </div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 2 }}>
                難易度 : <span style={{ color: G.D.color }}>{G.D.name}</span><br />
                到達 : 地下 {G.deepest} 階<br />
                レベル : {p.lv}　撃破 : {G.kills} 体<br />
                経過 : {G.turn} ターン<br />
                シード : {G.seed}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <Btn tone="primary" onClick={() => start(null, G.diffKey)} style={{ flex: 1 }}>もう一度潜る</Btn>
                <Btn onClick={() => start(G.seed, G.diffKey)} style={{ flex: 1 }}>同じ迷宮で</Btn>
              </div>
              <div style={{ marginTop: 8 }}>
                <Btn tone="ghost" onClick={() => { setScreen("title"); setMenu(null); }} style={{ width: "100%" }}>難易度を選び直す</Btn>
              </div>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  );
}

const shell = {
  width: "100%",
  height: "100vh",
  background: C.ink,
  display: "flex",
  justifyContent: "center",
  fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
  color: C.paper,
  userSelect: "none",
};

const panelCol = {
  position: "relative",
  width: "100%",
  maxWidth: 480,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: C.ink,
  overflow: "hidden",
};
