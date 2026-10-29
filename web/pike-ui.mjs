import {createPike,pikePickDoor,pikeResolveEvent,pikeFinishRoom,pikeNextPass,pikeLucyTeam,pikeBrainTier} from './pike.mjs';
import {createPikeBattle,repairPikeBattle} from './pike-battle.mjs';
import {TowerEngine,makeMon} from './engine.mjs';
import {BattlePresenter} from './battle-presentation.mjs';
import {bindBattleSprites} from './battle-view.mjs';
import {targetPlan} from './battle-ui.mjs';
import {pikeBattleFrame,pikeMoveControls,pikeReplacementControls} from './pike-battle-ui.mjs';
const $=x=>document.querySelector(x), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='battle-tower-emerald-reptile-v1';
let D,save=null,battle=null,pikeActions={};
const labels={trainer:'Combat Solo',double:'Combat Duo',hard_trainer:'Combat difficile + soins',wild:'Rencontre sauvage',status:'Piège de statut',quiet:'Salle paisible',full_heal:'Soins complets',partial_heal:'Soins partiels',brain:'Reine Venin Charline'};
const nameOf=id=>D.speciesNames?.[id]||id;
const sprite=(p,back=false)=>{
 const code=encodeURIComponent(D.species?.[p.species]?.sprite||p.species.toLowerCase().replaceAll('_',''));
 const folder=back?'gen5ani-back':'gen5ani';
 return '<img class="pike-sprite" src="https://play.pokemonshowdown.com/sprites/'+folder+'/'+code+'.gif" data-code="'+code+'" data-facing="'+(back?'back':'front')+'" alt="'+esc(p.name)+'" loading="eager">';
};
function spriteFallback(root){
 root.querySelectorAll('.pike-sprite').forEach(img=>{
  img.onerror=()=>{
   if(img.dataset.fallback==='png'){img.style.visibility='hidden';return;}
   img.dataset.fallback='png';
   img.src='https://play.pokemonshowdown.com/sprites/'+(img.dataset.facing==='back'?'gen5-back':'gen5')+'/'+img.dataset.code+'.png';
  };
 });
}
const hpBar=p=>'<div class="pike-health-track"><span style="width:'+Math.max(0,Math.min(100,p.hp/p.maxHp*100))+'%;background:'+(p.hp/p.maxHp<.25?'#d85c50':p.hp/p.maxHp<.5?'#e6b65c':'#67ba79')+'"></span></div>';
function combatant(p,back){
 return '<div class="pike-battler '+(back?'pike-ally':'pike-foe')+'" data-battler="'+esc(p.id)+'"><div class="pike-battler-sprite">'+sprite(p,back)+'</div><div class="pike-battler-details"><strong>'+esc(p.name)+' <small>N.'+p.level+'</small></strong>'+hpBar(p)+'<small>'+p.hp+'/'+p.maxHp+' PV · '+esc(p.status||'OK')+'</small>'+
 (Object.entries(p.stages||{}).filter(([,n])=>n).map(([stat,n])=>'<span class="pike-stage-tag">'+esc(stat.toUpperCase())+' '+(n>0?'+':'')+n+'</span>').join(''))+'</div></div>';
}
const eventIcon={full_heal:'✚',partial_heal:'✚',status:'☠',quiet:'✦',trainer:'⚔',double:'⚔',hard_trainer:'⚔',wild:'◆',brain:'♛'};
const setFor=species=>{
 const existing=D.sets?.[species];
 if(existing)return structuredClone(existing);
 const p=D.species[species],moves=(Array.isArray(D.learnsets?.[species])?D.learnsets[species]:Object.keys(D.moveData)).filter(k=>D.moveData[k]).slice(0,4);
 return {species,ability:p.abilities[0],item:'NONE',nature:'HARDY',level:50,moves,evs:[0,0,0,0,0,0],ivs:[31,31,31,31,31,31]};
};
const partySave=()=>battle?structuredClone(battle.player.party):save.party;
function persist(){
 if(!save)return;
 if(battle){save.combatActions=structuredClone(pikeActions);save.combat=Object.fromEntries(Object.entries(battle).filter(([k])=>!['data','rng','aiAction'].includes(k)));}
 localStorage.setItem(KEY,JSON.stringify(save));
 $('#pike-message').textContent='✓ Parcours enregistré sur cet appareil.';
}
function load(){try{let raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw?.pike&&raw?.sets&&raw?.party)return raw;}catch{}return null;}
function restoreBattle(raw){
 if(!raw)return null;
 const e=Object.assign(Object.create(TowerEngine.prototype),structuredClone(raw));
 e.data=D;e.rng=()=>e.random();return e;
}
function show(el){for(const id of ['pike-intro','pike-play'])$('#'+id).classList.toggle('hidden',id!==el);}
function teamBuilder(){
 const list=Object.keys(D.species).sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'fr'));
 $('#pike-builder').innerHTML=[0,1,2].map((i)=>'<label>POKÉMON '+(i+1)+'<select data-pike-species="'+i+'">'+list.map(k=>'<option value="'+esc(k)+'" '+(k===['METAGROSS','SWAMPERT','LATIOS'][i]?'selected':'')+'>'+esc(nameOf(k))+'</option>').join('')+'</select></label>').join('');
}
function start(){
 try{
  const species=[...document.querySelectorAll('[data-pike-species]')].map(s=>s.value);
  if(new Set(species).size!==3)throw Error('Choisis trois espèces différentes.');
  const levelMode=$('#pike-level').value;
  const level=levelMode==='50'?50:60;
  const sets=species.map(key=>({...setFor(key),level}));
  const pike=createPike(sets);
  const temp=createPikeBattle(D,{sets,party:sets.map(p=>makeMon(p,D,'human',p.level)),opponents:[setFor('SEVIPER')],mode:'single',levelMode,seed:83479,trainer:'Préparation'});
  save={pike,sets,levelMode,party:structuredClone(temp.player.party),combat:null,history:[]};
  battle=null;persist();render();show('pike-play');
 }catch(err){$('#pike-message').textContent=err.message;}
}
function setupBattle(door){
 const pike=save.pike;
 let opponents,mode='single',title=labels[door.event];
 if(door.event==='brain'){
  opponents=pikeLucyTeam(door.kind,D,save.levelMode==='50'?50:Math.max(60,...save.sets.map(p=>p.level)));
  title='Reine Venin Charline · Symbole Chance '+(door.kind==='silver'?'Argent':'Or');
 }else if(door.event==='wild'){
  const pool=['SEVIPER','MILOTIC','DUSCLOPS','BRELOOM','ELECTRODE','WOBBUFFET'].filter(k=>D.species[k]);
  opponents=[setFor(pool[Math.floor(Math.random()*pool.length)])];
 }else {
  const count=door.event==='double'?2:3;
  mode=door.event==='double'?'double':'single';
  let candidate=Object.values(D.sets||{}).filter(p=>p?.species&&D.species[p.species]&&p.moves?.every(k=>D.moveData[k]));
  if(candidate.length<count)candidate=Object.keys(D.species).slice(0,40).map(setFor);
  opponents=Array.from({length:count},(_,i)=>structuredClone(candidate[(Math.floor(Math.random()*candidate.length)+i)%candidate.length]));
 }
 const level=save.levelMode==='50'?50:Math.max(60,...save.sets.map(p=>p.level));
 opponents=opponents.map(p=>({...p,level}));
 // Each expedition battle runs the actual Frontier engine, with its normal CPU AI.
 const e=createPikeBattle(D,{sets:save.sets,party:save.party,opponents,mode,levelMode:save.levelMode,
  seed:Math.floor(Math.random()*0xffffffff),trainer:title});
 e.trainerData={id:'pike-'+save.pike.totalRooms,name:title};
 battle=e;pikeActions={};save.combat=null;persist();
}
function playerCard(p){
 const ko=p.hp<=0;
 const condition=ko?'<span class="pike-ko-badge" aria-label="Pokémon K.O.">K.O.</span>':
  p.status?'<span class="pike-condition">'+esc(p.status.toUpperCase())+'</span>':'<span class="pike-ok">OK</span>';
 return '<div class="pike-mon '+(ko?'pike-mon-ko':'')+'"><b>'+esc(p.name)+'</b>'+
  '<span class="pike-mon-vitals">'+Math.max(0,p.hp)+' / '+p.maxHp+' PV · '+condition+'</span>'+
  '<div class="hp-meter"><span class="'+(p.hp/p.maxHp<.25?'low':p.hp/p.maxHp<.5?'medium':'')+'" style="width:'+Math.max(0,100*p.hp/p.maxHp)+'%"></span></div>'+
  '<small>'+esc(p.ability||'')+' · '+esc(p.item||'NONE')+'</small></div>';
}
function roomView(){
 const pike=save.pike,stage=$('#pike-stage');
 if(pike.phase==='doors'){
  stage.innerHTML='<div class="pike-scene"><div class="pike-scene-banner"><span>◈ LABYRINTHE · '+pike.pass+' / '+(pike.room+1)+'</span><span>REPTILE DE COMBAT</span></div><h3>CHOISIS TON CHEMIN</h3><p class="pike-hint">'+esc(pike.choices.hint)+' <b> · Porte '+(pike.choices.hintDoor===null?'?':pike.choices.hintDoor+1)+'</b></p><div class="pike-doors">'+pike.choices.doors.map((door,i)=>'<button class="pike-door" data-door="'+i+'"><img src="./pike-door.svg" alt="" class="pike-door-art"><b>PORTE '+(i+1)+'</b><small>ENTRER ▶</small></button>').join('')+'</div><p class="pike-scene-foot">Les événements sont dissimulés derrière les portes. L’indice ne concerne qu’un seul chemin.</p></div>';
  stage.querySelectorAll('[data-door]').forEach(el=>el.onclick=()=>pickDoor(+el.dataset.door));
 }else if(pike.phase==='event'){
  stage.innerHTML='<div class="pike-event-scene"><div class="pike-event-glyph">'+(eventIcon[pike.roomEvent]||'✦')+'</div><h3>ÉVÉNEMENT · '+esc(labels[pike.roomEvent])+'</h3><p>Un événement se déclenche dans cette salle.</p><button id="pike-event" class="btn primary">DÉCOUVRIR L’ÉVÉNEMENT</button></div>';
  $('#pike-event').onclick=()=>{try{pikeResolveEvent(pike,save.party,Math.random,D.moveData,D);persist();render();}catch(e){$('#pike-message').textContent=e.message;}};
 }else if(pike.phase==='resolved'){
  stage.innerHTML='<div class="pike-event-scene"><div class="pike-event-glyph">'+(eventIcon[pike.roomEvent]||'✦')+'</div><h3>SALLE TRAVERSÉE</h3><p>'+esc(pike.eventMessage||'Combat remporté !')+'</p><button id="pike-continue" class="btn primary">PASSER À LA SALLE SUIVANTE ▶</button></div>';
  $('#pike-continue').onclick=()=>{pikeFinishRoom(pike,save.party);persist();render();};
 }else if(pike.phase==='pass_complete'){
  stage.innerHTML='<h3>🏆 PASSAGE '+pike.pass+' TERMINÉ</h3><p>Tu as franchi les sept portes. '+(pike.silver?'Symbole Chance Argent obtenu. ':'')+(pike.gold?'Symbole Chance Or obtenu.':'')+'</p><button class="btn primary" id="pike-nextpass">PASSAGE SUIVANT ▶</button>';
  $('#pike-nextpass').onclick=()=>{pikeNextPass(pike,save.party);persist();render();};
 }else if(pike.phase==='lost')stage.innerHTML='<h3>DÉFI TERMINÉ</h3><p>Tous tes Pokémon sont K.O. Le chemin s’arrête ici. Recommence un parcours.</p><button id="pike-retry" class="btn">RECOMMENCER</button>';
 if($('#pike-retry'))$('#pike-retry').onclick=restart;
}
function pickDoor(index){
 try{
  if(!save.party.some(p=>p.hp>0)){save.pike.phase='lost';persist();render();return;}
  const door=pikePickDoor(save.pike,index);
  if(save.pike.phase==='battle')setupBattle(door);
  persist();render();
 }catch(err){$('#pike-message').textContent=err.message;}
}
function combatView(){
 if(!battle)return;
 repairPikeBattle(battle);
 const stage=$('#pike-stage'),snap=battle.snapshot(),foes=battle.active('opponent'),ours=battle.active('player');
 if(snap.status!=='active'){
  if(snap.status==='won'&&!save.pike.battleResolved){
   save.party=structuredClone(battle.player.party).map(p=>({...p,active:false}));
   save.pike.battleResolved=true;save.pike.phase='resolved';
   save.pike.eventMessage='Combat remporté !'+(save.pike.roomEvent==='hard_trainer'?' L’infirmière soigne ton équipe.':'');
   if(save.pike.roomEvent==='hard_trainer')save.party.forEach(p=>{p.hp=p.maxHp;p.status='';p.sleep=0;p.toxic=0;p.pp=Object.fromEntries(Object.entries(p.pp).map(([k,v])=>[k,D.moveData[k]?.pp??v]));});
   battle=null;save.combat=null;persist();render();return;
  }
  if(snap.status==='lost'||(!ours.length&&!battle.player.party.some(p=>p.hp>0))){
   save.pike.phase='lost';save.party=structuredClone(battle.player.party);battle=null;save.combat=null;persist();render();return;
  }
 }
 const required=(battle.pendingReplacements||[]).filter(r=>r.owner==='human');
 if(required.length)stage.innerHTML=pikeBattleFrame(battle,pikeReplacementControls(battle));
 else stage.innerHTML=pikeBattleFrame(battle,pikeMoveControls(battle,pikeActions));
 bindBattleSprites(stage);
 stage.querySelector('#pike-log-toggle').onclick=()=>stage.querySelector('#battle-log').classList.toggle('hidden');
 stage.querySelectorAll('[data-stat-info]').forEach(btn=>btn.onclick=()=>{
  const m=battle.get(btn.dataset.statInfo);
  if(!m)return;
  const fields=Object.entries(m.stats||{}).map(([k,v])=>k.toUpperCase()+' : '+v+' ('+((m.stages||{})[k]||0)+' niveau(x))').join('\n');
  alert(m.name+'\n'+fields+'\nTalent : '+m.ability+'\nObjet : '+m.item);
 });
 if(required.length){
  stage.querySelectorAll('[data-pike-replace]').forEach(btn=>btn.onclick=()=>{
   try{battle.replaceFainted(required[0].fainted,btn.dataset.pikeReplace);pikeActions={};persist();render();}
   catch(e){$('#pike-message').textContent=e.message;}
  });
  return;
 }
 stage.querySelectorAll('[data-actor][data-move]').forEach(btn=>btn.onclick=()=>{
  const actor=btn.dataset.actor,move=btn.dataset.move,plan=targetPlan(battle,actor,move);
  pikeActions[actor]={actor,type:'move',move,target:plan.targets[0]?.id||battle.active('opponent')[0]?.id};
  persist();render();
 });
 stage.querySelectorAll('[data-pike-target-actor]').forEach(btn=>btn.onclick=()=>{
  const a=pikeActions[btn.dataset.pikeTargetActor];if(a)a.target=btn.dataset.pikeTargetId;
  render();
 });
 stage.querySelectorAll('[data-pike-baton-actor]').forEach(btn=>btn.onclick=()=>{
  const a=pikeActions[btn.dataset.pikeBatonActor];if(a)a.to=btn.dataset.pikeBatonTo;
  render();
 });
 stage.querySelectorAll('[data-pike-switch-actor]').forEach(btn=>btn.onclick=()=>{
  const actor=btn.dataset.pikeSwitchActor;
  pikeActions[actor]={actor,type:'switch',to:btn.dataset.pikeSwitchTo};
  persist();render();
 });
 const execute=stage.querySelector('#pike-turn');
 if(execute)execute.onclick=async()=>{
  execute.disabled=true;
  try{
   const own=battle.active('player').filter(m=>m.owner==='human'||m.owner==='human2');
   const choices=own.map(m=>{
    if(m.charging)return {actor:m.id,type:'move',move:m.charging.move,target:m.charging.target};
    return pikeActions[m.id];
   });
   const oldLogLength=battle.log.length;
   battle.turnActions(choices);
   const visualEvents=battle.log.slice(0,battle.log.length-oldLogLength).reverse();
   pikeActions={};persist();render();
   const arena=$('#pike-stage #battle-arena');
   if(arena)await new BattlePresenter(arena).play(visualEvents,{moveAnimations:true,animationSpeed:'fast',respectReducedMotion:true});
  }catch(e){$('#pike-message').textContent='Combat : '+e.message;render();}
 };

}
function render(){
 if(!save)return;
 const pike=save.pike;
 $('#pike-progress').innerHTML='<strong>PASSAGE '+pike.pass+' · PORTE '+Math.min(7,pike.room+1)+'/7</strong><small>'+(pike.totalRooms*2)+' SALLES TRAVERSÉES · '+(pike.silver?'🥈 ARGENT ':'')+(pike.gold?'🥇 OR':'')+'</small>';
 $('#pike-party').innerHTML='<h3>TON ÉQUIPE · ENDURANCE</h3><div class="pike-party-list">'+(battle?.player.party||save.party).map(playerCard).join('')+'</div>';
 $('#pike-history').innerHTML=pike.history.slice().reverse().map(h=>'<p>Passage '+h.pass+' · salle '+h.room+' · porte '+(h.door+1)+' · '+esc(labels[h.event]||h.event)+'</p>').join('');
 if(pike.phase==='battle'&&battle)combatView();else roomView();
}
function restart(){if(!confirm('Recommencer le Reptile ? La progression du parcours sera remplacée.'))return;localStorage.removeItem(KEY);save=null;battle=null;show('pike-intro');$('#pike-message').textContent='Nouveau parcours prêt.';}
async function init(){
 const response=await fetch('./data/catalog.json');if(!response.ok)throw Error('Catalogue indisponible');D=await response.json();
 teamBuilder();
 $('#pike-start').onclick=start;
 $('#pike-resume').onclick=()=>{save=load();battle=restoreBattle(save.combat);if(battle)repairPikeBattle(battle);pikeActions=save.combatActions||{};show('pike-play');render();};
 $('#pike-save').onclick=persist;
 $('#pike-reset').onclick=restart;
 $('#pike-leave').onclick=()=>{persist();show('pike-intro');$('#pike-resume').classList.remove('hidden');};
 if(load())$('#pike-resume').classList.remove('hidden');
}
init().catch(err=>$('#pike-message').textContent=err.message);
