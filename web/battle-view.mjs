// Shared battle arena visuals for Tower, Factory, Dome and Pike.
// Display-only helpers: the real battle engine stays responsible for resolution.
import {TYPES,typeName,percent,statChanges} from './battle-ui.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={sleep:'SOMMEIL',paralyze:'PARALYSÉ',toxic:'TOXIK',poison:'POISON',burn:'BRÛLURE',freeze:'GEL'};
export function battleSprite(species,data,back=false){
 const code=data.species[species]?.sprite||species.toLowerCase().replaceAll('_','');
 return '<img class="pokemon-img" src="https://play.pokemonshowdown.com/sprites/'+(back?'gen5ani-back':'gen5ani')+'/'+encodeURIComponent(code)+'.gif" data-code="'+esc(code)+'" data-side="'+(back?'back':'front')+'" data-tried="1" alt="'+esc(data.speciesNames?.[species]||species)+'" loading="eager">';
}
export function bindBattleSprites(root=document){
 root.querySelectorAll('.pokemon-img:not([data-bound])').forEach(img=>{
  img.dataset.bound='1';
  img.addEventListener('error',()=>{
   const step=+img.dataset.tried;img.dataset.tried=String(step+1);
   const code=encodeURIComponent(img.dataset.code),back=img.dataset.side==='back';
   if(step<=1)img.src='https://play.pokemonshowdown.com/sprites/'+(back?'gen5-back':'gen5')+'/'+code+'.png';
   else{img.style.opacity='.05';img.onerror=null;}
  });
 });
}
export function renderCombatMon(mon,back,data,{hideEnemyPercent=false,hpPrecision=1}={}){
 if(!mon)return '<div class="battler empty">—</div>';
 const ratio=Math.max(0,100*mon.hp/mon.maxHp);
 const types=(data.species[mon.species]?.types||[]).map(t=>'<span class="type-badge" style="background:'+(TYPES[t]?.[1]||'#ccc')+'">'+esc(typeName(t))+'</span>').join('');
 const conditions=[mon.status?'<span class="condition-tag condition-'+esc(mon.status)+'">'+esc(labels[mon.status]||mon.status.toUpperCase())+'</span>':'',mon.confused>0?'<span class="condition-tag condition-confused">CONFUS</span>':''].filter(Boolean).join('');
 const changes=statChanges(mon);
 const stageMarkup=changes.length?'<button class="stat-changes" data-stat-info="'+esc(mon.id)+'" aria-label="Changements de statistiques de '+esc(mon.name)+'">'+changes.map(x=>'<span class="stat-change '+(x.stage>0?'raised':'lowered')+'">'+(x.stage>0?'↑':'↓')+' '+esc(x.labelText)+'</span>').join('')+'</button>':'';
 return '<div class="battler" data-battler="'+esc(mon.id)+'"><div class="combat-mon">'+battleSprite(mon.species,data,back)+'</div><div class="battle-identity"><div class="identity-top"><b>'+esc(mon.name)+'</b><span>N.'+mon.level+'</span></div><span class="type-badges">'+types+'</span><div class="hp-meter"><span class="'+(ratio<25?'low':ratio<50?'medium':'')+'" style="width:'+ratio+'%"></span></div><div class="battle-hp">'+(back?mon.hp+' / '+mon.maxHp+' · ':'')+(!back&&hideEnemyPercent?'PV':percent(mon.hp,mon.maxHp,hpPrecision)+' %')+'</div>'+(conditions?'<div class="condition-tags" aria-label="Altérations de statut">'+conditions+'</div>':'')+stageMarkup+'<button class="stats-info" data-stat-info="'+esc(mon.id)+'" aria-label="Statistiques de '+esc(mon.name)+'">ⓘ STATS</button></div></div>';
}
export function renderBattleArena(engine,opts={}){
 const foes=engine.active('opponent'),allies=engine.active('player');
 return '<div class="battle-row enemy '+(foes.length>1?'double':'')+'">'+foes.map(m=>renderCombatMon(m,false,engine.data,opts)).join('')+'</div><div class="battle-row player '+(allies.length>1?'double':'')+'">'+allies.map(m=>renderCombatMon(m,true,engine.data,opts)).join('')+'</div>';
}
