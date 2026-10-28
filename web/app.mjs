import {STAT_KEYS,STAT_NAMES,stageRatio,effectiveStat} from './battle-stats.mjs';
import {BattlePresenter,preferences} from './battle-presentation.mjs';
import {RunStore,migrateState,createRun,captureRun,contextKey} from './runs.mjs';
import {TYPES,typeName,percent,targetPlan,groupedLog,statChanges} from './battle-ui.mjs';
import {officialSet,trainerTeam} from './frontier.mjs';
import {createDomeTournament,domeNextOpponent,domeResolveRound,domeSelectTwo,domeCpuSelection,domeProfile,DOME_ROUNDS} from './dome.mjs';
import {rentalPool,beginFactoryDraft,proposeFactoryExchange,resolveFactoryExchange} from './factory.mjs';
import {exportSave,validateImport,restoreEngine} from './storage.mjs';
import {TowerEngine,validateTeam,statsFor,makeMon,TYPE_CHART} from './engine.mjs';
const $=sel=>document.querySelector(sel), $$=sel=>[...document.querySelectorAll(sel)];
const STORE='battle-tower-emerald-v05';const LEGACY_STORE='battle-tower-simple-v03';const deepCopy=o=>JSON.parse(JSON.stringify(o));
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const MODES={single:['SOLO','3 Pokémon · 1 contre 1','◆'],double:['DUO','4 Pokémon · 2 contre 2','◆◆'],multi:['MULTI IA','2 Pokémon + partenaire automatique','◉'],network:['MULTI RÉSEAU','Deux appareils · non implémenté','▣']};
const required={single:3,double:4,multi:2,link:2};
let D,state={mode:'single',levelMode:'50',team:[],partner:['MILOTIC','SNORLAX'],records:{}},screen='mode',engine=null,actions={},editorSlot=-1,editing=null;
const NATURES=['HARDY','LONELY','BRAVE','ADAMANT','NAUGHTY','BOLD','DOCILE','RELAXED','IMPISH','LAX','TIMID','HASTY','SERIOUS','JOLLY','NAIVE','MODEST','MILD','QUIET','BASHFUL','RASH','CALM','GENTLE','SASSY','CAREFUL','QUIRKY'];
let presenter,presenting=false;
let factoryPool=[],factorySelection=[],factorySwap={};
let repository,revision=0,saveQueue=Promise.resolve(),storageFailed=false,activeRun=null,switchPrompt=null;
function store(){
 const snapshot=deepCopy(state);
 saveQueue=saveQueue.then(async()=>{if(storageFailed)throw Error('Sauvegarde bloquée.');revision=await repository.commit(snapshot,revision);$('#save-status').textContent='✓ Enregistré sur cet appareil';}).catch(err=>{storageFailed=true;$('#save-status').textContent='⚠ '+err.message;$('#storage-error').classList.remove('hidden');$('#storage-message').textContent=err.message;throw err;});
 saveQueue.catch(()=>{});return saveQueue;
}
function saveBattleSession(){
 if(engine&&activeRun){const old=state.runs.find(r=>r.id===activeRun);const next=captureRun(old,engine,actions);state.runs=state.runs.map(r=>r.id===activeRun?next:r);}
 return store();
}
function restoreBattleSession(id){
 const saved=state.runs.find(r=>r.id===id);if(!saved)return false;
 try{engine=restoreEngine(D,saved,TowerEngine);activeRun=id;state.mode=saved.mode;state.levelMode=saved.levelMode;state.facility=saved.facility||'tower';actions=deepCopy(saved.actions||{});switchPrompt=null;nav('battle');notify('Défi repris avec son équipe et ses décisions.');return true;}
 catch(err){notify('Reprise impossible : '+err.message);return false;}
}
function badges(species){return `<span class="type-badges">${(D.species[species]?.types||[]).map(t=>`<span class="type-badge" style="background:${TYPES[t]?.[1]||'#ccc'}">${typeName(t)}</span>`).join('')}</span>`;}
function icon(species){const path=species==='UNOWN'?'unown/a':species.toLowerCase();return `<img class="menu-icon" src="https://raw.githubusercontent.com/pret/pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/graphics/pokemon/${path}/icon.png" alt="" loading="lazy">`;}

function renderRuns(){const list=state.runs.filter(r=>contextKey(r)===contextKey(state));$('#runs-list').innerHTML=list.length?list.map(r=>`<article class="run-card"><b>${escapeHTML(r.name)}</b><small>${r.victories} victoire(s) · ${r.engine.status==='active'?'combat '+(r.engine.streak+1)+' / tour '+r.engine.turn:r.engine.status==='won'?'combat suivant '+(r.victories+1):'défi terminé'}${r.archived?' · ARCHIVÉ':''}</small><div class="run-team">${r.team.map(p=>`<span>${icon(p.species)}${escapeHTML(nameOf(p.species))}</span>`).join('')}</div><small>${new Date(r.updatedAt).toLocaleString('fr-CH')}</small><div class="run-actions"><button data-resume="${escapeHTML(r.id)}">${r.archived?'CONSULTER':'REPRENDRE'}</button><button data-rename="${escapeHTML(r.id)}">RENOMMER</button>${r.engine.status==='lost'&&!r.archived?`<button data-archive="${escapeHTML(r.id)}">ARCHIVER</button>`:''}<button data-delete-run="${escapeHTML(r.id)}">SUPPRIMER</button></div></article>`).join(''):'<p>Aucun défi dans ce format. Tu peux en commencer plusieurs avec des équipes différentes.</p>';
 $$('[data-resume]').forEach(b=>b.onclick=()=>restoreBattleSession(b.dataset.resume));
 $$('[data-rename]').forEach(b=>b.onclick=async()=>{const r=state.runs.find(r=>r.id===b.dataset.rename);const n=prompt('Nom du défi :',r.name);if(n?.trim()){r.name=n.trim().slice(0,80);await store();renderRuns();}});
 $$('[data-archive]').forEach(b=>b.onclick=async()=>{state.runs.find(r=>r.id===b.dataset.archive).archived=true;await store();renderRuns();});
 $$('[data-delete-run]').forEach(b=>b.onclick=async()=>{if(confirm('Supprimer définitivement ce défi et son historique ?')){state.runs=state.runs.filter(r=>r.id!==b.dataset.deleteRun);await store();renderRuns();}});
}

function notify(message){let t=$('#toast');t.textContent=message;t.classList.remove('hidden');clearTimeout(window._notice);window._notice=setTimeout(()=>t.classList.add('hidden'),3000);}
function nameOf(key){return D.speciesNames[key]||key.replaceAll('_',' ')}
function moveName(key){return D.moveData[key]?.name||key.replaceAll('_',' ')}
function sprite(key,back=false){let code=D.species[key]?.sprite||key.toLowerCase().replaceAll('_','');let path=`https://play.pokemonshowdown.com/sprites/${back?'gen5ani-back':'gen5ani'}/${code}.gif`;
 return `<img class="pokemon-img" src="${path}" data-code="${escapeHTML(code)}" data-side="${back?'back':'front'}" data-tried="1" alt="${escapeHTML(nameOf(key))}" loading="lazy">`}
