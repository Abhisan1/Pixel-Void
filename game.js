// ============================================================
// PIXEL VOID — Star Wars Campaign v5
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
canvas.style.width  = canvas.width  + 'px';
canvas.style.height = canvas.height + 'px';
canvas.width  *= dpr; canvas.height *= dpr;
ctx.scale(dpr, dpr);
const W = 400, H = 600;

// Game viewport — enemies + player live here. UI outside.
const GY = 50;   // game area top
const GH = 480;  // game area height
const GB = GY + GH; // game area bottom = 530

// ── Palette ────────────────────────────────────────────────
const C = {
  bg:'#020602',     grid:'#060e06',  dim:'#0a150a',
  lo:'#112011',     mid:'#1e4e1e',   hi:'#3a8c3a',
  bright:'#6ee06e', accent:'#ffe066',danger:'#ff3c3c',
  shield:'#44aaff', fuel:'#00ffcc',  coin:'#ffd700',
  ui:'#6ee06e',     white:'#d8ffd8', panel:'#0a120a',
};

// ── State ──────────────────────────────────────────────────
const ST = { MENU:0,CRAWL:1,PLAYING:2,PAUSED:3,HANGAR:4,GAMEOVER:5,VICTORY:6 };
let state = ST.MENU;

// ── Save ───────────────────────────────────────────────────
// cannon is NOT saved — it's session-only (kept on death, reset on fresh open)
function loadSave(){
  try {
    const s = JSON.parse(localStorage.getItem('pixelvoid5')||'{}');
    return { totalCoins:s.totalCoins||0, bestScore:s.bestScore||0,
             victories:s.victories||0 };
  } catch(e){ return {totalCoins:0,bestScore:0,victories:0}; }
}
function writeSave(){
  // Never write cannon to disk — it resets on fresh browser open
  const toWrite={ totalCoins:save.totalCoins, bestScore:save.bestScore,
                  victories:save.victories };
  localStorage.setItem('pixelvoid5',JSON.stringify(toWrite));
}
let save = loadSave();
// Session cannon — persists through retries this session, resets on page load
let sessionCannon = 0;

// ── Upgrade Definitions ────────────────────────────────────
const UG = {
  cannon:{
    name:'CANNON', icon:'⚡',
    levels:['MK1','MK2','MK3','MK4','MK5'],
    costs:[0,80,180,340,600],
    desc:['1 shot','2 shot','3 shot','3+fast','3+rapid'],
  },
  engine:{
    name:'ENGINE', icon:'◈',
    levels:['MK1','MK2','MK3','MK4','MK5'],
    costs:[0,60,140,280,480],
    desc:['2.0 spd','2.8 spd','3.6 spd','4.6 spd','5.8 spd'],
    speed:[2.0,2.8,3.6,4.6,5.8],
  },
  shield:{
    name:'SHIELD', icon:'▣',
    levels:['MK1','MK2','MK3','MK4','MK5'],
    costs:[0,70,160,300,520],
    desc:['3 HP','4 HP','5 HP','6 HP','8 HP'],
    hp:[3,4,5,6,8],
    repairCost:18,
  },
};

// ── Power-up pool ──────────────────────────────────────────
const PUPS = [
  {id:'homing', name:'HOMING MISSILES', icon:'◎', cost:50,  desc:'Bullets track enemies 25s'},
  {id:'rapid',  name:'RAPID FIRE',      icon:'⚡', cost:45,  desc:'Fire rate x2 for 25s'},
  {id:'slow',   name:'ION PULSE',       icon:'❄', cost:45,  desc:'Enemies 35% slower 20s'},
  {id:'spread', name:'SPREAD SHOT',     icon:'✦', cost:40,  desc:'+2 angled bullets 25s'},
  {id:'nuke',   name:'PROTON TORPEDO',  icon:'☢', cost:100, desc:'Destroy all enemies instantly'},
  {id:'magnet', name:'SCRAP MAGNET',    icon:'⬡', cost:35,  desc:'Auto-collect fuel 20s'},
];

// ── Sector Definitions ─────────────────────────────────────
// duration in frames @ 60fps. S1=10800=3min, S6=boss
const SECTORS = [
  { num:1, film:'EPISODE IV', title:'A NEW HOPE',
    crawl:['The GALACTIC EMPIRE tightens','its grip on the Outer Rim.','',
           'A lone Rebel pilot escapes','the blockade of Tatooine','aboard the MILLENNIUM FALCON.','',
           'The mission: punch through','Imperial patrol squadrons','and reach the Rebel fleet.','',
           'The fate of the galaxy','rests on one ship...'],
    duration:7200,  spawnInterval:120, enemySpeedBase:0.36,  // S1: 120s intro
    pool:['fighter','fighter','fighter'],
    fuelRequired:18, bgTint:null, hasBoss:false },  // S1: need 18 cells

  { num:2, film:'EPISODE V', title:'THE EMPIRE STRIKES BACK',
    crawl:['The Empire has located','the Rebel base on Hoth.','',
           'Imperial probe droids swarm','the asteroid fields.','',
           'Scout ships harry the flanks.','There is no safe passage.','',
           'Trust in the Force.','Trust in your ship.'],
    duration:5400,  spawnInterval:95,  enemySpeedBase:0.48,  // S2: 90s easy
    pool:['fighter','scout','scout','fighter'],
    fuelRequired:22, bgTint:'rgba(0,8,24,0.18)', hasBoss:false },  // S2

  { num:3, film:'EPISODE VI', title:'RETURN OF THE JEDI',
    crawl:['The Emperor\'s trap is sprung.','The Death Star is operational.','',
           'Imperial bombers blanket','the approach to Endor.','',
           'Only the Millennium Falcon','can break through.','',
           'Fly fast. Fly true.'],
    duration:5400,  spawnInterval:75,  enemySpeedBase:0.58,  // S3: 90s medium
    pool:['fighter','bomber','fighter','scout'],
    fuelRequired:26, bgTint:'rgba(8,18,0,0.18)', hasBoss:false },  // S3

  { num:4, film:'EPISODE I', title:'THE PHANTOM MENACE',
    crawl:['The Trade Federation blockade','surrounds Naboo.','',
           'Droid fighters swarm','in impossible numbers.','',
           'Hull integrity is critical.','','Find another way.'],
    duration:3600,  spawnInterval:60,  enemySpeedBase:0.70,  // S4: 60s hard
    pool:['fighter','bomber','scout','fighter','bomber'],
    fuelRequired:30, bgTint:'rgba(18,0,26,0.18)', hasBoss:false },  // S4

  { num:5, film:'EPISODE II', title:'ATTACK OF THE CLONES',
    crawl:['Clone armies mass on Geonosis.','The Separatist dreadnoughts','move into attack formation.','',
           'This is the final gauntlet','before the Star Destroyer.','',
           'Conserve fuel.','The worst is yet to come.'],
    duration:3600,  spawnInterval:46,  enemySpeedBase:0.82,  // S5: 60s harder
    pool:['fighter','bomber','scout','fighter','bomber','fighter'],
    fuelRequired:34, bgTint:'rgba(28,10,0,0.22)', hasBoss:false },  // S5

  { num:6, film:'EPISODE III', title:'REVENGE OF THE SITH',
    crawl:['Order 66 has been executed.','The galaxy falls to darkness.','',
           'One ship remains.','One pilot. One chance.','',
           'The STAR DESTROYER looms','over the ruins of the Republic.','',
           'Destroy the bridge.','End the Empire.','',
           'May the Force be with you.'],
    duration:99999, spawnInterval:80, enemySpeedBase:0.82,
    pool:['fighter','scout'],
    fuelRequired:0, bgTint:'rgba(44,0,0,0.28)', hasBoss:true },
];

