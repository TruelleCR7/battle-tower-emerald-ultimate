import {TowerEngine} from './engine.mjs';
// Battle Pike / Reptile de Combat — Emerald-inspired seven door choices per pass.
// All choices are generated in advance and kept in the saved Pike state.
export const PIKE_EVENTS=['trainer','full_heal','double','quiet','hard_trainer','wild','status','partial_heal'];
export const PIKE_HINTS=[
 {events:['trainer','full_heal'],text:'Je sens une présence humaine derrière cette porte…'},
 {events:['double','quiet'],text:'Il me semble entendre des murmures derrière cette porte…'},
 {events:['wild','hard_trainer'],text:'Une odeur caractéristique de Pokémon émane de cette porte…'},
 {events:['status','partial_heal'],text:'Une étrange vague de nostalgie se dégage de cette porte…'}
];
export const PIKE_ROOMS_PER_PASS=7;
export function pikeBrainTier(pass){return pass===2?'silver':pass===10?'gold':null;}
const int=(random,n)=>Math.max(0,Math.min(n-1,Math.floor(random()*n)));
const pick=(random,values)=>values[int(random,values.length)];
export function pikeChoices(pass,room,random=Math.random){
 if(room===6&&pikeBrainTier(pass))return {hint:'Une présence terrifiante plane derrière toutes les portes…',hintDoor:null,
  doors:[0,1,2].map(i=>({id:i,event:'brain',kind:pikeBrainTier(pass)}))};
 const chosenPair=pick(random,PIKE_HINTS),hintDoor=int(random,3);
 const doors=[0,1,2].map((id)=>{
  const allowed=id===hintDoor?chosenPair.events:PIKE_EVENTS.filter(e=>!chosenPair.events.includes(e));
  return {id,event:pick(random,allowed)};
 });
 return {hint:chosenPair.text,hintDoor,doors};
}
export function createPike(team,random=Math.random){
 if(!Array.isArray(team)||team.length!==3)throw Error('Le Reptile exige trois Pokémon.');
 return {pass:1,room:0,totalRooms:0,phase:'doors',party:null,choices:pikeChoices(1,0,random),
  history:[],silver:false,gold:false,roomEvent:null,battleResolved:false};
}
export function pikePickDoor(pike,index){
 if(pike.phase!=='doors')throw Error('Une salle est déjà en cours.');
 if(!Number.isInteger(index)||index<0||index>2)throw Error('Porte inconnue.');
 const door=pike.choices.doors[index];
 pike.roomEvent=door.event;pike.phase=['trainer','double','hard_trainer','wild','brain'].includes(door.event)?'battle':'event';
 pike.selectedDoor=index;return door;
}
export function pikeStatusEffect(party,random=Math.random,data=null){
 const candidates=party.filter(p=>p.hp>0&&!p.status);
 const number=Math.min(candidates.length,1+Math.floor(Math.max(0,party.length-1)*random()));
 const effects=['poison','freeze','paralyze','burn','sleep'];
 const messages=[];
 // The Pike trap must obey the same status immunities and berries as a battle.
 // Reuse the engine's inflict() and useBerry() instead of setting status directly.
 const engine=data?Object.assign(Object.create(TowerEngine.prototype),{
  data,player:{party,active:[]},opponent:{party:[],active:[]},log:[],turn:0,rng:random,
 }):null;
 for(let i=0;i<number;i++){
  if(!candidates.length)break;
  const chosen=candidates.splice(int(random,candidates.length),1)[0];
  const type=pick(random,effects);
  if(engine){
   if(engine.inflict(chosen,type)){
    messages.push(chosen.name+' : '+type+(chosen.status?'':' (soigné par une baie)'));
   }else messages.push(chosen.name+' résiste à '+type+'.');
  }else{
   // Retain a catalogue-free mode for isolated event simulations.
   chosen.status=type;if(type==='sleep')chosen.sleep=2+int(random,3);
   messages.push(chosen.name+' : '+type);
  }
 }
 return messages.length?'Une attaque surprise ! '+messages.join(' · '):'Aucun Pokémon valide ne peut être affecté.';
}
export function pikeResolveEvent(pike,party,random=Math.random,moveData=null,data=null){
 if(pike.phase!=='event')throw Error('Cette salle nécessite un combat.');
 const event=pike.roomEvent;let message='';
 if(event==='full_heal'){
  party.forEach(p=>{p.hp=p.maxHp;p.status='';p.sleep=0;p.toxic=0;if(moveData)p.pp=Object.fromEntries(Object.entries(p.pp).map(([k,v])=>[k,moveData[k]?.pp??v]));});
  message='Une infirmière soigne entièrement votre équipe !';
 }else if(event==='partial_heal'){
  const targets=party.filter(p=>p.hp>0&&(p.hp<p.maxHp||p.status));
  const count=Math.min(targets.length,1+int(random,2));
  for(let i=0;i<count;i++){let p=targets.splice(int(random,targets.length),1)[0];p.hp=p.maxHp;p.status='';p.sleep=0;p.toxic=0;if(moveData)p.pp=Object.fromEntries(Object.entries(p.pp).map(([k,v])=>[k,moveData[k]?.pp??v]));}
  message=count?'Un bienfaiteur soigne '+count+' Pokémon.':'Personne ne nécessite de soins.';
 }else if(event==='status')message=pikeStatusEffect(party,random,data);
 else if(event==='quiet')message='La salle est paisible. Vous traversez sans rencontrer de danger.';
 else throw Error('Événement inconnu.');
 pike.eventMessage=message;pike.phase='resolved';
 return message;
}
export function pikeFinishRoom(pike,party,random=Math.random){
 if(pike.phase!=='resolved')throw Error('Termine l’événement avant de poursuivre.');
 const event=pike.roomEvent,brain=event==='brain'?pikeBrainTier(pike.pass):null;
 pike.history.push({pass:pike.pass,room:pike.room+1,door:pike.selectedDoor,event,message:pike.eventMessage||''});
 if(brain)pike[brain]=true;
 pike.totalRooms++;
 pike.room++;
 pike.roomEvent=null;pike.eventMessage='';pike.battleResolved=false;pike.selectedDoor=null;
 if(pike.room>=PIKE_ROOMS_PER_PASS){pike.phase='pass_complete';return 'Passage '+pike.pass+' terminé !';}
 pike.phase='doors';pike.choices=pikeChoices(pike.pass,pike.room,random);
 return 'Salle '+(pike.room+1)+' : choisissez une porte.';
}
export function pikeNextPass(pike,party,random=Math.random){
 if(pike.phase!=='pass_complete')throw Error('Le passage n’est pas terminé.');
 pike.pass++;pike.room=0;pike.phase='doors';pike.choices=pikeChoices(pike.pass,0,random);
 return pike;
}
export function pikeLucyTeam(tier,data,level=50){
 const raw=tier==='silver'?[
  ['SEVIPER','BRAVE','QUICK_CLAW',['SWAGGER','CRUNCH','POISON_FANG','GIGA_DRAIN'],[252,0,252,6,0,0],16],
  ['SHUCKLE','BOLD','CHESTO_BERRY',['TOXIC','SANDSTORM','PROTECT','REST'],[252,0,0,106,252,0],16],
  ['MILOTIC','MODEST','LEFTOVERS',['ICE_BEAM','MIRROR_COAT','SURF','RECOVER'],[152,0,100,152,106,0],16]
 ]:[
  ['SEVIPER','BOLD','FOCUS_BAND',['SWAGGER','CRUNCH','SLUDGE_BOMB','GIGA_DRAIN'],[252,0,0,252,6,0],31],
  ['STEELIX','BRAVE','BRIGHT_POWDER',['EARTHQUAKE','ROCK_SLIDE','EXPLOSION','SCREECH'],[252,0,0,6,252,0],31],
  ['GYARADOS','ADAMANT','CHESTO_BERRY',['DRAGON_DANCE','RETURN','ROAR','REST'],[252,6,0,0,252,0],31]
 ];
 return raw.map(([species,nature,item,moves,evs,iv])=>{
  if(!data.species?.[species]||moves.some(m=>!data.moveData?.[m]))throw Error('Catalogue incomplet pour Charline : '+species);
  return {species,nature,item,moves,evs,ivs:Array(6).fill(iv),ability:data.species[species].abilities[0],level};
 });
}