function spriteFallback(root=document){root.querySelectorAll('.pokemon-img:not([data-bound])').forEach(img=>{img.dataset.bound='1';img.addEventListener('error',()=>{let step=+img.dataset.tried;img.dataset.tried=String(step+1);let code=encodeURIComponent(img.dataset.code),back=img.dataset.side==='back';if(step===0)img.src=`https://play.pokemonshowdown.com/sprites/${back?'gen5ani-back':'gen5ani'}/${code}.gif`;else if(step===1)img.src=`https://play.pokemonshowdown.com/sprites/${back?'gen5-back':'gen5'}/${code}.png`;else{img.style.opacity='.05';img.onerror=null}});});}
function record(){return state.records[(state.facility==='factory'?'factory:':state.facility==='dome'?'dome:':'')+state.mode+':'+state.levelMode]||{current:0,best:0,silver:false,gold:false}}
function saveRecord(result){const key=(state.facility==='factory'?'factory:':state.facility==='dome'?'dome:':'')+state.mode+':'+state.levelMode,r=record();if(result==='won'){r.current=engine.streak+1;r.best=Math.max(r.best,r.current);if(state.mode==='single'){if(r.current===35)r.silver=true;if(r.current===70)r.gold=true;}}else r.current=0;state.records[key]=r;}
function nav(target){presenter?.cancel();if(target!=='battle'&&engine){saveBattleSession();engine=null;activeRun=null;actions={};}if(target==='battle'&&!engine){notify('Choisis une équipe et lance le combat.');return}screen=target;document.body.dataset.screen=target;$$('.screen').forEach(el=>el.classList.toggle('hidden',el.id!==target));$$('[data-go]').forEach(el=>el.classList.toggle('active',el.dataset.go===target));if(target==='mode')renderMode();if(target==='team')renderTeam();if(target==='battle')renderBattle();window.scrollTo({top:0,behavior:'instant'});}
function options(keys,selected,format=x=>x){return keys.map(key=>`<option value="${escapeHTML(key)}" ${key===selected?'selected':''}>${escapeHTML(format(key))}</option>`).join('')}
function firstAvailable(){return Object.keys(D.sets).find(k=>!state.team.some(s=>s.species===k))}
function setFor(key){if(D.sets[key])return deepCopy(D.sets[key]);let p=D.species[key];if(!p)return null;const move=(D.learnsets[key]||[]).slice(0,4);
 return {species:key,ability:p.abilities[0],item:'NONE',moves:move,level:50,nature:'HARDY',evs:[252,0,0,0,252,6],ivs:[31,31,31,31,31,31],role:'Personnalisé'}}
