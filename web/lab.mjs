import {createLabBattle,labRequiredActions,playLabTurn,labReplacements,labReplace} from './lab-engine.mjs';
import {STAT_KEYS,STAT_NAMES,effectiveStat} from './battle-stats.mjs';
import {moveDetails} from './split-mode.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let D,battle,setup,teams,version=0;
const available=(species)=>Object.keys(D.species).sort((a,b)=>(D.speciesNames[a]||a).localeCompare(D.speciesNames[b]||b,'fr'));
const speciesOptions=()=>available().map(k=>'<option value="'+esc(k)+'">'+esc(D.speciesNames[k]||k)+'</option>').join('');
const moveOptions=()=>Object.keys(D.moveData).sort().map(k=>'<option value="'+esc(k)+'">'+esc(D.moveData[k].name||k)+' · '+esc(k)+'</option>').join('');
const itemOptions=()=>Object.keys(D.items||{NONE:1}).sort().map(k=>'<option value="'+esc(k)+'">'+esc(k.replaceAll('_',' '))+'</option>').join('');
const natureOptions=()=>D.natures.map(k=>'<option value="'+esc(k)+'">'+esc(k)+'</option>').join('');
function defaultSet(species){
 const k=D.species[species]?species:Object.keys(D.species)[0];
 const learnt=Array.isArray(D.learnsets?.[k])?D.learnsets[k]:Object.keys(D.moveData);
 const moves=learnt.filter(x=>D.moveData[x]).slice(0,4);
 return {species:k,level:50,nature:D.natures.includes('HARDY')?'HARDY':D.natures[0],
  ability:D.species[k].abilities[0],item:'NONE',moves:moves.length?moves:[Object.keys(D.moveData)[0]],
  evs:[0,0,0,0,0,0],ivs:[31,31,31,31,31,31]};
}
function selectOptions(options,value){return options.replace('value="'+esc(value)+'"','value="'+esc(value)+'" selected');}
function card(side,i,set){
 const species=D.species[set.species];
 const speciesHTML=selectOptions(speciesOptions(),set.species);
 const abilities=(species?.abilities||[]).map(k=>'<option value="'+esc(k)+'" '+(set.ability===k?'selected':'')+'>'+esc(k.replaceAll('_',' '))+'</option>').join('');
 const moves=[0,1,2,3].map(n=>'<label>CAPACITÉ '+(n+1)+'<select data-move="'+n+'"><option value="">— Aucune —</option>'+selectOptions(moveOptions(),set.moves[n]||'')+'</select></label>').join('');
 return '<article class="lab-mon-config" data-team="'+side+'" data-index="'+i+'"><div class="lab-heading"><b>POKÉMON '+(i+1)+'</b><button class="btn" data-remove="'+side+':'+i+'" '+(teams[side].length<=1?'disabled':'')+'>RETIRER</button></div>'+
 '<label>ESPÈCE<select data-field="species">'+speciesHTML+'</select></label><div class="lab-mini-grid"><label>NIVEAU<input type="number" min="1" max="100" data-field="level" value="'+set.level+'"></label><label>TALENT<select data-field="ability">'+abilities+'</select></label><label>OBJET<select data-field="item">'+selectOptions(itemOptions(),set.item)+'</select></label><label>NATURE<select data-field="nature">'+selectOptions(natureOptions(),set.nature)+'</select></label></div>'+
 '<details><summary>CAPACITÉS · EV / IV</summary><div class="lab-mini-grid">'+moves+'</div><h4>EV — PV / ATQ / DÉF / ATQ.SPÉ / DÉF.SPÉ / VIT</h4><div class="lab-mini-grid">'+set.evs.map((v,n)=>'<label>EV '+(n+1)+'<input type="number" data-ev="'+n+'" value="'+v+'" min="0" max="255"></label>').join('')+'</div><h4>IV — même ordre</h4><div class="lab-mini-grid">'+set.ivs.map((v,n)=>'<label>IV '+(n+1)+'<input type="number" data-iv="'+n+'" value="'+v+'" min="0" max="31"></label>').join('')+'</div></details></article>';
}
function renderSetup(){
 $('#lab-player-team').innerHTML=teams.player.map((set,i)=>card('player',i,set)).join('');
 $('#lab-opponent-team').innerHTML=teams.opponent.map((set,i)=>card('opponent',i,set)).join('');
 $$('[data-team]').forEach(el=>{
  const {team,index}=el.dataset,set=teams[team][+index];
  el.querySelector('[data-field="species"]').onchange=e=>{teams[team][+index]=defaultSet(e.target.value);renderSetup();};
  for(const name of ['level','ability','item','nature'])el.querySelector('[data-field="'+name+'"]').onchange=e=>{set[name]=name==='level'?Number(e.target.value):e.target.value;};
  el.querySelectorAll('[data-move]').forEach(x=>x.onchange=e=>{const n=+x.dataset.move;set.moves[n]=e.target.value;set.moves=set.moves.filter(Boolean);renderSetup();});
  el.querySelectorAll('[data-ev]').forEach(x=>x.onchange=e=>{set.evs[+x.dataset.ev]=Number(e.target.value);});
  el.querySelectorAll('[data-iv]').forEach(x=>x.onchange=e=>{set.ivs[+x.dataset.iv]=Number(e.target.value);});
 });
 $$('[data-remove]').forEach(b=>b.onclick=()=>{const [side,index]=b.dataset.remove.split(':');teams[side].splice(+index,1);renderSetup();});
}
function start(){
 try{
  setup={mode:$('#lab-mode').value,splitMode:$('#lab-split').value,seed:Number($('#lab-seed').value),player:structuredClone(teams.player),opponent:structuredClone(teams.opponent)};
  battle=createLabBattle(D,setup);
  $('#lab-setup').classList.add('hidden');$('#lab-battle').classList.remove('hidden');$('#lab-setup-error').textContent='';
  renderBattle();
 }catch(e){$('#lab-setup-error').textContent=e.message;}
}
function statusInfo(m){
 const details=STAT_KEYS.filter(k=>m.stages?.[k]).map(k=>STAT_NAMES[k]+': '+(m.stages[k]>0?'+':'')+m.stages[k]).join(' · ');
 return '<article class="lab-fighter"><strong>'+esc(m.name)+' <small>Nv '+m.level+'</small></strong>'+
 '<span>'+m.hp+'/'+m.maxHp+' PV · '+esc(m.status||'Aucun statut')+' · '+esc(m.ability)+'</span>'+
 '<div class="lab-hp"><span style="width:'+Math.max(0,Math.min(100,m.hp/m.maxHp*100))+'%"></span></div>'+
 '<small>'+esc(details||'Statistiques neutres')+'</small><small>ATQ '+effectiveStat(battle,m,'atk')+' · DÉF '+effectiveStat(battle,m,'def')+' · ATQ.SPÉ '+effectiveStat(battle,m,'spa')+' · DÉF.SPÉ '+effectiveStat(battle,m,'spd')+' · VIT '+effectiveStat(battle,m,'spe')+'</small>'+
 (m.charging?'<strong class="lab-active">PRÉPARATION : '+esc(D.moveData[m.charging.move]?.name||m.charging.move)+' · attaque au prochain tour</strong>':'')+
 (m.active?'<span class="lab-active">ACTIF</span>':'<span class="lab-bench">RÉSERVE</span>')+'</article>';
}
function actionBox({id,name,side,moves,pp,bench},targets){
 const user=battle.get(id);
 return '<div class="lab-action" data-actor="'+esc(id)+'"><b>'+esc(name)+' · '+(side==='player'?'BLEU':'ROUGE')+'</b>'+(user.charging?'<p><strong>Tour de libération automatique : '+esc(D.moveData[user.charging.move]?.name||user.charging.move)+'</strong></p>':'')+
 '<label>ACTION<select class="lab-action-type"><option value="move">Attaquer</option>'+(bench.length?'<option value="switch">Changer de Pokémon</option>':'')+'</select></label>'+
 '<label>CAPACITÉ<select class="lab-action-move">'+moves.filter(k=>!user.charging||user.charging.move===k).map(k=>'<option value="'+esc(k)+'" '+(pp[k]<=0&&!user.charging?'disabled':'')+'>'+esc(D.moveData[k]?.name||k)+' · Puissance '+moveDetails(D.moveData[k],battle.splitMode).power+' · Précision '+moveDetails(D.moveData[k],battle.splitMode).accuracy+' · '+pp[k]+' PP</option>').join('')+'</select></label>'+
 '<label>CIBLE<select class="lab-action-target">'+targets.filter(t=>t.id!==id).map(t=>'<option value="'+esc(t.id)+'" '+(battle.sideOf(t)!==side?'selected':'')+'>'+esc(t.name)+' · '+(battle.sideOf(t)==='player'?'BLEU':'ROUGE')+'</option>').join('')+'</select></label>'+
 '<label>REMPLACER PAR<select class="lab-action-switch">'+bench.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label></div>';
}
function applySettings(){
 battle.weather=$('#lab-weather').value;
 battle.weatherTurns=battle.weather?-1:0;
 const editor=$('#lab-mon-adjustments');
 editor.querySelectorAll('[data-adjust]').forEach(el=>{
  const m=battle.get(el.dataset.adjust);if(!m)return;
  m.hp=Math.max(1,Math.min(m.maxHp,Number(el.querySelector('[data-hp]').value)||1));
  m.status=el.querySelector('[data-status]').value;
  m.sleep=m.status==='sleep'?2:0;
  m.toxic=0;
  for(const key of STAT_KEYS)m.stages[key]=Math.max(-6,Math.min(6,Number(el.querySelector('[data-stage="'+key+'"]').value)||0));
 });
 battle.write('Conditions du laboratoire modifiées manuellement.');
 renderBattle();
}
function adjustments(){
 return ['player','opponent'].flatMap(side=>battle[side].party).map(m=>
 '<fieldset data-adjust="'+esc(m.id)+'"><legend>'+esc(m.name)+'</legend><label>PV<input type="number" min="1" max="'+m.maxHp+'" data-hp value="'+m.hp+'"></label>'+
 '<label>Statut<select data-status>'+[['','Aucun'],['burn','Brûlure'],['poison','Poison'],['toxic','Poison grave'],['paralyze','Paralysie'],['sleep','Sommeil'],['freeze','Gel']].map(([v,l])=>'<option value="'+v+'" '+(m.status===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
 STAT_KEYS.map(k=>'<label>'+STAT_NAMES[k]+'<input type="number" min="-6" max="6" data-stage="'+k+'" value="'+(m.stages[k]||0)+'"></label>').join('')+'</fieldset>').join('');
}
function renderBattle(){
 $('#lab-turn').textContent=battle.status==='active'?'TOUR '+(battle.turn+1)+' · '+(battle.mode==='double'?'DUO':'SOLO'):battle.status==='won'?'VICTOIRE BLEUE':'VICTOIRE ROUGE';
 $('#lab-player-field').innerHTML=battle.player.party.map(statusInfo).join('');
 $('#lab-opponent-field').innerHTML=battle.opponent.party.map(statusInfo).join('');
 const all=[...battle.active('player'),...battle.active('opponent')];
 $('#lab-replacements').innerHTML=labReplacements(battle).map(r=>'<div class="lab-replace" data-fainted="'+esc(r.fainted)+'"><b>K.O. · CHOISIR LE REMPLAÇANT '+(r.side==='player'?'BLEU':'ROUGE')+'</b><select>'+r.choices.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select><button class="btn primary">ENVOYER</button></div>').join('');
 $$('[data-fainted]').forEach(el=>el.querySelector('button').onclick=()=>{
  try{labReplace(battle,el.dataset.fainted,el.querySelector('select').value);renderBattle();}catch(e){$('#lab-error').textContent=e.message;}
 });
 $('#lab-actions').innerHTML=labReplacements(battle).length||battle.status!=='active'?'':labRequiredActions(battle).map(a=>actionBox(a,all)).join('');
 $('#lab-play').disabled=battle.status!=='active'||labReplacements(battle).length>0;
 $('#lab-log').innerHTML=battle.log.map(e=>'<p class="lab-event '+(e.kind||'')+'"><small>T'+e.turn+'</small> '+esc(e.text)+'</p>').join('');
 $('#lab-weather').value=battle.weather;
 $('#lab-mon-adjustments').innerHTML=adjustments();
 $('#lab-error').textContent='';
}
function play(){
 try{
  const selected={};
  $$('.lab-action').forEach(el=>{
   const actor=el.dataset.actor,type=el.querySelector('.lab-action-type').value;
   selected[actor]=type==='switch'?{actor,type,to:el.querySelector('.lab-action-switch').value}:
    {actor,type,move:el.querySelector('.lab-action-move').value,target:el.querySelector('.lab-action-target').value};
  });
  playLabTurn(battle,selected);renderBattle();
 }catch(e){$('#lab-error').textContent=e.message;console.error('Laboratoire',e);}
}
function exportScenario(){
 const contents={application:'battle-tower-combat-laboratory',schema:1,setup,state:battle.snapshot(),log:battle.log};
 const blob=new Blob([JSON.stringify(contents,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='combat-laboratoire-tour-'+battle.turn+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function main(){
 const r=await fetch('./data/catalog.json');if(!r.ok)throw Error('Catalogue de Pokémon indisponible.');
 D=await r.json();
 teams={player:[defaultSet('METAGROSS'),defaultSet('SWAMPERT'),defaultSet('LATIOS')],opponent:[defaultSet('SALAMENCE'),defaultSet('SNORLAX'),defaultSet('MILOTIC')]};
 $('#lab-mode').onchange=()=>renderSetup();
 $$('[data-lab-add]').forEach(b=>b.onclick=()=>{const side=b.dataset.labAdd;if(teams[side].length>=6)return;teams[side].push(defaultSet('PIKACHU'));renderSetup();});
 $('#lab-start').onclick=start;
 $('#lab-restart').onclick=()=>{$('#lab-battle').classList.add('hidden');$('#lab-setup').classList.remove('hidden');};
 $('#lab-play').onclick=play;
 $('#lab-export').onclick=exportScenario;
 $('#lab-settings-toggle').onclick=()=>$('#lab-conditions').classList.toggle('hidden');
 $('#lab-weather-apply').onclick=applySettings;
 renderSetup();
}
main().catch(e=>{$('#lab-setup-error').textContent=e.message;console.error(e);});
