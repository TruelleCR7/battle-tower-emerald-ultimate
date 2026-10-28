import {createPike,pikePickDoor,pikeResolveEvent,pikeFinishRoom,pikeNextPass,pikeLucyTeam,pikeBrainTier} from './pike.mjs';
import {createLabBattle} from './lab-engine.mjs';
import {TowerEngine} from './engine.mjs';
const $=x=>document.querySelector(x), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
const KEY='battle-tower-emerald-reptile-v1';
let D,save=null,battle=null;
const labels={trainer:'Combat Solo',double:'Combat Duo',hard_trainer:'Combat difficile + soins',wild:'Rencontre sauvage',status:'Piège de statut',quiet:'Salle paisible',full_heal:'Soins complets',partial_heal:'Soins partiels',brain:'Reine Venin Charline'};
const nameOf=id=>D.speciesNames?.[id]||id;
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
 const e=createLabBattle(D,{mode,player:save.sets,opponent:opponents,seed:Math.floor(Math.random()*0xffffffff)});
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
  stage.innerHTML='<h3>LES TROIS PORTES</h3><p class="pike-hint">🔮 '+esc(pike.choices.hint)+' · Porte '+(pike.choices.hintDoor===null?'?':pike.choices.hintDoor+1)+'</p><div class="pike-doors">'+pike.choices.doors.map((door,i)=>'<button class="pike-door" data-door="'+i+'"><span>🚪</span><b>PORTE '+(i+1)+'</b><small>Choisir ce chemin</small></button>').join('')+'</div><p>Le contenu des autres portes reste inconnu. Une porte peut aider ton équipe ou la mettre en danger.</p>';
  stage.querySelectorAll('[data-door]').forEach(el=>el.onclick=()=>pickDoor(+el.dataset.door));
 }else if(pike.phase==='event'){
  stage.innerHTML='<h3>ÉVÉNEMENT · '+esc(labels[pike.roomEvent])+'</h3><p>Un événement se déclenche dans cette salle.</p><button id="pike-event" class="btn primary">DÉCOUVRIR L’ÉVÉNEMENT</button>';
  $('#pike-event').onclick=()=>{try{pikeResolveEvent(pike,save.party);persist();render();}catch(e){$('#pike-message').textContent=e.message;}};
 }else if(pike.phase==='resolved'){
  stage.innerHTML='<h3>SALLE TRAVERSÉE</h3><p>'+esc(pike.eventMessage||'Combat remporté !')+'</p><button id="pike-continue" class="btn primary">PASSER À LA SALLE SUIVANTE ▶</button>';
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
   if(save.pike.roomEvent==='hard_trainer')save.party.forEach(p=>{p.hp=p.maxHp;p.status='';p.sleep=0;p.toxic=0;});
   battle=null;save.combat=null;persist();render();return;
  }
  if(snap.status==='lost'){
   save.pike.phase='lost';save.party=structuredClone(battle.player.party);battle=null;save.combat=null;persist();render();return;
  }
 }
 const required=(battle.pendingReplacements||[]).filter(r=>r.owner==='human');
 if(required.length){
  const r=required[0],bench=battle.bench(r.side,r.owner);
  stage.innerHTML='<h3>UN POKÉMON EST K.O.</h3><select id="pike-replacement">'+bench.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select><button id="pike-send" class="btn primary">ENVOYER</button>';
  $('#pike-send').onclick=()=>{try{battle.replaceFainted(r.fainted,$('#pike-replacement').value);persist();render();}catch(e){$('#pike-message').textContent=e.message;}};
  return;
 }
 stage.innerHTML='<h3>⚔ '+esc(battle.trainer)+' · TOUR '+(battle.turn+1)+'</h3><div class="pike-opponent">'+foes.map(playerCard).join('')+'</div><div class="pike-commands">'+ours.map(p=>{
  const moves=p.charging?[p.charging.move]:p.moves.filter(k=>p.pp[k]>0);
  return '<fieldset data-actor="'+p.id+'"><legend>'+esc(p.name)+(p.charging?' · CHARGE':'')+'</legend><label>CAPACITÉ<select data-move>'+moves.map(k=>'<option value="'+k+'">'+esc(D.moveData[k]?.name||k)+' · '+p.pp[k]+' PP</option>').join('')+'</select></label><label>CIBLE<select data-target>'+foes.map(e=>'<option value="'+e.id+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>CHANGEMENT<select data-switch><option value="">— Attaquer —</option>'+battle.bench('player',p.owner).map(q=>'<option value="'+q.id+'">'+esc(q.name)+'</option>').join('')+'</select></label></fieldset>';
 }).join('')+'</div><button class="btn primary" id="pike-turn">EXÉCUTER LE TOUR ▶</button><details open><summary>JOURNAL DU COMBAT</summary><div class="pike-combatlog">'+battle.log.slice(0,24).map(e=>'<p>Tour '+e.turn+' · '+esc(e.text)+'</p>').join('')+'</div></details>';
 $('#pike-turn').onclick=()=>{
  try{
   const choices=[...stage.querySelectorAll('[data-actor]')].map(box=>{
    const actor=box.dataset.actor,to=box.querySelector('[data-switch]').value;
    return to?{actor,type:'switch',to}:{actor,type:'move',move:box.querySelector('[data-move]').value,target:box.querySelector('[data-target]').value};
   });
   battle.turnActions(choices);persist();render();
  }catch(e){$('#pike-message').textContent='Combat : '+e.message;}
 };
}
function render(){
 if(!save)return;
 const pike=save.pike;
 $('#pike-progress').innerHTML='<strong>PASSAGE '+pike.pass+' · PORTE '+Math.min(7,pike.room+1)+'/7</strong><small>'+pike.totalRooms+' SALLES TRAVERSÉES · '+(pike.silver?'🥈 ARGENT ':'')+(pike.gold?'🥇 OR':'')+'</small>';
 $('#pike-party').innerHTML='<h3>TON ÉQUIPE · ENDURANCE</h3>'+save.party.map(playerCard).join('');
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
