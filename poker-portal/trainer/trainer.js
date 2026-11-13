const $ = id => document.getElementById(id);
const USE_CARD_IMAGES = false;   // true → брать сканы из /cards/

let board=[], hand1=[], hand2=[];
let active=false, waiting=false;
let total=0, ok=0, bad=0, cardSec=5;
let handTimer=null, tickTimer=null, nextTimer=null, endAt=0;

// ---------- отрисовка карт ----------
const LAYOUT = {
  2:[[50,28],[50,112]],
  3:[[50,28],[50,70],[50,112]],
  4:[[30,28],[70,28],[30,112],[70,112]],
  5:[[30,28],[70,28],[50,70],[30,112],[70,112]],
  6:[[30,28],[70,28],[30,70],[70,70],[30,112],[70,112]],
  7:[[30,28],[70,28],[50,49],[30,70],[70,70],[30,112],[70,112]],
  8:[[30,28],[70,28],[50,49],[30,70],[70,70],[50,91],[30,112],[70,112]],
  9:[[30,28],[70,28],[30,52],[70,52],[50,70],[30,88],[70,88],[30,112],[70,112]],
 10:[[30,25],[70,25],[30,47],[70,47],[50,58],[50,82],[30,93],[70,93],[30,115],[70,115]]
};
function pipFactor(r){
  if(r<=3) return .24;
  if(r<=5) return .20;
  if(r<=8) return .17;
  return .15;
}
function fileName(c){
  const rn = c.rank<=10 ? String(c.rank)
           : {11:'jack',12:'queen',13:'king',14:'ace'}[c.rank];
  const sn = {s:'spades',h:'hearts',d:'diamonds',c:'clubs'}[c.suit];
  return `${rn}_of_${sn}.png`;
}
function cardEl(c){
  if(USE_CARD_IMAGES){
    const img=new Image();
    img.className='card'; img.alt=RCHR[c.rank]+SYM[c.suit];
    img.src=`../cards/${fileName(c)}`;
    img.onerror=()=>img.replaceWith(cssCard(c));
    return img;
  }
  return cssCard(c);
}
function cssCard(c){
  const red = c.suit==='h'||c.suit==='d';
  const el=document.createElement('div');
  el.className='card '+(red?'red':'black');
  const s=SYM[c.suit], r=RCHR[c.rank];
  let inner='';
  if(c.rank===14){
    inner=`<div class="pip" style="left:50%;top:50%;font-size:calc(var(--cw)*.34)">${s}</div>`;
  } else if(c.rank>=11){
    inner=`<div class="court">${r}</div><div class="court-suit">${s}</div>`;
  } else {
    const f=pipFactor(c.rank);
    inner=LAYOUT[c.rank].map(([x,y])=>
      `<div class="pip ${y>70?'flip':''}" style="left:${x}%;top:${y/1.4}%;
        font-size:calc(var(--cw)*${f})">${s}</div>`).join('');
  }
  el.innerHTML=`<div class="plate">${inner}</div>
    <div class="idx tl"><span class="r">${r}</span><span class="s">${s}</span></div>
    <div class="idx br"><span class="r">${r}</span><span class="s">${s}</span></div>`;
  return el;
}
function render(id,cards){
  const box=$(id); box.innerHTML='';
  cards.forEach(c=>box.appendChild(cardEl(c)));
}

// ---------- игра ----------
function deal(){
  if(!active) return;
  const d=shuffle(makeDeck());
  board=d.slice(0,5); hand1=d.slice(5,7); hand2=d.slice(7,9);
  render('board',board); render('hand1',hand1); render('hand2',hand2);
  say(`Определите победителя! У вас ${cardSec} сек.`, '#fff');
  waiting=true; setButtons(true);
  clearTimeout(handTimer);
  handTimer=setTimeout(timeout, cardSec*1000);
}
function judge(){
  const e1=evaluate([...board,...hand1]);
  const e2=evaluate([...board,...hand2]);
  const cmp=compareHands(e1,e2);
  return {e1,e2,answer: cmp>0?1:cmp<0?2:0};
}
function answer(choice){
  if(!active||!waiting) return;
  waiting=false; clearTimeout(handTimer); setButtons(false);
  total++;
  const {e1,e2,answer:right}=judge();
  if(choice===right){
    ok++; say('✅ ПРАВИЛЬНО!', '#7CFC00');
  } else {
    bad++;
    const w = right===0?'Ничья':right===1?'Игрок 1':'Игрок 2';
    say(`❌ НЕПРАВИЛЬНО! ${w}\nИгрок 1: ${e1.name}\nИгрок 2: ${e2.name}`,'#FF6347');
  }
  stats(); next();
}
function timeout(){
  if(!waiting) return;
  waiting=false; setButtons(false); total++; bad++;
  const {e1,e2,answer:right}=judge();
  const w = right===0?'Ничья':right===1?'Игрок 1':'Игрок 2';
  say(`⏰ ВРЕМЯ ВЫШЛО! ${w}\nИгрок 1: ${e1.name}\nИгрок 2: ${e2.name}`,'#FF6347');
  stats(); next();
}
function next(){
  clearTimeout(nextTimer);
  nextTimer=setTimeout(()=>{ if(active) deal(); }, 3000);
}
function start(){
  cardSec=Math.max(1,parseInt($('cardTime').value)||5);
  const min=Math.max(1,parseInt($('totalTime').value)||10);
  localStorage.setItem('pt_settings',JSON.stringify({cardSec,min}));
  total=ok=bad=0; stats();
  active=true; $('btnStart').disabled=true;
  $('cardTime').disabled=$('totalTime').disabled=true;
  endAt=Date.now()+min*60000;
  tickTimer=setInterval(tick,250); tick();
  deal();
}
function tick(){
  const left=endAt-Date.now();
  if(left<=0){ finish(); return; }
  const s=Math.ceil(left/1000);
  $('timer').textContent=
    `Осталось: ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function finish(){
  active=waiting=false;
  clearInterval(tickTimer); clearTimeout(handTimer); clearTimeout(nextTimer);
  setButtons(false);
  $('btnStart').disabled=false;
  $('cardTime').disabled=$('totalTime').disabled=false;
  $('timer').textContent='Осталось: 00:00';
  const pct = total ? (ok/total*100).toFixed(1) : '0.0';
  alert(`Тренировка завершена!\n\nРаздач: ${total}\nПравильно: ${ok}\nНеправильно: ${bad}\nТочность: ${pct}%`);
  say('Тренировка завершена. Нажмите «Начать» для новой сессии.','#fff');
}
function say(t,c){ const r=$('result'); r.textContent=t; r.style.color=c; }
function stats(){ $('stTotal').textContent=total; $('stOk').textContent=ok; $('stBad').textContent=bad; }
function setButtons(on){ document.querySelectorAll('.answer').forEach(b=>b.disabled=!on); }

// ---------- события ----------
$('btnStart').onclick=start;
$('btn1').onclick=()=>answer(1);
$('btn2').onclick=()=>answer(2);
$('btn0').onclick=()=>answer(0);
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  const k=e.key.toLowerCase();
  if(k==='1') answer(1);
  else if(k==='2') answer(2);
  else if(k==='d'||k==='в') answer(0);
  else if(k===' '){ e.preventDefault(); if(!$('btnStart').disabled) start(); }
});
(function restore(){
  try{
    const s=JSON.parse(localStorage.getItem('pt_settings'));
    if(s){ $('cardTime').value=s.cardSec; $('totalTime').value=s.min;
           $('timer').textContent=`Осталось: ${String(s.min).padStart(2,'0')}:00`; }
  }catch(_){}
  setButtons(false);
})();