function renderMode(){const isFactory=state.facility==='factory',isDome=state.facility==='dome';$('#facility-select').value=isFactory?'factory':isDome?'dome':'tower';$('#formats').classList.toggle('hidden',isFactory);$('#resume-game').classList.add('hidden');let html='';for(const [key,[label,desc,symbol]] of Object.entries(isDome?Object.fromEntries(Object.entries(MODES).filter(([k])=>k==='single'||k==='double')):MODES)){html+=`<button class="format ${state.mode===key?'selected':''}" data-mode="${key}" ${key==='network'?'disabled':''}><span class="glyph">${symbol}</span><strong>${label}</strong><small>${desc}</small></button>`;}$('#formats').innerHTML=html;$$('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;state.team=state.team.slice(0,required[state.mode]);store();renderMode();});$$('[name=lvl]').forEach(i=>{i.checked=i.value===state.levelMode;i.onchange=()=>{state.levelMode=i.value;store();renderMode();}});let r=record();$('#record').textContent=`RECORD : ${r.best||0} VICTOIRES  ${r.silver?' · ARGENT ✓':''}${r.gold?' · OR ✓':''}`;renderRuns();}
function renderTeam(){if(state.facility==='factory'){renderFactoryDraft();return;}$('#team').querySelector('.section-title h2').textContent='CONSTRUIS TON ÉQUIPE';$('#team').querySelector('.preset-area').classList.remove('hidden');$('#team').querySelector('.team-library').classList.remove('hidden');$('#team').querySelector('.rules-panel').classList.remove('hidden');$('#start').textContent=state.facility==='dome'?'ENTRER DANS LE TOURNOI ▶':'DÉMARRER LA TOUR ▶';const groups=Object.entries(D.teams||{}).filter(([,t])=>t.mode===state.mode||(state.mode==='link'&&t.mode==='multi'));$('#presets').innerHTML=groups.map(([id,t])=>`<option value="${escapeHTML(id)}">${escapeHTML(t.name)} — ${escapeHTML(t.description)}</option>`).join('');$('#use-preset').disabled=!groups.length;
 let html='';const need=required[state.mode];for(let i=0;i<need;i++){const p=state.team[i];if(p){html+=`<div class="slot">${sprite(p.species)}<div class="slot-body"><b>${i+1}. ${escapeHTML(nameOf(p.species))}</b>${badges(p.species)}<small>${escapeHTML(p.role||'Set stratégique')} · ${escapeHTML(p.ability)}<br>${escapeHTML(p.item)} · ${p.moves.map(moveName).slice(0,2).join(' / ')}</small></div><div class="slot-actions"><button class="btn" data-edit="${i}">MODIFIER</button>${i?`<button data-up="${i}" aria-label="Monter ce Pokémon">↑</button>`:''}</div></div>`;}else html+=`<button class="slot empty-slot" data-edit="${i}"><b>+ AJOUTER UN POKÉMON</b></button>`;}
 $('#team-list').innerHTML=html;$$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(+b.dataset.edit));$$('[data-up]').forEach(b=>b.onclick=()=>{let i=+b.dataset.up;[state.team[i-1],state.team[i]]=[state.team[i],state.team[i-1]];store();renderTeam()});
 if(state.mode==='link'){$('#partner-box').classList.remove('hidden');$('#partner-box').innerHTML=`<h3>ÉQUIPE DU JOUEUR 2</h3><p>Deux Pokémon contrôlés par un second joueur.</p>${[0,1].map(i=>`<label>POKÉMON ${i+1}<select data-partner="${i}">${options(Object.keys(D.sets),state.partner[i],nameOf)}</select></label>`).join('')}`;$$('[data-partner]').forEach(el=>el.onchange=()=>{state.partner[+el.dataset.partner]=el.value;store();});}else $('#partner-box').classList.add('hidden');
 renderSavedTeams();const errors=validateTeam(state.team,state.mode,state.levelMode,D);$('#validation').textContent=errors.length?'⚠ '+errors.join(' · '):'✓ ÉQUIPE VALIDE — PRÊTE POUR LA TOUR';$('#validation').classList.toggle('error',!!errors.length);$('#start').disabled=!!errors.length;spriteFallback($('#team-list'));}
function openEdit(i){editorSlot=i;const existing=state.team[i];editing=existing?deepCopy(existing):setFor(firstAvailable()||Object.keys(D.sets)[0]);if(!editing){notify('Aucun set disponible.');return;}renderEdit();$('#edit-layer').classList.remove('hidden');}
function renderEdit(){const p=editing;$('#species-search').value='';$('#species-search').oninput=e=>{let select=$('[data-field=species]'),q=e.target.value.toLowerCase();select.innerHTML=options(Object.keys(D.species).filter(k=>nameOf(k).toLowerCase().includes(q)||k.toLowerCase().includes(q)),editing.species,k=>nameOf(k)+' · '+D.species[k].types.map(typeName).join('/'))};$('#edit-title').textContent='SET STRATÉGIQUE · '+nameOf(p.species);$('#edit-preview').innerHTML=`${sprite(p.species)}<div><strong>${escapeHTML(nameOf(p.species))}</strong>${badges(p.species)}<br><small>${escapeHTML(p.role||'Set personnalisable')}</small></div>`;
 const fields=[['ESPÈCE','species',Object.keys(D.species),k=>nameOf(k)+' · '+D.species[k].types.map(typeName).join('/')],['SET DE LA TOUR','preset',(D.towerSets||[]).filter(t=>t.species===p.species).map(t=>t.id),x=>x],['TALENT','ability',D.species[p.species].abilities,x=>x],['OBJET TENU','item',D.towerItems?.length?['NONE',...D.towerItems]:Object.keys(D.items),x=>x],['NATURE','nature',NATURES,x=>x],['NIVEAU','level',Array.from({length:100},(_,i)=>i+1),x=>x],...Array.from({length:4},(_,i)=>[`CAPACITÉ ${i+1}`,'move'+i,(D.learnsets?.[p.species]||Object.keys(D.moveData)),x=>{let m=D.moveData[x];return `${m.name} · ${m.category==='physical'?'PHY':m.category==='special'?'SPÉ':'STA'}`}])];
 $('#edit-fields').innerHTML=fields.filter(x=>x[1]!=='preset'||x[2].length>0).map(([label,key,list,fmt])=>`<label class="field ${key==='species'?'wide':''}">${label}<select data-field="${key}">${options(list,key==='species'?p.species:key==='ability'?p.ability:key==='item'?p.item:key==='nature'?p.nature:key==='level'?p.level:key==='preset'?list[0]:p.moves[Number(key.slice(-1))],fmt)}</select></label>`).join('');
 $('#edit-advanced').innerHTML='<div class="adv-grid">'+['PV','ATT','DÉF','VIT','ATSP','DÉSP'].map((l,i)=>`<label>${l} EV<input type="number" min="0" max="255" data-ev="${i}" value="${p.evs[i]}"></label><label>${l} IV<input type="number" min="0" max="31" data-iv="${i}" value="${p.ivs[i]}"></label>`).join('')+'</div>';
 $('#edit-fields [data-field=species]').onchange=e=>{editing=setFor(e.target.value);renderEdit()};
 let preset=$('#edit-fields [data-field=preset]');if(preset)preset.onchange=e=>{let raw=(D.towerSets||[]).find(t=>t.id===e.target.value);if(raw){editing=officialSet(D,raw);renderEdit();}};
 $('#edit-error').textContent='';renderStats();$('#edit-fields').onchange=renderStats;$('#edit-advanced').oninput=renderStats;spriteFallback($('#edit-preview'));
}
function saveEdit(){let p=deepCopy(editing);p.ability=$('[data-field=ability]').value;p.item=$('[data-field=item]').value;p.nature=$('[data-field=nature]').value;p.level=Number($('[data-field=level]').value);p.moves=[0,1,2,3].map(i=>$(`[data-field=move${i}]`).value);p.evs=$$('#edit-advanced [data-ev]').map(e=>Number(e.value));p.ivs=$$('#edit-advanced [data-iv]').map(e=>Number(e.value));if(new Set(p.moves).size!==p.moves.length){$('#edit-error').textContent='Chaque capacité doit être différente.';return;}if(p.evs.some(x=>!Number.isInteger(x)||x<0||x>255)||p.evs.reduce((a,b)=>a+b,0)>510){$('#edit-error').textContent='EV : 0 à 255/stat et 510 maximum au total.';return;}if(p.ivs.some(x=>!Number.isInteger(x)||x<0||x>31)){$('#edit-error').textContent='IV : 0 à 31.';return;}const candidate=[...state.team];candidate[editorSlot]=p;const errs=validateTeam(candidate,state.mode,state.levelMode,D).filter(x=>!x.includes('Ce mode nécessite'));if(errs.length){$('#edit-error').textContent=errs.join(' · ');return;}state.team[editorSlot]=p;store();$('#edit-layer').classList.add('hidden');renderTeam();}
function partner(){if(state.mode!=='link')return undefined;return (state.partner||[]).map(setFor)}
function createDomeEntrants(team,levelMode){
 const used=new Set(),result=[];
 for(let i=0;i<15;i++){
  let trainer;for(let attempts=0;attempts<200;attempts++){const candidate=D.trainers[Math.floor(Math.random()*D.trainers.length)];if(candidate&&!used.has(candidate.id)){trainer=candidate;break;}}
  if(!trainer)throw Error('Impossible de générer les participants du Dôme.');
  used.add(trainer.id);
  result.push({name:trainer.name+' · '+trainer.class.replaceAll('_',' '),trainerId:trainer.id,team:trainerTeam(D,trainer,3,levelMode,Math.random)});
 }
 return createDomeTournament(team,result,D);
}
function applyDomeOpponent(battle,dome){
 const opponent=domeNextOpponent(dome);if(!opponent)throw Error('Adversaire du Dôme introuvable.');
 battle.trainer=opponent.name;
 battle.trainerData=D.trainers[opponent.trainerId];
 battle.opponent.party=opponent.team.map(p=>makeMon(p,D,'cpu',battle.level));
 battle.opponent.active=[battle.opponent.party[0].id];
 battle.opponent.party[0].active=true;
}
async function begin(continuing=false){
 if(storageFailed)return;const run=continuing&&state.runs.find(r=>r.id===activeRun);const facility=run?.facility||state.facility,isFactory=facility==='factory',isDome=facility==='dome';const team=run?(run.factory?.team||run.team):isFactory?factorySelection.map(i=>factoryPool[i]):state.team;
 if(isFactory&&!run&&factorySelection.length!==3){notify('Sélectionne trois Pokémon de location.');return;}
 const errors=validateTeam(team,state.mode,state.levelMode,D);if(errors.length){if(!isFactory)nav('team');notify(errors[0]);return;}
 try{
  if(run&&run.engine.status!=='won')throw Error('Seul un défi victorieux peut continuer.');
  const nextEngine=new TowerEngine(D,{mode:state.mode,levelMode:state.levelMode,team:deepCopy(team),streak:run?run.victories:0,trainerHistory:run?.trainerHistory||[]});
  if(run){run.pastBattles.push({number:run.engine.streak+1,trainer:run.engine.trainer,log:run.engine.log});engine=nextEngine;actions={};}
  else{engine=nextEngine;const created=createRun(state,engine);if(isFactory){created.facility='factory';created.name='Usine · '+new Date().toISOString().slice(0,10);created.factory=beginFactoryDraft(factoryPool,factorySelection);created.team=deepCopy(created.factory.team);}if(isDome){created.facility='dome';created.name='Dôme · '+new Date().toISOString().slice(0,10);created.dome=createDomeEntrants(created.team,state.levelMode);}activeRun=created.id;state.runs.push(created);actions={};}
  if(isDome){const current=state.runs.find(x=>x.id===activeRun);if(current.dome?.participants)applyDomeOpponent(engine,current.dome);current.dome.phase='preview';current.dome.resolvedBattle=false;}
  switchPrompt=null;await saveBattleSession();nav('battle');
 }catch(e){notify(e.message);}
}
function showStats(mon){
 const ours=engine.sideOf(mon)==='player';
 $('#stats-content').innerHTML=`<h2>${escapeHTML(mon.name)}</h2><table><thead><tr><th>Statistique</th><th>Niveau</th><th>×</th>${ours?'<th>Valeur</th>':''}</tr></thead><tbody>${STAT_KEYS.map(key=>{const n=mon.stages[key]||0,[a,b]=stageRatio(n,['acc','eva'].includes(key));return `<tr><th>${STAT_NAMES[key]}</th><td>${n>0?'+':''}${n}</td><td>${Number((a/b).toFixed(2)).toString().replace('.',',')}</td>${ours?`<td>${['acc','eva'].includes(key)?'—':effectiveStat(engine,mon,key)}</td>`:''}</tr>`;}).join('')}</tbody></table><p>Précision et Esquive : table Émeraude. Les chances de toucher utilisent leur différence de niveaux. Les valeurs affichées excluent les bonus dépendant de la capacité ou de la cible ; les PV ne possèdent pas de niveau.</p>`;
 $('#stats-dialog').showModal();
}
function setupOptions(){
 const sync=()=>{const p=preferences(state);$('#move-animations').value=p.moveAnimations?'on':'off';$('#animation-speed').value=p.animationSpeed;$('#reduced-motion').checked=p.respectReducedMotion;};
 $$('[data-options]').forEach(b=>b.onclick=()=>{sync();$('#options-dialog').showModal();});
 $('#options-close').onclick=()=>$('#options-dialog').close();$('#stats-close').onclick=()=>$('#stats-dialog').close();
 for(const id of ['move-animations','animation-speed','reduced-motion'])$('#'+id).onchange=()=>{state.preferences={moveAnimations:$('#move-animations').value==='on',animationSpeed:$('#animation-speed').value,respectReducedMotion:$('#reduced-motion').checked};presenter.cancel();store();};
}
function statBadges(m){const changes=statChanges(m);return changes.length?`<button class="stat-changes" data-stat-info="${m.id}" aria-label="Changements de statistiques de ${escapeHTML(m.name)}">${changes.map(x=>`<span class="stat-change ${x.stage>0?'raised':'lowered'}">${x.stage>0?'↑':'↓'} ${x.labelText}</span>`).join('')}</button>`:'';}
function combatMon(m,back){if(!m)return '<div class="battler empty">—</div>';let ratio=Math.max(0,100*m.hp/m.maxHp);return `<div class="battler" data-battler="${m.id}"><div class="combat-mon">${sprite(m.species,back)}</div><div class="battle-identity"><div class="identity-top"><b>${escapeHTML(m.name)}</b><span>N.${m.level}</span></div>${badges(m.species)}<div class="hp-meter"><span class="${ratio<25?'low':ratio<50?'medium':''}" style="width:${ratio}%"></span></div><div class="battle-hp">${back?m.hp+' / '+m.maxHp+' · ':''}${!back&&state.hideEnemyPercent?'PV':percent(m.hp,m.maxHp,state.hpPrecision||1)+' %'}</div>${statusBadges(m)}${statBadges(m)}<button class="stats-info" data-stat-info="${m.id}" aria-label="Statistiques de ${escapeHTML(m.name)}">ⓘ STATS</button></div></div>`}
function logHTML(log){return groupedLog(log).map(([turn,events])=>`<section class="log-turn"><h3>${turn?'TOUR '+String(turn).padStart(2,'0'):'ENTRÉE EN COMBAT'}</h3><ol>${events.map(e=>`<li class="event-${e.side||'system'}">${escapeHTML(e.text)}</li>`).join('')}</ol></section>`).join('');}
function memberCard(m){return `${icon(m.species)}<span><b>${escapeHTML(m.name)} · N.${m.level}</b>${badges(m.species)}<span class="hp-meter"><span style="width:${100*m.hp/m.maxHp}%"></span></span><small>${m.hp}/${m.maxHp} PV · ${percent(m.hp,m.maxHp,state.hpPrecision||1)} % · ${escapeHTML(m.status||'OK')}${m.active?' · EN JEU':''}${m.hp<=0?' · K.O.':''}</small></span>`;}
function renderReplacement(){
 const r=engine.pendingReplacements.find(x=>['human','human2'].includes(x.owner));if(!r)return false;
 const from=engine.get(r.fainted),selected=switchPrompt?.actor===r.fainted?engine.get(switchPrompt.to):null;
 $('#battle-controls').innerHTML=`<section class="forced-replacement"><h3>${escapeHTML(from.name)} EST K.O.</h3><p>Choisis le Pokémon à envoyer. Ce remplacement ne consomme pas de tour.</p><div class="bench-list">${engine[r.side].party.filter(m=>m.owner===r.owner).map(m=>`<button class="bench-card ${selected===m?'chosen':''}" data-replace-to="${m.id}" ${m.active||m.hp<=0?'disabled':''}>${memberCard(m)}${selected===m?'<b>✓</b>':''}</button>`).join('')}</div>${selected?`<div class="switch-confirm"><p>Envoyer <b>${escapeHTML(selected.name)}</b> ?</p><button id="confirm-replacement">ENVOYER ${escapeHTML(selected.name)}</button><button id="cancel-replacement">ANNULER</button></div>`:''}</section>`;
 $$('[data-replace-to]').forEach(b=>b.onclick=()=>{switchPrompt={actor:r.fainted,to:b.dataset.replaceTo};renderBattle();});
 if(selected){$('#cancel-replacement').onclick=()=>{switchPrompt=null;renderBattle();};$('#confirm-replacement').onclick=async()=>{
  if(storageFailed)return;$('#confirm-replacement').disabled=true;
  try{await saveQueue;const backup=deepCopy(state.runs.find(x=>x.id===activeRun));try{const result=engine.replaceFainted(r.fainted,selected.id);actions={};switchPrompt=null;if(result.status!=='active')saveRecord(result.status);if(result.status==='won')prepareFactoryOffers();await saveBattleSession();renderBattle();}catch(error){engine=restoreEngine(D,backup,TowerEngine);actions=backup.actions||{};throw error;}}catch(error){notify(error.message);if(!storageFailed)renderBattle();}
 };}return true;
}
function renderDomeScreen(run,snap){
 const dome=run.dome;
 if(snap.status!=='active'&&!dome.resolvedBattle){domeResolveRound(dome,snap.status==='won');dome.resolvedBattle=true;store();}
 const round=Math.min(3,dome.round||0),finished=dome.champion==='player';
 const opponent=domeNextOpponent(dome);
 const names=new Map((dome.participants||[]).map(p=>[p.id,p.player?'VOUS':p.name]));
 const selectedProfile=dome.participants?.find(p=>p.id===(dome.viewProfile||opponent?.id));
 const profile=selectedProfile?domeProfile(selectedProfile,D):null;
 const profilePanel=profile?'<section class="dome-profile"><h4>PROFIL DU DRESSEUR</h4><b>'+escapeHTML(profile.name)+'</b><p>Puissance : '+Math.round(profile.strength)+' · Classement : '+profile.seed+'/16</p><p>Style de combat : '+escapeHTML(profile.style)+'</p><p>Statistiques favorisées : '+escapeHTML(profile.favored.map(k=>STAT_NAMES[k]||k).join(', ')||'Équilibrées')+'</p><div class="dome-opponents">'+profile.team.map(p=>'<span class="dome-opponent">'+icon(p)+' '+escapeHTML(nameOf(p))+'</span>').join('')+'</div></section>':'';
 const reception=previewPlaceholder=>'<nav class="dome-reception"><button class="btn" id="dome-opponent">ADVERSAIRE</button><button class="btn" id="dome-bracket">TABLEAU</button><button class="btn primary" id="dome-select">COMBATTRE</button>'+(dome.round>0?'<button class="btn" id="dome-record">ENREGISTRER</button>':'')+'<button class="btn" id="dome-rest">REPOS</button><button class="btn" id="dome-leave">PARTIR</button></nav>';
 const bracket=(dome.rounds||[]).map((pairs,r)=>'<section class="dome-tree-round"><h4>'+DOME_ROUNDS[r]+'</h4>'+pairs.map(([a,b],i)=>{const winner=dome.results?.[r]?.[i]?.winner;return '<div class="dome-tree-pair"><span data-dome-profile="'+escapeHTML(a)+'" class="'+(winner===a?'dome-qualified':'')+'">'+escapeHTML(names.get(a)||'—')+'</span><span class="'+(winner===b?'dome-qualified':'')+'">'+escapeHTML(names.get(b)||'—')+'</span></div>';}).join('')+'</section>').join('');
 const preview=dome.phase==='preview'&&snap.status==='active';
 const chosen=Array.isArray(dome.chosen)?dome.chosen:[0,1];
 const options=preview&&dome.menu==='select'?'<div class="dome-lead-picker"><h3>CHOISIS TES DEUX POKÉMON</h3><p>Émeraude : inscris trois Pokémon au tournoi, mais sélectionne uniquement deux combattants par match. Le premier sera ton Lead.</p><div class="dome-lead-options">'+run.team.map((p,i)=>{const pos=chosen.indexOf(i);return '<button class="dome-lead-option '+(pos>=0?'chosen':'')+'" data-dome-pick="'+i+'" aria-pressed="'+(pos>=0)+'">'+icon(p.species)+' <b>'+escapeHTML(nameOf(p.species))+'</b><small>'+(pos===0?'★ LEAD':pos===1?'2e POKÉMON':'EN RÉSERVE')+'</small></button>';}).join('')+'</div></div>':'';
 const opponents=opponent?.team.map(p=>'<span class="dome-opponent">'+icon(p.species)+' '+escapeHTML(nameOf(p.species))+'</span>').join('')||'';
 const nextLabel=finished?'🏆 TOURNOI REMPORTÉ !':snap.status==='lost'?'ÉLIMINÉ':snap.status==='won'?'VICTOIRE · QUALIFIÉ !':'';
 const controls=preview?'<h3>'+DOME_ROUNDS[round]+'</h3><p>ADVERSAIRE : <b>'+escapeHTML(opponent?.name||snap.trainer)+'</b></p><p>ÉQUIPE INSCRITE DE L’ADVERSAIRE</p><div class="dome-opponents">'+opponents+'</div>'+(dome.menu==='select'?options:'')+'<button class="btn primary" id="dome-fight" '+(chosen.length!==2?'disabled':'')+'>COMMENCER LE MATCH ▶</button>':nextLabel+'<div><button class="btn primary" id="'+(snap.status==='won'&&!finished?'dome-next':'dome-finish')+'">'+(snap.status==='won'&&!finished?'TABLEAU DU TOUR SUIVANT ▶':'MES DÉFIS')+'</button></div>';
 $('#battle-controls').innerHTML='<section class="terminal dome-panel"><h3>DÔME DE COMBAT · 16 PARTICIPANTS · '+(run.mode==='double'?'DUO':'SOLO')+'</h3>'+(preview?reception():'')+(dome.menu==='bracket'||!preview?'<div class="dome-tree">'+bracket+'</div>':'')+(dome.menu==='profile'&&preview?profilePanel:'')+controls+'</section>';
 if($('#dome-opponent'))$('#dome-opponent').onclick=()=>{dome.menu='profile';dome.viewProfile=opponent?.id;renderBattle();};
 if($('#dome-bracket'))$('#dome-bracket').onclick=()=>{dome.menu='bracket';renderBattle();};
 if($('#dome-select'))$('#dome-select').onclick=()=>{dome.menu='select';renderBattle();};
 if($('#dome-rest'))$('#dome-rest').onclick=async()=>{await saveBattleSession();nav('mode');};
 if($('#dome-leave'))$('#dome-leave').onclick=async()=>{if(confirm('Abandonner le tournoi et perdre la série ?')){engine.status='lost';dome.phase='eliminated';await saveBattleSession();nav('mode');}};
 if($('#dome-record'))$('#dome-record').onclick=()=>notify('Le combat précédent est conservé dans l’historique de ce défi.');
 $('[data-dome-profile]').forEach(b=>b.onclick=()=>{dome.menu='profile';dome.viewProfile=b.dataset.domeProfile;renderBattle();});
 $$('[data-dome-pick]').forEach(button=>button.onclick=async()=>{
  const index=Number(button.dataset.domePick),current=Array.isArray(dome.chosen)?[...dome.chosen]:[0,1];
  if(current.includes(index)){if(current.length>1)current.splice(current.indexOf(index),1);}
  else if(current.length<2)current.push(index);else current.splice(1,1,index);
  dome.chosen=current;await store();renderBattle();
 });
 if($('#dome-fight'))$('#dome-fight').onclick=async()=>{
  const indices=dome.chosen||[0,1];domeSelectTwo(run.team,indices);
  const selected=indices.map(i=>engine.player.party[i]);
  if(selected.some(x=>!x))throw Error('Sélection du Dôme invalide.');
  engine.player.party=selected;
  engine.player.active=run.mode==='double'?selected.map(p=>p.id):[selected[0].id];selected.forEach((p,i)=>p.active=run.mode==='double'||i===0);
  engine.sets=domeSelectTwo(run.team,indices);
  engine.originalConfig.team=engine.sets;
  const cpuIndices=domeCpuSelection(domeNextOpponent(dome).team,run.team,D,TYPE_CHART);
  engine.opponent.party=cpuIndices.map(i=>engine.opponent.party[i]);
  engine.opponent.active=run.mode==='double'?engine.opponent.party.map(p=>p.id):[engine.opponent.party[0].id];engine.opponent.party.forEach((p,i)=>p.active=run.mode==='double'||i===0);
  dome.phase='battle';await saveBattleSession();renderBattle();
 };
 if($('#dome-next'))$('#dome-next').onclick=async()=>{
  await begin(true);
 };
 if($('#dome-finish'))$('#dome-finish').onclick=async()=>{
  await store();nav('mode');
 };
}
function renderBattle(){if(!engine)return;const snap=engine.snapshot(),run=state.runs.find(r=>r.id===activeRun);$('#battle-mode').textContent=(run?.facility==='factory'?'USINE · ':run?.facility==='dome'?'DÔME · ':MODES[state.mode][0]+' · ')+'NIVEAU '+(state.levelMode==='50'?'50':'LIBRE');$('#battle-heading').textContent=snap.trainer;$('#streak-counter').textContent=run?.facility==='dome'?('TOUR '+Math.min(4,(run.victories||0)+1)+'/4'):`${snap.streak} VICTOIRE(S) · ${snap.round}/7`;
 const enemy=engine.active('opponent'),own=engine.active('player');$('#battle-arena').innerHTML=`<div class="battle-row enemy ${enemy.length>1?'double':''}">${enemy.map(m=>combatMon(m,false)).join('')}</div><div class="battle-row player ${own.length>1?'double':''}">${own.map(m=>combatMon(m,true)).join('')}</div>`;
 $('#battle-dialogue').innerHTML=logHTML(engine.log.filter(e=>e.turn===engine.turn));$('#battle-log').innerHTML='<h2>Combat '+(engine.streak+1)+'</h2>'+logHTML(engine.log)+(run.pastBattles||[]).slice().reverse().map(b=>`<details><summary>Combat ${b.number} · ${escapeHTML(b.trainer)}</summary>${logHTML(b.log)}</details>`).join('');
 if(run?.facility==='dome'&&(run.dome?.phase==='preview'||snap.status!=='active')){renderDomeScreen(run,snap);spriteFallback($('#battle-board'));return;}
 if(snap.status==='won'&&run?.facility==='factory'){renderFactoryExchange(run);spriteFallback($('#battle-board'));return;}
 if(snap.status!=='active'){$('#battle-controls').innerHTML=`<div class="terminal"><h3>${snap.status==='won'?'VICTOIRE !':'DÉFAITE !'}</h3><p>${snap.status==='won'?'Équipe restaurée au prochain combat.':'Fin de ce défi. Son historique reste disponible.'}</p>${snap.status==='won'?'<button class="btn primary" id="next-fight">COMBAT SUIVANT ▶</button>':'<button class="btn primary" id="return-runs">MES DÉFIS</button>'}</div>`;if($('#next-fight'))$('#next-fight').onclick=()=>begin(true);if($('#return-runs'))$('#return-runs').onclick=()=>nav('mode');spriteFallback($('#battle-arena'));return;}
 if(engine.pendingReplacements?.length&&renderReplacement()){spriteFallback($('#battle-board'));return;}
 const controllable=own.filter(m=>m.owner==='human'||m.owner==='human2');let html='';for(const [index,mon] of controllable.entries()){
 const choice=actions[mon.id];html+=`<div class="chooser"><h3>ACTIF ${index+1} · ${escapeHTML(mon.name)} ${choice?'✓':'· ACTION À CHOISIR'}</h3><div class="moves">${(mon.moves.every(k=>mon.pp[k]<=0||(mon.choiceLock&&mon.choiceLock!==k))?['STRUGGLE']:mon.moves).map(key=>{const m=D.moveData[key],selected=choice?.type==='move'&&choice.move===key;return `<button class="move ${selected?'sel':''}" style="--move-color:${TYPES[m.type]?.[1]||'#ddd'}" aria-pressed="${selected}" data-actor="${mon.id}" data-move="${key}" ${(mon.pp[key]>0&&(!mon.choiceLock||mon.choiceLock===key))||key==='STRUGGLE'?'':'disabled'}><b>${selected?'✓ ':''}${escapeHTML(moveName(key))}</b><small>${typeName(m.type)} · ${m.category==='physical'?'Physique':m.category==='special'?'Spéciale':'Statut'}<br>${key==='STRUGGLE'?'—':mon.pp[key]+' / '+m.pp} PP</small></button>`;}).join('')}</div>`;
 if(choice?.type==='move'){
  if(D.moveData[choice.move].effect==='baton')html+=`<fieldset class="bench-panel"><legend>DESTINATAIRE DE RELAIS</legend>${engine.bench('player',mon.owner).map(p=>`<button class="bench-card ${choice.to===p.id?'chosen':''}" data-baton-actor="${mon.id}" data-baton-to="${p.id}">${memberCard(p)}${choice.to===p.id?'✓':''}</button>`).join('')}</fieldset>`;
  const plan=targetPlan(engine,mon.id,choice.move);
  html+=plan.automatic?`<p class="target-label">↳ ${plan.label}</p>`:`<fieldset class="target-panel"><legend>CIBLE DE ${escapeHTML(moveName(choice.move))}</legend><div class="target-cards">${plan.targets.map(t=>`<button class="target-card ${choice.target===t.id?'selected':''}" aria-pressed="${choice.target===t.id}" data-target-actor="${mon.id}" data-target-id="${t.id}">${icon(t.species)}<b>${choice.target===t.id?'✓ ':''}${escapeHTML(t.name)}</b>${badges(t.species)}<small>${engine.sideOf(t)==='player'?'ALLIÉ · ':''}${engine.sideOf(t)==='opponent'&&state.hideEnemyPercent?'PV masqués':percent(t.hp,t.maxHp,state.hpPrecision||1)+' %'}${t.status?' · '+escapeHTML(t.status):''}</small></button>`).join('')}</div></fieldset>`;
 }
 html+=`<details class="bench-panel"><summary>CHANGER ${escapeHTML(mon.name)}</summary><div class="bench-list">${engine.player.party.filter(m=>m.owner===mon.owner).map(m=>{const reserved=Object.values(actions).some(a=>a.actor!==mon.id&&a.type==='switch'&&a.to===m.id);return `<button class="bench-card" data-switch-actor="${mon.id}" data-switch-to="${m.id}" ${m.active||m.hp<=0||reserved?'disabled':''}>${memberCard(m)}${reserved?'<small>DÉJÀ CHOISI</small>':''}</button>`;}).join('')}</div></details>`;
 if(choice)html+=`<p class="action-mark">✓ ${choice.type==='switch'?'Remplacer par '+escapeHTML(engine.get(choice.to)?.name):escapeHTML(moveName(choice.move))+(targetPlan(engine,mon.id,choice.move).automatic?'':' → '+escapeHTML(engine.get(choice.target)?.name||'CHOISIR UNE CIBLE'))}</p>`;
 html+='</div>';
 }
 if(switchPrompt){const from=engine.get(switchPrompt.actor),to=engine.get(switchPrompt.to);html+=`<div class="switch-confirm" role="dialog" aria-label="Confirmer le remplacement"><p>Remplacer <b>${escapeHTML(from.name)}</b> par <b>${escapeHTML(to.name)}</b> ?</p><button id="confirm-switch">CONFIRMER</button><button id="cancel-switch">ANNULER</button></div>`;}
 html+=`<div class="combat-actions"><button id="commit-turn" class="btn primary" ${controllable.some(m=>!actions[m.id]||(actions[m.id].type==='move'&&(!actions[m.id].target||(D.moveData[actions[m.id].move]?.effect==='baton'&&!actions[m.id].to))))||switchPrompt?'disabled':''}>VALIDER LE TOUR ▶</button></div>`;$('#battle-controls').innerHTML=html;
 $$('#battle-controls [data-actor]').forEach(b=>b.onclick=()=>{const actor=b.dataset.actor,plan=targetPlan(engine,actor,b.dataset.move);actions[actor]={actor,type:'move',move:b.dataset.move,target:plan.automatic||plan.targets.length===1?plan.targets[0]?.id:null};switchPrompt=null;saveBattleSession();renderBattle();});
 $$('[data-baton-actor]').forEach(b=>b.onclick=()=>{actions[b.dataset.batonActor].to=b.dataset.batonTo;saveBattleSession();renderBattle();});
 $$('[data-target-actor]').forEach(b=>b.onclick=()=>{actions[b.dataset.targetActor].target=b.dataset.targetId;saveBattleSession();renderBattle();});
 $$('[data-switch-actor]').forEach(b=>b.onclick=()=>{switchPrompt={actor:b.dataset.switchActor,to:b.dataset.switchTo};renderBattle();$('#confirm-switch').scrollIntoView({block:'nearest'});});
 if($('#confirm-switch')){$('#confirm-switch').onclick=()=>{const {actor,to}=switchPrompt;actions[actor]={actor,type:'switch',to};switchPrompt=null;saveBattleSession();renderBattle();};$('#cancel-switch').onclick=()=>{switchPrompt=null;renderBattle();};}
 $('#commit-turn').onclick=async()=>{if(storageFailed||presenting)return;$('#commit-turn').disabled=true;try{await saveQueue;const backup=deepCopy(state.runs.find(r=>r.id===activeRun));try{const oldLogLength=engine.log.length;const result=engine.turnActions(Object.values(actions));const visualEvents=engine.log.slice(0,engine.log.length-oldLogLength).reverse();actions={};if(result.status!=='active')saveRecord(result.status);await saveBattleSession();renderBattle();presenting=true;$('#battle-controls').inert=true;try{await presenter.play(visualEvents,preferences(state));}finally{presenting=false;$('#battle-controls').inert=false;}}catch(e){engine=restoreEngine(D,backup,TowerEngine);actions=backup.actions||{};throw e;}}catch(e){notify(e.message);if(!storageFailed)renderBattle();}};
 spriteFallback($('#battle-board'));
}

const STATUS_LABELS={sleep:'SOMMEIL',paralyze:'PARALYSÉ',toxic:'TOXIK',poison:'POISON',burn:'BRÛLURE',freeze:'GEL'};
function statusBadges(mon){const tags=[];if(mon.status)tags.push('<span class="condition-tag condition-'+escapeHTML(mon.status)+'">'+escapeHTML(STATUS_LABELS[mon.status]||mon.status.toUpperCase())+'</span>');if(mon.confused>0)tags.push('<span class="condition-tag condition-confused">CONFUS</span>');return tags.length?'<div class="condition-tags" aria-label="Altérations de statut">'+tags.join('')+'</div>':'';}
function moveTypeBadge(type){const t=TYPES[type]||[type,'#aaa'];return '<span class="move-type-badge" style="background:'+t[1]+'">'+escapeHTML(t[0])+'</span>';}
const FR_NATURES={HARDY:'Hardi',LONELY:'Solo',BRAVE:'Brave',ADAMANT:'Rigide',NAUGHTY:'Mauvais',BOLD:'Assuré',DOCILE:'Docile',RELAXED:'Relax',IMPISH:'Malin',LAX:'Lâche',TIMID:'Timide',HASTY:'Pressé',SERIOUS:'Sérieux',JOLLY:'Jovial',NAIVE:'Naïf',MODEST:'Modeste',MILD:'Doux',QUIET:'Discret',BASHFUL:'Pudique',RASH:'Foufou',CALM:'Calme',GENTLE:'Gentil',SASSY:'Malpoli',CAREFUL:'Prudent',QUIRKY:'Bizarre'};
const FR_ITEMS={NONE:'Aucun',LEFTOVERS:'Restes',SCOPE_LENS:'Lentilscope',KINGS_ROCK:'Roche Royale',SHELL_BELL:'Grelot Coque',SOFT_SAND:'Sable Doux',MYSTIC_WATER:'Eau Mystique',CHERI_BERRY:'Baie Ceriz',LUM_BERRY:'Baie Prine',SITRUS_BERRY:'Baie Sitrus',CHOICE_BAND:'Bandeau Choix',QUICK_CLAW:'Vive Griffe',FOCUS_BAND:'Bandeau',BRIGHT_POWDER:'Poudreclaire',WHITE_HERB:'Herbe Blanche',BLACK_SLUDGE:'Boue Noire',LIFE_ORB:'Orbe Vie',SALAC_BERRY:'Baie Sailak',PETAYA_BERRY:'Baie Pitaye',LIECHI_BERRY:'Baie Lichii',CHESTO_BERRY:'Baie Maron',ASPEAR_BERRY:'Baie Willia',RAWST_BERRY:'Baie Fraive',PECHA_BERRY:'Baie Pêcha',PERSIM_BERRY:'Baie Kika',SILK_SCARF:'Mouchoir Soie',MAGNET:'Aimant',CHARCOAL:'Charbon',MIRACLE_SEED:'Grain Miracl',NEVER_MELT_ICE:'Glace Éternelle',BLACK_BELT:'Ceinture Noire',SPELL_TAG:'Rune Sort',TWISTED_SPOON:'Cuillertordu',DRAGON_FANG:'Croc Dragon',METAL_COAT:'Peau Métal',HARD_STONE:'Pierre Dure',SHARP_BEAK:'Bec Pointu',POISON_BARB:'Pic Venin'};
const FR_ABILITIES={INTIMIDATE:'Intimidation',LEVITATE:'Lévitation',PRESSURE:'Pression',SWIFT_SWIM:'Glissade',CHLOROPHYLL:'Chlorophylle',STURDY:'Fermeté',CLEAR_BODY:'Corps Sain',INNER_FOCUS:'Attention',NATURAL_CURE:'Médic Nature',SYNCHRONIZE:'Synchro',BLAZE:'Brasier',TORRENT:'Torrent',OVERGROW:'Engrais',STATIC:'Statik',FLASH_FIRE:'Torche',WATER_ABSORB:'Absorb Eau',VOLT_ABSORB:'Absorb Volt',THICK_FAT:'Isograisse',SAND_STREAM:'Sable Volant',SPEED_BOOST:'Turbo',SHELL_ARMOR:'Coque Armure',BATTLE_ARMOR:'Armurbaston',HUGE_POWER:'Coloforce',PURE_POWER:'Force Pure',GUTS:'Cran',MARVEL_SCALE:'Écaille Spé.',SHADOW_TAG:'Marque Ombre',TRUANT:'Absentéisme',SERENE_GRACE:'Sérénité',KEEN_EYE:'Regard Vif',INSOMNIA:'Insomnia',EARLY_BIRD:'Matinal',OWN_TEMPO:'Tempo Perso',OBLIVIOUS:'Benêt',SAND_VEIL:'Voile Sable',HYPER_CUTTER:'Hyper Cutter',IMMUNITY:'Vaccin',POISON_POINT:'Point Poison',ROCK_HEAD:'Tête de Roc',LIGHTNING_ROD:'Paratonnerre',COMPOUND_EYES:'Œil Composé',CLOUD_NINE:'Ciel Gris',DROUGHT:'Sécheresse',DRIZZLE:'Crachin'};
const frKey=(key,map)=>map[key]||String(key||'—').replaceAll('_',' ');
function showFactorySummary(p){
 if(!p||!D.species[p.species])return;
 let dialog=$('#factory-summary');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='factory-summary';dialog.className='game-dialog factory-summary-dialog';document.body.append(dialog);}
 const labels=['PV','ATTAQUE','DÉFENSE','ATQ. SPÉ.','DÉF. SPÉ.','VITESSE'];
 const values=statsFor(p,D,p.level||50),keys=['hp','atk','def','spa','spd','spe'];
 const moves=(p.moves||[]).map(key=>{const m=D.moveData[key];return '<li class="factory-move '+(m?'move-'+escapeHTML(m.type.toLowerCase()):'')+'"><b>'+escapeHTML(moveName(key))+'</b><small>'+(m?moveTypeBadge(m.type)+' · '+(m.category==='physical'?'Physique':m.category==='special'?'Spéciale':'Statut')+' · '+(m.power||'—')+' puissance · '+m.pp+' PP':'')+'</small></li>';}).join('');
 dialog.innerHTML='<div class="factory-summary-banner">POKÉMON · RÉSUMÉ <span>USINE DE COMBAT</span></div><div class="factory-summary-head">'+sprite(p.species)+'<div><h3>'+escapeHTML(nameOf(p.species))+' · N.'+(p.level||50)+'</h3>'+badges(p.species)+'<p><b>Nature :</b> '+escapeHTML(frKey(p.nature,FR_NATURES))+'</p><p><b>Talent :</b> '+escapeHTML(frKey(p.ability,FR_ABILITIES))+'</p><p><b>Objet tenu :</b> '+escapeHTML(frKey(p.item||'NONE',FR_ITEMS))+'</p></div></div><h3 class="factory-summary-section">STATISTIQUES · IV / EV</h3><div class="factory-summary-stats">'+keys.map((key,i)=>'<div><span>'+labels[i]+'</span><b>'+values[key]+'</b><small>IV '+(p.ivs?.[i]??'—')+' · EV '+(p.evs?.[i]??'—')+'</small></div>').join('')+'</div><h3 class="factory-summary-section">CAPACITÉS</h3><ul class="factory-summary-moves">'+moves+'</ul><button class="btn primary" id="factory-summary-close">FERMER</button>';
 dialog.querySelector('#factory-summary-close').onclick=()=>dialog.close();
 spriteFallback(dialog);dialog.showModal();
}
function renderFactoryDraft(){
 const section=$('#team');
 section.querySelector('.section-title h2').textContent='CHOISIS TES POKÉMON DE LOCATION';
 section.querySelector('.preset-area').classList.add('hidden');
 section.querySelector('.team-library').classList.add('hidden');
 section.querySelector('.rules-panel').classList.add('hidden');
 $('#partner-box').classList.add('hidden');
 if(!factoryPool.length){try{factoryPool=rentalPool(D,{levelMode:state.levelMode});}catch(e){$('#team-list').innerHTML='<p>'+escapeHTML(e.message)+'</p>';$('#start').disabled=true;return;}}
 $('#team-list').innerHTML='<p>Sélectionne 3 Pokémon parmi les 6 proposés. Tu pourras échanger après chaque victoire.</p><div class="bench-list">'+factoryPool.map((p,i)=>'<div class="factory-pick-row"><button class="bench-card '+(factorySelection.includes(i)?'chosen':'')+'" data-rental="'+i+'">'+icon(p.species)+' <b>'+escapeHTML(nameOf(p.species))+'</b>'+(factorySelection.includes(i)?' ✓':'')+'</button><button class="btn factory-detail" data-rental-info="'+i+'" aria-label="Résumé de '+escapeHTML(nameOf(p.species))+'">RÉSUMÉ</button></div>').join('')+'</div><button id="factory-reroll" class="btn">AUTRES LOCATIONS</button>';
 $$('[data-rental]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.rental);factorySelection=factorySelection.includes(i)?factorySelection.filter(x=>x!==i):factorySelection.length<3?[...factorySelection,i]:factorySelection;renderFactoryDraft();});
 $$('[data-rental-info]').forEach(b=>b.onclick=()=>showFactorySummary(factoryPool[Number(b.dataset.rentalInfo)]));
 $('#factory-reroll').onclick=()=>{factoryPool=[];factorySelection=[];renderFactoryDraft();};
 $('#validation').textContent=factorySelection.length+'/3 POKÉMON DE LOCATION SÉLECTIONNÉS';
 $('#validation').classList.remove('error');
 $('#start').disabled=factorySelection.length!==3;
 $('#start').textContent='DÉMARRER L’USINE ▶';
}
function prepareFactoryOffers(){
 const run=state.runs.find(r=>r.id===activeRun);
 if(!run||run.facility!=='factory'||run.factory?.phase==='exchange')return;
 const team=engine.opponent.party.slice(0,3).map(p=>({species:p.species,item:p.item||'NONE',nature:p.nature,moves:[...p.moves],evs:[...p.evs],ivs:[...p.ivs],ability:p.ability,level:p.level,role:'Location adversaire'}));
 run.factory=proposeFactoryExchange(run.factory,team);
}
function renderFactoryExchange(run){
 if(run.factory?.phase!=='exchange'){const opponent=run.engine?.opponent?.party||[];if(opponent.length>=3){const offers=opponent.slice(0,3).map(p=>({species:p.species,item:p.item||'NONE',nature:p.nature,moves:[...p.moves],evs:[...p.evs],ivs:[...p.ivs],ability:p.ability,level:p.level}));run.factory=proposeFactoryExchange(run.factory,offers);}else{notify('Propositions adverses indisponibles.');return;}}
 const fac=run.factory;
 const card=(p,i,kind,selected)=>'<div class="factory-pick-row"><button class="bench-card '+(selected?'chosen':'')+'" data-'+kind+'="'+i+'">'+icon(p.species)+' <b>'+escapeHTML(nameOf(p.species))+'</b>'+(selected?' ✓':'')+'</button><button class="btn factory-detail" data-'+kind+'-info="'+i+'" aria-label="Résumé de '+escapeHTML(nameOf(p.species))+'">RÉSUMÉ</button></div>';
 $('#battle-controls').innerHTML='<div class="terminal"><h3>USINE · ÉCHANGE APRÈS VICTOIRE</h3><p>Choisis un Pokémon adverse et celui de ton équipe à remplacer, ou passe.</p><h3>POKÉMON ADVERSAIRES</h3><div class="bench-list">'+fac.offers.map((p,i)=>card(p,i,'offer',factorySwap.take===i)).join('')+'</div><h3>TON ÉQUIPE</h3><div class="bench-list">'+fac.team.map((p,i)=>card(p,i,'give',factorySwap.give===i)).join('')+'</div><button id="factory-pass" class="btn">PASSER ▶</button> <button id="factory-confirm" class="btn primary" '+(factorySwap.take==null||factorySwap.give==null?'disabled':'')+'>ÉCHANGER ▶</button></div>';
 $$('[data-offer]').forEach(b=>b.onclick=()=>{factorySwap.take=Number(b.dataset.offer);renderFactoryExchange(run);});
 $$('[data-give]').forEach(b=>b.onclick=()=>{factorySwap.give=Number(b.dataset.give);renderFactoryExchange(run);});
 $$('[data-offer-info]').forEach(b=>b.onclick=()=>showFactorySummary(fac.offers[Number(b.dataset.offerInfo)]));
 $$('[data-give-info]').forEach(b=>b.onclick=()=>showFactorySummary(fac.team[Number(b.dataset.giveInfo)]));
 const finish=async choice=>{try{run.factory=resolveFactoryExchange(run.factory,choice);run.team=deepCopy(run.factory.team);factorySwap={};await saveBattleSession();await begin(true);}catch(e){notify(e.message);}};
 $('#factory-pass').onclick=()=>finish('pass');
 $('#factory-confirm').onclick=()=>finish(factorySwap);
}

async function main(){let response=await fetch('./data/catalog.json');if(!response.ok)throw new Error('Catalogue introuvable');D=await response.json();
 try{let raw=JSON.parse(localStorage.getItem(STORE)||localStorage.getItem(LEGACY_STORE)||'null');if(raw&&raw.mode&&Array.isArray(raw.team))state={...state,...raw};}catch{}
 repository=await new RunStore().open();const saved=await repository.load();revision=saved?.revision||0;state=saved?migrateState(saved.state):migrateState(state);if(!saved)await store();
 if(!MODES[state.mode]||state.mode==='network')state.mode='single';
 if(!state.team.length)state.team=['METAGROSS','SWAMPERT','LATIOS'].map(setFor).filter(Boolean);
 $('#version-label').textContent='v0.6.4 · DÔME EN TEST';
 $('#facility-select').onchange=e=>{state.facility=e.target.value;if(state.facility==='factory'||state.facility==='dome')state.mode='single';factoryPool=[];factorySelection=[];store();renderMode();};
 presenter=new BattlePresenter($('#battle-arena'));setupOptions();
 $('#battle-arena').onclick=e=>{const button=e.target.closest('[data-stat-info]');if(button)showStats(engine.get(button.dataset.statInfo));};
 setupLibrary();
 let count=Object.keys(D.species).length;$('#source-state').textContent=`${count} ESPÈCES · ${Object.keys(D.moveData).length} CAPACITÉS · ${D.aiScript?.audit? 'SCRIPTS IA SOURCE ('+D.aiScript.audit.instructions+' instructions, simulation partielle)' : 'IA ORIGINALE À SYNCHRONISER'}`;
 $$('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));$('#to-team').onclick=()=>nav('team');$('#back-mode').onclick=()=>nav('mode');$('#use-preset').onclick=()=>{let preset=D.teams[$('#presets').value];if(!preset)return;state.team=preset.members.map(setFor);store();renderTeam();notify('Composition chargée.');};$('#start').onclick=()=>begin(false);
 $('#edit-close').onclick=()=>$('#edit-layer').classList.add('hidden');$('#edit-save').onclick=saveEdit;$('#edit-layer').onclick=e=>{if(e.target.id==='edit-layer')$('#edit-layer').classList.add('hidden')};$('#battle-exit').onclick=()=>{if(!engine)return;if(confirm('Abandonner ce défi et perdre sa série ?')){engine.status='lost';engine.write('Défi abandonné.');saveRecord('lost');nav('mode');}};$('#battle-pause').onclick=async()=>{try{await saveBattleSession();nav('mode');}catch{}};$('#hp-precision').value=state.hpPrecision||1;$('#hp-precision').onchange=e=>{state.hpPrecision=+e.target.value;store();};$('#hide-enemy-percent').checked=!!state.hideEnemyPercent;$('#hide-enemy-percent').onchange=e=>{state.hideEnemyPercent=e.target.checked;store();};$('#battle-log-toggle').onclick=()=>$('#battle-log').classList.toggle('hidden');document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&engine)saveBattleSession();});
 nav('mode');}
