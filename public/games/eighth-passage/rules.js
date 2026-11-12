export const ANOMALIES = [
 {id:'giant',name:'天井に届く男',hint:'歩いてくる人影が、天井に届くほど大きくなっていました。'},
 {id:'backward',name:'後ろ向きの男',hint:'人影が背中を向けたまま、こちらへ歩いていました。'},
 {id:'stare',name:'立ち止まる男',hint:'人影が通路の中央で立ち止まり、こちらを見つめていました。'},
 {id:'red-door',name:'赤い扉',hint:'右側の管理室の扉が、赤く変わっていました。'},
 {id:'inverted',name:'逆さまの広告',hint:'左側のポスターが、すべて上下逆さまになっていました。'},
 {id:'missing',name:'消えた広告',hint:'左側に並んでいたポスターが、すべて消えていました。'},
 {id:'red-light',name:'赤い照明',hint:'通路の照明が、不気味な赤色に変わっていました。'},
 {id:'eyes',name:'見つめる天井',hint:'天井に、大きな目が三つ現れていました。'},
 {id:'footprints',name:'赤い足跡',hint:'通路の床に、赤い足跡が続いていました。'},
 {id:'sign',name:'出口はない',hint:'頭上の案内板に「出口はない」と書かれていました。'},
 {id:'extra-door',name:'三つ目の扉',hint:'通常は二つしかない管理扉が、三つに増えていました。'},
 {id:'red-eyes',name:'赤い視線',hint:'通常は白い人影の目が、赤く光っていました。'},
 {id:'tactile',name:'途切れる誘導',hint:'通路をまっすぐ伸びていた黄色い点字ブロックが、途中で消えていました。'},
 {id:'floating',name:'浮いている男',hint:'人影の両足が床を離れ、宙に浮いていました。'},
 {id:'long-arms',name:'床をこする腕',hint:'人影の腕が異様に伸び、指先が床まで届いていました。'},
 {id:'head-backward',name:'後ろ向きの頭',hint:'こちらへ歩く人影の頭だけが、真後ろを向いていました。'},
 {id:'headless',name:'頭のない人影',hint:'歩いてくる人影に、頭がありませんでした。'},
 {id:'twins',name:'二人目',hint:'いつも一人の人影が、二人並んで歩いていました。'},
 {id:'tiny',name:'小さすぎる人影',hint:'人影が、腰より低い大きさに縮んでいました。'},
 {id:'ceiling-man',name:'天井を歩く人影',hint:'人影が上下逆さまになって、天井を歩いていました。'},
 {id:'tilted-head',name:'折れた首',hint:'人影の頭が、真横へ大きく傾いていました。'},
 {id:'red-tactile',name:'赤い誘導',hint:'黄色いはずの点字ブロックが、赤色に変わっていました。'},
 {id:'floating-posters',name:'壁を離れた広告',hint:'ポスターが壁から離れ、通路の中に浮いていました。'},
 {id:'barrier',name:'封鎖された通路',hint:'通路の途中に、立入禁止のテープが張られていました。'},
 {id:'wall-message',name:'壁からの警告',hint:'右側の壁に、赤い大きな文字で「帰れ」と書かれていました。'},
 {id:'door-eyes',name:'扉の向こうの目',hint:'管理室の扉に、白く光る大きな目が現れていました。'},
 {id:'low-sign',name:'落ちた案内板',hint:'通路の中央に、落下した案内板が立ちはだかっていました。'},
 {id:'floor-hole',name:'底のない穴',hint:'通路の床に、黒く大きな穴が開いていました。'}
];
export class Run {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.stage=0;this.tutorial=true;this.current=null;this.mistakes=0;this.encountered=new Set();this.found=new Set();this.bag=[];this.turns=0;this.normalStreak=0;this.anomalyStreak=0;this.finished=false;}
 next(){
  this.turns++;
  // A guaranteed anomaly after the baseline teaches the core decision without a long random wait.
  const has=this.turns===1 || this.normalStreak>=2 || (this.anomalyStreak<3 && this.random()<.58);
  if(has){if(!this.bag.length){this.bag=ANOMALIES.map(a=>a.id);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}const selected=this.bag.pop();this.current=ANOMALIES.find(a=>a.id===selected);this.normalStreak=0;this.anomalyStreak++;this.encountered.add(this.current.id);}
  else{this.current=null;this.normalStreak++;this.anomalyStreak=0;}
 }
 decide(retreat){
  if(this.finished)return {ignored:true};
  if(this.tutorial){if(retreat)return {blocked:true};this.tutorial=false;this.next();return {baseline:true,correct:true,stage:0};}
  const anomaly=this.current;const correct=retreat===Boolean(anomaly);
  if(correct){this.stage++;if(anomaly)this.found.add(anomaly.id);}else{this.stage=0;this.mistakes++;}
  const result={correct,stage:this.stage,anomaly,retreat,finished:this.stage===8};
  if(result.finished)this.finished=true;else this.next();
  return result;
 }
}