// ── Game Variables ─────────────────────────────────────────
let score, coins, hp, maxHp, frame, gameFrame, sectorFrame;
let engineLevel, shieldLevel; // per-run levels (reset on death)
let player, bullets, enemies, particles, fuelCells, starfield;
let spawnTimer, fireTimer, shakeTimer, shakeAmt;
let bossAlive, bossWarning, bossPhase, bossDefeated;
let currentSector, ngPlus, sectorComplete, sectorResult;
// Fuel: simple integer — fuel = cells collected, fuelRequired = cells needed to pass
// fuelMax = cells needed + 30% headroom for display cap
let heldPowerups, activePowerups;
let crawlTimer;
let hangarTab;
let victoryTimer;

// ── Input ──────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e=>{
  keys[e.key]=true;
  if(e.key==='Escape'){
    if(state===ST.PLAYING){ state=ST.PAUSED; }
    else if(state===ST.PAUSED){ state=ST.PLAYING; }
  }
  if((e.key==='f'||e.key==='F')&&state===ST.PLAYING) usePowerup(0);
  if((e.key==='g'||e.key==='G')&&state===ST.PLAYING) usePowerup(1);
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', e=>{ keys[e.key]=false; });
let touchX=null;
canvas.addEventListener('touchstart',e=>{e.preventDefault();touchX=e.touches[0].clientX;},{passive:false});
canvas.addEventListener('touchmove', e=>{e.preventDefault();touchX=e.touches[0].clientX;},{passive:false});
canvas.addEventListener('touchend',  e=>{e.preventDefault();touchX=null;},{passive:false});
canvas.addEventListener('click', handleClick);

// ── Util ───────────────────────────────────────────────────
function rand(a,b){ return a+Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a,b+1)); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function shake(amt,dur){ shakeAmt=amt; shakeTimer=dur; }
function overlap(ax,ay,aw,ah,bx,by,bw,bh){
  return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;
}

// ── Stars ──────────────────────────────────────────────────
function initStars(){
  starfield=[];
  for(let i=0;i<80;i++) starfield.push({
    x:rand(0,W), y:rand(GY,GB),
    size:rand(0.5,1.8), speed:rand(0.15,0.8), alpha:rand(0.15,0.65),
  });
}
function updateStars(spd){
  for(const s of starfield){
    s.y += s.speed*(spd||0.4);
    if(s.y>GB){ s.y=GY; s.x=rand(0,W); }
  }
}
function drawStars(){
  for(const s of starfield){
    ctx.globalAlpha=s.alpha*0.85; ctx.fillStyle=C.mid;
    ctx.fillRect(s.x,s.y,s.size,s.size);
  }
  ctx.globalAlpha=1;
}

// ── Ship Art ───────────────────────────────────────────────
function drawFalcon(x,y,col,scale){
  const s=scale||1;
  ctx.fillStyle=col||C.bright;
  const p=(dx,dy,w,h)=>ctx.fillRect(x+dx*s,y+dy*s,w*s,h*s);
  p(-10,-2,20,4); p(-8,-6,16,4); p(-6,-10,12,4); p(-4,-12,8,2);
  p(-6,2,4,4); p(2,2,4,4); p(-14,-2,4,4);
  ctx.fillStyle=C.accent; p(-3,6,6,3);
}
function drawFighter(x,y,r){
  ctx.fillStyle=r>0.5?C.hi:r>0.25?C.accent:C.danger;
  const p=(dx,dy,w,h)=>ctx.fillRect(x+dx,y+dy,w,h);
  p(-6,0,12,4); p(-4,-4,8,4); p(-2,-8,4,4); p(-10,4,6,6); p(4,4,6,6);
}
function drawBomber(x,y,r){
  ctx.fillStyle=r>0.5?C.hi:r>0.25?C.accent:C.danger;
  const p=(dx,dy,w,h)=>ctx.fillRect(x+dx,y+dy,w,h);
  p(-14,0,28,6); p(-10,-6,20,6); p(-6,-10,12,4);
  p(-16,6,6,8); p(10,6,6,8);
  ctx.fillStyle=C.mid; p(-2,10,4,4);
}
function drawScout(x,y,r){
  ctx.fillStyle=r>0.5?C.hi:r>0.25?C.accent:C.danger;
  const p=(dx,dy,w,h)=>ctx.fillRect(x+dx,y+dy,w,h);
  p(-2,0,4,12); p(-5,4,10,4); p(-1,-4,2,4);
}
function drawStarDestroyer(x,y,hp,mhp,phase){
  const r=hp/mhp;
  const hull=r>0.6?'#d0d0d0':r>0.3?C.accent:C.danger;
  ctx.fillStyle=hull;
  const p=(dx,dy,w,h)=>ctx.fillRect(x+dx,y+dy,w,h);
  // Main wedge
  p(-44,0,88,10); p(-36,10,72,10); p(-28,20,56,10);
  p(-18,30,36,10); p(-10,40,20,10); p(-4,50,8,8);
  // Wings
  p(-56,0,14,20); p(42,0,14,20);
  // Phase glow
  if(phase>=2){ ctx.fillStyle='rgba(255,80,0,0.3)'; p(-44,0,88,14); }
  if(phase>=3){ ctx.fillStyle='rgba(255,0,0,0.25)'; p(-44,0,88,22); }
  // No bridge tower — clean wedge only
  // HP bar above ship
  const bw=120,bx=x-60,by2=y-30;
  ctx.fillStyle='#140000'; ctx.fillRect(bx,by2,bw,8);
  ctx.fillStyle=r>0.6?'#bbbbbb':r>0.3?C.accent:C.danger;
  ctx.fillRect(bx,by2,bw*r,8);
  ctx.strokeStyle='#666'; ctx.lineWidth=1; ctx.strokeRect(bx,by2,bw,8);
  const pn=['','PHASE I','PHASE II','PHASE III'];
  ctx.fillStyle=phase>=3?C.danger:phase>=2?C.accent:'#cccccc';
  ctx.font='bold 10px Courier New'; ctx.textAlign='center';
  ctx.fillText(`STAR DESTROYER  ${pn[phase]}`,x,by2-5);
  ctx.fillStyle=C.accent; ctx.font='9px Courier New';
  ctx.fillText('▲ AIM FOR THE TOP',x,by2-15);
}

// ── Particles ──────────────────────────────────────────────
function spawnExplosion(x,y,color,count){
  for(let i=0;i<count;i++){
    const a=rand(0,Math.PI*2),sp=rand(1,5);
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
                    life:rand(0.5,1),size:rand(2,5),color});
  }
}
function spawnFuelCell(x,y,amount){
  // Only spawn fuel cells inside game area
  fuelCells.push({
    x:clamp(x,20,W-20), y:clamp(y,GY+10,GB-10),
    vx:rand(-1.2,1.2), vy:rand(-2,-0.4),
    timer:660, amount,
  });
}

