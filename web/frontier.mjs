// Data and selection rules from battle_tower.c at sources.lock.json.
// PID generation, record-mixed trainers and full RNG call order remain unported.
export function fixedIVForTrainer(id){return id<100?3:id<220?6+3*Math.floor((id-100)/20):31;}
export function trainerRange(data,streak){let c=Math.floor(streak/7);return (c<=7&&streak%7===6?data.trainerRangesHard:data.trainerRanges)[Math.min(c,7)];}
export function chooseTrainer(data,streak,rng,previous=[]){const [lo,hi]=trainerRange(data,streak);let id;for(let n=0;n<10000;n++){id=lo+(Math.floor(rng()*65536)%(hi-lo+1));if(!previous.includes(id))return data.trainers[id];}throw Error('Sélection de dresseur impossible.');}
export function officialSet(data,raw,iv=31){return {species:raw.species,item:raw.item,nature:raw.nature,moves:[...raw.moves],evs:[...raw.evs],ivs:Array(6).fill(iv),ability:data.species[raw.species].abilities[0],level:50,role:'Set Tour · '+raw.id};}
export function trainerTeam(data,trainer,count,levelMode,rng,exclude=[]){const sets=new Map(data.towerSets.map(s=>[s.id,s])),result=[],species=new Set(exclude.map(x=>x.species)),items=new Set(exclude.map(x=>x.item).filter(x=>x!=='NONE'));let attempts=0;
 while(result.length<count){if(++attempts>20000)throw Error('Équipe officielle impossible pour ce dresseur.');let raw=sets.get(trainer.sets[Math.floor(rng()*65536)%trainer.sets.length]);if(!raw||(levelMode==='50'&&raw.ordinal>849)||species.has(raw.species)||(raw.item!=='NONE'&&items.has(raw.item)))continue;
 const mon=officialSet(data,raw,fixedIVForTrainer(trainer.id));mon.ability=data.species[raw.species].abilities[Math.floor(rng()*65536)%data.species[raw.species].abilities.length];result.push(mon);species.add(mon.species);if(mon.item!=='NONE')items.add(mon.item);}
 return result;
}
