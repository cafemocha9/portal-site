import React, { useRef, useEffect, useState, useCallback } from "react";

/**
 * BREACH v3 — 逆タワーディフェンス(2ルート・ランダム地形版)
 *
 * v2からの変更点(ユーザー要望):
 * 1. 初期タワーを増やし種類も混成に(単一戦術の初手素通りを封じる)
 * 2. マップをラウンド開始ごとにランダム生成(経路形状・設置枠が毎回変わる)
 * 3. 侵入口を2箇所(レーンA/B)に増設。両ルートは合流点で1本に束ねてコアへ向かう
 *
 * バランス設計の要点(ヘッドレスシミュレーション40マップで検証済み):
 * - 2ルート化は攻撃側に有利(防衛の火力が分散する)ため、初期タワー数と
 *   AIの脅威対応上限を引き上げて相殺した
 * - 防衛AIは「どちらのレーンに脅威が集中しているか」を見て、新設タワーの
 *   設置枠をそのレーン優先で選ぶ(でないと無関係なレーンに増設して無駄になる)
 * - 単一戦術スパム(ラット/バルーン/ハチ/ジャガーノート連打)は0〜3%まで抑制
 * - 隠密集中・分裂系・タンク+シールダーの「デスボール」は25〜50%の勝率を残し、
 *   強力だが確実ではない選択肢として存在(読み合いの余地を残すため意図的)
 * - 防衛網を読んで編成をピボットする適応的プレイは100%勝利を再現
 */

// ============ 座標系 ============
const W = 900, H = 580; // マップを少し縦長に(元520→580)。以下の座標範囲はHに対する比率で算出するため自動追従する

function pathLen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return L;}
function posAt(pts,d){
  let rem=d;
  for(let i=1;i<pts.length;i++){
    const seg=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    if(rem<=seg){const t=rem/seg;return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t, pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];}
    rem-=seg;
  }
  return pts[pts.length-1];
}
function mkRng(seed){let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };}

// ============ ランダム地形生成 ============
// 2本のレーン(A/B)は各自ジグザグに進み、共通の合流点(junction)で1本の道に束ねられ、
// そこからさらに1回ジグザグしてコアへ到達する。合流後の区間は両レーンの脅威が
// 同時に通過するため、天然の「絞り込み」ポイントとして機能する。
function genMap(seed){
  const rng = mkRng(seed);
  const ri = (a,b)=>Math.floor(a+rng()*(b-a+1));
  const core=[840, ri(Math.round(H*0.423), Math.round(H*0.577))];
  const junction=[ri(560,680), ri(Math.round(H*0.346), Math.round(H*0.654))];
  function lane(entryY){
    const entry=[0,entryY];
    const n=ri(2,3);
    const pts=[entry];
    for(let i=1;i<=n;i++){
      const x=Math.round(entry[0]+(junction[0]-entry[0])*i/(n+1));
      let y;
      if(i===1) y=ri(60,H-60);
      else{const py=pts[pts.length-1][1]; const jit=Math.round(160*H/520); y=Math.max(50,Math.min(H-50,py+ri(-jit,jit)));}
      pts.push([x,y]);
    }
    pts.push(junction);
    return pts;
  }
  const gA=lane(ri(Math.round(H*0.135),Math.round(H*0.288))), gB=lane(ri(Math.round(H*0.712),Math.round(H*0.865)));
  const shared=[junction,[Math.round((junction[0]+core[0])/2),ri(200,320)],core];
  const groundA=gA.concat(shared.slice(1));
  const groundB=gB.concat(shared.slice(1));
  const lanes=[
    {ground:groundA, air:[gA[0],core], glen:pathLen(groundA), alen:pathLen([gA[0],core]), entryY:gA[0][1]},
    {ground:groundB, air:[gB[0],core], glen:pathLen(groundB), alen:pathLen([gB[0],core]), entryY:gB[0][1]},
  ];
  // 設置枠: 各経路セグメントの中点から垂直方向にオフセットした点を候補にする
  const raw=[];
  const addFrom=(path)=>{
    for(let i=1;i<path.length;i++){
      const [ax,ay]=path[i-1],[bx,by]=path[i];
      const mx=(ax+bx)/2, my=(ay+by)/2;
      const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1;
      const nx=-dy/L, ny=dx/L;
      for(const off of [36,-36]){
        const x=Math.round(mx+nx*off), y=Math.round(my+ny*off);
        if(x<20||x>W-20||y<20||y>H-20) continue;
        if(raw.some(s=>Math.hypot(s[0]-x,s[1]-y)<44)) continue;
        raw.push([x,y]);
      }
    }
  };
  addFrom(groundA); addFrom(groundB);
  const samplesA=[]; for(let d=0;d<lanes[0].glen;d+=14) samplesA.push(posAt(lanes[0].ground,d));
  const samplesB=[]; for(let d=0;d<lanes[1].glen;d+=14) samplesB.push(posAt(lanes[1].ground,d));
  const covOf=(s,arr)=>arr.reduce((c,p)=>c+(Math.hypot(p[0]-s[0],p[1]-s[1])<=100?1:0),0);
  const slots = raw.map(s=>{
    const covA=covOf(s,samplesA), covB=covOf(s,samplesB);
    return {x:s[0], y:s[1], cov:covA+covB, covA, covB, a:covA>=3, b:covB>=3};
  }).sort((p,q)=>q.cov-p.cov).slice(0,18);
  return {core, junction, lanes, slots};
}

