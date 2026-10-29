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
 const statusFx={sleep:['sleep','Z z z'],freeze:['ice','❄ ❄'],burn:['fire','♨'],paralyze:['electric','ϟ ϟ'],poison:['poison','☣'],toxic:['poison','☣']};
 const activeFx=mon.hp>0?statusFx[mon.status]:null;
 const persistentFx=(activeFx?'<span class="battle-status-vfx persistent-vfx vfx-'+activeFx[0]+'" aria-hidden="true">'+activeFx[1]+'</span>':'')+(mon.hp>0&&mon.confused>0?'<span class="battle-status-vfx persistent-vfx vfx-confusion" aria-hidden="true">? ?</span>':'');
 const hasClone=mon.hp>0&&Number(mon.substitute)>0;
 const cloneMarkup=hasClone?'<div class="substitute-doll" aria-label="Clone actif"><span class="substitute-ears"></span><span class="substitute-eyes"></span><span class="substitute-mouth"></span></div>':'';
 const changes=statChanges(mon);
 const stageMarkup=changes.length?'<button class="stat-changes" data-stat-info="'+esc(mon.id)+'" aria-label="Changements de statistiques de '+esc(mon.name)+'">'+changes.map(x=>'<span class="stat-change '+(x.stage>0?'raised':'lowered')+'">'+(x.stage>0?'↑':'↓')+' '+esc(x.labelText)+'</span>').join('')+'</button>':'';
 return '<div class="battler '+(mon.hp<=0?'battler-ko':hasClone?'battler-substitute':'')+'" data-battler="'+esc(mon.id)+'"><div class="combat-mon">'+battleSprite(mon.species,data,back)+cloneMarkup+persistentFx+(mon.hp<=0?'<span class="ko-marker">K.O.</span>':'')+'</div><div class="battle-identity"><div class="identity-top"><b>'+esc(mon.name)+'</b><span>N.'+mon.level+'</span></div><span class="type-badges">'+types+'</span><div class="hp-meter"><span class="'+(ratio<25?'low':ratio<50?'medium':'')+'" style="width:'+ratio+'%"></span></div><div class="battle-hp">'+(back?mon.hp+' / '+mon.maxHp+' · ':'')+(!back&&hideEnemyPercent?'PV':percent(mon.hp,mon.maxHp,hpPrecision)+' %')+'</div>'+(hasClone?'<div class="condition-tags"><span class="condition-tag condition-substitute">CLONE · '+Math.ceil(mon.substitute)+' PV</span></div>':'')+(conditions?'<div class="condition-tags" aria-label="Altérations de statut">'+conditions+'</div>':'')+stageMarkup+'<button class="stats-info" data-stat-info="'+esc(mon.id)+'" aria-label="Statistiques de '+esc(mon.name)+'">ⓘ STATS</button></div></div>';
}
export function renderBattleArena(engine,opts={}){
 const displayed=side=>engine[side].active.map((id,slot)=>engine.get(id)||engine.get((engine.pendingReplacements||[]).find(r=>r.side===side&&r.slot===slot)?.fainted)).filter(Boolean);
 const foes=displayed('opponent'),allies=displayed('player');
 return '<div class="battle-row enemy '+(foes.length>1?'double':'')+'">'+foes.map(m=>renderCombatMon(m,false,engine.data,opts)).join('')+'</div><div class="battle-row player '+(allies.length>1?'double':'')+'">'+allies.map(m=>renderCombatMon(m,true,engine.data,opts)).join('')+'</div>';
}
