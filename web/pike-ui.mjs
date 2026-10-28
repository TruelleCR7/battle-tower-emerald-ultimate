import {createPike,pikePickDoor,pikeResolveEvent,pikeFinishRoom,pikeNextPass,pikeLucyTeam,pikeBrainTier} from './pike.mjs';
import {createLabBattle} from './lab-engine.mjs';
import {TowerEngine} from './engine.mjs';
import {BattlePresenter} from './battle-presentation.mjs';
const $=x=>document.querySelector(x), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='battle-tower-emerald-reptile-v1';
let D,save=null,battle=null;
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
 if(battle)save.combat=Object.fromEntries(Object.entries(battle).filter(([k])=>!['data','rng','aiAction'].includes(k)));
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
  const temp=createLabBattle(D,{mode:'single',player:sets,opponent:[setFor('SEVIPER')],seed:83479});
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
 // Keep all 3 challengers in solo and duo; each side's action logic uses the common engine.
 const e=createLabBattle(D,{mode,player:save.sets,opponent:opponents,seed:Math.floor(Math.random()*0xffffffff),deferEntryEffects:true});
 e.player.party=structuredClone(save.party);
 e.player.party.forEach(p=>{p.active=false;p.owner='human';p.guarded=false;p.flinched=false;p.charging=null;});
 e.player.active=[];
 e.initializeSide('player');
 e.opponent.party.forEach(p=>p.owner='cpu');
 // Trainer AI remains the same source-backed AI as the regular Battle Tower.
 e.trainer=title;e.trainerData={id:'pike-'+save.pike.totalRooms,name:title};
 e.write('Reptile de Combat : '+title);
 e.entryEffects([...e.active('opponent'),...e.active('player')]);
 battle=e;save.combat=null;persist();
}
function playerCard(p){
 return '<div class="pike-mon"><b>'+esc(p.name)+'</b><span>'+p.hp+'/'+p.maxHp+' PV · '+esc(p.status||'OK')+'</span><small>'+esc(p.ability||'')+' · '+esc(p.item||'NONE')+'</small></div>';
}
function roomView(){
 const pike=save.pike,stage=$('#pike-stage');
 if(pike.phase==='doors'){
  stage.innerHTML='<div class="pike-scene"><div class="pike-scene-banner"><span>◈ LABYRINTHE · '+pike.pass+' / '+(pike.room+1)+'</span><span>REPTILE DE COMBAT</span></div><h3>CHOISIS TON CHEMIN</h3><p class="pike-hint">'+esc(pike.choices.hint)+' <b> · Porte '+(pike.choices.hintDoor===null?'?':pike.choices.hintDoor+1)+'</b></p><div class="pike-doors">'+pike.choices.doors.map((door,i)=>'<button class="pike-door" data-door="'+i+'"><img src="./pike-door.svg" alt="" class="pike-door-art"><b>PORTE '+(i+1)+'</b><small>ENTRER ▶</small></button>').join('')+'</div><p class="pike-scene-foot">Les événements sont dissimulés derrière les portes. L’indice ne concerne qu’un seul chemin.</p></div>';
  stage.querySelectorAll('[data-door]').forEach(el=>el.onclick=()=>pickDoor(+el.dataset.door));
 }else if(pike.phase==='event'){
  stage.innerHTML='<div class="pike-event-scene"><div class="pike-event-glyph">'+(eventIcon[pike.roomEvent]||'✦')+'</div><h3>ÉVÉNEMENT · '+esc(labels[pike.roomEvent])+'</h3><p>Un événement se déclenche dans cette salle.</p><button id="pike-event" class="btn primary">DÉCOUVRIR L’ÉVÉNEMENT</button></div>';
  $('#pike-event').onclick=()=>{try{pikeResolveEvent(pike,save.party,Math.random,D.moveData);persist();render();}catch(e){$('#pike-message').textContent=e.message;}};
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
  const door=pikePickDoor(save.pike,index);
  if(save.pike.phase==='battle')setupBattle(door);
  persist();render();
 }catch(err){$('#pike-message').textContent=err.message;}
}
function combatView(){
 if(!battle)return;
 const stage=$('#pike-stage'),snap=battle.snapshot(),foes=battle.active('opponent'),ours=battle.active('player');
 if(snap.status!=='active'){
  if(snap.status==='won'&&!save.pike.battleResolved){
   save.party=structuredClone(battle.player.party).map(p=>({...p,active:false}));
   save.pike.battleResolved=true;save.pike.phase='resolved';
   save.pike.eventMessage='Combat remporté !'+(save.pike.roomEvent==='hard_trainer'?' L’infirmière soigne ton équipe.':'');
   if(save.pike.roomEvent==='hard_trainer')save.party.forEach(p=>{p.hp=p.maxHp;p.status='';p.sleep=0;p.toxic=0;p.pp=Object.fromEntries(Object.entries(p.pp).map(([k,v])=>[k,D.moveData[k]?.pp??v]));});
   battle=null;save.combat=null;persist();render();return;
  }
  if(snap.status==='lost'){
   save.pike.phase='lost';save.party=structuredClone(battle.player.party);battle=null;save.combat=null;persist();render();return;
  }
 }
 const required=(battle.pendingReplacements||[]).filter(r=>r.owner==='human');
 if(required.length){
  const r=required[0],bench=battle.bench(r.side,r.owner);
  stage.innerHTML='<div class="pike-battle-shell"><div class="pike-battle-top">⚔ REMPLACEMENT APRÈS K.O.</div><div class="pike-arena"><div class="pike-battle-row pike-battle-enemy">'+foes.map(p=>combatant(p,false)).join('')+'</div><div class="pike-battle-row pike-battle-player">'+ours.map(p=>combatant(p,true)).join('')+'</div></div><h3>UN POKÉMON EST K.O.</h3><select id="pike-replacement">'+bench.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select><button id="pike-send" class="btn primary">ENVOYER</button></div>';spriteFallback(stage);
  $('#pike-send').onclick=()=>{try{battle.replaceFainted(r.fainted,$('#pike-replacement').value);persist();render();}catch(e){$('#pike-message').textContent=e.message;}};
  return;
 }
 stage.innerHTML='<div class="pike-battle-shell"><div class="pike-battle-top"><span>⚔ '+esc(battle.trainer)+'</span><span>TOUR '+(battle.turn+1)+' · '+(battle.mode==='double'?'DUO':'SOLO')+'</span></div>'+
 '<div class="pike-arena" aria-label="Terrain de combat Pokémon"><div class="pike-battle-background"><span class="pike-battle-pillar pike-pillar-left"></span><span class="pike-battle-pillar pike-pillar-right"></span></div><div class="pike-battle-row pike-battle-enemy">'+foes.map(p=>combatant(p,false)).join('')+'</div><div class="pike-battle-row pike-battle-player">'+ours.map(p=>combatant(p,true)).join('')+'</div></div>'+
 '<div class="pike-dialogue" aria-live="polite">'+(battle.log.slice(0,3).map(e=>esc(e.text)).join('<span class="pike-dialogue-separator"> · </span>')||'Un combat commence !')+'</div>'+
 '<div class="pike-commands"><h3>CHOISIS LES ACTIONS DE TON ÉQUIPE</h3>'+ours.map(p=>{
  const moves=p.charging?[p.charging.move]:p.moves.filter(k=>p.pp[k]>0&&(!p.choiceLock||p.choiceLock===k));
  const usable=moves.length?moves:['STRUGGLE'];
  return '<fieldset data-actor="'+esc(p.id)+'"><legend>'+esc(p.name)+(p.charging?' · ATTAQUE EN PRÉPARATION':'')+'</legend><div class="pike-action-grid"><label>CAPACITÉ<select data-move>'+usable.map(k=>'<option value="'+esc(k)+'">'+esc(D.moveData[k]?.name||k)+' · '+(p.pp[k]??'—')+' PP</option>').join('')+'</select></label><label>CIBLE<select data-target>'+foes.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>CHANGEMENT<select data-switch '+(p.charging?'disabled':'')+'><option value="">— Attaquer —</option>'+battle.bench('player',p.owner).map(q=>'<option value="'+esc(q.id)+'">'+esc(q.name)+'</option>').join('')+'</select></label></div><div class="pike-move-summary">'+usable.map(k=>'<span class="pike-move-badge">'+esc(D.moveData[k]?.name||k)+' <small>'+esc(D.moveData[k]?.category||'')+'</small></span>').join('')+'</div></fieldset>';
 }).join('')+'</div><div class="pike-battle-actions"><button class="btn primary" id="pike-turn">EXÉCUTER LE TOUR ▶</button></div><details class="pike-log-panel" open><summary>JOURNAL DU COMBAT · '+battle.log.length+' ÉVÉNEMENTS</summary><div class="pike-combatlog">'+battle.log.slice(0,45).map(e=>'<p><small>TOUR '+e.turn+'</small> '+esc(e.text)+'</p>').join('')+'</div></details></div>';
 spriteFallback(stage);
 $('#pike-turn').onclick=()=>{
  try{
   const choices=[...stage.querySelectorAll('[data-actor]')].map(box=>{
    const actor=box.dataset.actor,to=box.querySelector('[data-switch]').value;
    return to?{actor,type:'switch',to}:{actor,type:'move',move:box.querySelector('[data-move]').value,target:box.querySelector('[data-target]').value};
   });
   const oldLogLength=battle.log.length;
   battle.turnActions(choices);const visualEvents=battle.log.slice(0,battle.log.length-oldLogLength).reverse();persist();render();
   const arena=$('#pike-stage .pike-arena');if(arena)new BattlePresenter(arena).play(visualEvents,{moveAnimations:true,animationSpeed:'fast',respectReducedMotion:true}).catch(console.error);
  }catch(e){$('#pike-message').textContent='Combat : '+e.message;}
 };
}
function render(){
 if(!save)return;
 const pike=save.pike;
 $('#pike-progress').innerHTML='<strong>PASSAGE '+pike.pass+' · PORTE '+Math.min(7,pike.room+1)+'/7</strong><small>'+(pike.totalRooms*2)+' SALLES TRAVERSÉES · '+(pike.silver?'🥈 ARGENT ':'')+(pike.gold?'🥇 OR':'')+'</small>';
 $('#pike-party').innerHTML='<h3>TON ÉQUIPE · ENDURANCE</h3>'+(battle?.player.party||save.party).map(playerCard).join('');
 $('#pike-history').innerHTML=pike.history.slice().reverse().map(h=>'<p>Passage '+h.pass+' · salle '+h.room+' · porte '+(h.door+1)+' · '+esc(labels[h.event]||h.event)+'</p>').join('');
 if(pike.phase==='battle'&&battle)combatView();else roomView();
}
function restart(){if(!confirm('Recommencer le Reptile ? La progression du parcours sera remplacée.'))return;localStorage.removeItem(KEY);save=null;battle=null;show('pike-intro');$('#pike-message').textContent='Nouveau parcours prêt.';}
async function init(){
 const response=await fetch('./data/catalog.json');if(!response.ok)throw Error('Catalogue indisponible');D=await response.json();
 teamBuilder();
 $('#pike-start').onclick=start;
 $('#pike-resume').onclick=()=>{save=load();battle=restoreBattle(save.combat);show('pike-play');render();};
 $('#pike-save').onclick=persist;
 $('#pike-reset').onclick=restart;
 $('#pike-leave').onclick=()=>{persist();show('pike-intro');$('#pike-resume').classList.remove('hidden');};
 if(load())$('#pike-resume').classList.remove('hidden');
}
init().catch(err=>$('#pike-message').textContent=err.message);