// ============ ユニット定義(攻撃側) ============
const UNITS = {
  rat:      {id:'rat',      name:'ラット',         glyph:'🐭', cost:20,  hp:55,  spd:110, dmg:1,  air:false, stealth:false, desc:'最安。数で処理能力を飽和させる'},
  sprinter: {id:'sprinter', name:'スプリンター',   glyph:'💨', cost:45,  hp:80,  spd:175, dmg:2,  air:false, stealth:false, desc:'最速。射程を素通りして抜ける'},
  splitter: {id:'splitter', name:'スプリッター',   glyph:'🦠', cost:62,  hp:90,  spd:100, dmg:2,  air:false, stealth:false, splitInto:'ratlet', splitCount:2, desc:'撃破時に弱い分裂片2体を残す'},
  tank:     {id:'tank',     name:'タンク',         glyph:'🛡️', cost:90,  hp:650, spd:66,  dmg:4,  air:false, stealth:false, desc:'高耐久。スナイパーの貫通弾に注意'},
  shielder: {id:'shielder', name:'シールダー',     glyph:'🔰', cost:85,  hp:300, spd:62,  dmg:2,  air:false, stealth:false, auraDR:0.25, auraR:70, desc:'周囲の地上味方の被ダメを25%軽減'},
  stealth:  {id:'stealth',  name:'ファントム',     glyph:'👻', cost:65,  hp:130, spd:95,  dmg:3,  air:false, stealth:true,  desc:'レーダー圏を通るまで完全に不可視'},
  balloon:  {id:'balloon',  name:'バルーン',       glyph:'🎈', cost:75,  hp:130, spd:75,  dmg:3,  air:true,  stealth:false, wobble:55, desc:'空路を上下に揺れて進む'},
  bee:      {id:'bee',      name:'ハチ',           glyph:'🐝', cost:35,  hp:60,  spd:130, dmg:1,  air:true,  stealth:false, desc:'安価な空中スウォーム'},
  medic:    {id:'medic',    name:'メディック',     glyph:'⛑️', cost:70,  hp:120, spd:75,  dmg:1,  air:false, stealth:false, healRate:15, healR:70, desc:'周囲を回復(1体につき1人まで)'},
  jugger:   {id:'jugger',   name:'ジャガーノート', glyph:'👹', cost:260, hp:2400,spd:46,  dmg:12, air:false, stealth:false, desc:'移動要塞。コアに12ダメージ'},
  bomber:   {id:'bomber',   name:'ボマー',       glyph:'🧨', cost:95,  hp:150, spd:88,  dmg:2,  air:false, stealth:false, emp:{r:105,dur:3.5}, desc:'撃破時に爆発し周囲のタワーを3.5秒沈黙させる'},
};
const RATLET = {hp:20, spd:105, dmg:1, air:false, stealth:false}; // スプリッターの分裂片(購入不可)
const UNIT_ORDER = ['rat','sprinter','splitter','bomber','tank','shielder','stealth','balloon','bee','medic','jugger'];

// ============ タワー定義(防衛側 = AI) ============
const TOWERS = {
  arrow:  {id:'arrow',  name:'アロー塔',   glyph:'🏹', cost:60,  range:110, dmg:12, interval:0.75, splash:0,  hitsAir:true,  hitsGround:true},
  cannon: {id:'cannon', name:'キャノン砲', glyph:'💣', cost:90,  range:95,  dmg:16, interval:1.1,  splash:62, hitsAir:false, hitsGround:true},
  sniper: {id:'sniper', name:'スナイパー', glyph:'🎯', cost:110, range:200, dmg:80, interval:2.6,  splash:0,  hitsAir:false, hitsGround:true, pierce:0.11},
  frost:  {id:'frost',  name:'フロスト',   glyph:'❄️', cost:80,  range:90,  dmg:3,  interval:0.9,  splash:0,  hitsAir:false, hitsGround:true, slow:0.45, slowDur:1.6},
  radar:  {id:'radar',  name:'レーダー',   glyph:'📡', cost:70,  range:130, dmg:0,  interval:1,    splash:0,  hitsAir:false, hitsGround:false, reveal:true},
  aa:     {id:'aa',     name:'対空砲',     glyph:'🚀', cost:85,  range:140, dmg:26, interval:0.55, splash:0,  hitsAir:true,  hitsGround:false},
  tesla:  {id:'tesla',  name:'テスラ塔',   glyph:'⚡', cost:120, range:105, dmg:20, interval:0.9,  splash:0,  hitsAir:true,  hitsGround:true, chain:3},
  mortar: {id:'mortar', name:'臼砲',       glyph:'🔥', cost:140, range:230, dmg:34, interval:2.0,  splash:80, hitsAir:false, hitsGround:true, minRange:70},
  drain:  {id:'drain',  name:'吸収塔',     glyph:'🌀', cost:100, range:120, dmg:6,  interval:0.8,  splash:0,  hitsAir:false, hitsGround:true, execute:0.04},
};

// ============ 経済・ルール ============
const ECON = {
  coreHp: 60, rounds: 12,
  incomeBase: 200, incomeGrow: 48,
  dmgBonus: 5,
  aiBudgetBase: 120, aiBudgetGrow: 34, aiBudgetAccel: 9,
  maxTowers: 11, sellRefund: 0.7,
  upgradeCost: 80, maxLevel: 3, upgradeDmgMul: 1.35,
  spawnGap: 0.35,
};

// ============ AI 脅威分析 ============
const THREAT_NAME = {swarm:'集団', tank:'重装', stealth:'隠密', air:'空中'};
const COUNTER = {swarm:'cannon', tank:'sniper', stealth:'radar', air:'aa'};
const COUNTER2 = {swarm:'tesla', tank:'drain', stealth:null, air:'tesla'};   // 主対策が飽和した際の第2候補
const COUNTER3 = {swarm:'mortar', tank:'mortar', stealth:null, air:null};    // さらに逼迫した際の第3候補
const THREAT_OF = {cannon:'swarm', sniper:'tank', radar:'stealth', aa:'air', tesla:'swarm', drain:'tank', mortar:'tank'};

function threatProfile(sent, leaked){
  const cnt=(arr,t)=>arr.filter(x=>x===t).length;
  const w=(t)=>cnt(sent,t)+cnt(leaked,t)*2;
  return {
    swarm: w('rat')+w('sprinter')+Math.ceil(w('medic')*0.7)+Math.ceil(w('stealth')*0.8)+w('splitter')*3+w('bomber')*2,
    tank:  w('tank')*2 + w('jugger')*6 + w('medic') + Math.ceil(w('shielder')*1.5),
    stealth: w('stealth')*2,
    air:   w('balloon')*2 + Math.ceil(w('bee')*1.5),
  };
}
function decayMemory(mem, prof){
  const out={};
  for(const k of ['swarm','tank','stealth','air']) out[k]=(mem?.[k]||0)*0.5 + (prof[k]||0);
  return out;
}

