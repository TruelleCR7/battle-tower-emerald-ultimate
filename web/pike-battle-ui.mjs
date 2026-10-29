// Same structural battle UI used in the regular Frontier battles.
// The Pike supplies its own persistent expedition state, not a second battle renderer.
import {TYPES,typeName,percent,targetPlan,groupedLog} from './battle-ui.mjs';
import {renderBattleArena,battleSprite} from './battle-view.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(p,data)=>'<img class="menu-icon" src="https://raw.githubusercontent.com/pret/pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/graphics/pokemon/'+(p.species==='UNOWN'?'unown/a':p.species.toLowerCase())+'/icon.png" alt="" loading="lazy">';
const badges=(mon,data)=>(data.species[mon.species]?.types||[]).map(t=>'<span class="type-badge" style="background:'+(TYPES[t]?.[1]||'#ccc')+'">'+esc(typeName(t))+'</span>').join('');
export function pikeBattleLog(engine){
 return groupedLog(engine.log).map(([turn,events])=>'<section class="log-turn"><h3>'+(turn?'TOUR '+String(turn).padStart(2,'0'):'ENTRÉE EN COMBAT')+'</h3><ol>'+events.map(e=>'<li class="event-'+esc(e.side||'system')+'">'+esc(e.text)+'</li>').join('')+'</ol></section>').join('');
}
export function pikeBattleFrame(engine,controls){
 const mode=engine.mode==='double'?'DUO':'SOLO';
 return '<div class="battle-title pike-shared-title"><div><small>REPTILE DE COMBAT · '+mode+'</small><h2>'+esc(engine.trainer)+'</h2></div><span class="streak">TOUR '+(engine.turn+1)+'</span></div>'+
  '<div class="pixel-frame" id="battle-board"><div class="arena" id="battle-arena">'+renderBattleArena(engine)+'</div>'+
  '<div class="controls" id="battle-controls">'+controls+'</div>'+
  '<div class="dialogue" id="battle-dialogue" aria-live="polite">'+(engine.log.filter(e=>e.turn===engine.turn).slice(0,3).map(e=>'<p>'+esc(e.text)+'</p>').join('')||'<p>Choisis une action pour commencer.</p>')+'</div></div>'+ 
  '<div class="battle-bottom"><button type="button" class="textbutton" id="pike-log-toggle">HISTORIQUE COMPLET ▾</button></div>'+
  '<div id="battle-log" class="logs hidden">'+pikeBattleLog(engine)+'</div>';
}
function memberCard(mon,data){
 return icon(mon,data)+'<span><b>'+esc(mon.name)+' · N.'+mon.level+'</b><span class="type-badges">'+badges(mon,data)+'</span>'+
  '<span class="hp-meter"><span style="width:'+Math.max(0,100*mon.hp/mon.maxHp)+'%"></span></span>'+
  '<small>'+mon.hp+'/'+mon.maxHp+' PV · '+percent(mon.hp,mon.maxHp)+' % · '+esc(mon.status||'OK')+(mon.active?' · EN JEU':'')+'</small></span>';
}
export function pikeReplacementControls(engine){
 const r=(engine.pendingReplacements||[]).find(x=>x.owner==='human');
 if(!r)return '';
 const from=engine.get(r.fainted);
 return '<section class="forced-replacement"><h3>'+esc(from?.name||'Pokémon')+' EST K.O.</h3><p>Choisis le Pokémon à envoyer. Ce remplacement ne consomme pas de tour.</p>'+
  '<div class="bench-list">'+engine.bench(r.side,r.owner).map(mon=>'<button class="bench-card" data-pike-replace="'+esc(mon.id)+'">'+memberCard(mon,engine.data)+'</button>').join('')+'</div></section>';
}
export function pikeMoveControls(engine,actions){
 const own=engine.active('player').filter(m=>m.owner==='human'||m.owner==='human2');
 let html='';
 for(const [i,mon] of own.entries()){
  const choice=actions[mon.id];
  const moves=mon.charging?[mon.charging.move]:
   mon.moves.filter(k=>(mon.pp[k]||0)>0&&(!mon.choiceLock||mon.choiceLock===k));
  const usable=moves.length?moves:['STRUGGLE'];
  html+='<div class="chooser"><h3>ACTIF '+(i+1)+' · '+esc(mon.name)+' '+(choice?'✓':'· ACTION À CHOISIR')+'</h3>';
  if(mon.charging)html+='<p class="target-label">↳ '+esc(engine.data.moveData[mon.charging.move]?.name||mon.charging.move)+' : attaque automatique au prochain tour.</p>';
  html+='<div class="moves">'+usable.map(key=>{
   const m=engine.data.moveData[key]||{name:key,pp:0,type:'NORMAL',category:'physical'};
   const selected=choice?.type==='move'&&choice.move===key;
   return '<button type="button" class="move '+(selected?'sel':'')+'" style="--move-color:'+(TYPES[m.type]?.[1]||'#ddd')+'" aria-pressed="'+selected+'" data-actor="'+esc(mon.id)+'" data-move="'+esc(key)+'"><b>'+(selected?'✓ ':'')+esc(m.name||key)+'</b><small>'+esc(typeName(m.type))+' · '+(m.category==='physical'?'Physique':m.category==='special'?'Spéciale':'Statut')+'<br>'+(key==='STRUGGLE'?'—':mon.pp[key]+' / '+m.pp)+' PP</small></button>';
  }).join('')+'</div>';
  if(choice?.type==='move'){
   const plan=targetPlan(engine,mon.id,choice.move);
   if(engine.data.moveData[choice.move]?.effect==='baton')html+='<fieldset class="bench-panel"><legend>DESTINATAIRE DE RELAIS</legend>'+engine.bench('player',mon.owner).map(p=>'<button type="button" class="bench-card '+(choice.to===p.id?'chosen':'')+'" data-pike-baton-actor="'+esc(mon.id)+'" data-pike-baton-to="'+esc(p.id)+'">'+memberCard(p,engine.data)+'</button>').join('')+'</fieldset>';
   html+=plan.automatic?'<p class="target-label">↳ '+esc(plan.label)+'</p>':
    '<fieldset class="target-panel"><legend>CIBLE DE '+esc(engine.data.moveData[choice.move]?.name||choice.move)+'</legend><div class="target-cards">'+plan.targets.map(t=>'<button type="button" class="target-card '+(choice.target===t.id?'selected':'')+'" data-pike-target-actor="'+esc(mon.id)+'" data-pike-target-id="'+esc(t.id)+'">'+icon(t,engine.data)+'<b>'+(choice.target===t.id?'✓ ':'')+esc(t.name)+'</b><span class="type-badges">'+badges(t,engine.data)+'</span><small>'+percent(t.hp,t.maxHp)+' % · '+esc(t.status||'OK')+'</small></button>').join('')+'</div></fieldset>';
  }
  if(!mon.charging){
   html+='<details class="bench-panel"><summary>CHANGER '+esc(mon.name)+'</summary><div class="bench-list">'+engine.bench('player',mon.owner).map(p=>'<button type="button" class="bench-card" data-pike-switch-actor="'+esc(mon.id)+'" data-pike-switch-to="'+esc(p.id)+'">'+memberCard(p,engine.data)+'</button>').join('')+'</div></details>';
  }
  if(choice)html+='<p class="action-mark">✓ '+(choice.type==='switch'?'Remplacer par '+esc(engine.get(choice.to)?.name):esc(engine.data.moveData[choice.move]?.name||choice.move))+'</p>';
  html+='</div>';
 }
 const ready=own.every(m=>{
  const a=actions[m.id];if(!a)return false;
  if(a.type==='switch')return Boolean(a.to);
  const meta=engine.data.moveData[a.move];if(!meta)return false;
  const plan=targetPlan(engine,m.id,a.move);
  return Boolean(a.target||plan.automatic)&&(meta.effect!=='baton'||Boolean(a.to));
 });
 html+='<div class="combat-actions"><button class="btn primary" type="button" id="pike-turn" '+(!ready?'disabled':'')+'>VALIDER LE TOUR ▶</button></div>';
 return html;
}