main().catch(e=>{document.querySelector('main').innerHTML=`<section class="screen"><h2>ERREUR DE CHARGEMENT</h2><p>${escapeHTML(e.message)}</p><p>Ouvre le site depuis son adresse HTTPS, ou depuis ton ordinateur sur le même Wi-Fi.</p></section>`;console.error(e)});

function renderStats(){const p=deepCopy(editing);p.nature=$('[data-field=nature]').value;p.level=Number($('[data-field=level]').value);p.evs=$$('[data-ev]').map(x=>Number(x.value));p.ivs=$$('[data-iv]').map(x=>Number(x.value));let st=statsFor(p,D,p.level);$('#stats-preview').innerHTML=Object.entries(st).map(([k,v])=>`<span>${k.toUpperCase()} <b>${v}</b></span>`).join('');}
function download(name,data){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderSavedTeams(){let list=state.savedTeams||[];$('#saved-teams').innerHTML=list.map((t,i)=>`<option value="${i}">${escapeHTML(t.name)} · ${escapeHTML(t.mode)}</option>`).join('');$('#load-team').disabled=$('#delete-team').disabled=!list.length;}
function setupLibrary(){
 $('#save-team').onclick=()=>{const errors=validateTeam(state.team,state.mode,state.levelMode,D);if(errors.length){notify(errors[0]);return;}let name=prompt('Nom de cette équipe (une nouvelle copie sera enregistrée) :','Équipe '+((state.savedTeams||[]).length+1));if(!name?.trim())return;(state.savedTeams||=[]).push({name:name.trim().slice(0,80),mode:state.mode,levelMode:state.levelMode,members:deepCopy(state.team)});store();renderSavedTeams();};
 $('#load-team').onclick=()=>{const t=state.savedTeams?.[+$('#saved-teams').value];if(!t)return;state.mode=t.mode;state.levelMode=t.levelMode;state.team=deepCopy(t.members);store();renderTeam();};
 $('#delete-team').onclick=()=>{let i=+$('#saved-teams').value;if(confirm('Supprimer cette équipe enregistrée ?')){state.savedTeams.splice(i,1);store();renderSavedTeams();}};
 $('#export-save').onclick=()=>download('BattleTower-sauvegarde-v2.json',exportSave(state));
 $('#export-team').onclick=()=>download('BattleTower-equipe-v1.json',{application:'battle-tower-team',schema:1,mode:state.mode,levelMode:state.levelMode,team:state.team});
 $('#import-json').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>20000000)throw Error('Fichier trop volumineux (20 Mo maximum).');const raw=JSON.parse(await f.text());if(raw.application==='battle-tower-team'){const errors=validateTeam(raw.team,raw.mode,raw.levelMode,D);if(errors.length)throw Error(errors.join(' · '));state.mode=raw.mode;state.levelMode=raw.levelMode;state.team=raw.team;}else{const parsed=validateImport(raw,D);if(!confirm('Remplacer toutes les équipes, défis et records par ce fichier ? Exporte d’abord la sauvegarde actuelle si nécessaire.'))return;state=parsed;engine=null;activeRun=null;}store();nav('team');notify('Import terminé.');}catch(err){notify('Import refusé : '+err.message)}finally{e.target.value=''}};
}
