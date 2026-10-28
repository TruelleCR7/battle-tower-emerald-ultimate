// Battle Dome tournament model. Bracket order follows pokeemerald seed pairings.
// CPU-versus-CPU results currently use a seeded weighted approximation; not the ROM battle resolver.
export const DOME_PAIRS=[[1,9],[13,5],[8,16],[12,4],[3,11],[15,7],[6,14],[10,2]];
export const DOME_ROUNDS=['HUITIÈMES DE FINALE','QUARTS DE FINALE','DEMI-FINALES','FINALE'];
export function domeStrength(team,data){
 const species=team.map(m=>data.species[m.species]).filter(Boolean);
 const total=species.reduce((n,s)=>n+Object.values(s.baseStats||s.base||{}).reduce((a,b)=>a+(Number(b)||0),0),0);
 const types=new Set(species.flatMap(s=>s.types||[]));
 const highest=Math.max(50,...team.map(m=>m.level||50));
 return total+types.size*highest/20;
}
export function createDomeTournament(playerTeam,participants,data,random=Math.random){
 if(participants.length!==15)throw Error('Le Dôme exige quinze adversaires.');
 const roster=[{id:'player',name:'VOUS',team:playerTeam,player:true},...participants.map((p,i)=>({...p,id:'cpu-'+i,player:false}))];
 roster.forEach(p=>p.strength=domeStrength(p.team,data));
 roster.sort((a,b)=>b.strength-a.strength||(a.player?-1:b.player?1:0));
 roster.forEach((p,i)=>p.seed=i+1);
 const bySeed=new Map(roster.map(p=>[p.seed,p.id]));
 return {phase:'preview',round:0,leadIndex:0,chosen:[0,1],participants:roster,rounds:[DOME_PAIRS.map(pair=>pair.map(seed=>bySeed.get(seed)))],results:[],champion:null};
}
export function domeNextOpponent(dome){
 const pair=dome.rounds[dome.round]?.find(pair=>pair.includes('player'));
 if(!pair)return null;
 const id=pair.find(id=>id!=='player');
 return dome.participants.find(p=>p.id===id)||null;
}
export function domeResolveRound(dome,playerWon,random=Math.random){
 if(dome.champion)return dome;
 const pairs=dome.rounds[dome.round];if(!pairs||!pairs.some(p=>p.includes('player')))throw Error('Tournoi invalide.');
 const byId=new Map(dome.participants.map(p=>[p.id,p]));
 const winners=pairs.map(([a,b])=>{
  if(a==='player'||b==='player')return playerWon?'player':(a==='player'?b:a);
  const sa=byId.get(a).strength,sb=byId.get(b).strength;
  return random()<(sa/(sa+sb))?a:b;
 });
 dome.results.push(pairs.map((pair,i)=>({pair,winner:winners[i]})));
 if(!playerWon||winners.length===1){dome.champion=winners[0]||null;dome.phase=playerWon?'champion':'eliminated';return dome;}
 dome.round++;dome.rounds.push(Array.from({length:winners.length/2},(_,i)=>winners.slice(i*2,i*2+2)));
 dome.phase='preview';dome.leadIndex=0;dome.chosen=[0,1];return dome;
}
export function domeSelectTwo(team,indices){
 if(!Array.isArray(indices)||indices.length!==2||new Set(indices).size!==2||indices.some(i=>!Number.isInteger(i)||i<0||i>=team.length))throw Error('Sélectionne deux Pokémon différents.');
 return indices.map(i=>team[i]);
}
