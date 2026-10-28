// Battle Dome tournament model. Bracket order follows pokeemerald seed pairings.
// CPU-versus-CPU results currently use a seeded weighted approximation; not the ROM battle resolver.
export const DOME_PAIRS=[[1,9],[13,5],[8,16],[12,4],[3,11],[15,7],[6,14],[10,2]];
export const DOME_ROUNDS=['HUITIÈMES DE FINALE','QUARTS DE FINALE','DEMI-FINALES','FINALE'];
export function domeStrength(team,data){
 const species=team.map(m=>data.species[m.species]).filter(Boolean);
 const total=species.reduce((n,s)=>n+Object.values(s.baseStats||s.base||s.stats||{}).reduce((a,b)=>a+(Number(b)||0),0),0);
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
 return {phase:'preview',round:0,leadIndex:0,chosen:[0,1],participants:roster,rounds:[DOME_PAIRS.map(pair=>pair.map(seed=>bySeed.get(seed)))],results:[],champion:null,tournamentNumber:1,tournamentsWon:0,history:[]};
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

/** Gen III Dome offensive/defensive matchup scoring (selection phase).
 * Tie-break and lead probabilities mirror documented Emerald selection rules.
 */
export function domeCpuSelection(enemyTeam,playerTeam,data,typeChart,random=Math.random){
 const score=(mon,method)=>{
  let points=0;
  for(const target of playerTeam){
   if(method==='offense'){
    for(const move of mon.moves||[]){
     const info=data.moveData?.[move];if(!info||!info.power)continue;
     const multiplier=(data.species[target.species]?.types||[]).reduce((v,t)=>v*(typeChart[info.type]?.[t]??1),1);
     if(multiplier>=4)points+=8;else if(multiplier>=2)points+=4;else if(multiplier>=1)points+=2;
    }
   }else{
    for(const move of target.moves||[]){
     const info=data.moveData?.[move];if(!info||!info.power)continue;
     const multiplier=(data.species[mon.species]?.types||[]).reduce((v,t)=>v*(typeChart[info.type]?.[t]??1),1);
     if(multiplier===0)points+=8;else if(multiplier<=.25)points+=4;else if(multiplier<=.5)points+=2;
     else if(multiplier>=4)points-=4;else if(multiplier>=2)points-=2;
    }
   }
  }
  return points;
 };
 let method=random()<.5?'offense':'defense';
 let scores=enemyTeam.map(p=>score(p,method));
 if(scores.every(x=>x===scores[0])){method=method==='offense'?'defense':'offense';scores=enemyTeam.map(p=>score(p,method));}
 const order=enemyTeam.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]||(random()<.5?-1:1));
 if(scores.every(x=>x===scores[0]))return random()<.5?[order[0],order[1]]:[order[1],order[0]];
 return random()<.4?[order[0],order[1]]:[order[1],order[0]];
}

export function domeProfile(participant,data){
 const team=participant.team||[];
 const totals={hp:0,atk:0,def:0,spe:0,spa:0,spd:0};
 for(const p of team)for(let i=0;i<6;i++)totals[['hp','atk','def','spe','spa','spd'][i]]+=Number(p.evs?.[i]||0);
 const high=Math.max(...Object.values(totals));
 const favored=Object.keys(totals).filter(k=>totals[k]===high&&high>0);
 const moveStats={attack:0,defense:0,status:0};
 for(const p of team)for(const move of p.moves||[]){
  const m=data.moveData?.[move];if(!m)continue;
  if(Number(m.power)>0)moveStats.attack++;
  else moveStats.status++;
  if(['PROTECT','DETECT','RECOVER','REST','LIGHT_SCREEN','REFLECT','SUBSTITUTE'].includes(move))moveStats.defense++;
 }
 const style=moveStats.defense>=3?'Défensif':moveStats.status>=moveStats.attack?'Technique':'Offensif';
 return {name:participant.name,seed:participant.seed,strength:participant.strength,style,favored,team:team.map(p=>p.species)};
}

/** Enter the next four-match tournament without resetting the challenge streak. */
export function startNextDomeTournament(previous,playerTeam,participants,data,random=Math.random){
 if(previous.champion!=='player'||previous.results?.length!==4)throw Error('Le tournoi précédent doit être remporté avant de continuer.');
 const next=createDomeTournament(playerTeam,participants,data,random);
 next.tournamentNumber=(previous.tournamentNumber||1)+1;
 next.tournamentsWon=(previous.tournamentsWon||0)+1;
 next.history=[...(previous.history||[]),{
  number:previous.tournamentNumber||1,
  champion:'player',
  participants:previous.participants.map(p=>({id:p.id,name:p.name,seed:p.seed,species:p.team.map(m=>m.species)})),
  results:previous.results.map(round=>round.map(match=>({pair:[...match.pair],winner:match.winner})))
 }];
 return next;
}
