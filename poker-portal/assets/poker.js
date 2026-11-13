const SUITS = ['s','h','d','c'];
const SYM   = {s:'♠', h:'♥', d:'♦', c:'♣'};
const RCHR  = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',
               10:'10',11:'J',12:'Q',13:'K',14:'A'};
const RNAME = {2:'двоек',3:'троек',4:'четвёрок',5:'пятёрок',6:'шестёрок',
               7:'семёрок',8:'восьмёрок',9:'девяток',10:'десяток',
               11:'валетов',12:'дам',13:'королей',14:'тузов'};

function makeDeck(){
  const d=[];
  for(const s of SUITS) for(let r=2;r<=14;r++) d.push({rank:r,suit:s});
  return d;
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

// старшая карта стрита (учитывает A-2-3-4-5)
function straightHigh(ranks){
  const set=new Set(ranks);
  if(set.has(14)) set.add(1);
  const arr=[...set].sort((a,b)=>b-a);
  for(let i=0;i+4<arr.length;i++)
    if(arr[i]-arr[i+4]===4) return arr[i];
  return null;
}

// оценка 5–7 карт -> {cat, tb[], name}
function evaluate(cards){
  const counts=new Map();
  for(const c of cards) counts.set(c.rank,(counts.get(c.rank)||0)+1);
  const groups=[...counts.entries()].sort((a,b)=> b[1]-a[1] || b[0]-a[0]);
  const allRanks=[...counts.keys()].sort((a,b)=>b-a);

  let flushSuit=null;
  for(const s of SUITS)
    if(cards.filter(c=>c.suit===s).length>=5) flushSuit=s;

  // 8 — стрит-флеш
  if(flushSuit){
    const sh=straightHigh(cards.filter(c=>c.suit===flushSuit).map(c=>c.rank));
    if(sh) return {cat:8,tb:[sh],
      name: sh===14 ? 'Роял-флеш' : `Стрит-флеш до ${RCHR[sh]}`};
  }
  // 7 — каре
  const quad=groups.find(g=>g[1]===4);
  if(quad){
    const k=allRanks.find(r=>r!==quad[0]);
    return {cat:7,tb:[quad[0],k],name:`Каре ${RNAME[quad[0]]}`};
  }
  // 6 — фулл-хаус
  const trips=groups.filter(g=>g[1]>=3).map(g=>g[0]).sort((a,b)=>b-a);
  if(trips.length){
    const t=trips[0];
    const p=groups.filter(g=>g[1]>=2 && g[0]!==t).map(g=>g[0]).sort((a,b)=>b-a)[0];
    if(p!==undefined)
      return {cat:6,tb:[t,p],name:`Фулл-хаус ${RNAME[t]} и ${RNAME[p]}`};
  }
  // 5 — флеш
  if(flushSuit){
    const f=cards.filter(c=>c.suit===flushSuit).map(c=>c.rank)
                 .sort((a,b)=>b-a).slice(0,5);
    return {cat:5,tb:f,name:`Флеш ${SYM[flushSuit]} до ${RCHR[f[0]]}`};
  }
  // 4 — стрит
  const sh=straightHigh(allRanks);
  if(sh) return {cat:4,tb:[sh],name:`Стрит до ${RCHR[sh]}`};
  // 3 — тройка
  if(trips.length){
    const t=trips[0];
    const k=allRanks.filter(r=>r!==t).slice(0,2);
    return {cat:3,tb:[t,...k],name:`Тройка ${RNAME[t]}`};
  }
  // 2 / 1 — пары
  const pairs=groups.filter(g=>g[1]===2).map(g=>g[0]).sort((a,b)=>b-a);
  if(pairs.length>=2){
    const [a,b]=pairs;
    const k=allRanks.find(r=>r!==a&&r!==b);
    return {cat:2,tb:[a,b,k],name:`Две пары ${RNAME[a]} и ${RNAME[b]}`};
  }
  if(pairs.length===1){
    const p=pairs[0];
    const k=allRanks.filter(r=>r!==p).slice(0,3);
    return {cat:1,tb:[p,...k],name:`Пара ${RNAME[p]}`};
  }
  // 0 — старшая карта
  return {cat:0,tb:allRanks.slice(0,5),name:`Старшая ${RCHR[allRanks[0]]}`};
}

// >0 — первая сильнее, <0 — вторая, 0 — ничья
function compareHands(a,b){
  if(a.cat!==b.cat) return a.cat-b.cat;
  for(let i=0;i<Math.max(a.tb.length,b.tb.length);i++){
    const x=a.tb[i]||0, y=b.tb[i]||0;
    if(x!==y) return x-y;
  }
  return 0;
}