// ── Init ───────────────────────────────────────────────────
function initGame(ng, freshStart){
  ngPlus=ng||0;
  score=0; coins=0; frame=0; gameFrame=0; sectorFrame=0;
  shakeTimer=0; shakeAmt=0; spawnTimer=0; fireTimer=0;
  bossAlive=false; bossWarning=0; bossPhase=1; bossDefeated=false;
  currentSector=0; sectorComplete=false; sectorResult=null; victoryTimer=0;
  // Fresh start from menu = cannon resets. Retry after death = keep session cannon.
  if(freshStart) sessionCannon=0;
  engineLevel=0; shieldLevel=0;
  maxHp=UG.shield.hp[shieldLevel]; hp=maxHp;
  heldPowerups=[null,null]; activePowerups={};
  fuelCells=[]; fuel=0;
  player={x:W/2,y:GB-50,w:20,h:20,
          speed:UG.engine.speed[engineLevel],invincible:0};
  bullets=[]; enemies=[]; particles=[];
  initStars();
}

function startCrawl(){
  crawlTimer=0;
  state=ST.CRAWL;
}

function goToHangar(){
  hangarTab=0;
  state=ST.HANGAR;
}

// ── Power-ups ──────────────────────────────────────────────
function usePowerup(slot){
  const id=heldPowerups[slot];
  if(!id) return;
  heldPowerups[slot]=null;
  if(id==='nuke'){
    for(let i=enemies.length-1;i>=0;i--){
      if(enemies[i].type!=='boss'){
        spawnExplosion(enemies[i].x,enemies[i].y,C.bright,10);
        earnCoins(enemies[i].value);
        for(let f=0;f<2;f++) spawnFuelCell(enemies[i].x,enemies[i].y,6);
        enemies.splice(i,1);
      }
    }
    shake(12,20);
  } else {
    const dur=id==='slow'||id==='magnet'?1200:1500;
    activePowerups[id]=dur;
  }
}

function earnCoins(val){
  coins+=val; save.totalCoins+=val;
}

// ── Sector Logic ───────────────────────────────────────────
function getSec(){ return SECTORS[currentSector]; }

function checkSectorEnd(){
  const sec=getSec();
  if(sec.hasBoss) return;
  if(sectorFrame>=sec.duration && !sectorComplete){
    sectorComplete=true;
    sectorResult = fuel>=sec.fuelRequired?'win':'retry';
    setTimeout(()=>{ if(state===ST.PLAYING) goToHangar(); },1600);
  }
}

function advanceSector(replay){
  if(!replay && sectorResult==='win') currentSector++;
  sectorFrame=0; sectorComplete=false; sectorResult=null;
  bossAlive=false; bossPhase=1; spawnTimer=0;
  enemies=[]; bullets=bullets.filter(b=>b.type==='player');
  fuelCells=[]; fuel=0;
  activePowerups={};
  startCrawl();
}

// ── Shooting ───────────────────────────────────────────────
function shoot(){
  const lvl=sessionCannon;
  const rapid=!!activePowerups['rapid'];
  const homing=!!activePowerups['homing'];
  const spread=!!activePowerups['spread'];
  const by=player.y-12; const spd=-10;
  const mk=(x,vy,vx)=>({x,y:by,vy,vx:vx||0,w:3,h:12,type:'player',homing});
  let bs=[];
  if(lvl<=0)     bs=[mk(player.x,spd)];
  else if(lvl===1) bs=[mk(player.x-7,spd),mk(player.x+7,spd)];
  else             bs=[mk(player.x-9,spd),mk(player.x,spd),mk(player.x+9,spd)];
  if(lvl>=3) for(const b of bs) b.vy=-12;
  if(spread){ bs.push(mk(player.x,spd*0.8,-3.5)); bs.push(mk(player.x,spd*0.8,3.5)); }
  bullets.push(...bs);
}

// ── Enemy Spawn ────────────────────────────────────────────
function spawnEnemy(){
  if(bossAlive) return;
  const sec=getSec();
  const type=sec.pool[randi(0,sec.pool.length-1)];
  const ng=ngPlus;
  const si=currentSector; // sector index 0-5
  // HP scales with sector AND ng+
  const cfgs={
    fighter:{hp:1+Math.floor(si*0.4)+ng,   speed:sec.enemySpeedBase,      w:20,h:14,sInt:0,   val:8,  fuel:2},
    bomber: {hp:3+Math.floor(si*0.7)+ng,   speed:sec.enemySpeedBase*0.68, w:28,h:14,sInt:120, val:20, fuel:3},
    scout:  {hp:1,                          speed:sec.enemySpeedBase*1.4,  w:10,h:12,sInt:0,   val:4,  fuel:1},
  };
  const cfg=cfgs[type];
  enemies.push({
    x:rand(30,W-30), y:GY-20,
    type, hp:cfg.hp, maxHp:cfg.hp,
    speed:cfg.speed, w:cfg.w, h:cfg.h,
    dx:Math.random()<0.5?1:-1,
    shootTimer:randi(0,70), shootInterval:cfg.sInt,
    value:cfg.val, fuelDrop:cfg.fuel,
  });
}

function spawnBoss(){
  bossAlive=true; bossWarning=200; bossPhase=1;
  const ng=ngPlus;
  // Boss HP much higher — genuinely hard
  enemies.push({
    x:W/2, y:GY-90, type:'boss',
    hp:100+ng*40, maxHp:100+ng*40,
    speed:0.35, w:88, h:68,
    dx:1, arrived:false,
    shootTimer:0, shootInterval:55,
    value:0, fuelDrop:0, escortTimer:0,
  });
}

function enemySpd(base){
  const slow=activePowerups['slow']?0.65:1.0;
  const ng=1+ngPlus*0.18;
  return base*slow*ng;
}

