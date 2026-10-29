// Battle Pike battle adapter. Uses the real TowerEngine and its source-backed enemy AI.
// Never imports the two-human manual Laboratory battle constructor.
import {TowerEngine,makeMon} from './engine.mjs';
const clone=x=>structuredClone(x);
export function createPikeBattle(data,{sets,party,opponents,mode='single',levelMode='50',seed=12345,trainer='Dresseur du Reptile'}){
 if(!['single','double'].includes(mode))throw Error('Format du Reptile invalide.');
 if(!Array.isArray(party)||party.length!==3||!Array.isArray(opponents)||!opponents.length)throw Error('Équipe du Reptile invalide.');
 const living=party.filter(p=>p.hp>0);
 if(!living.length)throw Error('Tous les Pokémon sont K.O. : le parcours est terminé.');
 // A door with a Duo encounter must remain playable with one surviving Pokémon.
 const battleMode=mode==='double'&&living.length<2?'single':mode;
 const enemyTeam=opponents.map(s=>makeMon(s,data,'cpu',s.level));
 const playerParty=clone(party);
 playerParty.forEach(p=>{p.owner='human';p.active=false;p.guarded=false;p.flinched=false;p.charging=null;});
 enemyTeam.forEach(p=>p.active=false);
 const battle=Object.create(TowerEngine.prototype);
 Object.assign(battle,{data,mode:battleMode,levelMode,level:levelMode==='50'?50:Math.max(60,...sets.map(p=>p.level||60)),
  rngState:seed>>>0,trainerHistory:[],streak:0,round:1,series:1,log:[],turn:0,status:'active',
  weather:'',weatherTurns:0,hazards:{player:0,opponent:0},score:0,trainer,
  sets:clone(sets),originalConfig:{mode:battleMode,levelMode,team:clone(sets),streak:0},
  pendingReplacements:[],actions:{},player:{party:playerParty,active:[]},opponent:{party:enemyTeam,active:[]}});
 battle.rng=()=>battle.random();
 const starting=playerParty.filter(p=>p.hp>0).slice(0,battleMode==='double'?2:1);
 for(const p of starting)p.active=true;
 battle.player.active=starting.map(p=>p.id);
 const enemyStarts=enemyTeam.slice(0,battleMode==='double'?2:1);
 for(const p of enemyStarts)p.active=true;
 battle.opponent.active=enemyStarts.map(p=>p.id);
 battle.write('Reptile de Combat : '+trainer+'.');
 if(battleMode!==mode)battle.write('Un seul Pokémon est encore disponible : rencontre disputée en Solo.');
 battle.entryEffects([...enemyStarts,...starting]);
 battle.resolveFaint();battle.checkEnd();battle.settleReplacements();
 return battle;
}
export function repairPikeBattle(battle){
 // Recover saves created by the original Pike adapter that deployed a KO first.
 if(!battle||battle.status!=='active')return false;
 let repaired=false;
 for(const side of ['player','opponent']){
  const team=battle[side];
  if(!team?.party?.length)continue;
  if(!Array.isArray(team.active))team.active=[];
  const taken=new Set();
  for(let slot=0;slot<team.active.length;slot++){
   const current=team.party.find(p=>p.id===team.active[slot]);
   if(current?.hp>0){current.active=true;taken.add(current.id);continue;}
   if(current)current.active=false;
   const replacement=team.party.find(p=>p.hp>0&&!taken.has(p.id));
   if(replacement){
    replacement.active=true;team.active[slot]=replacement.id;taken.add(replacement.id);
    battle.write(replacement.name+' entre en jeu à la place du Pokémon K.O. !',{kind:'replacement',actor:replacement.id,side});
    repaired=true;
   }else{team.active[slot]=null;repaired=true;}
  }
  if(!team.active.length&&team.party.some(p=>p.hp>0)){
   const next=team.party.find(p=>p.hp>0);next.active=true;team.active=[next.id];repaired=true;
  }
  if(side==='opponent')for(const p of team.party)p.owner='cpu';
 }
 if(repaired){battle.pendingReplacements=[];battle.checkEnd();}
 return repaired;
}
