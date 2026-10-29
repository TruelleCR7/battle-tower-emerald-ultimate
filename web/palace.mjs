// Battle Palace — nature distribution transcribed from pret/pokeemerald,
// src/battle_script_commands.c gBattlePalaceNatureToMoveGroupLikelihood.
// Each row: Attack, Defense for regular HP and below 50% HP; Support is remainder.
export const PALACE_NATURES={
 HARDY:[61,7,61,7],LONELY:[20,25,84,8],BRAVE:[70,15,32,60],ADAMANT:[38,31,70,15],
 NAUGHTY:[20,70,70,22],BOLD:[30,20,32,58],DOCILE:[56,22,56,22],RELAXED:[25,15,75,15],
 IMPISH:[69,6,28,55],LAX:[35,10,29,6],TIMID:[62,10,30,20],HASTY:[58,37,88,6],
 SERIOUS:[34,11,29,11],JOLLY:[35,5,35,60],NAIVE:[56,22,56,22],MODEST:[35,45,34,60],
 MILD:[44,50,34,6],QUIET:[56,22,56,22],BASHFUL:[30,58,30,58],RASH:[30,13,27,6],
 CALM:[40,50,25,62],GENTLE:[18,70,90,5],SASSY:[88,6,22,20],CAREFUL:[42,50,42,5],
 QUIRKY:[56,22,56,22]
};
export const PALACE_GROUPS=['attack','defense','support'];
export const PALACE_GROUP_LABELS={attack:'Attaque',defense:'Défense',support:'Soutien'};
export const palaceTier=streak=>streak===20?'silver':streak===41?'gold':null;
export function palaceChances(nature,low=false){
 const [a,d,la,ld]=PALACE_NATURES[nature]||PALACE_NATURES.HARDY;
 const attack=low?la:a,defense=low?ld:d;
 return {attack,defense,support:100-attack-defense};
}
// Pokeemerald groups moves by their effects, NOT by physical/special split.
// Defensive moves are self-directed: recovery, boosts, field protection, etc.
// Support includes opposing status, interference and stat-lowering moves.
const DEFENSE_EFFECTS=new Set(['heal','rest','protect','calm','swords','dragondance','bulk','sun','sand','hail',
 'reflect','light_screen','rain','substitute','aroma','destiny','baton','safeguard','spikes','belly_drums',
 'MIST','HAZE','COSMIC_POWER','BELLY_DRUM','PSYCH_UP','ATTACK_UP','ATTACK_UP_2','DEFENSE_UP','DEFENSE_UP_2',
 'SPECIAL_ATTACK_UP','SPECIAL_ATTACK_UP_2','SPECIAL_DEFENSE_UP','SPECIAL_DEFENSE_UP_2','SPEED_UP','SPEED_UP_2',
 'ACCURACY_UP','EVASION_UP','EVASION_UP_2','SAFEGUARD']);
export function palaceMoveGroup(move){
 if(!move)return 'support';
 if(move.category!=='status'&&move.power>0)return 'attack';
 if(move.target==='self'||move.target==='enemyfield'||DEFENSE_EFFECTS.has(move.effect)||DEFENSE_EFFECTS.has(move.originalEffect))return 'defense';
 return 'support';
}
const choice=(rng,list)=>list[Math.min(list.length-1,Math.floor(rng()*list.length))];
export function palaceChooseMove(engine,mon){
 const side=engine.sideOf(mon),foe=side==='player'?'opponent':'player';
 const foes=engine.active(foe);
 const target=foes[0]||null;
 const usable=mon.moves.filter(key=>(mon.pp[key]||0)>0&&(!mon.choiceLock||mon.choiceLock===key)&&mon.disabled!==key&&
 (!mon.encored||mon.encored===key)&&!(mon.taunted&&engine.data.moveData[key]?.category==='status'));
 if(mon.charging)return {actor:mon.id,type:'move',move:mon.charging.move,target:mon.charging.target};
 if(!usable.length)return {actor:mon.id,type:'move',move:'STRUGGLE',target:target?.id};
 const low=mon.hp*2<mon.maxHp&&mon.status!=='sleep'; // original checks below half and awake
 const chances=palaceChances(mon.nature,low),roll=Math.floor(engine.rng()*100);
 const group=roll<chances.attack?'attack':roll<chances.attack+chances.defense?'defense':'support';
 let candidates=usable.filter(key=>palaceMoveGroup(engine.data.moveData[key])===group);
 if(!candidates.length){
  // Emerald: when group is missing, fall back to another usable group but
  // 50% of the time the Pokemon cannot attack at all this turn.
  if(engine.rng()>=.5){
   engine.write(`${mon.name} hésite et n'attaque pas ! (Palais : ${PALACE_GROUP_LABELS[group]})`);
   return {actor:mon.id,type:'pass'};
  }
  candidates=usable;
 }
 const move=choice(engine.rng,candidates),meta=engine.data.moveData[move];
 let chosen=target;
 if(meta?.target==='self')chosen=mon;
 else if(meta?.target==='all'||meta?.target==='enemies'||meta?.target==='random'||meta?.target==='enemyfield')chosen=target;
 else if(foes.length>1)chosen=choice(engine.rng,foes);
 engine.write(`${mon.name} décide de ${meta?.name||move} (${PALACE_GROUP_LABELS[group]} · ${mon.nature}) !`);
 return {actor:mon.id,type:'move',move,target:chosen?.id};
}
