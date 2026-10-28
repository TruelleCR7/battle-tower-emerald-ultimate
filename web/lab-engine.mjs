// Isolated two-sided manual battle harness. Does not read or write player saves.
import {TowerEngine,makeMon} from './engine.mjs';
const clone=o=>structuredClone(o);
export function createLabBattle(data,{mode='single',player,opponent,seed=12345}){
 if(!['single','double'].includes(mode))throw Error('Format du laboratoire inconnu.');
 const minimum=mode==='double'?2:1;
 for(const [side,team] of [['player',player],['opponent',opponent]]){
  if(!Array.isArray(team)||team.length<minimum||team.length>6)throw Error('Équipe '+side+' : entre '+minimum+' et 6 Pokémon.');
  for(const set of team){
   if(!data.species?.[set.species]||!Array.isArray(set.moves)||!set.moves.length||set.moves.length>4||set.moves.some(m=>!data.moveData?.[m]))throw Error('Set invalide : espèce ou capacité absente.');
   if(!Number.isInteger(set.level)||set.level<1||set.level>100)throw Error('Niveau invalide.');
  }
 }
 const battle=Object.create(TowerEngine.prototype);
 Object.assign(battle,{data,mode,levelMode:'open',level:50,rngState:seed>>>0,trainerHistory:[],streak:0,round:1,series:1,
  log:[],turn:0,status:'active',weather:'',weatherTurns:0,hazards:{player:0,opponent:0},score:0,trainer:'Laboratoire · adversaire manuel',
  sets:clone(player),originalConfig:{mode,levelMode:'open',team:clone(player),streak:0},pendingReplacements:[],actions:{},
  player:{party:player.map(s=>makeMon(s,data,'human',s.level)),active:[]},
  opponent:{party:opponent.map(s=>makeMon(s,data,'human2',s.level)),active:[]}});
 battle.rng=()=>battle.random();
 battle.initializeSide('player');
 battle.initializeSide('opponent');
 battle.write('Laboratoire : les deux équipes sont sous ton contrôle.');
 battle.entryEffects([...battle.active('opponent'),...battle.active('player')]);
 return battle;
}
export function labRequiredActions(battle){
 return [...battle.active('player'),...battle.active('opponent')].map(m=>({id:m.id,name:m.name,side:battle.sideOf(m),moves:m.moves,pp:m.pp,
  bench:battle.bench(battle.sideOf(m),m.owner).map(p=>({id:p.id,name:p.name}))}));
}
export function playLabTurn(battle,selected){
 if(battle.status!=='active')throw Error('Le combat est terminé.');
 if(battle.pendingReplacements?.length)throw Error('Effectue les remplacements après K.O.');
 const required=labRequiredActions(battle);
 const supplied=Object.keys(selected||{});
 if(supplied.length!==required.length||required.some(m=>!selected[m.id]))throw Error('Choisis une action pour chaque Pokémon actif des deux camps.');
 for(const {id,side} of required){
  const a=selected[id],m=battle.get(id);
  if(!a||a.actor!==id||!['move','switch'].includes(a.type))throw Error('Action manuelle invalide pour '+m.name);
  if(a.type==='move'){
   if(!m.moves.includes(a.move)&&a.move!=='STRUGGLE')throw Error('Capacité invalide pour '+m.name);
   if(a.move!=='STRUGGLE'&&(m.pp[a.move]||0)<=0)throw Error('Plus de PP : '+a.move);
   if(a.target&&!battle.get(a.target))throw Error('Cible inconnue.');
  }else if(!battle.bench(side,m.owner).some(p=>p.id===a.to))throw Error('Remplaçant invalide pour '+m.name);
 }
 // Engine treats only the player side as commandable. Override enemy AI only for this turn,
 // so the identical combat resolver handles all four human-selected actions.
 const commands=Object.values(selected).map(clone);
 const previousAI=battle.aiAction;
 battle.aiAction=m=>{const action=selected[m.id];if(!action)throw Error('Action adverse absente.');return clone(action);};
 try{return battle.turnActions(commands.filter(a=>battle.sideOf(battle.get(a.actor))==='player'));}
 finally{battle.aiAction=previousAI;}
}
export function labReplacements(battle){
 return (battle.pendingReplacements||[]).map(r=>({...r,choices:battle.bench(r.side,r.owner).map(p=>({id:p.id,name:p.name}))}));
}
export function labReplace(battle,faintedId,replacementId){return battle.replaceFainted(faintedId,replacementId);}