function freeSlot(towers, map, laneBias){
  const used=new Set(towers.map(t=>t.slot));
  if(laneBias===0 || laneBias===1){
    const key = laneBias===0 ? 'a' : 'b';
    for(let i=0;i<map.slots.length;i++) if(!used.has(i) && map.slots[i][key]) return i;
  }
  for(let i=0;i<map.slots.length;i++) if(!used.has(i)) return i;
  return -1;
}

function aiAdapt(towers, budget, prof, map, laneBias, log, savings){
  // 沈黙の警戒: 敵の未消費資金が大きい = 一斉投入(ほぼ確実に重装編成)の前兆。
  // 備蓄額に比例して重装脅威を先読み加算し、スナイパー/フロストを予防建設させる。
  // さらに警戒時はAI側も増強予算を確保する(備蓄との予算格差を埋めないと物理的に間に合わないため)。
  const anticip = Math.min(40, Math.floor((savings||0)/70));
  const capBonus = anticip>=3 ? Math.min(4, Math.floor(anticip/6)) : 0;
  const CAP = ECON.maxTowers + capBonus; // 大型侵攻の前兆時は防衛枠を臨時拡張
  if(anticip>=3){
    prof = {...prof, tank:(prof.tank||0)+anticip};
    const emergency = Math.min(700, Math.round((savings||0)*0.34));
    budget.v += emergency;
    log?.push(`◈ 敵の資金備蓄(推定$${Math.round(savings)})を検知 → 増強予算+$${emergency}で大型侵攻に備える`);
  }
  const order=Object.entries(prof).sort((a,b)=>b[1]-a[1]);
  const count=(ty)=>towers.filter(t=>t.type===ty).length;
  const relevance=(t)=>{
    if(t.type==='arrow'||t.type==='frost') return 1+t.level;
    return (prof[THREAT_OF[t.type]]||0)*2 + t.level;
  };
  const sellWorst=(protect)=>{
    const cands=towers.filter(t=>t.type!==protect).sort((a,b)=>relevance(a)-relevance(b));
    if(!cands.length) return false;
    const v=cands[0];
    const refund=Math.round((TOWERS[v.type].cost+(v.level-1)*ECON.upgradeCost)*ECON.sellRefund);
    budget.v+=refund;
    towers.splice(towers.indexOf(v),1);
    log?.push(`◌ ${TOWERS[v.type].name}を撤去(資材${refund}回収)`);
    return true;
  };
  for(const [threat,score] of order){
    if(score<=0) continue;
    // 主対策 → 上限に達したら第2・第3の対策塔へ回す(単一塔種の飽和で対応が止まるのを防ぐ)
    const tiers=[[COUNTER[threat], COUNTER[threat]==='radar'?3:5],[COUNTER2[threat],3],[COUNTER3[threat],2]];
    for(const [cty,want] of tiers){
      if(!cty) continue;
      while(count(cty)<want && budget.v>=TOWERS[cty].cost){
        if(towers.length>=CAP){ if(!sellWorst(cty)) break; if(towers.length>=CAP) break; }
        const s=freeSlot(towers,map,laneBias); if(s<0) break;
        towers.push({type:cty, slot:s, level:1, justBuilt:true});
        budget.v-=TOWERS[cty].cost;
        log?.push(`⚠ ${THREAT_NAME[threat]}圧力 ${Math.round(score)}pt を検知 → ${TOWERS[cty].name}を建設`);
      }
    }
  }
  if((prof.tank||0)>=6){
    const fwant=Math.min(2, Math.floor(prof.tank/8));
    while(towers.filter(t=>t.type==='frost').length<fwant && budget.v>=TOWERS.frost.cost){
      if(towers.length>=CAP){ if(!sellWorst('frost')) break; if(towers.length>=CAP) break; }
      const s=freeSlot(towers,map,laneBias); if(s<0) break;
      towers.push({type:'frost', slot:s, level:1, justBuilt:true});
      budget.v-=TOWERS.frost.cost;
      log?.push(`⚠ 重装の足止めにフロストを建設`);
    }
  }
  let guard=0;
  while(budget.v>=ECON.upgradeCost && guard++<20){
    // 強化は「現在の脅威に対応する塔」を優先(関連度降順、同点なら低レベル優先)
    const up=towers.filter(t=>t.level<ECON.maxLevel && !TOWERS[t.type].reveal)
      .sort((a,b)=>{const ra=relevance(a),rb=relevance(b);return rb!==ra?rb-ra:a.level-b.level;})[0];
    if(!up) break;
    up.level++; budget.v-=ECON.upgradeCost;
    log?.push(`▲ ${TOWERS[up.type].name}を強化 → Lv${up.level}`);
  }
  while(budget.v>=TOWERS.arrow.cost && towers.length<ECON.maxTowers){
    const s=freeSlot(towers,map,laneBias); if(s<0) break;
    towers.push({type:'arrow', slot:s, level:1, justBuilt:true});
    budget.v-=TOWERS.arrow.cost;
    log?.push(`+ 汎用防衛としてアロー塔を建設`);
  }
}

// 初期配置: 高カバレッジ枠に各脅威への対策を1つずつ、かつ両レーンへ分散して設置。
// レーダーは必ず片方だけでなく両レーンに1基ずつ確保する(「片方が無警戒」を防ぐ)。
function initTowers(map){
  const S=map.slots; const used=new Set(); const t=[];
  const take=(pred,type,lvl)=>{
    for(let i=0;i<S.length;i++){ if(used.has(i)) continue; if(pred(S[i])){ used.add(i); t.push({type,slot:i,level:lvl}); return true; } }
    return false;
  };
  const both=s=>s.a&&s.b, onlyA=s=>s.a&&!s.b, onlyB=s=>s.b&&!s.a, any=()=>true;
  take(onlyA,'radar',1)||take(both,'radar',1)||take(any,'radar',1);
  take(onlyB,'radar',1)||take(any,'radar',1);
  take(both,'sniper',1)||take(any,'sniper',1);
  take(onlyA,'cannon',1)||take(any,'cannon',1);
  take(onlyB,'aa',1)||take(any,'aa',1);
  take(onlyA,'arrow',2)||take(any,'arrow',2);
  take(onlyB,'arrow',2)||take(any,'arrow',2);
  return t;
}