// ── Update ─────────────────────────────────────────────────
function update(){
  gameFrame++; sectorFrame++;
  if(shakeTimer>0) shakeTimer--;

  for(const k of Object.keys(activePowerups)){
    activePowerups[k]--;
    if(activePowerups[k]<=0) delete activePowerups[k];
  }

  // Player movement — CLAMPED to game viewport
  const spd=player.speed;
  if(keys['ArrowLeft']||keys['a'])  player.x-=spd;
  if(keys['ArrowRight']||keys['d']) player.x+=spd;
  if(keys['ArrowUp']||keys['w'])    player.y-=spd;
  if(keys['ArrowDown']||keys['s'])  player.y+=spd;
  if(touchX!==null){
    const rect=canvas.getBoundingClientRect();
    const tx=(touchX-rect.left)*(W/rect.width);
    const dx=tx-player.x;
    if(Math.abs(dx)>4) player.x+=Math.sign(dx)*spd;
  }
  // Hard clamp — Falcon always visible inside game area
  player.x=clamp(player.x,16,W-16);
  player.y=clamp(player.y,GY+16,GB-16);
  if(player.invincible>0) player.invincible--;

  // Auto fire
  fireTimer++;
  const rapid=!!activePowerups['rapid'];
  const fc=rapid
    ?(sessionCannon>=3?7:sessionCannon>=1?9:11)
    :(sessionCannon>=3?14:sessionCannon>=1?18:24);
  if(fireTimer>=fc){ shoot(); fireTimer=0; }

  updateStars(0.32+currentSector*0.1);

  // Spawn
  const sec=getSec();
  if(!bossAlive&&!sectorComplete){
    spawnTimer++;
    if(spawnTimer>=sec.spawnInterval){ spawnEnemy(); spawnTimer=0; }
  }
  if(sec.hasBoss&&!bossAlive&&!bossWarning&&!bossDefeated&&sectorFrame>600) spawnBoss();
  if(bossWarning>0) bossWarning--;

  // Bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.y+=b.vy; if(b.vx) b.x+=b.vx;
    if(b.homing&&b.type==='player'&&enemies.length>0){
      let ne=null,nd=99999;
      for(const e of enemies){
        const d=Math.abs(e.x-b.x)+Math.abs(e.y-b.y);
        if(d<nd){nd=d;ne=e;}
      }
      if(ne) b.x+=Math.sign(ne.x-b.x)*2;
    }
    if(b.y<GY||b.y>GB+20||b.x<-20||b.x>W+20){bullets.splice(i,1);continue;}

    if(b.type==='player'){
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        // Enemy must be fully inside game area before it can be hit
        if(e.y - e.h/2 < GY + 2) continue;
        if(e.type==='boss'){
          // Weak spot = top row of wedge (must fly close)
          const bx=e.x-44, by2=e.y-e.h/2;
          if(overlap(b.x-1,b.y,b.w,b.h,bx,by2,88,10)){
            e.hp--; bullets.splice(i,1);
            spawnExplosion(b.x,b.y,C.accent,4);
            if(e.hp<=0) killEnemy(j);
            break;
          }
        } else {
          if(overlap(b.x-1,b.y,b.w,b.h,e.x-e.w/2,e.y-e.h/2,e.w,e.h)){
            e.hp--; bullets.splice(i,1);
            spawnExplosion(b.x,b.y,C.hi,3);
            if(e.hp<=0) killEnemy(j);
            break;
          }
        }
      }
    }

    if(b.type==='enemy'&&player.invincible===0){
      // Enemy bullets only harm player if inside game area
      if(b.y>GY&&overlap(b.x-2,b.y-2,6,6,player.x-10,player.y-10,20,20)){
        bullets.splice(i,1); damagePlayer(1);
      }
    }
  }

  // Enemies
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.type==='boss'){
      updateBoss(e,i);
    } else {
      e.y+=enemySpd(e.speed);
      if(e.type==='bomber'){e.x+=e.dx*0.45;if(e.x>W-22||e.x<22)e.dx*=-1;}
      // Bombers shoot only when visible
      if(e.shootInterval>0&&e.y>GY){
        e.shootTimer++;
        if(e.shootTimer>=e.shootInterval){
          e.shootTimer=0;
          bullets.push({x:e.x,y:e.y+10,vy:3.2,vx:0,w:4,h:8,type:'enemy'});
        }
      }
      // Remove when past game bottom
      if(e.y>GB+30){enemies.splice(i,1);continue;}
    }
    // Ram — only inside game area
    if(e.y>GY&&player.invincible===0&&
       overlap(e.x-e.w/2,e.y-e.h/2,e.w,e.h,player.x-10,player.y-10,20,20)){
      spawnExplosion(e.x,e.y,C.danger,14); shake(8,14);
      damagePlayer(2);
      if(e.type!=='boss'){
        for(let f=0;f<2;f++) spawnFuelCell(e.x,e.y,Math.ceil(e.fuelDrop/2));
        enemies.splice(i,1);
      }
    }
  }

  // Fuel cells
  const magnet=!!activePowerups['magnet'];
  for(let i=fuelCells.length-1;i>=0;i--){
    const f=fuelCells[i];
    f.x+=f.vx; f.y+=f.vy; f.vy+=0.055;
    f.timer--;
    if(f.timer<=0){fuelCells.splice(i,1);continue;}
    const dist=Math.hypot(f.x-player.x,f.y-player.y);
    const basePickR = 20 + engineLevel * 8; // MK1=20, MK2=28, MK3=36, MK4=44, MK5=52
    const pickR=magnet?150:basePickR;
    if(dist<pickR){
      if(magnet&&dist>basePickR){f.x+=(player.x-f.x)*0.1;f.y+=(player.y-f.y)*0.1;}
      else{ fuel+=f.amount; fuelCells.splice(i,1); }
    }
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.055; p.life-=0.02;
    if(p.life<=0) particles.splice(i,1);
  }

  score+=0.01*(1+currentSector*0.22);
  checkSectorEnd();
}

function updateBoss(e,idx){
  const r=e.hp/e.maxHp;
  if(r<=0.30&&bossPhase<3){ bossPhase=3; shake(18,30); spawnEscorts(3); }
  else if(r<=0.60&&bossPhase<2){ bossPhase=2; shake(12,20); spawnEscorts(2); }

  if(!e.arrived){ e.y+=0.55; if(e.y>=GY+95) e.arrived=true; }
  else{
    const sp=bossPhase===3?2.2:bossPhase===2?1.6:0.85;
    e.x+=e.dx*sp; if(e.x>W-65||e.x<65) e.dx*=-1;
  }
  e.shootTimer++;
  const intv=bossPhase===3?32:bossPhase===2?44:58;
  if(e.shootTimer>=intv){
    e.shootTimer=0;
    const ways=bossPhase===3?7:bossPhase===2?5:3;
    for(let s=0;s<ways;s++){
      const angle=Math.PI/2+(s-(ways-1)/2)*0.26;
      bullets.push({x:e.x+(s-(ways-1)/2)*12,y:e.y+36,
                    vx:Math.cos(angle)*3.4,vy:Math.sin(angle)*3.4,
                    w:5,h:5,type:'enemy'});
    }
  }
  if(bossPhase===3){
    e.escortTimer=(e.escortTimer||0)+1;
    if(e.escortTimer>240){e.escortTimer=0;spawnEscorts(1);}
  }
}

function spawnEscorts(n){
  for(let i=0;i<n;i++) enemies.push({
    x:rand(50,W-50),y:GY-20,type:'fighter',
    hp:2+ngPlus,maxHp:2+ngPlus,
    speed:0.75,w:20,h:14,dx:1,
    shootTimer:0,shootInterval:0,value:3,fuelDrop:4,
  });
}

function killEnemy(j){
  const e=enemies[j];
  const isBoss=e.type==='boss';
  spawnExplosion(e.x,e.y,isBoss?'#ffffff':C.bright,isBoss?50:12);
  if(isBoss){shake(22,36);bossAlive=false;bossDefeated=true;}
  else shake(3,5);
  earnCoins(e.value);
  score+=e.value*2;
  if(!isBoss){
    // Each cell = 1 fuel unit. Drop cfg.fuelDrop number of cells.
    for(let f=0;f<e.fuelDrop;f++) spawnFuelCell(e.x+rand(-12,12),e.y,1);
  }
  enemies.splice(j,1);
  if(isBoss) setTimeout(()=>{ if(state===ST.PLAYING) triggerVictory(); },2000);
}