// ============ メインコンポーネント ============
export default function BreachTD(){
  const stateRef = useRef(null);
  const [, forceRender] = useState(0);
  const [phase, setPhase] = useState('title');
  const [speed, setSpeed] = useState(1);
  const [lane, setLane] = useState(0); // 現在の出撃先レーン(0=A, 1=B)
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const speedRef = useRef(1);
  speedRef.current = speed;

  const initGame = useCallback(()=>{
    const map = genMap(Math.floor(Math.random()*1e9));
    stateRef.current = {
      map,
      round: 1,
      coreHp: ECON.coreHp,
      money: ECON.incomeBase,
      towers: initTowers(map),
      aiMem: null,
      queue: [],
      units: [],
      spawnIdx: 0, spawnT: 0,
      cds: [],
      beams: [], booms: [],
      roundDmg: 0, roundLeaked: [], roundSent: [],
      aiLog: [{r:0, lines:['防衛AI起動。2レーンに混成防衛網を初期配置。','あなたの編成とレーン選択を毎ラウンド分析する。']}],
      lastResult: null,
      totalDmgHist: [],
    };
    setLane(0);
    setPhase('plan');
    forceRender(n=>n+1);
  },[]);

  // ---------- 編成操作 ----------
  const queueCost = ()=> stateRef.current ? stateRef.current.queue.reduce((s,q)=>s+UNITS[q.id].cost,0) : 0;
  const addUnit = (id)=>{
    const st=stateRef.current;
    if(queueCost()+UNITS[id].cost > st.money) return;
    st.queue.push({id, lane}); forceRender(n=>n+1);
  };
  const removeUnit = (idx)=>{ stateRef.current.queue.splice(idx,1); forceRender(n=>n+1); };

  // ---------- 出撃 ----------
  const launch = ()=>{
    const st=stateRef.current;
    if(st.queue.length===0) return;
    st.money -= queueCost();
    st.units=[]; st.spawnIdx=0; st.spawnT=0;
    st.cds = st.towers.map(()=>0);
    st.beams=[]; st.booms=[];
    st.roundDmg=0; st.roundLeaked=[]; st.roundSent=st.queue.slice();
    st.towers.forEach(t=>{t.justBuilt=false; t.empT=0;});
    setPhase('battle');
  };

  // ---------- 戦闘ループ ----------
  useEffect(()=>{
    if(phase!=='battle') return;
    let last=performance.now();
    let renderAcc=0;
    const loop=(now)=>{
      const rawDt=Math.min((now-last)/1000, 0.05);
      last=now;
      const st=stateRef.current;
      const steps = speedRef.current;
      for(let s=0;s<steps;s++) stepBattle(st, rawDt);
      renderAcc+=rawDt;
      draw();
      if(renderAcc>0.033){renderAcc=0;forceRender(n=>n+1);}
      if(st.coreHp<=0){ endRound(true); return; }
      if(st.spawnIdx>=st.queue.length && st.units.length===0){ endRound(false); return; }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase]);

  function stepBattle(st, dt){
    const map=st.map;
    st.spawnT-=dt;
    while(st.spawnIdx<st.queue.length && st.spawnT<=0){
      const q=st.queue[st.spawnIdx];
      const def=UNITS[q.id];
      st.units.push({type:q.id, lane:q.lane, hp:def.hp, maxHp:def.hp, d:0, slowT:0, marked:false});
      st.spawnIdx++; st.spawnT+=ECON.spawnGap;
    }
    const radars=st.towers.filter(t=>t.type==='radar');
    for(const u of st.units){
      const def=UNITS[u.type]||RATLET;
      const ln=map.lanes[u.lane];
      const p=posAt(def.air?ln.air:ln.ground, u.d);
      u.x=p[0]; u.y=p[1];
      if(def.wobble) u.y += Math.sin(u.d/60)*def.wobble;
      if(!def.stealth){u.revealed=true;}
      else if(!u.marked){
        if(radars.some(r=>Math.hypot(map.slots[r.slot].x-u.x, map.slots[r.slot].y-u.y)<=TOWERS.radar.range)) u.marked=true;
        u.revealed=u.marked;
      } else u.revealed=true;
    }
    const healed=new Set();
    for(const m of st.units){
      const md=UNITS[m.type];
      if(!md?.healRate) continue;
      for(const u of st.units){
        if(u!==m && u.hp>0 && !healed.has(u) && Math.hypot(u.x-m.x,u.y-m.y)<=md.healR){
          u.hp=Math.min(u.maxHp, u.hp+md.healRate*dt);
          healed.add(u);
        }
      }
    }
    for(const u of st.units) u.dr=0;
    for(const sh of st.units){
      const sd=UNITS[sh.type];
      if(!sd?.auraDR) continue;
      for(const u of st.units){
        const ud=UNITS[u.type]||RATLET;
        if(u!==sh && !ud.air && u.dr===0 && Math.hypot(u.x-sh.x,u.y-sh.y)<=sd.auraR) u.dr=sd.auraDR;
      }
    }
    st.towers.forEach((tw,i)=>{
      st.cds[i]-=dt;
      if(tw.empT>0){tw.empT-=dt; return;} // ボマーのEMPで沈黙中
      if(st.cds[i]>0) return;
      const def=TOWERS[tw.type];
      if(def.reveal) return;
      const dmg=def.dmg*Math.pow(ECON.upgradeDmgMul, tw.level-1);
      const {x:tx,y:ty}=map.slots[tw.slot];
      let best=null;
      for(const u of st.units){
        if(u.hp<=0) continue;
        const ud=UNITS[u.type]||RATLET;
        if(ud.air && !def.hitsAir) continue;
        if(!ud.air && !def.hitsGround) continue;
        if(!u.revealed) continue;
        const dist=Math.hypot(u.x-tx,u.y-ty);
        if(dist>def.range) continue;
        if(def.minRange && dist<def.minRange) continue;
        if(!best||u.d>best.d) best=u;
      }
      if(!best) return;
      st.cds[i]=def.interval;
      const beamColor = tw.type==='sniper'?'#FF5A4E' : tw.type==='frost'?'#8FD8FF' : tw.type==='aa'?'#FFD166' : '#CFE6FF';
      st.beams.push({x1:tx,y1:ty,x2:best.x,y2:best.y,t:0.12,color:beamColor});
      if(def.splash>0){
        st.booms.push({x:best.x,y:best.y,t:0.25,r:def.splash});
        for(const u of st.units){
          const ud=UNITS[u.type]||RATLET;
          if(u.hp<=0||ud.air) continue;
          if(Math.hypot(u.x-best.x,u.y-best.y)<=def.splash) u.hp-=dmg*(1-(u.dr||0));
        }
      }else{
        let base=dmg*(1-(best.dr||0));
        if(def.pierce) base+=best.maxHp*def.pierce;
        if(def.execute) base+=best.maxHp*def.execute; // 吸収塔: 最大HP比例の追加ダメージ
        best.hp-=base;
        if(def.slow){best.slowT=def.slowDur; best.slowMul=1-def.slow;}
        if(def.chain){ // テスラ塔: 近傍へ減衰しつつ連鎖
          let src2=best, hit=new Set([best]), cd=base*0.6;
          for(let c=1;c<def.chain;c++){
            let nxt=null,bd=1e9;
            for(const u of st.units){
              if(u.hp<=0||hit.has(u))continue;
              const ud=UNITS[u.type]||RATLET;
              if(ud.air&&!def.hitsAir)continue;
              if(!ud.air&&!def.hitsGround)continue;
              if(!u.revealed)continue;
              const dd=Math.hypot(u.x-src2.x,u.y-src2.y);
              if(dd<=90&&dd<bd){bd=dd;nxt=u;}
            }
            if(!nxt)break;
            nxt.hp-=cd*(1-(nxt.dr||0));
            st.beams.push({x1:src2.x,y1:src2.y,x2:nxt.x,y2:nxt.y,t:0.12,color:'#B98FFF'});
            hit.add(nxt); src2=nxt; cd*=0.6;
          }
        }
      }
    });
    st.beams=st.beams.filter(b=>(b.t-=dt)>0);
    st.booms=st.booms.filter(b=>(b.t-=dt)>0);
    const next=[]; const spawned=[];
    for(const u of st.units){
      if(u.hp<=0){
        const ud=UNITS[u.type];
        if(ud?.emp){ // ボマー: 周囲のタワーを一定時間沈黙させる
          for(const tw of st.towers){
            const s=map.slots[tw.slot];
            if(Math.hypot(s.x-u.x,s.y-u.y)<=ud.emp.r) tw.empT=Math.max(tw.empT||0, ud.emp.dur);
          }
          st.booms.push({x:u.x,y:u.y,t:0.4,r:ud.emp.r});
        }
        if(ud?.splitInto){
          for(let k=0;k<ud.splitCount;k++){
            spawned.push({type:'ratlet', lane:u.lane, hp:RATLET.hp, maxHp:RATLET.hp, d:u.d+k*8, slowT:0, marked:false});
          }
          st.booms.push({x:u.x,y:u.y,t:0.2,r:20});
        }
        continue;
      }
      const def=UNITS[u.type]||RATLET;
      let spd=def.spd;
      if(u.slowT>0){u.slowT-=dt; spd*=u.slowMul||1;}
      u.d+=spd*dt;
      const ln=map.lanes[u.lane];
      const L=def.air?ln.alen:ln.glen;
      if(u.d>=L){
        st.coreHp=Math.max(0, st.coreHp-def.dmg);
        st.roundDmg+=def.dmg;
        st.roundLeaked.push(u.type);
        st.booms.push({x:map.core[0],y:map.core[1],t:0.35,r:34});
        continue;
      }
      next.push(u);
    }
    st.units=next.concat(spawned);
  }

  // ---------- ラウンド終了処理 ----------
  function endRound(coreDestroyed){
    const st=stateRef.current;
    const earned=st.roundDmg*ECON.dmgBonus;
    st.money+=earned;
    st.totalDmgHist.push(st.roundDmg);
    st.lastResult={dmg:st.roundDmg, earned, leaked:st.roundLeaked.length, sent:st.roundSent.length};
    st.queue=[];
    if(coreDestroyed){ setPhase('win'); forceRender(n=>n+1); return; }

    const sentTypes = st.roundSent.map(q=>q.id);
    const prof=threatProfile(sentTypes, st.roundLeaked);
    st.aiMem=decayMemory(st.aiMem, prof);
    const laneCount=[0,0]; for(const q of st.roundSent) laneCount[q.lane]++;
    const laneBias = laneCount[0]===laneCount[1] ? null : (laneCount[0]>laneCount[1] ? 0 : 1);
    const budget={v:ECON.aiBudgetBase+ECON.aiBudgetGrow*(st.round-1)+(ECON.aiBudgetAccel||0)*(st.round-1)*(st.round-1)};
    const lines=[];
    aiAdapt(st.towers, budget, st.aiMem, st.map, laneBias, lines, st.money);
    if(lines.length===0) lines.push('現行の防衛配置を維持。');
    if(laneBias!==null) lines.unshift(`分析: レーン${laneBias===0?'A':'B'}への集中を検知。`);
    st.aiLog.unshift({r:st.round, lines});
    if(st.aiLog.length>6) st.aiLog.pop();

    if(st.round>=ECON.rounds){ setPhase('lose'); forceRender(n=>n+1); return; }
    st.round++;
    st.money+=ECON.incomeBase+ECON.incomeGrow*(st.round-1);
    setPhase('result');
    forceRender(n=>n+1);
  }

  // ---------- 描画 ----------
  const draw = useCallback(()=>{
    const cv=canvasRef.current; if(!cv) return;
    const ctx=cv.getContext('2d');
    const st=stateRef.current; if(!st) return;
    const map=st.map;
    ctx.clearRect(0,0,W,H);

    ctx.strokeStyle='rgba(160,195,235,0.08)'; ctx.lineWidth=1;
    for(let x=0;x<=W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    const laneColor=['rgba(207,230,255,0.7)', 'rgba(255,178,94,0.7)'];
    const laneFill=['rgba(159,193,232,0.55)', 'rgba(255,178,94,0.35)'];

    // 空路(両レーン、破線)
    map.lanes.forEach((ln,i)=>{
      ctx.strokeStyle = i===0?'rgba(207,230,255,0.25)':'rgba(255,178,94,0.25)';
      ctx.setLineDash([8,10]); ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(ln.air[0][0],ln.air[0][1]); ctx.lineTo(ln.air[1][0],ln.air[1][1]); ctx.stroke();
    });
    ctx.setLineDash([]);

    // 地上経路(両レーン)
    map.lanes.forEach((ln,i)=>{
      ctx.strokeStyle=laneFill[i]; ctx.lineWidth=24; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.globalAlpha=0.22;
      ctx.beginPath(); ctx.moveTo(ln.ground[0][0],ln.ground[0][1]);
      for(let k=1;k<ln.ground.length;k++) ctx.lineTo(ln.ground[k][0],ln.ground[k][1]);
      ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=laneColor[i]; ctx.lineWidth=1.5; ctx.setLineDash([2,6]);
      ctx.beginPath(); ctx.moveTo(ln.ground[0][0],ln.ground[0][1]);
      for(let k=1;k<ln.ground.length;k++) ctx.lineTo(ln.ground[k][0],ln.ground[k][1]);
      ctx.stroke(); ctx.setLineDash([]);
    });

    // 侵入口ラベル
    ctx.font='bold 12px ui-monospace, monospace'; ctx.textAlign='left';
    ctx.fillStyle='#CFE6FF'; ctx.fillText('▶ 侵入口A', 6, map.lanes[0].entryY-8);
    ctx.fillStyle='#FFB25E'; ctx.fillText('▶ 侵入口B', 6, map.lanes[1].entryY-8);
    // 合流点マーカー
    ctx.strokeStyle='rgba(207,230,255,0.4)'; ctx.lineWidth=1.5; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.arc(map.junction[0],map.junction[1],14,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(207,230,255,0.5)'; ctx.font='10px ui-monospace, monospace'; ctx.textAlign='center';
    ctx.fillText('合流点', map.junction[0], map.junction[1]-20);

    // 空きスロット
    const used=new Set(st.towers.map(t=>t.slot));
    ctx.strokeStyle='rgba(159,193,232,0.25)'; ctx.setLineDash([3,4]);
    map.slots.forEach((s,i)=>{ if(used.has(i)) return; ctx.beginPath(); ctx.arc(s.x,s.y,10,0,Math.PI*2); ctx.stroke(); });
    ctx.setLineDash([]);

    // タワー
    for(const tw of st.towers){
      const s=map.slots[tw.slot];
      const def=TOWERS[tw.type];
      ctx.strokeStyle = tw.type==='radar' ? 'rgba(126,240,196,0.25)' : 'rgba(159,193,232,0.14)';
      ctx.setLineDash(tw.type==='radar'?[4,4]:[]);
      ctx.beginPath(); ctx.arc(s.x,s.y,def.range,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = tw.justBuilt ? '#FFD166' : 'rgba(207,230,255,0.5)';
      ctx.fillStyle = 'rgba(18,44,84,0.9)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(s.x,s.y,14,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.font='17px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      if(tw.empT>0) ctx.globalAlpha=0.35; // EMP沈黙中は減光
      ctx.fillText(def.glyph, s.x, s.y+1);
      ctx.globalAlpha=1;
      ctx.textBaseline='alphabetic';
      if(tw.empT>0){ ctx.fillStyle='#B98FFF'; ctx.font='bold 11px ui-monospace, monospace'; ctx.fillText('⚡沈黙', s.x, s.y-21); }
      ctx.fillStyle='#FFD166';
      for(let l=0;l<tw.level;l++){ctx.beginPath();ctx.arc(s.x-8+l*8,s.y+20,2.4,0,Math.PI*2);ctx.fill();}
      if(tw.justBuilt){ ctx.fillStyle='#FFD166'; ctx.font='bold 10px ui-monospace, monospace'; ctx.textAlign='center'; ctx.fillText('新設', s.x, s.y-20); }
    }

    // コア
    const [cx,cy]=map.core;
    ctx.strokeStyle='#FF5A4E'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#FF5A4E'; ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fill();
    ctx.font='bold 12px ui-monospace, monospace'; ctx.textAlign='center';
    ctx.fillText('CORE', cx, cy+38);

    for(const b of st.booms){
      ctx.strokeStyle=`rgba(255,178,94,${b.t*3})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r*(1-b.t*2.5+0.4),0,Math.PI*2); ctx.stroke();
    }
    for(const b of st.beams){
      ctx.strokeStyle=b.color; ctx.globalAlpha=Math.min(1,b.t*10); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(b.x1,b.y1); ctx.lineTo(b.x2,b.y2); ctx.stroke();
      ctx.globalAlpha=1;
    }

    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const u of st.units){
      const def=UNITS[u.type]||RATLET;
      const glyph = UNITS[u.type]?def.glyph:'🐁';
      const alpha = def.stealth && !u.revealed ? 0.45 : 1;
      ctx.globalAlpha=alpha;
      ctx.font = (u.type==='jugger') ? '26px serif' : '18px serif';
      ctx.fillText(glyph, u.x, u.y - (def.air?26:0));
      const w=u.type==='jugger'?30:18;
      const yy=u.y-(def.air?26:0)-15;
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(u.x-w/2,yy,w,3.5);
      ctx.fillStyle= u.hp/u.maxHp>0.4 ? '#7EF0C4' : '#FF6A3D';
      ctx.fillRect(u.x-w/2,yy,w*Math.max(0,u.hp/u.maxHp),3.5);
      if(u.slowT>0){ctx.fillStyle='#8FD8FF';ctx.font='9px serif';ctx.fillText('❄',u.x+12,u.y-12);}
      if(def.stealth&&u.marked){ctx.fillStyle='#FF5A4E';ctx.font='9px ui-monospace';ctx.fillText('◉',u.x+12,u.y-12);}
      ctx.globalAlpha=1;
    }
    ctx.textBaseline='alphabetic';
  },[]);

  useEffect(()=>{ if(phase==='plan'||phase==='result') draw(); },[phase,draw]);

  const st=stateRef.current;

  // ============ UI ============
  const S = {
    bg:'#12294F', panel:'#0E2244', panelLine:'rgba(159,193,232,0.22)',
    ink:'#CFE6FF', dim:'#7E9CC6', orange:'#FF6A3D', amber:'#FFB25E', red:'#FF5A4E', green:'#7EF0C4', blue:'#8FBFFF',
  };

  const Btn = ({onClick,disabled,children,primary,style})=>(
    <button onClick={onClick} disabled={disabled}
      style={{
        padding:'10px 18px', fontFamily:'ui-monospace, monospace', fontWeight:700, fontSize:14,
        background: primary ? S.orange : 'transparent',
        color: primary ? '#12294F' : S.ink,
        border:`1.5px solid ${primary?S.orange:S.panelLine}`,
        borderRadius:4, cursor:disabled?'default':'pointer', opacity:disabled?0.4:1,
        letterSpacing:'0.06em', ...style,
      }}>{children}</button>
  );

  if(phase==='title'){
    return (
      <div style={{minHeight:'100vh',background:S.bg,color:S.ink,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'ui-monospace, monospace',padding:20}}>
        <div style={{maxWidth:560,textAlign:'center'}}>
          <div style={{fontSize:12,letterSpacing:'0.4em',color:S.amber}}>逆タワーディフェンス</div>
          <h1 style={{fontSize:56,margin:'8px 0 4px',letterSpacing:'0.12em',color:'#fff'}}>BREACH</h1>
          <div style={{fontSize:13,color:S.dim,marginBottom:28}}>2方向から、防衛網を読み、裏をかけ。</div>
          <div style={{textAlign:'left',border:`1px solid ${S.panelLine}`,borderRadius:6,padding:'18px 20px',fontSize:13,lineHeight:2,background:S.panel}}>
            <div><span style={{color:S.blue}}>■</span> 侵入口は<b>2箇所(レーンA/B)</b>。両ルートは合流点で1本に束ねてコアへ向かう。</div>
            <div><span style={{color:S.orange}}>■</span> {ECON.rounds}ラウンド以内にコア(HP{ECON.coreHp})を破壊すれば勝利。</div>
            <div><span style={{color:S.amber}}>■</span> 防衛AIは編成と<b>集中レーン</b>を毎ラウンド分析し、対応する枠に増設する。</div>
            <div><span style={{color:S.green}}>■</span> 地形は対戦ごとにランダム生成。同じ戦術が常に通るとは限らない。</div>
          </div>
          <div style={{marginTop:28}}><Btn primary onClick={initGame}>作戦開始</Btn></div>
        </div>
      </div>
    );
  }

  const cost=queueCost();
  const towerCounts = st ? Object.keys(TOWERS).map(ty=>({ty, n:st.towers.filter(t=>t.type===ty).length})).filter(o=>o.n>0) : [];

  return (
    <div style={{minHeight:'100vh',background:S.bg,color:S.ink,fontFamily:'ui-monospace, monospace',padding:'10px 12px 28px'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>

        <div style={{display:'flex',alignItems:'baseline',gap:14,flexWrap:'wrap',marginBottom:8}}>
          <span style={{fontSize:20,fontWeight:800,letterSpacing:'0.15em',color:'#fff'}}>BREACH</span>
          <span style={{fontSize:12,color:S.dim}}>ROUND</span>
          <span style={{fontSize:18,color:S.amber,fontWeight:700}}>{st.round}<span style={{fontSize:12,color:S.dim}}> / {ECON.rounds}</span></span>
          <span style={{fontSize:12,color:S.dim,marginLeft:'auto'}}>資金</span>
          <span style={{fontSize:18,color:S.green,fontWeight:700}}>${st.money - (phase==='plan'?cost:0)}</span>
        </div>

        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:S.dim,marginBottom:3}}>
            <span>敵コア HP</span><span style={{color:S.red,fontWeight:700}}>{st.coreHp} / {ECON.coreHp}</span>
          </div>
          <div style={{height:8,background:'rgba(0,0,0,0.4)',borderRadius:3,overflow:'hidden',border:`1px solid ${S.panelLine}`}}>
            <div style={{height:'100%',width:`${st.coreHp/ECON.coreHp*100}%`,background:`linear-gradient(90deg, ${S.red}, ${S.orange})`,transition:'width 0.3s'}}/>
          </div>
        </div>

        <div style={{border:`1px solid ${S.panelLine}`,borderRadius:6,overflow:'hidden',background:S.panel}}>
          <div style={{position:'relative'}}>
            <canvas ref={canvasRef} width={W} height={H} style={{width:'100%',display:'block'}}/>
            {phase==='battle' && (
              <div style={{position:'absolute',top:8,right:8,display:'flex',gap:6}}>
                {[1,2,4].map(x=>(
                  <button key={x} onClick={()=>setSpeed(x)}
                    style={{padding:'4px 10px',fontSize:12,fontFamily:'inherit',fontWeight:700,borderRadius:3,cursor:'pointer',
                      background:speed===x?S.amber:'rgba(0,0,0,0.4)',color:speed===x?'#12294F':S.ink,border:`1px solid ${S.panelLine}`}}>
                    ×{x}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{padding:'7px 10px',fontSize:11,color:S.dim,borderTop:`1px solid ${S.panelLine}`,background:'rgba(14,34,68,0.6)'}}>
            防衛網: {towerCounts.map(o=>`${TOWERS[o.ty].glyph}×${o.n}`).join(' ')} <span style={{color:S.dim}}>({st.towers.length}/{ECON.maxTowers}基)</span>
          </div>
        </div>

        {phase==='result' && st.lastResult && (
          <div style={{marginTop:10,border:`1px solid ${S.amber}`,borderRadius:6,padding:'12px 16px',background:'rgba(255,178,94,0.06)',fontSize:13}}>
            <b style={{color:S.amber}}>ROUND {st.round-1} 完了</b> — 
            突破 <b style={{color:S.orange}}>{st.lastResult.leaked}</b>/{st.lastResult.sent}体 / 
            コアに <b style={{color:S.red}}>{st.lastResult.dmg}</b> ダメージ / 
            報酬 <b style={{color:S.green}}>+${st.lastResult.earned}</b> + 収入 <b style={{color:S.green}}>+${ECON.incomeBase+ECON.incomeGrow*(st.round-1)}</b>
            <div style={{marginTop:8}}><Btn primary onClick={()=>setPhase('plan')}>次の編成へ</Btn></div>
          </div>
        )}

        {(phase==='win'||phase==='lose') && (
          <div style={{marginTop:10,border:`1.5px solid ${phase==='win'?S.green:S.red}`,borderRadius:6,padding:'20px 22px',textAlign:'center',
            background:phase==='win'?'rgba(126,240,196,0.06)':'rgba(255,90,78,0.06)'}}>
            <div style={{fontSize:30,fontWeight:800,letterSpacing:'0.2em',color:phase==='win'?S.green:S.red}}>
              {phase==='win'?'BREACH 成功':'作戦失敗'}
            </div>
            <div style={{fontSize:13,color:S.dim,margin:'8px 0 14px'}}>
              {phase==='win'
                ? `${st.round} ラウンドで敵コアを破壊した。2方向作戦で防衛AIの裏をかいた。`
                : `${ECON.rounds} ラウンド経過。コアの残りHPは ${st.coreHp}。`}
              <br/>ラウンド別与ダメージ: {st.totalDmgHist.join(' → ')||'—'}
            </div>
            <Btn primary onClick={initGame}>再挑戦(新しい地形)</Btn>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:10,marginTop:10}}>

          {phase==='plan' && (
            <div style={{border:`1px solid ${S.panelLine}`,borderRadius:6,padding:'12px 14px',background:S.panel}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
                <b style={{fontSize:13,letterSpacing:'0.1em'}}>編成 — タップで追加</b>
                <span style={{fontSize:12,color:S.dim}}>使用 <b style={{color:S.amber}}>${cost}</b> / ${st.money}</span>
              </div>

              {/* レーン選択 */}
              <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
                <span style={{fontSize:11,color:S.dim}}>出撃先:</span>
                <button onClick={()=>setLane(0)}
                  style={{padding:'6px 14px',fontSize:12,fontWeight:700,borderRadius:4,cursor:'pointer',fontFamily:'inherit',
                    background:lane===0?S.blue:'transparent', color:lane===0?'#12294F':S.blue, border:`1.5px solid ${S.blue}`}}>
                  レーンA
                </button>
                <button onClick={()=>setLane(1)}
                  style={{padding:'6px 14px',fontSize:12,fontWeight:700,borderRadius:4,cursor:'pointer',fontFamily:'inherit',
                    background:lane===1?S.amber:'transparent', color:lane===1?'#12294F':S.amber, border:`1.5px solid ${S.amber}`}}>
                  レーンB
                </button>
                <span style={{fontSize:10.5,color:S.dim,marginLeft:4}}>両方に送ると防衛の火力が分散する</span>
              </div>

              <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6}}>
                {UNIT_ORDER.map(id=>{
                  const u=UNITS[id];
                  const afford = cost+u.cost<=st.money;
                  return (
                    <button key={id} onClick={()=>addUnit(id)} disabled={!afford}
                      style={{minWidth:118,textAlign:'left',padding:'8px 10px',borderRadius:5,cursor:afford?'pointer':'default',
                        background:'rgba(0,0,0,0.25)',border:`1px solid ${afford?S.panelLine:'rgba(159,193,232,0.08)'}`,
                        color:S.ink,opacity:afford?1:0.4,fontFamily:'inherit',flexShrink:0}}>
                      <div style={{fontSize:18}}>{u.glyph} <b style={{fontSize:12}}>{u.name}</b></div>
                      <div style={{fontSize:11,color:S.amber,fontWeight:700}}>${u.cost}</div>
                      <div style={{fontSize:10,color:S.dim,lineHeight:1.5}}>HP{u.hp} 速{u.spd} コア{u.dmg}</div>
                      <div style={{fontSize:10,color:S.dim,lineHeight:1.4,marginTop:2}}>{u.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{marginTop:8,minHeight:34,display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',
                border:`1px dashed ${S.panelLine}`,borderRadius:5,padding:'6px 8px'}}>
                {st.queue.length===0 && <span style={{fontSize:12,color:S.dim}}>出撃キュー(タップで外す。色でレーンを表示)</span>}
                {st.queue.map((q,i)=>(
                  <button key={i} onClick={()=>removeUnit(i)}
                    style={{fontSize:16,padding:'2px 6px',background: q.lane===0?'rgba(143,191,255,0.15)':'rgba(255,178,94,0.15)',
                      border:`1px solid ${q.lane===0?S.blue:S.amber}`, borderRadius:4,cursor:'pointer'}}>
                    {UNITS[q.id].glyph}
                  </button>
                ))}
              </div>

              <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <Btn primary onClick={launch} disabled={st.queue.length===0}>出撃({st.queue.length}体)</Btn>
                <Btn onClick={()=>{st.queue=[];forceRender(n=>n+1);}} disabled={st.queue.length===0}>クリア</Btn>
                <span style={{fontSize:11,color:S.dim,marginLeft:'auto'}}>
                  A:{st.queue.filter(q=>q.lane===0).length} / B:{st.queue.filter(q=>q.lane===1).length}
                </span>
              </div>
            </div>
          )}

          <div style={{border:`1px solid ${S.panelLine}`,borderRadius:6,padding:'12px 14px',background:S.panel}}>
            <b style={{fontSize:13,letterSpacing:'0.1em',color:S.red}}>▍防衛AI 思考ログ</b>
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
              {st.aiLog.map((entry,i)=>(
                <div key={i} style={{fontSize:12,lineHeight:1.8,opacity:i===0?1:0.55,
                  borderLeft:`2px solid ${i===0?S.red:S.panelLine}`,paddingLeft:10}}>
                  <div style={{color:S.dim,fontSize:10}}>{entry.r===0?'初期化':`ROUND ${entry.r} 分析`}</div>
                  {entry.lines.map((l,j)=><div key={j}>{l}</div>)}
                </div>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:10.5,color:S.dim,lineHeight:1.8,borderTop:`1px solid ${S.panelLine}`,paddingTop:8}}>
              対応表: 集団→キャノン砲 / 重装→スナイパー(貫通あり)/ 隠密→レーダー(永続マーキング)/ 空中→対空砲。
              片方のレーンに集中すると、AIはそのレーン側の枠を優先して増設する。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