function damagePlayer(dmg){
  if(player.invincible>0) return;
  hp=Math.max(0,hp-dmg);
  player.invincible=90; shake(6,10);
  spawnExplosion(player.x,player.y,C.shield,8);
  if(hp<=0) endGame();
}

function endGame(){
  if(score>save.bestScore){ save.bestScore=score; writeSave(); }
  state=ST.GAMEOVER;
}

function triggerVictory(){
  if(score>save.bestScore) save.bestScore=score;
  save.victories++; writeSave();
  victoryTimer=0; state=ST.VICTORY;
}

// ── Draw Helpers ───────────────────────────────────────────
function drawPanel(x,y,w,h,col){
  ctx.fillStyle=col||C.panel; ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=C.lo; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
}
function drawBtn(x,y,w,h,label,col,textCol){
  ctx.fillStyle=col||C.hi; ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=C.mid; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
  ctx.fillStyle=textCol||C.bg;
  ctx.font='bold 13px Courier New'; ctx.textAlign='center';
  ctx.fillText(label,x+w/2,y+h/2+5);
}

// ── Draw Game ──────────────────────────────────────────────
function drawGame(){
  // Full background
  ctx.fillStyle='#010301'; ctx.fillRect(0,0,W,H);

  // Game viewport border
  ctx.fillStyle=C.bg; ctx.fillRect(0,GY,W,GH);
  const tint=getSec().bgTint;
  if(tint){ctx.fillStyle=tint;ctx.fillRect(0,GY,W,GH);}

  // Subtle grid inside game area only
  ctx.save();
  ctx.beginPath(); ctx.rect(0,GY,W,GH); ctx.clip();
  ctx.strokeStyle=C.grid; ctx.lineWidth=0.5;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,GY);ctx.lineTo(x,GB);ctx.stroke();}
  for(let y=GY;y<GB;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  let sx=0,sy=0;
  if(shakeTimer>0){sx=rand(-shakeAmt,shakeAmt);sy=rand(-shakeAmt,shakeAmt);}
  ctx.translate(sx,sy);

  drawStars();

  // Boss warning flash
  if(bossWarning>80){
    ctx.globalAlpha=gameFrame%22<11?0.88:0.08;
    ctx.fillStyle=C.danger; ctx.font='bold 15px Courier New'; ctx.textAlign='center';
    ctx.fillText('⚠  STAR DESTROYER INCOMING  ⚠',W/2,GY+GH/2-12);
    ctx.font='10px Courier New';
    ctx.fillText('FLY CLOSE — AIM FOR THE BRIDGE',W/2,GY+GH/2+10);
    ctx.globalAlpha=1;
  }

  // Sector complete flash
  if(sectorComplete&&!getSec().hasBoss){
    ctx.globalAlpha=gameFrame%28<14?0.85:0.08;
    ctx.fillStyle=sectorResult==='win'?C.accent:C.danger;
    ctx.font='bold 16px Courier New'; ctx.textAlign='center';
    ctx.fillText(sectorResult==='win'?'SECTOR CLEAR':'FUEL LOW — RETRY',W/2,GY+GH/2);
    ctx.globalAlpha=1;
  }

  // Fuel cells
  for(const f of fuelCells){
    ctx.globalAlpha=Math.min(1,f.timer/80);
    ctx.fillStyle=C.fuel; ctx.fillRect(f.x-3,f.y-3,6,6);
    ctx.fillStyle='rgba(0,255,200,0.25)'; ctx.fillRect(f.x-6,f.y-6,12,12);
    ctx.globalAlpha=1;
  }

  // Enemy bullets
  for(const b of bullets) if(b.type==='enemy'&&b.y>GY){
    ctx.fillStyle=C.danger; ctx.fillRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);
  }
  // Player bullets
  for(const b of bullets) if(b.type==='player'){
    ctx.fillStyle=activePowerups['homing']?C.accent:C.bright;
    ctx.fillRect(b.x-b.w/2,b.y,b.w,b.h);
    ctx.fillStyle=C.mid; ctx.fillRect(b.x-1,b.y+b.h,2,4);
  }

  // Enemies (only draw if in game area)
  for(const e of enemies){
    if(e.y<GY-e.h&&e.type!=='boss') continue;
    const r=e.hp/e.maxHp;
    if(e.type==='boss') drawStarDestroyer(e.x,e.y-e.h/2,e.hp,e.maxHp,bossPhase);
    else if(e.type==='fighter') drawFighter(e.x,e.y-e.h/2,r);
    else if(e.type==='bomber')  drawBomber(e.x,e.y-e.h/2,r);
    else if(e.type==='scout')   drawScout(e.x,e.y-e.h/2,r);
  }

  // Player — always visible, clamped
  const fl=player.invincible===0||Math.floor(gameFrame/4)%2===0;
  if(fl){
    if(activePowerups['slow']){
      ctx.globalAlpha=0.3; ctx.fillStyle=C.shield;
      ctx.beginPath(); ctx.arc(player.x,player.y,22,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    drawFalcon(player.x,player.y-8,C.bright);
    ctx.fillStyle=C.accent; ctx.globalAlpha=0.5+Math.sin(gameFrame*0.3)*0.35;
    ctx.fillRect(player.x-3,player.y+8,6,randi(4,10)); ctx.globalAlpha=1;
  }

  // Particles
  for(const p of particles){
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
  ctx.restore();
  ctx.restore(); // end clip

  // ── TOP HUD BAR ────────────────────────────────────────
  ctx.fillStyle=C.panel; ctx.fillRect(0,0,W,GY);
  ctx.fillStyle=C.lo; ctx.fillRect(0,GY-1,W,1);

  // Score
  ctx.fillStyle=C.mid; ctx.font='10px Courier New'; ctx.textAlign='left';
  ctx.fillText('SCORE',8,14);
  ctx.fillStyle=C.bright; ctx.font='bold 16px Courier New';
  ctx.fillText(Math.floor(score).toString().padStart(7,'0'),8,32);

  // Sector center
  const sec=getSec();
  ctx.textAlign='center';
  ctx.fillStyle=C.accent; ctx.font='bold 13px Courier New';
  ctx.fillText(`⬡ ${coins}`,W/2,15);
  ctx.fillStyle=C.mid; ctx.font='10px Courier New';
  ctx.fillText(`S${sec.num}/6  ${sec.title}`,W/2,32);

  // Hull right
  ctx.textAlign='right'; ctx.fillStyle=C.mid; ctx.font='10px Courier New';
  ctx.fillText('HULL',W-8,14);
  const hpR=hp/maxHp;
  ctx.fillStyle=C.lo; ctx.fillRect(W-90,18,80,14);
  ctx.fillStyle=hpR>0.5?C.hi:hpR>0.25?C.accent:C.danger;
  ctx.fillRect(W-90,18,80*hpR,14);
  ctx.strokeStyle=C.mid; ctx.lineWidth=1; ctx.strokeRect(W-90,18,80,14);
  ctx.fillStyle=C.white; ctx.font='bold 10px Courier New'; ctx.textAlign='center';
  ctx.fillText(`${hp}/${maxHp}`,W-50,29);

  // ── BOTTOM UI AREA (below game viewport) ────────────────
  const BY=GB+2; // bottom area starts here
  const BH=H-GB-2; // ~68px

  ctx.fillStyle=C.panel; ctx.fillRect(0,BY,W,BH);
  ctx.fillStyle=C.lo; ctx.fillRect(0,BY,W,1);

  // Power-up slots row
  const PR=BY+18;
  ctx.fillStyle=C.dim; ctx.fillRect(0,BY,W,22);
  ctx.fillStyle=C.lo; ctx.fillRect(0,BY+22,W,1);

  ctx.font='11px Courier New'; ctx.textAlign='left';
  ctx.fillStyle=C.mid; ctx.fillText('[F]',8,PR);
  const p0=heldPowerups[0]?PUPS.find(p=>p.id===heldPowerups[0]):null;
  ctx.fillStyle=p0?C.accent:C.lo;
  ctx.fillText(p0?`${p0.icon} ${p0.name}`:'— empty',28,PR);

  ctx.fillStyle=C.mid; ctx.fillText('[G]',W/2+4,PR);
  const p1=heldPowerups[1]?PUPS.find(p=>p.id===heldPowerups[1]):null;
  ctx.fillStyle=p1?C.accent:C.lo;
  ctx.fillText(p1?`${p1.icon} ${p1.name}`:'— empty',W/2+24,PR);

  // Active powerup timers
  const aks=Object.keys(activePowerups);
  if(aks.length>0){
    ctx.font='10px Courier New';
    aks.forEach((k,i)=>{
      const pu=PUPS.find(p=>p.id===k);
      if(pu){
        ctx.fillStyle=C.accent; ctx.textAlign='left';
        ctx.fillText(`${pu.icon}${Math.ceil(activePowerups[k]/60)}s`,8+i*55,BY+38);
      }
    });
  }

  // Fuel bar row (only in non-boss sectors)
  if(!sec.hasBoss){
    const FR=BY+52;
    const fuelR=Math.min(1, fuel/sec.fuelRequired); // 0..1, bar fills at exactly required
    const bw=W-100; const bx=52;

    ctx.fillStyle=C.lo; ctx.fillRect(0,BY+34,W,1);
    ctx.fillStyle=C.dim; ctx.fillRect(bx,FR-8,bw,12);
    // Orange marker at right edge = goal
    ctx.fillStyle='rgba(255,130,0,0.85)';
    ctx.fillRect(bx+bw-2,FR-10,3,16);
    ctx.fillStyle=fuelR>=1?C.fuel:'#007755';
    ctx.fillRect(bx,FR-8,bw*fuelR,12);
    ctx.strokeStyle=C.mid; ctx.lineWidth=1; ctx.strokeRect(bx,FR-8,bw,12);

    ctx.fillStyle=C.fuel; ctx.font='bold 11px Courier New'; ctx.textAlign='left';
    ctx.fillText('FUEL',8,FR+2);
    ctx.fillStyle=fuelR>=1?C.fuel:C.danger; ctx.textAlign='right';
    ctx.fillText(`${fuel}/${sec.fuelRequired}`,W-8,FR+2);
  }

  if(ngPlus>0){
    ctx.fillStyle=C.danger; ctx.font='bold 10px Courier New'; ctx.textAlign='right';
    ctx.fillText(`NG+${ngPlus}`,W-6,H-3);
  }
}

// ── Crawl ──────────────────────────────────────────────────
function drawCrawl(){
  crawlTimer++;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  updateStars(0.25); drawStars();

  const sec=getSec();
  ctx.fillStyle=C.accent; ctx.font='bold 12px Courier New'; ctx.textAlign='center';
  ctx.fillText(sec.film,W/2,36);
  ctx.fillStyle=C.bright; ctx.font='bold 20px Courier New';
  ctx.fillText(sec.title,W/2,60);

  const lineH=28; const scrollY=crawlTimer*0.038;
  ctx.save();
  ctx.beginPath(); ctx.rect(20,75,W-40,H-100); ctx.clip();
  sec.crawl.forEach((line,i)=>{
    const y=120+i*lineH-scrollY+H*0.28;
    if(y<70||y>H-18) return;
    const alpha=Math.min(1,Math.min(y-70,H-y-18)/50);
    ctx.globalAlpha=alpha;
    ctx.fillStyle=line===''?C.dim:C.white;
    ctx.font='13px Courier New'; ctx.textAlign='center';
    ctx.fillText(line,W/2,y);
  });
  ctx.globalAlpha=1; ctx.restore();

  if(crawlTimer>90){
    ctx.fillStyle=Math.floor(crawlTimer/35)%2===0?C.accent:'#000';
    ctx.font='bold 12px Courier New'; ctx.textAlign='center';
    ctx.fillText('[ CLICK TO LAUNCH ]',W/2,H-16);
  }
  const total=(sec.crawl.length*lineH)+H*0.28;
  if(crawlTimer*0.038>total+80) state=ST.PLAYING;
}

// ── Pause ──────────────────────────────────────────────────
function drawPause(){
  drawGame();
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(0,GY,W,GH);
  ctx.fillStyle=C.bright; ctx.font='bold 22px Courier New'; ctx.textAlign='center';
  ctx.fillText('PAUSED',W/2,GY+140);

  const btns=[
    {label:'▶  RESUME',    y:GY+180, col:C.hi,    tc:C.bg},
    {label:'↺  RESTART',   y:GY+226, col:C.mid,   tc:C.bg},
    {label:'⌂  MAIN MENU', y:GY+272, col:C.lo,    tc:C.ui},
  ];
  btns.forEach(b=> drawBtn(W/2-80,b.y,160,34,b.label,b.col,b.tc));

  ctx.fillStyle=C.dim; ctx.font='11px Courier New'; ctx.textAlign='center';
  ctx.fillText('ESC to resume',W/2,GY+330);
}

// ── Hangar ─────────────────────────────────────────────────
function drawHangar(){
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=C.grid; ctx.lineWidth=0.5;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // Header
  ctx.fillStyle=C.panel; ctx.fillRect(0,0,W,46);
  ctx.fillStyle=C.lo; ctx.fillRect(0,46,W,1);
  ctx.fillStyle=C.bright; ctx.font='bold 20px Courier New'; ctx.textAlign='center';
  ctx.fillText('HANGAR',W/2,20);
  const sec=getSec();
  const nxt=SECTORS[Math.min(currentSector+1,5)];
  ctx.fillStyle=sectorResult==='win'?C.accent:C.danger;
  ctx.font='11px Courier New';
  ctx.fillText(sectorResult==='win'?`NEXT: S${currentSector+2} — ${nxt.title}`:`RETRY: S${sec.num} — ${sec.title}`,W/2,38);

  // Coins + ship
  ctx.fillStyle=C.accent; ctx.font='bold 14px Courier New';
  ctx.fillText(`⬡ ${save.totalCoins} COINS`,W/2,62);
  drawFalcon(W/2,82,C.bright);
  ctx.fillStyle=C.mid; ctx.font='10px Courier New';
  ctx.fillText('MILLENNIUM FALCON',W/2,100);

  // Hull bar + repair
  const hpR=hp/maxHp;
  ctx.fillStyle=C.lo; ctx.fillRect(60,106,W-120,12);
  ctx.fillStyle=hpR>0.5?C.hi:hpR>0.25?C.accent:C.danger;
  ctx.fillRect(60,106,(W-120)*hpR,12);
  ctx.strokeStyle=C.mid; ctx.lineWidth=1; ctx.strokeRect(60,106,W-120,12);
  ctx.fillStyle=C.white; ctx.font='10px Courier New'; ctx.textAlign='center';
  ctx.fillText(`HULL ${hp}/${maxHp}`,W/2,116);

  if(hp<maxHp){
    const cost=(maxHp-hp)*UG.shield.repairCost;
    const ok=save.totalCoins>=cost;
    drawBtn(W/2-60,122,120,22,`REPAIR  ⬡${cost}`,ok?C.hi:C.lo,ok?C.bg:C.mid);
  }

  // Tabs
  const tabY=148;
  ['UPGRADES','POWER-UPS'].forEach((t,i)=>{
    ctx.fillStyle=hangarTab===i?C.lo:C.dim;
    ctx.fillRect(i*(W/2),tabY,W/2,24);
    ctx.strokeStyle=hangarTab===i?C.bright:C.mid;
    ctx.lineWidth=hangarTab===i?2:1;
    ctx.strokeRect(i*(W/2),tabY,W/2,24);
    ctx.fillStyle=hangarTab===i?C.bright:C.mid;
    ctx.font='bold 11px Courier New'; ctx.textAlign='center';
    ctx.fillText(t,i*(W/2)+W/4,tabY+16);
  });

  const contentY=178;

  if(hangarTab===0){
    // Upgrades
    const ukeys=['cannon','engine','shield'];
    ukeys.forEach((key,i)=>{
      const ug=UG[key];
      const level=key==='cannon'?sessionCannon:key==='engine'?engineLevel:shieldLevel;
      const y=contentY+i*82;
      const next=level+1;
      const canUp=next<5;
      const cost=canUp?ug.costs[next]:0;
      const ok=save.totalCoins>=cost;

      drawPanel(10,y,W-20,76);
      ctx.fillStyle=C.ui; ctx.font='bold 12px Courier New'; ctx.textAlign='left';
      ctx.fillText(`${ug.icon} ${ug.name}`,22,y+16);
      // Level pips
      for(let l=0;l<5;l++){
        ctx.fillStyle=l<=level?C.bright:C.lo;
        ctx.fillRect(22+l*18,y+22,14,6);
      }
      ctx.fillStyle=C.hi; ctx.font='11px Courier New';
      ctx.fillText(`${ug.levels[level]}  —  ${ug.desc[level]}`,22,y+44);
      if(canUp){
        ctx.fillStyle=ok?C.accent:C.mid;
        ctx.fillText(`▲ ⬡${cost}  →  ${ug.levels[next]}`,22,y+62);
      } else {
        ctx.fillStyle=C.bright; ctx.fillText('✓ MAX LEVEL',22,y+62);
      }
    });

  } else {
    // Power-ups
    ctx.fillStyle=C.mid; ctx.font='10px Courier New'; ctx.textAlign='center';
    const s0=heldPowerups[0]||'empty'; const s1=heldPowerups[1]||'empty';
    ctx.fillText(`[F] ${s0}   [G] ${s1}`,W/2,contentY);

    PUPS.forEach((pu,i)=>{
      const y=contentY+12+i*56;
      const owned=heldPowerups.includes(pu.id);
      const ok=save.totalCoins>=pu.cost;
      drawPanel(10,y,W-20,50, owned?C.lo:C.dim);
      ctx.strokeStyle=owned?C.accent:C.mid;
      ctx.lineWidth=owned?2:1; ctx.strokeRect(10,y,W-20,50);

      ctx.fillStyle=C.accent; ctx.font='16px Courier New'; ctx.textAlign='left';
      ctx.fillText(pu.icon,20,y+30);
      ctx.fillStyle=C.bright; ctx.font='bold 11px Courier New';
      ctx.fillText(pu.name,42,y+16);
      ctx.fillStyle=C.mid; ctx.font='10px Courier New';
      ctx.fillText(pu.desc,42,y+30);
      if(owned){
        ctx.fillStyle=C.accent; ctx.fillText('✓ EQUIPPED',42,y+44);
      } else {
        ctx.fillStyle=ok?C.hi:C.lo;
        ctx.fillText(`⬡${pu.cost} — click to equip`,42,y+44);
      }
    });
  }

  // Bottom buttons — always visible, never overlap content
  const BT=H-80;
  ctx.fillStyle=C.lo; ctx.fillRect(0,BT-2,W,1);
  if(sectorResult==='win'){
    drawBtn(10,BT+4,W/2-16,32,'↺ REPLAY SECTOR',C.lo,C.mid);
    drawBtn(W/2+6,BT+4,W/2-16,32,'▶ NEXT SECTOR',C.hi,C.bg);
  } else {
    drawBtn(W/2-90,BT+4,180,32,'↺  RETRY SECTOR',C.accent,C.bg);
  }
}

// ── Menu ───────────────────────────────────────────────────
function drawMenu(){
  frame++;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  updateStars(0.28); drawStars();

  ctx.fillStyle=C.accent; ctx.font='bold 12px Courier New'; ctx.textAlign='center';
  ctx.fillText('A long time ago in a galaxy far, far away...',W/2,45);
  ctx.fillStyle=C.bright; ctx.font='bold 32px Courier New';
  ctx.fillText('PIXEL VOID',W/2,108);
  ctx.fillStyle=C.mid; ctx.font='11px Courier New';
  ctx.fillText('A STAR WARS BRICK ERA ADVENTURE',W/2,128);

  const sy2=195+Math.sin(frame*0.04)*8;
  drawFalcon(W/2,sy2,C.bright,1.5);
  ctx.fillStyle=C.accent; ctx.globalAlpha=0.4+Math.sin(frame*0.2)*0.3;
  ctx.fillRect(W/2-3,sy2+14,6,10); ctx.globalAlpha=1;

  SECTORS.forEach((s,i)=>{
    ctx.fillStyle=i===5?C.danger:i>=3?C.accent:C.mid;
    ctx.font=(i===5?'bold ':'')+'10px Courier New'; ctx.textAlign='center';
    ctx.fillText(`${s.film}: ${s.title}`,W/2,272+i*19);
  });

  ctx.fillStyle=C.hi; ctx.font='11px Courier New';
  ctx.fillText(`BEST ${Math.floor(save.bestScore).toString().padStart(7,'0')}  ⬡ ${save.totalCoins}  ${save.victories}✦`,W/2,392);

  if(Math.floor(frame/30)%2===0){
    ctx.fillStyle=C.accent; ctx.font='bold 13px Courier New';
    ctx.fillText('May the Force be with you.',W/2,424);
    ctx.fillStyle=C.bright;
    ctx.fillText('[ CLICK TO BEGIN ]',W/2,448);
  }
}

// ── Victory ────────────────────────────────────────────────
function drawVictory(){
  victoryTimer++;
  drawGame();
  ctx.fillStyle='rgba(0,0,0,0.84)'; ctx.fillRect(0,0,W,H);
  for(const p of particles){
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
  const bl=Math.floor(victoryTimer/20)%2===0;
  ctx.fillStyle=bl?C.accent:C.bright;
  ctx.font='bold 24px Courier New'; ctx.textAlign='center';
  ctx.fillText('YOU DEFEATED',W/2,150);
  ctx.fillText('THE EMPIRE',W/2,182);
  ctx.fillStyle=C.mid; ctx.font='11px Courier New';
  ctx.fillText('The Force was with the Millennium Falcon.',W/2,210);
  ctx.fillStyle=C.ui; ctx.font='13px Courier New';
  ctx.fillText(`SCORE  ${Math.floor(score).toString().padStart(7,'0')}`,W/2,248);
  ctx.fillStyle=C.accent;
  ctx.fillText(`⬡ ${coins} COINS`,W/2,270);
  if(victoryTimer>110){
    drawBtn(W/2-90,308,180,36,`▶ NEW GAME+  NG+${ngPlus+1}`,C.danger,C.bg);
    drawBtn(W/2-90,356,180,36,'⚙ HANGAR',C.lo,C.ui);
    drawBtn(W/2-90,404,180,36,'⌂ MAIN MENU',C.dim,C.mid);
  }
}

// ── Game Over ──────────────────────────────────────────────
function drawGameOver(){
  drawGame();
  ctx.fillStyle='rgba(0,3,0,0.88)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.danger; ctx.font='bold 26px Courier New'; ctx.textAlign='center';
  ctx.fillText('SHIP DESTROYED',W/2,158);
  ctx.fillStyle=C.mid; ctx.font='11px Courier New';
  ctx.fillText('MILLENNIUM FALCON LOST IN THE VOID',W/2,180);
  const sec=getSec();
  ctx.fillStyle=C.hi; ctx.font='11px Courier New';
  ctx.fillText(`FELL IN S${sec.num}: ${sec.title}`,W/2,202);
  ctx.fillStyle=C.ui; ctx.font='13px Courier New';
  ctx.fillText(`SCORE  ${Math.floor(score).toString().padStart(7,'0')}`,W/2,234);
  ctx.fillStyle=C.accent;
  ctx.fillText(`COINS EARNED  ⬡ ${coins}`,W/2,256);
  if(score>=save.bestScore&&score>0){
    ctx.fillStyle=C.accent; ctx.font='bold 12px Courier New';
    ctx.fillText('✦ NEW BEST SCORE ✦',W/2,280);
  }
  ctx.fillStyle=C.danger; ctx.font='10px Courier New';
  ctx.fillText('Cannon upgrades saved. Engine & Shield reset.',W/2,308);

  drawBtn(W/2-80,334,160,36,'▶ TRY AGAIN',C.hi,C.bg);
  drawBtn(W/2-80,384,160,36,'⚙ HANGAR',C.lo,C.ui);
}

// ── Click Handler ──────────────────────────────────────────
function handleClick(e){
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(W/rect.width);
  const my=(e.clientY-rect.top)*(H/rect.height);

  if(state===ST.MENU){ initGame(0, true); startCrawl(); return; }
  if(state===ST.CRAWL){ state=ST.PLAYING; return; }

  if(state===ST.PAUSED){
    if(my>GY+158&&my<GY+214) state=ST.PLAYING;
    if(my>GY+204&&my<GY+260){ initGame(ngPlus, false); startCrawl(); }
    if(my>GY+250&&my<GY+306) state=ST.MENU;
    return;
  }

  if(state===ST.GAMEOVER){
    if(mx>W/2-80&&mx<W/2+80){
      if(my>334&&my<370){ initGame(0, false); startCrawl(); }
      if(my>384&&my<420){ initGame(0, false); goToHangar(); }
    }
    return;
  }

  if(state===ST.VICTORY&&victoryTimer>110){
    if(my>308&&my<344){ initGame(ngPlus+1, true); startCrawl(); }
    if(my>356&&my<392){ initGame(ngPlus, true); goToHangar(); }
    if(my>404&&my<440) state=ST.MENU;
    return;
  }

  if(state===ST.HANGAR){
    // Tab switch
    if(my>148&&my<172){ hangarTab=mx<W/2?0:1; return; }

    // Repair
    if(hp<maxHp&&my>122&&my<144){
      const cost=(maxHp-hp)*UG.shield.repairCost;
      if(save.totalCoins>=cost){save.totalCoins-=cost;hp=maxHp;writeSave();}
      return;
    }

    if(hangarTab===0){
      const ukeys=['cannon','engine','shield'];
      ukeys.forEach((key,i)=>{
        const y=178+i*82;
        if(mx>10&&mx<W-10&&my>y&&my<y+76){
          const ug=UG[key];
          const level=key==='cannon'?sessionCannon:key==='engine'?engineLevel:shieldLevel;
          const next=level+1;
          if(next<5&&save.totalCoins>=ug.costs[next]){
            save.totalCoins-=ug.costs[next];
            if(key==='cannon'){ sessionCannon=next; writeSave(); }
            else if(key==='engine'){
              engineLevel=next;
              player.speed=UG.engine.speed[engineLevel];
            } else {
              shieldLevel=next;
              maxHp=UG.shield.hp[shieldLevel];
            }
          }
        }
      });
    } else {
      PUPS.forEach((pu,i)=>{
        const y=190+i*56;
        if(mx>10&&mx<W-10&&my>y&&my<y+50){
          if(heldPowerups.includes(pu.id)) return;
          if(save.totalCoins<pu.cost) return;
          if(heldPowerups[0]===null){ save.totalCoins-=pu.cost; heldPowerups[0]=pu.id; writeSave(); }
          else if(heldPowerups[1]===null){ save.totalCoins-=pu.cost; heldPowerups[1]=pu.id; writeSave(); }
        }
      });
    }

    // Bottom buttons
    const BT=H-80;
    if(my>BT+4&&my<BT+36){
      if(sectorResult==='win'){
        if(mx>10&&mx<W/2-6)  advanceSector(true);  // replay
        if(mx>W/2+6&&mx<W-10) advanceSector(false); // next
      } else {
        advanceSector(true); // retry
      }
    }
    return;
  }
}

// ── Loop ───────────────────────────────────────────────────
frame=0;
function loop(){
  frame++;
  ctx.clearRect(0,0,W,H);
  if(state===ST.MENU)     drawMenu();
  if(state===ST.CRAWL)    drawCrawl();
  if(state===ST.PLAYING){ update(); drawGame(); }
  if(state===ST.PAUSED)   drawPause();
  if(state===ST.HANGAR)   drawHangar();
  if(state===ST.GAMEOVER){ drawGame(); drawGameOver(); }
  if(state===ST.VICTORY){
    drawGame();
    if(Math.random()<0.2) spawnExplosion(rand(0,W),rand(GY,GB),
      [C.accent,C.bright,C.danger,'#fff'][randi(0,3)],4);
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life-=0.013;
      if(p.life<=0) particles.splice(i,1);
    }
    drawVictory();
  }
  requestAnimationFrame(loop);
}

initStars();
loop();
