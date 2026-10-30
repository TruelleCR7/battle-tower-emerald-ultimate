/* Battle Tower Studio — moteur JS autonome. Génération III avec catégories par attaque (split Gen IV).
 * Aucune ROM ni appel serveur n'intervient dans le calcul. Ce n'est pas un port intégral de battle_ai_main.c.
 */
import {chooseTrainer,trainerTeam} from './frontier.mjs';
import {effectiveStat,accuracyChance,baseDamage,weatherActive,STAT_KEYS,STAT_NAMES} from './battle-stats.mjs';
import {normalizeSplitMode,splitCategory} from './split-mode.mjs';
import {palaceChooseMove,palaceBrainSets} from './palace.mjs';
import {chooseEmeraldMove} from './ai_emerald_scripted.mjs';
export const TYPE_CHART = {
 NORMAL:{ROCK:.5,GHOST:0,STEEL:.5}, FIRE:{FIRE:.5,WATER:.5,GRASS:2,ICE:2,BUG:2,ROCK:.5,DRAGON:.5,STEEL:2},
 WATER:{FIRE:2,WATER:.5,GRASS:.5,GROUND:2,ROCK:2,DRAGON:.5}, ELECTRIC:{WATER:2,ELECTRIC:.5,GRASS:.5,GROUND:0,FLYING:2,DRAGON:.5},
 GRASS:{FIRE:.5,WATER:2,GRASS:.5,POISON:.5,GROUND:2,FLYING:.5,BUG:.5,ROCK:2,DRAGON:.5,STEEL:.5},
 ICE:{FIRE:.5,WATER:.5,GRASS:2,ICE:.5,GROUND:2,FLYING:2,DRAGON:2,STEEL:.5},
 FIGHTING:{NORMAL:2,ICE:2,POISON:.5,FLYING:.5,PSYCHIC:.5,BUG:.5,ROCK:2,GHOST:0,DARK:2,STEEL:2},
 POISON:{GRASS:2,POISON:.5,GROUND:.5,ROCK:.5,GHOST:.5,STEEL:0},
 GROUND:{FIRE:2,ELECTRIC:2,GRASS:.5,POISON:2,FLYING:0,BUG:.5,ROCK:2,STEEL:2},
 FLYING:{ELECTRIC:.5,GRASS:2,FIGHTING:2,BUG:2,ROCK:.5,STEEL:.5},
 PSYCHIC:{FIGHTING:2,POISON:2,PSYCHIC:.5,DARK:0,STEEL:.5},
 BUG:{FIRE:.5,GRASS:2,FIGHTING:.5,POISON:.5,FLYING:.5,PSYCHIC:2,GHOST:.5,DARK:2,STEEL:.5},
 ROCK:{FIRE:2,ICE:2,FIGHTING:.5,GROUND:.5,FLYING:2,BUG:2,STEEL:.5},
 GHOST:{NORMAL:0,PSYCHIC:2,GHOST:2,DARK:.5,STEEL:.5},
 DRAGON:{DRAGON:2,STEEL:.5}, DARK:{FIGHTING:.5,PSYCHIC:2,GHOST:2,DARK:.5,STEEL:.5},
 STEEL:{FIRE:.5,WATER:.5,ELECTRIC:.5,ICE:2,ROCK:2,STEEL:.5}
};
// Sound moves in the Gen III battle engine. Soundproof does not block the user's own actions.
export const SOUND_MOVES=new Set(['GROWL','ROAR','SING','SUPERSONIC','SCREECH','SNORE','UPROAR','HYPER_VOICE','METAL_SOUND','GRASS_WHISTLE','PERISH_SONG']);
export function soundproofBlocks(moveKey,attacker,defender){return attacker?.id!==defender?.id&&defender?.ability==='SOUNDPROOF'&&SOUND_MOVES.has(moveKey);}
export const MULTI_HIT_2_TO_5=new Set(['DOUBLE_SLAP','COMET_PUNCH','FURY_ATTACK','PIN_MISSILE','SPIKE_CANNON','BARRAGE','FURY_SWIPES','BONE_RUSH','BULLET_SEED','ICICLE_SPEAR','ROCK_BLAST']);
export const MULTI_HIT_FIXED={DOUBLE_KICK:2,BONEMERANG:2,TWINEEDLE:2,TRIPLE_KICK:3};
export function multiHitCount(moveKey,rng,ability){
 if(Object.hasOwn(MULTI_HIT_FIXED,moveKey))return MULTI_HIT_FIXED[moveKey];
 if(!MULTI_HIT_2_TO_5.has(moveKey))return 1;
 if(ability==='SKILL_LINK')return 5;
 const roll=Math.floor(rng()*65536)%8;
 return roll<3?2:roll<6?3:roll===6?4:5;
}
export const STATS=['hp','atk','def','spe','spa','spd'];
export const NATURE_EFFECT={LONELY:['atk','def'],BRAVE:['atk','spe'],ADAMANT:['atk','spa'],NAUGHTY:['atk','spd'],BOLD:['def','atk'],RELAXED:['def','spe'],IMPISH:['def','spa'],LAX:['def','spd'],TIMID:['spe','atk'],HASTY:['spe','def'],JOLLY:['spe','spa'],NAIVE:['spe','spd'],MODEST:['spa','atk'],MILD:['spa','def'],QUIET:['spa','spe'],RASH:['spa','spd'],CALM:['spd','atk'],GENTLE:['spd','def'],SASSY:['spd','spe'],CAREFUL:['spd','spa']};
let sequence=0;
export function effectiveness(type, target, data, inverse=false){
  // Each defending type is inverted independently; ability immunities remain absolute.
  if(type==='GROUND' && target.ability==='LEVITATE') return 0;
  return (data.species[target.species].types||['NORMAL']).reduce((x,t)=>{
    const factor=TYPE_CHART[type]?.[t]??1;
    return x*(inverse?(factor===0?2:1/factor):factor);
  },1);
}
export function statsFor(set,data,level=50){
  const base=data.species[set.species].stats, ivs=set.ivs||[31,31,31,31,31,31], evs=set.evs||[0,0,0,0,0,0];
  const plus=NATURE_EFFECT[set.nature]?.[0], minus=NATURE_EFFECT[set.nature]?.[1];
  const map=[0,1,2,3,4,5];const names=STATS;
  const result={};map.forEach((n)=>{
    const x=base[n],v=Math.floor(((2*x+(ivs[n]??31)+Math.floor((evs[n]||0)/4))*level)/100);
    result[names[n]]=n===0?v+level+10:Math.floor((v+5)*(names[n]===plus?1.1:names[n]===minus?.9:1));
  });if(set.species==='SHEDINJA')result.hp=1;return result;
}
export function validateTeam(team,mode,levelMode,data){
 const need={single:3,double:4,multi:2,link:2}[mode], errors=[];
 if(!need){return ['Mode inconnu.'];}
 if(!Array.isArray(team))return ['Équipe absente ou invalide.'];
 if(team.length!==need)errors.push(`Ce mode nécessite ${need} Pokémon.`);
 const names=new Set(), items=new Set();
 for(const [i,m] of (team||[]).entries()){
  const pre=`Pokémon ${i+1} : `;
  if(!m||typeof m!=='object'){errors.push(pre+'configuration absente');continue;}
  if(m.egg)errors.push(pre+'œufs interdits');
  if(m.hp!==undefined&&m.hp<=0)errors.push(pre+'Pokémon K.O.');
  if(!data.species[m.species]){errors.push(pre+'espèce inconnue');continue;}
  if(data.banned?.includes(m.species)) errors.push(pre+'espèce interdite');
  if(names.has(m.species))errors.push('Espèces en double interdites.');names.add(m.species);
  if(m.item&&m.item!=='NONE'){if(items.has(m.item))errors.push('Objets tenus en double interdits.');items.add(m.item);}
  if(!data.items?.hasOwnProperty(m.item||'NONE'))errors.push(pre+'objet inconnu');
  if(!data.species[m.species].abilities.includes(m.ability))errors.push(pre+'talent incompatible');
  if(!data.natures.includes(m.nature))errors.push(pre+'nature inconnue');
  if(!Number.isInteger(Number(m.level||50))||Number(m.level||50)<1||Number(m.level||50)>100)errors.push(pre+'niveau hors limites (1–100)');
  if(levelMode==='50'&&(m.level||50)>50)errors.push(pre+'niveau supérieur à 50');
  if(!Array.isArray(m.evs)||m.evs.length!==6||m.evs.some(v=>!Number.isInteger(+v)||v<0||v>255)||m.evs.reduce((a,b)=>a+Number(b),0)>510)errors.push(pre+'EV invalides (>510 ou >255/stat)');
  if(!Array.isArray(m.ivs)||m.ivs.length!==6||m.ivs.some(v=>!Number.isInteger(+v)||v<0||v>31))errors.push(pre+'IV invalides');
  if(data.learnsets?.[m.species]&&Array.isArray(m.moves)&&m.moves.some(k=>!data.learnsets[m.species].includes(k)))errors.push(pre+'capacité non disponible pour cette espèce dans les sources importées');
  if(!Array.isArray(m.moves)||m.moves.length===0||m.moves.length>4||new Set(m.moves).size!==m.moves.length||m.moves.some(k=>!data.moveData[k]))errors.push(pre+'capacités invalides');
 }
 return [...new Set(errors)];
}
function deep(x){return JSON.parse(JSON.stringify(x));}
export function makeMon(set,data,owner,level=50){
 const stats=statsFor(set,data,level);return {id:'poke-'+(++sequence),species:set.species,name:data.speciesNames[set.species]||set.species,
 owner,level,item:set.item||'NONE',ability:set.ability,nature:set.nature,moves:[...set.moves],pp:Object.fromEntries(set.moves.map(x=>[x,data.moveData[x]?.pp||10])),
 evs:[...set.evs],ivs:[...set.ivs],stats,hp:stats.hp,maxHp:stats.hp,status:'',toxic:0,sleep:0,stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0},
 guarded:false,protectCount:0,seeded:false,substitute:0,destiny:false,flinched:false,lastMove:'',choiceLock:'',truantTurn:0,recharge:0,active:false,critHits:0};
}
function randInt(rng,n){return Math.floor(rng()*n);}
function statStage(k){return k>=0?(2+k)/2:2/(2-k);}
function accStage(k){return k>=0?(3+k)/3:3/(3-k);}
const CONTACT_MOVE_KEYS=new Set(['TACKLE','SCRATCH','POUND','QUICK_ATTACK','EXTREME_SPEED','RETURN','FRUSTRATION','DOUBLE_EDGE','BODY_SLAM','TAKE_DOWN','HEADBUTT','FAKE_OUT','SLASH','CRUSH_CLAW','BRICK_BREAK','CROSS_CHOP','MACH_PUNCH','SKY_UPPERCUT','CLOSE_COMBAT','MEGAHORN','POISON_TAIL','IRON_TAIL','METEOR_MASH','AERIAL_ACE','WING_ATTACK','DRAGON_CLAW','SHADOW_CLAW','THUNDER_PUNCH','FIRE_PUNCH','ICE_PUNCH','DRAIN_PUNCH','DIZZY_PUNCH','FOCUS_PUNCH','BITE','CRUNCH','STRENGTH','CUT','FLY','DIG','WATERFALL','ROCK_SMASH','SUPERPOWER','REVERSAL','FLAIL','STRUGGLE']);
function makesContact(key,move){
 if(typeof move.makesContact==='boolean')return move.makesContact;
 if(typeof move.contact==='boolean')return move.contact;
 if(Array.isArray(move.flags))return move.flags.includes('contact')||move.flags.includes('MAKES_CONTACT');
 return CONTACT_MOVE_KEYS.has(key);
}
const TWO_TURN_MOVES={FLY:'fly',DIG:'dig',DIVE:'dive',BOUNCE:'fly',SOLAR_BEAM:'solar'};
function twoTurnKind(key,move){
 return TWO_TURN_MOVES[key]||({FLY:'fly',DIG:'dig',DIVE:'dive',SOLAR_BEAM:'solar'}[move?.originalEffect])||null;
}
function canHitChargingTarget(moveKey,target){
 const type=target.charging?.kind;
 if(!type||type==='solar')return true;
 if(type==='fly')return ['GUST','TWISTER','THUNDER','SKY_UPPERCUT','HURRICANE'].includes(moveKey);
 if(type==='dig')return ['EARTHQUAKE','MAGNITUDE','FISSURE'].includes(moveKey);
 if(type==='dive')return ['SURF','WHIRLPOOL'].includes(moveKey);
 return true;
}
const statusTranslation={burn:'brûlure',paralyze:'paralysie',poison:'poison',toxic:'poison grave',freeze:'gel',sleep:'sommeil'};
export class TowerEngine {
 constructor(data,config={}) {
  this.data=data;this.facility=config.facility||'tower';this.splitMode=normalizeSplitMode(config.splitMode);this.inverseBattle=!!config.inverseBattle;this.mode=config.mode||'single';this.levelMode=config.levelMode||'50';this.level=this.levelMode==='50'?50:Math.max(60,...(config.team||[]).map(m=>m.level||50));
  this.rngState=(config.seed??(Math.random()*0x100000000))>>>0;this.rng=config.rng||(()=>this.random());this.trainerHistory=config.trainerHistory||[];this.streak=config.streak||0;this.round=(this.streak%7)+1;this.series=Math.floor(this.streak/7)+1;
  this.log=[];this.turn=0;this.status='active';this.weather='';this.weatherTurns=0;this.hazards={player:0,opponent:0};
  this.player={party:[],active:[]};this.opponent={party:[],active:[]};this.trainer='Dresseur de la Tour';this.score=0;
  if(validateTeam(config.team,this.mode,this.levelMode,data).length)throw Error(validateTeam(config.team,this.mode,this.levelMode,data).join(' '));
  this.sets=deep(config.team);this.originalConfig={mode:this.mode,levelMode:this.levelMode,team:this.sets,streak:this.streak,splitMode:this.splitMode,inverseBattle:this.inverseBattle,facility:this.facility};
  this.player.party=this.sets.map(x=>makeMon(x,data,'human',x.level||50));
  if(this.mode==='multi'||this.mode==='link'){
   const ally=(config.partner||this.makeRandomSets(2,this.sets)).slice(0,2);
   ally.forEach(x=>this.player.party.push(makeMon(x,data,this.mode==='link'?'human2':'partner',x.level||50))); 
  }
  const isBrain=this.facility==='tower'&&this.mode==='single'&&[34,69].includes(this.streak);
  const isPalaceBrain=this.facility==='palace'&&this.mode==='single'&&[20,41].includes(this.streak);
  this.trainer=isPalaceBrain?'Esteban · Meneur du Palais':isBrain?'Anabel · Meneuse de la Tour':this.pickTrainer();
  let opponents=isPalaceBrain?palaceBrainSets(this.streak===20?'silver':'gold',data,this.level):this.makeRandomSets(this.mode==='single'?3:4,[],isBrain);
  opponents.forEach((x,i)=>this.opponent.party.push(makeMon(x,data,this.mode==='multi'||this.mode==='link'?(i<2?'cpu1':'cpu2'):'cpu',this.level)));
  this.initializeSide('player');this.initializeSide('opponent');
  this.write(`Défi n° ${this.streak+1} · ${this.trainer} !`);
  if(this.inverseBattle)this.write('COMBAT INVERSÉ : les faiblesses et résistances sont inversées !');
  this.write(this.splitMode==='type'?'Catégories physique/spéciale selon le type (règles Émeraude).':'Catégories physique/spéciale selon chaque capacité (split moderne).');
  if(!config.deferEntryEffects)this.entryEffects([...this.opponent.active,...this.player.active].map(id=>this.get(id)).filter(Boolean));
 }


 /** Starts a Battle Dome match after two entrants per side have been selected.
  * Defers all switch-in effects until the actual registered combatants are known.
  * Ordinary Tower and Factory startup remains unchanged. */
 startDomeBattle(playerIndices,opponentIndices,format='single'){
  if(this.turn!==0||this.status!=='active'||this.domeBattleStarted)throw Error('Ce combat du Dôme a déjà commencé.');
  if(!['single','double'].includes(format))throw Error('Format du Dôme invalide.');
  const valid=(indices,party)=>Array.isArray(indices)&&indices.length===2&&
   new Set(indices).size===2&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<party.length);
  if(!valid(playerIndices,this.player.party)||!valid(opponentIndices,this.opponent.party))throw Error('Sélectionne deux Pokémon différents par camp.');
  this.player.party=playerIndices.map(i=>this.player.party[i]);
  this.opponent.party=opponentIndices.map(i=>this.opponent.party[i]);
  this.mode=format;
  for(const side of ['player','opponent']){
   const party=this[side].party;
   party.forEach((p,i)=>p.active=format==='double'||i===0);
   this[side].active=party.filter(p=>p.active).map(p=>p.id);
  }
  this.sets=playerIndices.map(i=>this.sets[i]);
  this.originalConfig.team=this.sets;
  this.originalConfig.mode=format;
  this.domeBattleStarted=true;
  this.write('Dôme de Combat : les deux Pokémon sélectionnés entrent en lice.');
  this.entryEffects([...this.opponent.active,...this.player.active].map(id=>this.get(id)).filter(Boolean));
 }

 random(){this.rngState=(Math.imul(this.rngState,0x41c64e6d)+0x6073)>>>0;return (this.rngState>>>16)/65536;}
 pickTrainer(){this.trainerData=chooseTrainer(this.data,this.streak,this.rng,this.trainerHistory);return this.trainerData.name+' · '+this.trainerData.class.replaceAll('_',' ');}
 makeRandomSets(count,exclude=[],brain=false){
  const used=new Set(exclude.map(m=>m.species)),items=new Set(exclude.map(m=>m.item).filter(k=>k&&k!=='NONE'));
  const base=Object.values(this.data.sets).filter(s=>!this.data.banned.includes(s.species));const result=[];
  const brainSilver=['ALAKAZAM','ENTEI','SNORLAX'];const brainGold=['RAIKOU','LATIOS','SNORLAX'];
  const target=brain?(this.streak===34?brainSilver:brainGold):null;
  if(brain&&this.data.towerBrains){
    const source=(this.streak===34?this.data.towerBrains.silver:this.data.towerBrains.gold)||[];
    if(source.length>=count)return source.slice(0,count).map(x=>deep(x));
  }
  if(!brain&&this.data.trainers?.length){const trainer=this.trainerData||chooseTrainer(this.data,this.streak,this.rng);return trainerTeam(this.data,trainer,count,this.levelMode,this.rng,exclude);}
  for(let i=0;i<count;i++){
   let candidates=base.filter(m=>!used.has(m.species)&&(!items.has(m.item)||m.item==='NONE'));
   let pre=target?candidates.find(x=>x.species===target[i]):null;
   if(!pre) pre=candidates[randInt(this.rng,candidates.length)]||base[randInt(this.rng,base.length)];
   const s=deep(pre);used.add(s.species);if(s.item!=='NONE')items.add(s.item);
   // IV progressifs : les dresseurs supérieurs deviennent plus compétitifs.
   const iv=brain?(this.streak===34?24:31):Math.min(31,8+Math.floor(this.streak/7)*2);
   s.ivs=Array(6).fill(iv);result.push(s);
  }return result;
 }
 initializeSide(side){
  const s=this[side];const count=this.mode==='single'?1:2;
  if(count===1){s.active=[s.party[0]?.id];s.party[0].active=true;return;}
  const indexes=(this.mode==='multi'||this.mode==='link')?[0,2]:[0,1];
  s.active=indexes.map(i=>s.party[i]?.id);indexes.forEach(i=>{if(s.party[i])s.party[i].active=true;});
 }
 write(msg,event={}){this.log.unshift({turn:this.turn,text:msg,...event});}
 get(id){return [...this.player.party,...this.opponent.party].find(m=>m.id===id);}
 sideOf(m){return this.player.party.includes(m)?'player':'opponent';}
 active(side){return this[side].active.map(id=>this.get(id)).filter(x=>x&&x.hp>0);}
 bench(side,owner){return this[side].party.filter(m=>m.hp>0&&!m.active&&(!owner||owner===m.owner));}
 countAlive(side){return this[side].party.filter(x=>x.hp>0).length;}
 effectiveSpeed(m){return effectiveStat(this,m,'spe');}
 damagePreview(attacker,target,move,options={}){
  if(splitCategory(this,move)==='status')return {damage:0,mult:1};
  const eff=effectiveness(move.type,target,this.data,this.inverseBattle);if(eff===0)return {damage:0,mult:0};
  if(move.type==='GROUND'&&target.ability==='LEVITATE')return {damage:0,mult:0};
  if(target.ability==='WONDER_GUARD'&&eff<=1)return {damage:0,mult:0};
  if(move.originalEffect==='LEVEL_DAMAGE')return {damage:attacker.level,mult:eff,fixed:true};
  if(move.originalEffect==='SONICBOOM')return {damage:20,mult:eff,fixed:true};
  if(move.originalEffect==='DRAGON_RAGE')return {damage:40,mult:eff,fixed:true};
  if(move.originalEffect==='SUPER_FANG')return {damage:Math.max(1,Math.floor(target.hp/2)),mult:eff,fixed:true};
  let damage=baseDamage(this,attacker,target,move,options);
  if(this.data.species[attacker.species].types.includes(move.type))damage=Math.floor(damage*15/10);
  for(const type of this.data.species[target.species].types){const factor=TYPE_CHART[move.type]?.[type]??1;damage=Math.floor(damage*(this.inverseBattle?(factor===0?2:1/factor):factor));}
  return {damage:Math.max(1,damage),mult:eff};
 }

 aiAction(m){
  if(this.facility==='palace')return palaceChooseMove(this,m);
  if(m.moves.every(k=>m.pp[k]<=0||(m.choiceLock&&m.choiceLock!==k)||m.disabled===k||(m.encored&&m.encored!==k)||(m.taunted&&splitCategory(this,this.data.moveData[k])==='status')))return {actor:m.id,type:'move',move:'STRUGGLE',target:this.active(this.sideOf(m)==='player'?'opponent':'player')[0]?.id};
  if(this.data.aiScript?.blocks?.AI_CheckBadMove){const action=chooseEmeraldMove(this,m);if(this.data.moveData[action.move]?.effect==='baton')action.to=this.bench(this.sideOf(m),m.owner)[0]?.id;return action;}
  throw new Error('IA source indisponible : aucun remplacement heuristique autorisé.');
 }

 required(){return this.active('player').filter(m=>['human','human2'].includes(m.owner)).map(m=>m.id);}
 pendingDefaults(choices){
  const required=this.required();if(!Array.isArray(choices))throw Error('Actions invalides.');
  for(const id of required)if(!choices.find(a=>a.actor===id))throw Error('Sélectionne une action pour chaque Pokémon contrôlé.');
  if(choices.length!==required.length||new Set(choices.map(a=>a.actor)).size!==choices.length)throw Error('Une seule action par Pokémon contrôlé.');
  const replacements=new Set();for(const a of choices){const m=this.get(a.actor);if(!required.includes(a.actor))throw Error('Pokémon non contrôlable.');
   if(a.type==='palace'&&this.facility==='palace')continue;
   if(a.type==='switch'){const to=this.get(a.to);if(!to||to.active||to.hp<=0||to.owner!==m.owner||this.sideOf(to)!==this.sideOf(m)||replacements.has(a.to))throw Error('Remplacement impossible ou déjà choisi.');replacements.add(a.to);}
   else if(a.type==='move'){if(m.charging)continue;const move=this.data.moveData[a.move];if(move?.effect==='baton'&&!this.bench(this.sideOf(m),m.owner).some(p=>p.id===a.to))throw Error('Choisis le destinataire de Relais.');if(!move||(!m.moves.includes(a.move)&&a.move!=='STRUGGLE')||(a.move!=='STRUGGLE'&&(m.pp[a.move]<=0||(m.choiceLock&&m.choiceLock!==a.move))))throw Error('Capacité indisponible.');
    if(a.move==='STRUGGLE'&&m.moves.some(k=>m.pp[k]>0&&(!m.choiceLock||m.choiceLock===k)))throw Error('Lutte indisponible tant qu’une capacité est utilisable.');
    if(move.target==='enemy'&&!['COUNTER','MIRROR_COAT'].includes(move.originalEffect)){const t=this.get(a.target);if(!t||!t.active||t.hp<=0||this.sideOf(t)===this.sideOf(m))throw Error('Choisis un adversaire actif comme cible.');}
   }else throw Error('Action inconnue.');
  }
 }
 turnActions(playerChoices){
  if(this.status!=='active')throw new Error('Ce combat est terminé.');
  if(this.pendingReplacements?.length)throw Error('Choisis le Pokémon à envoyer après le K.O.');
  this.pendingDefaults(playerChoices);
  const sides=[...this.active('player'),...this.active('opponent')];
  const actions=[];for(const m of sides){let a=m.charging?{actor:m.id,type:'move',move:m.charging.move,target:m.charging.target}:playerChoices.find(x=>x.actor===m.id);if(this.facility==='palace'&&(!a||a.type==='palace'))a=palaceChooseMove(this,m);else if(!a)a=this.aiAction(m);if(a)actions.push(deep(a));}
  for(const m of sides)m.receivedDamage={};
  this.turn++;this.write('— Tour '+this.turn+' —');
  // Process action by priority & speed, with a small random tie break.
  for(const a of actions){const m=this.get(a.actor),move=this.data.moveData[a.move];a.prio=a.type==='switch'?6:a.type==='pass'?-7:(move?.priority||0);a.speed=this.effectiveSpeed(m)||0;a.roll=this.rng();
    if(m.item==='QUICK_CLAW'&&a.type==='move'&&this.rng()<.2){a.prio+=.5;this.write(`Griffe Rapide s'active pour ${m.name} !`);}
  }
  actions.sort((a,b)=>b.prio-a.prio||b.speed-a.speed||b.roll-a.roll);
  for(const a of actions){
   if(this.status!=='active')break;
   const m=this.get(a.actor);if(!m||m.hp<=0||!m.active)continue;
   if(a.type==='switch'){this.switchMon(m,a.to);continue;}
   if(a.type==='pass')continue;
   this.execute(m,a);
   for(const p of [...this.active('player'),...this.active('opponent')])this.whiteHerb(p);
   this.resolveFaint();this.checkEnd();
  }
  if(this.status==='active'){
   this.endOfTurn();this.resolveFaint();this.checkEnd();
  }
  this.settleReplacements();
  return this.snapshot();
 }
 switchMon(m,newid,carry=false){
  const side=this.sideOf(m), slot=this[side].active.indexOf(m.id), target=this.get(newid);
  if(!target||target.hp<=0||target.active||target.owner!==m.owner||slot<0)return this.write('Changement impossible.');
  const transfer=carry?{stages:{...m.stages},...Object.fromEntries(['confused','focusEnergy','substitute','escapePrevention','cursed','seeded','seedSource','lockedOnBy','perish','rooted','mudSport','waterSport'].map(k=>[k,m[k]??0]))}:null;
  if(m.ability==='NATURAL_CURE'){m.status='';m.toxic=0;m.sleep=0;}
  m.charging=null;m.active=false;m.stages={atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0};m.choiceLock='';m.protectCount=0;m.seeded=false;m.substitute=0;
  for(const key of ['confused','focusEnergy','substitute','escapePrevention','cursed','seeded','seedSource','lockedOnBy','perish','rooted','mudSport','waterSport','foresight']){m[key]=0;target[key]=0;}
  target.stages=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  target.active=true;target.receivedDamage={};target.aiKnownMoves=[];target.aiKnownAbility='';target.enteredTurn=this.turn;this[side].active[slot]=newid;
  this.write(`${m.name} revient ! ${target.name} entre en jeu.`,{kind:'switch',actor:m.id,side:side,to:newid});
  if(transfer){const {stages,...rest}=transfer;Object.assign(target,rest);this.setStages(target,stages,'Relais');}
  this.entryEffects([target]);
 }
 entryEffects(mons){for(const m of mons){if(!m||m.hp<=0)continue;
  const side=this.sideOf(m),foe=side==='player'?'opponent':'player';
  if(this.hazards[side]>0&&!this.data.species[m.species].types.includes('FLYING')&&m.ability!=='LEVITATE'){
    this.hpLoss(m,Math.floor(m.maxHp*([0,1/8,1/6,1/4][this.hazards[side]])),'Picots');}
  if(m.ability==='SAND_STREAM'){this.weather='sand';this.weatherTurns=-1;this.write('Une tempête de sable se lève !');}
  if(m.ability==='DRIZZLE'){this.weather='rain';this.weatherTurns=-1;this.write('Crachin déclenche une pluie persistante !');}
  if(m.ability==='DROUGHT'){this.weather='sun';this.weatherTurns=-1;this.write('Sécheresse déclenche un soleil intense !');}
  if(m.ability==='INTIMIDATE')for(const e of this.active(foe))this.modify(e,'atk',-1,m);
  if(m.ability==='TRACE'){const target=this.active(foe)[0];if(target){m.ability=target.ability;this.write(`${m.name} copie le talent ${m.ability} !`);}}
 }for(const p of [...this.active('player'),...this.active('opponent')])this.whiteHerb(p);}
 modify(m,stat,n,source=m){
  if(!Object.hasOwn(m.stages,stat)||m.hp<=0)return false;
  const external=source!==m;
  if(n<0&&external&&(m.substitute>0||this.mist?.[this.sideOf(m)]>0||['CLEAR_BODY','WHITE_SMOKE'].includes(m.ability)||(stat==='atk'&&m.ability==='HYPER_CUTTER')||(stat==='acc'&&m.ability==='KEEN_EYE'))){this.write(`${m.name} : ${m.substitute>0?'Clonage':this.mist?.[this.sideOf(m)]>0?'Brume':({CLEAR_BODY:'Corps Sain',WHITE_SMOKE:'Écran Fumée',HYPER_CUTTER:'Hyper Cutter',KEEN_EYE:'Regard Vif'})[m.ability]} empêche la baisse de ${STAT_NAMES[stat]}.`);return false;}
  const old=m.stages[stat];m.stages[stat]=Math.max(-6,Math.min(6,old+n));
  const labels={atk:'Attaque',def:'Défense',spa:'Attaque Spé.',spd:'Défense Spé.',spe:'Vitesse',acc:'Précision',eva:'Esquive'};
  if(m.stages[stat]===old){this.write(`${m.name} : ${labels[stat]} est déjà au ${n>0?'maximum':'minimum'}.`);return false;}
  this.write(`${m.name} : ${labels[stat]} ${old>0?'+':''}${old} → ${m.stages[stat]>0?'+':''}${m.stages[stat]}.`,{kind:'stat',actor:m.id,side:this.sideOf(m),stat,from:old,to:m.stages[stat]});return true;
 }
 setStages(m,stages,reason){for(const key of STAT_KEYS){const old=m.stages[key],value=stages[key]||0;m.stages[key]=value;if(old!==value)this.write(`${m.name} : ${STAT_NAMES[key]} ${old>0?'+':''}${old} → ${value>0?'+':''}${value} · ${reason}.`,{kind:'stat',actor:m.id,side:this.sideOf(m),stat:key,from:old,to:value});}}
 whiteHerb(m){if(m.item!=='WHITE_HERB'||!Object.values(m.stages).some(n=>n<0))return;this.setStages(m,Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(0,m.stages[k])])),'Herbe Blanche');m.usedItem=m.item;m.item='NONE';this.write(`${m.name} consomme son Herbe Blanche.`,{kind:'item',actor:m.id});}
 statMove(m,t,move){
  const effect=move.originalEffect,match=/^(ATTACK|DEFENSE|SPEED|SPECIAL_ATTACK|SPECIAL_DEFENSE|ACCURACY|EVASION)_(UP|DOWN)(_2)?$/.exec(effect);
  const stats={ATTACK:'atk',DEFENSE:'def',SPEED:'spe',SPECIAL_ATTACK:'spa',SPECIAL_DEFENSE:'spd',ACCURACY:'acc',EVASION:'eva'};
  if(match){this.modify(t,stats[match[1]],(match[2]==='UP'?1:-1)*(match[3]?2:1),m);return true;}
  if(effect==='COSMIC_POWER'){this.modify(m,'def',1);this.modify(m,'spd',1);return true;}
  if(effect==='TICKLE'){this.modify(t,'atk',-1,m);this.modify(t,'def',-1,m);return true;}
  if(effect==='PSYCH_UP'){this.setStages(m,t.stages,'Boost');return true;}
  if(effect==='HAZE'){for(const p of [...this.active('player'),...this.active('opponent')])this.setStages(p,{},'Buée Noire');this.write('Buée Noire annule tous les changements de statistiques.');return true;}
  if(effect==='BELLY_DRUM'){const cost=Math.max(1,Math.floor(m.maxHp/2));if(m.hp<=cost||m.stages.atk===6){this.write('Cognobidon échoue.');return true;}this.modify(m,'atk',6-m.stages.atk);this.hpLoss(m,cost,'Cognobidon');return true;}
  if(['SWAGGER','FLATTER'].includes(effect)){if(t.substitute>0){this.write('Le clone bloque la capacité.');return true;}this.modify(t,effect==='SWAGGER'?'atk':'spa',effect==='SWAGGER'?2:1,m);const protectedConfusion=t.ability==='OWN_TEMPO'||(this.sideOf(m)!==this.sideOf(t)&&this.safeguards?.[this.sideOf(t)]>0);
   if(!t.confused&&!protectedConfusion)t.confused=2+(Math.floor(this.rng()*65536)%4);
   this.write(protectedConfusion?`${t.name} est protégé de la confusion.`:`${t.name} est confus.`,protectedConfusion?{}:{kind:'status',actor:t.id,side:this.sideOf(t),status:'confusion'});return true;}
  if(effect==='MIST'){(this.mist??={})[this.sideOf(m)]=5;this.write('Brume protège des baisses de statistiques.');return true;}
  return false;
 }
 inflict(m,status,source=null){
  if(m.status)return false;
  if(source&&source!==m&&this.sideOf(source)!==this.sideOf(m)&&this.safeguards?.[this.sideOf(m)]>0){
   this.write(`Rune Protect protège ${m.name} !`);
   return false;
  }
  const ty=this.data.species[m.species].types;
  if((status==='burn'&&ty.includes('FIRE'))||(['poison','toxic'].includes(status)&&(ty.includes('POISON')||ty.includes('STEEL')))||
    (status==='paralyze'&&m.ability==='LIMBER')||(status==='sleep'&&['INSOMNIA','VITAL_SPIRIT'].includes(m.ability))||(status==='burn'&&m.ability==='WATER_VEIL')||(['poison','toxic'].includes(status)&&m.ability==='IMMUNITY')||(status==='freeze'&&(ty.includes('ICE')||m.ability==='MAGMA_ARMOR')))return false;
  m.status=status;if(status==='sleep')m.sleep=2+randInt(this.rng,3);if(status==='toxic')m.toxic=0;
  this.write(`${m.name} subit ${statusTranslation[status]} !`,{kind:'status',actor:m.id,side:this.sideOf(m),status});
  // Gen III Synchro reflects an opponent-caused status before the curing berry activates.
  // Reflection deliberately has no source to prevent a second reflection loop.
  if(m.ability==='SYNCHRONIZE'&&source&&source!==m&&
     this.sideOf(source)!==this.sideOf(m)&&source.hp>0&&
     ['burn','paralyze','poison','toxic'].includes(status)){
    const reflected=status==='toxic'?'poison':status;
    this.write(`${m.name} active Synchro !`);
    this.inflict(source,reflected);
  }
  this.useBerry(m);return true;
 }
 useBerry(m){
  if(m.item==='LUM_BERRY'&&m.status){m.status='';m.sleep=0;m.toxic=0;this.write(`${m.name} se soigne avec sa Baie Prine !`);m.item='NONE';}
  if(m.item==='CHESTO_BERRY'&&m.status==='sleep'){m.status='';m.sleep=0;m.item='NONE';this.write(`${m.name} se réveille avec sa Baie Maron !`);}
  if(m.item==='SITRUS_BERRY'&&m.hp>0&&m.hp<=m.maxHp/2){this.heal(m,30);m.item='NONE';this.write('Baie Sitrus consommée !');}
 }
 hpLoss(m,amount,why=''){if(m.hp<=0)return 0;if(amount<=0)return 0;let val=Math.max(1,Math.floor(amount));const actual=Math.min(val,m.hp);m.hp-=actual;this.write(`${m.name} perd ${actual} PV (−${(actual/m.maxHp*100).toFixed(1).replace('.',',')} %)${why?' · '+why:''}.`,{kind:'damage',actor:m.id,side:this.sideOf(m),amount:actual,maxHp:m.maxHp});this.useBerry(m);return actual;}
 heal(m,amount){const a=Math.min(m.maxHp-m.hp,Math.max(0,Math.floor(amount)));m.hp+=a;if(a)this.write(`${m.name} récupère ${a} PV (+${(a/m.maxHp*100).toFixed(1).replace('.',',')} %).`,{kind:'heal',actor:m.id,side:this.sideOf(m),amount:a,maxHp:m.maxHp});return a;}
 canAct(m){
  if(m.recharge>0){m.recharge--;this.write(`${m.name} doit se recharger.`);return false;}
  if(m.ability==='TRUANT'){m.truantTurn++;if(m.truantTurn%2===0){this.write(`${m.name} flemmarde (Absentéisme).`);return false;}}
  if(m.flinched){this.write(`${m.name} a peur !`);return false;}
  if(m.status==='sleep'){m.sleep--;if(m.sleep<=0){m.status='';this.write(`${m.name} se réveille !`);}else{this.write(`${m.name} dort.`,{kind:'status',actor:m.id,side:this.sideOf(m),status:'sleep'});return false;}}
  if(m.status==='freeze'){if(this.rng()<.2){m.status='';this.write(`${m.name} dégèle !`);}else{this.write(`${m.name} est gelé.`,{kind:'status',actor:m.id,side:this.sideOf(m),status:'freeze'});return false;}}
  if(m.confused){m.confused--;if(m.confused&&Math.floor(this.rng()*65536)%2===0){const damage=baseDamage(this,m,m,{power:40,type:'MYSTERY',category:'physical',originalEffect:'HIT'});this.hpLoss(m,damage,'confusion');return false;}if(!m.confused)this.write(`${m.name} n’est plus confus.`);}
  if(m.status==='paralyze'&&this.rng()<.25){this.write(`${m.name} est totalement paralysé !`);return false;}
  return true;
 }
 execute(m,a){
  if(!this.canAct(m)){if(m.charging){this.write(`${m.name} interrompt sa préparation.`);m.charging=null;}return;}
  let name=a.move,move=this.data.moveData[name];if(!move||(!m.moves.includes(name)&&name!=='STRUGGLE'))return;
  const preparation=m.charging;
  const kind=twoTurnKind(name,move);
  const releasing=Boolean(preparation&&preparation.move===name);
  if(preparation&&!releasing){m.charging=null;return;}
  if(!releasing&&kind&&!(kind==='solar'&&this.weather==='sun'&&weatherActive(this))){
   // A charge is an offensive action: it interrupts consecutive Protect streaks.
   m.protectCount=0;
   if((m.pp[name]||0)<=0)return;
   m.pp[name]--;
   if(this.get(a.target)?.ability==='PRESSURE')m.pp[name]=Math.max(0,m.pp[name]-1);
   m.charging={move:name,kind,target:a.target};
   m.lastMove=name;
   if(m.item==='CHOICE_BAND')m.choiceLock=name;
   this.write(`${m.name} prépare ${move.name} !`,{kind:'charge',actor:m.id,move:name,side:this.sideOf(m)});
   return;
  }
  if(releasing){
   m.charging=null;
   const original=this.get(preparation.target);
   // A replacement Pokémon isn't the original target. Retarget to a living foe
   // when the marked target fainted or left play during the charge.
   const enemySide=this.sideOf(m)==='player'?'opponent':'player';
   const target=original?.active&&original.hp>0?original:
    this.active(enemySide)[0];
   a={...a,target:target?.id};
  }
  if(name!=='STRUGGLE'&&m.choiceLock&&m.choiceLock!==name){this.write(`${m.name} est bloqué sur ${this.data.moveData[m.choiceLock]?.name||m.choiceLock}.`);return;}
  if(!releasing&&name!=='STRUGGLE'&&(m.pp[name]||0)<=0){this.write(`${m.name} n'a plus de PP !`);return;}
  if(!releasing&&name!=='STRUGGLE'){m.pp[name]--;if(this.get(a.target)?.ability==='PRESSURE')m.pp[name]=Math.max(0,m.pp[name]-1);}
  if(m.item==='CHOICE_BAND')m.choiceLock=name;
  m.lastMove=name;this.write(`${m.name} utilise ${move.name} !`,{kind:'move',actor:m.id,side:this.sideOf(m),move:name,target:a.target});
  if(move.effect==='protect'){const good=this.rng()<1/Math.pow(2,m.protectCount);m.protectCount++;m.guarded=good;this.write(good?`${m.name} est protégé.`:'Mais cela échoue !');return;}
  m.protectCount=0;
  if(move.target==='self'||move.target==='enemyfield'){this.selfMove(m,move,a);this.whiteHerb(m);return;}
  const foe=this.sideOf(m)==='player'?'opponent':'player';
  let target=this.get(a.target);let recipients=[],landed=false;
  let retaliation=null;
  if(['COUNTER','MIRROR_COAT'].includes(move.originalEffect)){
   // Cmd_counterdamagecalculator / Cmd_mirrorcoatdamagecalculator, adapted to move category.
   const kind=move.originalEffect==='COUNTER'?'physical':'special',hit=m.receivedDamage?.[kind];target=this.get(hit?.actor);
   if(!hit?.amount||!target||target.hp<=0||!target.active||this.sideOf(target)===this.sideOf(m)){this.write('Mais cela échoue !');return;}
   retaliation=hit.amount*2;
  }
  if(move.target==='random'){const foes=this.active(foe);recipients=foes.length?[foes[randInt(this.rng,foes.length)]]:[];}
  else if(move.target==='enemies')recipients=this.active(foe);
  else if(move.target==='all')recipients=[...this.active(foe),...this.active(this.sideOf(m)).filter(x=>x.id!==m.id)];
  else recipients=[target&&target.hp>0&&target.active?target:this.active(foe)[0]].filter(Boolean);
  if(!recipients.length)return;
  for(const t of recipients){if(t.hp<=0)continue;
   if(soundproofBlocks(name,m,t)){this.write(`${t.name} est immunisé grâce à Anti-Bruit !`,{kind:'ability',actor:t.id,side:this.sideOf(t),ability:'SOUNDPROOF'});continue;}
   if(!canHitChargingTarget(name,t)){this.write(`${t.name} est hors de portée de ${move.name}.`);continue;}
   if(t.guarded){this.write(`${t.name} se protège de ${move.name}.`);continue;}
   const hitAcc=accuracyChance(this,m,t,move);
   if(move.accuracy!==0&&(Math.floor(this.rng()*65536)%100+1)>hitAcc){this.write(`${m.name} manque sa cible ${t.name}.`);continue;}
   if(splitCategory(this,move)==='status'){this.targetStatus(m,t,move);continue;}
   const count=multiHitCount(name,this.rng,m.ability);
   let hits=0,totalDealt=0;
   for(let hit=0;hit<count&&t.hp>0&&m.hp>0;hit++){
    // Triple Kick increases its base power each time and checks accuracy per hit.
    if(hit>0&&name==='TRIPLE_KICK'&&move.accuracy!==0&&(Math.floor(this.rng()*65536)%100+1)>accuracyChance(this,m,t,move))break;
    const hitMove=name==='TRIPLE_KICK'?{...move,power:move.power*(hit+1)}:move;
    const crit=!['BATTLE_ARMOR','SHELL_ARMOR'].includes(t.ability)&&(Math.floor(this.rng()*65536)%((move.effect==='crit')?8:16)===0);
    const result=retaliation!==null?{damage:retaliation,mult:effectiveness(move.type,t,this.data,this.inverseBattle)===0?0:1,fixed:true}:this.damagePreview(m,t,hitMove,{critical:crit,spread:recipients.length>1});
    if(result.mult===0){this.write(`Cela n'affecte pas ${t.name} !`);break;}
    if(t.ability==='FLASH_FIRE'&&move.type==='FIRE'){
      t.flashFire=true;this.write(`${t.name} absorbe l'attaque Feu grâce à Torche !`);break;
    }
    if((t.ability==='VOLT_ABSORB'&&move.type==='ELECTRIC')||(t.ability==='WATER_ABSORB'&&move.type==='WATER')){
      this.write(`${t.name} absorbe l'attaque grâce à ${t.ability} !`);this.heal(t,t.maxHp/4);break;
    }
    let dmg=result.fixed?result.damage:Math.max(1,Math.floor(result.damage*(100-(Math.floor(this.rng()*65536)%16))/100));
    landed=true;hits++;
    if(t.substitute>0){
      const sub=Math.min(dmg,t.substitute);t.substitute-=sub;
      this.write(`${t.name} : le clone encaisse ${sub} dégâts !`,{kind:'substitute-hit',actor:t.id,side:this.sideOf(t),amount:sub,remaining:t.substitute});
      if(t.substitute<=0)this.write('Le clone disparaît !',{kind:'substitute-break',actor:t.id,side:this.sideOf(t)});
      if(move.effect==='drain')this.drainRecovery(m,t,Math.max(1,Math.floor(sub/2)));
      if(move.effect==='recoil3'&&m.ability!=='ROCK_HEAD'&&m.hp>0)this.hpLoss(m,Math.max(1,Math.floor(sub/3)),'contrecoup');
      continue;
    }
    if(t.item==='FOCUS_BAND'&&dmg>=t.hp&&this.rng()<.1)dmg=t.hp-1;
    const dealt=this.hpLoss(t,dmg,'attaque');totalDealt+=dealt;
    if(dealt)(t.receivedDamage??={})[splitCategory(this,move)]={actor:m.id,amount:dealt};
    if(crit&&!result.fixed)this.write('Coup critique !');
    if(result.mult>=2)this.write('C’est super efficace !');if(result.mult>0&&result.mult<1)this.write('Ce n’est pas très efficace…');
    if(move.effect==='drain')this.drainRecovery(m,t,Math.max(1,Math.floor(dealt/2)));
    if(move.effect==='recoil3'&&m.ability!=='ROCK_HEAD')this.hpLoss(m,Math.max(1,Math.floor(dealt/3)),'contrecoup');
    this.afterHit(m,t,move);
    this.contactEffects(m,t,name,move);
    if(t.hp<=0&&t.destiny&&m.hp>0)this.hpLoss(m,m.hp,'Prélèvement Destin');
   }
   if(m.item==='SHELL_BELL'&&totalDealt>0&&m.hp>0)this.heal(m,Math.floor(totalDealt/8));
   if(count>1&&hits>0)this.write(`Touché ${hits} fois !`,{kind:'multi-hit',actor:t.id,side:this.sideOf(t),hits});
  }
  if(move.effect==='explode'&&m.hp>0){this.hpLoss(m,m.hp,'Explosion');}
  if(landed&&move.effect==='superpower'){this.modify(m,'atk',-1);this.modify(m,'def',-1);}
  if(landed&&move.originalEffect==='OVERHEAT')this.modify(m,'spa',-2);
  if(move.effect==='recharge'&&landed)m.recharge=1;
  if(move.effect==='uturn'&&m.hp>0){const r=this.bench(this.sideOf(m),m.owner);if(r.length)this.switchMon(m,r[0].id);}
 }
 selfMove(m,move,action={}){
  if(move.originalEffect==='SAFEGUARD'||move.effect==='safeguard'){
   const side=this.sideOf(m);
   if(this.safeguards?.[side]>0){this.write('Rune Protect est déjà actif.');return;}
   (this.safeguards??={})[side]=5;
   this.write(`Rune Protect protège l'équipe de ${m.name} !`);
   return;
  }
  if(this.statMove(m,m,move))return;
  switch(move.effect){
   case 'heal':if(m.hp<m.maxHp)this.heal(m,m.maxHp/2);else this.write('Tous les PV sont déjà présents.');break;
   case 'rest':if(m.hp===m.maxHp&&!m.status){this.write('Repos échoue.');break;}m.status='sleep';m.sleep=2;this.heal(m,m.maxHp);this.write(`${m.name} s'endort pour récupérer.`,{kind:'status',actor:m.id,side:this.sideOf(m),status:'sleep'});this.useBerry(m);break;
   case 'calm':this.modify(m,'spa',1);this.modify(m,'spd',1);break;
   case 'swords':this.modify(m,'atk',2);break;
   case 'dragondance':this.modify(m,'atk',1);this.modify(m,'spe',1);break;
   case 'bulk':this.modify(m,'atk',1);this.modify(m,'def',1);break;
   case 'curse':if(this.data.species[m.species].types.includes('GHOST')){const foes=this.active(this.sideOf(m)==='player'?'opponent':'player'),t=foes[Math.floor(this.rng()*65536)%foes.length];if(t&&!t.cursed){t.cursed=true;this.hpLoss(m,Math.max(1,Math.floor(m.maxHp/2)),'Malédiction');this.write(`${t.name} est maudit.`);}else this.write('Malédiction échoue.');break;}this.modify(m,'atk',1);this.modify(m,'def',1);this.modify(m,'spe',-1);break;
   case 'sun':this.weather='sun';this.weatherTurns=5;this.write('Le soleil brille !');break;
   case 'sand':this.weather='sand';this.weatherTurns=5;break;
   case 'hail':this.weather='hail';this.weatherTurns=5;break;
   case 'reflect':(this.reflections||={})[this.sideOf(m)]=5;break;
   case 'light_screen':(this.lightScreens||={})[this.sideOf(m)]=5;break;
   case 'rain':this.weather='rain';this.weatherTurns=5;this.write('La pluie commence à tomber !');break;
   case 'spikes':{let side=this.sideOf(m)==='player'?'opponent':'player';this.hazards[side]=Math.min(3,this.hazards[side]+1);this.write('Des Picots se répandent chez l’adversaire.');break;}
   case 'substitute':if(m.substitute>0||m.hp<=m.maxHp/4){this.write('Clonage échoue.');break;}const cost=Math.max(1,Math.floor(m.maxHp/4));m.hp-=cost;m.substitute=cost;this.write(`${m.name} perd ${cost} PV pour créer son clone.`,{kind:'damage',actor:m.id,side:this.sideOf(m),amount:cost,maxHp:m.maxHp});this.write(`${m.name} place un clone !`,{kind:'substitute-create',actor:m.id,side:this.sideOf(m),amount:cost});break;
   case 'aroma':for(const p of this[this.sideOf(m)].party){p.status='';p.toxic=0;p.sleep=0;}this.write('Aromathérapi guérit le groupe !');break;
   case 'destiny':m.destiny=true;this.write(`${m.name} se prépare à entraîner son adversaire.`);break;
   case 'baton':{const r=this.bench(this.sideOf(m),m.owner);const next=r.find(p=>p.id===action.to)||(m.owner.startsWith('human')?null:r[0]);if(next)this.switchMon(m,next.id,true);else this.write('Relais échoue : aucun remplaçant choisi.');break;}
   default:this.write('⚠ Effet non porté : '+move.name+' ('+move.originalEffect+').');
  }
 }
 targetStatus(m,t,move){
  if(move.type==='FIRE'&&t.ability==='FLASH_FIRE'){
   t.flashFire=true;this.write(`${t.name} absorbe l'attaque Feu grâce à Torche !`);return;
  }
  if(m!==t&&this.sideOf(m)!==this.sideOf(t)&&t.substitute>0){this.write(`${t.name} est protégé par son clone !`);return;}
  if(this.statMove(m,t,move))return;
  if(effectiveness(move.type,t,this.data,this.inverseBattle)===0&&['paralyze','toxic','poison'].includes(move.effect)){this.write('Cible immunisée.');return;}
  switch(move.effect){
   case 'burn':this.inflict(t,'burn',m);break;
   case 'paralyze':this.inflict(t,'paralyze',m);break;
   case 'toxic':this.inflict(t,'toxic',m);break;
   case 'sleep':this.inflict(t,'sleep',m);break;
   case 'seed':{
    if(t.seeded||t.substitute>0||this.data.species[t.species].types.includes('GRASS')){this.write('Vampigraine échoue.');break;}
    const side=this.sideOf(m),slot=this[side].active.indexOf(m.id);
    if(slot<0)break;
    t.seeded=true;t.seedSource={side,slot};
    this.write(`${t.name} est vampigrainé.`);break;
   }
   case 'whirlwind':{const r=this.bench(this.sideOf(t),t.owner);if(r.length)this.switchMon(t,r[randInt(this.rng,r.length)].id);break;}
   default:this.write('⚠ Effet non porté : '+move.name+' ('+move.originalEffect+').');
  }
 }
 contactEffects(attacker,defender,moveKey,move){
  if(!makesContact(moveKey,move)||attacker.hp<=0||this.sideOf(attacker)===this.sideOf(defender))return;
  const ability=defender.ability;
  if(ability==='ROUGH_SKIN'){
   this.hpLoss(attacker,Math.max(1,Math.floor(attacker.maxHp/16)),'Peau Dure');
  }else if(ability==='STATIC'&&this.rng()<1/3){
   this.inflict(attacker,'paralyze',defender);
  }else if(ability==='POISON_POINT'&&this.rng()<1/3){
   this.inflict(attacker,'poison',defender);
  }else if(ability==='FLAME_BODY'&&this.rng()<1/3){
   this.inflict(attacker,'burn',defender);
  }else if(ability==='EFFECT_SPORE'&&this.rng()<.1){
   const effect=['poison','paralyze','sleep'][Math.floor(this.rng()*3)];
   this.inflict(attacker,effect,defender);
  }
 }
 afterHit(m,t,move){if(t.hp<=0&&!['ATTACK_UP_HIT','DEFENSE_UP_HIT','ALL_STATS_UP_HIT'].includes(move.originalEffect))return;const chance=Math.min(100,(move.secondaryChance||0)*(m.ability==='SERENE_GRACE'?2:1));
  if((Math.floor(this.rng()*65536)%100)>=Math.min(100,chance))return;
  if(t.ability==='SHIELD_DUST'&&!['ATTACK_UP_HIT','DEFENSE_UP_HIT','ALL_STATS_UP_HIT'].includes(move.originalEffect))return;
  const e=move.originalEffect;
  const status={BURN_HIT:'burn',FREEZE_HIT:'freeze',PARALYZE_HIT:'paralyze',THUNDER:'paralyze',POISON_HIT:'poison',TWINEEDLE:'poison'}[e];if(status)this.inflict(t,status,m);
  const down={ATTACK_DOWN_HIT:'atk',DEFENSE_DOWN_HIT:'def',SPEED_DOWN_HIT:'spe',SPECIAL_ATTACK_DOWN_HIT:'spa',SPECIAL_DEFENSE_DOWN_HIT:'spd',ACCURACY_DOWN_HIT:'acc'}[e];if(down)this.modify(t,down,-1,m);
  if(e==='ATTACK_UP_HIT')this.modify(m,'atk',1);if(e==='DEFENSE_UP_HIT')this.modify(m,'def',1);
  if(e==='ALL_STATS_UP_HIT')for(const stat of ['atk','def','spa','spd','spe'])this.modify(m,stat,1);
  if(e==='FLINCH_HIT'&&t.ability!=='INNER_FOCUS')t.flinched=true;
 }
 // BattleScript_EffectAbsorb / BattleScript_LeechSeedTurnDrain (pokeemerald).
 drainRecovery(receiver,source,amount){
  if(receiver.hp<=0||amount<=0)return;
  if(source.ability==='LIQUID_OOZE')this.hpLoss(receiver,amount,'Suintement');
  else this.heal(receiver,amount);
 }
 leechSeedResidual(m){
  if(!m.seeded||m.hp<=0)return;
  // Emerald stores a battler position, not an individual Pokémon: a replacement
  // in the same position receives healing. Legacy saves had only a boolean.
  const source=m.seedSource||{side:this.sideOf(m)==='player'?'opponent':'player',slot:0};
  const receiver=this.get(this[source.side]?.active[source.slot]);
  if(!receiver||receiver.hp<=0)return;
  const dealt=this.hpLoss(m,Math.max(1,Math.floor(m.maxHp/8)),'Vampigraine');
  this.drainRecovery(receiver,m,dealt);
 }
 endOfTurn(){
  for(const field of ['reflections','lightScreens','mist','safeguards'])for(const side of ['player','opponent'])if(this[field]?.[side]>0)this[field][side]--;
  for(const m of [...this.active('player'),...this.active('opponent')]){
   if(m.hp<=0)continue;
   // Emerald: Shed Skin has a 1-in-3 chance to cure status before residual
   // poison/burn damage, not the 30% chance from Generation IV.
   if(m.ability==='SHED_SKIN'&&m.status&&this.rng()<1/3){
    m.status='';m.sleep=0;m.toxic=0;
    this.write(`${m.name} guérit grâce à Mue !`,{kind:'status',actor:m.id,side:this.sideOf(m)});
   }
   // Speed Boost does not activate on the turn a Pokémon switches in.
   if(m.ability==='SPEED_BOOST'&&m.enteredTurn!==this.turn)this.modify(m,'spe',1);
   this.leechSeedResidual(m);
   if(m.status==='burn'||m.status==='poison')this.hpLoss(m,m.maxHp/8,m.status);
   if(m.status==='toxic'){m.toxic++;this.hpLoss(m,m.maxHp*m.toxic/16,'toxic');}
   if(weatherActive(this)&&this.weather==='sand'&&!this.data.species[m.species].types.some(t=>['ROCK','GROUND','STEEL'].includes(t)))this.hpLoss(m,m.maxHp/16,'tempête de sable');
   if(weatherActive(this)&&this.weather==='hail'&&!this.data.species[m.species].types.includes('ICE'))this.hpLoss(m,m.maxHp/16,'grêle');
   if(m.cursed&&m.hp>0)this.hpLoss(m,Math.max(1,Math.floor(m.maxHp/4)),'Malédiction');
   if(m.item==='LEFTOVERS'&&m.hp>0)this.heal(m,m.maxHp/16);
   if(m.ability==='RAIN_DISH'&&weatherActive(this)&&this.weather==='rain'&&m.hp>0)this.heal(m,m.maxHp/16);
   m.guarded=false;m.flinched=false;m.destiny=false;
  }
  if(this.weatherTurns>0){this.weatherTurns--;if(this.weatherTurns===0){this.weather='';this.write('Le temps revient à la normale.');}}
 }
 resolveFaint(){
  this.pendingReplacements??=[];
  for(const side of ['player','opponent'])for(let slot=0;slot<this[side].active.length;slot++){
   const m=this.get(this[side].active[slot]);if(!m||m.hp>0)continue;
   m.charging=null;m.active=false;this[side].active[slot]=null;this.write(`${m.name} est K.O. !`,{kind:'faint',actor:m.id,side});
   if(this.bench(side,m.owner).length)this.pendingReplacements.push({side,slot,owner:m.owner,fainted:m.id});
  }
 }
 settleReplacements(){
  this.pendingReplacements??=[];
  if(this.status!=='active'){this.pendingReplacements=[];return;}
  for(let i=0;i<this.pendingReplacements.length;){
   const r=this.pendingReplacements[i],reserve=this.bench(r.side,r.owner);
   if(!reserve.length){this.pendingReplacements.splice(i,1);continue;}
   if(['human','human2'].includes(r.owner)){i++;continue;}
   this.pendingReplacements.splice(i,1);this.sendReplacement(r,reserve[0]);
   this.resolveFaint();this.checkEnd();if(this.status!=='active'){this.pendingReplacements=[];return;}
  }
 }
 sendReplacement(request,next){
  next.active=true;next.receivedDamage={};next.stages={atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0};next.aiKnownMoves=[];next.aiKnownAbility='';next.enteredTurn=this.turn;
  this[request.side].active[request.slot]=next.id;
  this.write(`${next.name} entre en combat !`,{kind:'replacement',actor:next.id,side:request.side});this.entryEffects([next]);
 }
 replaceFainted(faintedId,nextId){
  if(this.status!=='active')throw Error('Ce combat est terminé.');
  const index=(this.pendingReplacements||[]).findIndex(r=>r.fainted===faintedId&&['human','human2'].includes(r.owner));
  if(index<0)throw Error('Aucun remplacement attendu pour ce Pokémon.');
  const r=this.pendingReplacements[index],next=this.bench(r.side,r.owner).find(m=>m.id===nextId);
  if(!next)throw Error('Ce Pokémon ne peut pas entrer en jeu.');
  this.pendingReplacements.splice(index,1);this.sendReplacement(r,next);
  this.resolveFaint();this.checkEnd();this.settleReplacements();return this.snapshot();
 }
 checkEnd(){
  if(this.countAlive('opponent')===0){this.status='won';this.write('Victoire ! Le combat est remporté.');this.score=1;}
  else if(this.countAlive('player')===0){this.status='lost';this.write('Défaite. La série s’arrête.');this.score=0;}
 }
 snapshot(){return {facility:this.facility||'tower',splitMode:normalizeSplitMode(this.splitMode),inverseBattle:!!this.inverseBattle,mode:this.mode,levelMode:this.levelMode,round:this.round,series:this.series,streak:this.streak,turn:this.turn,status:this.status,safeguards:deep(this.safeguards||{}),
   weather:this.weather,trainer:this.trainer,log:this.log.slice(0,75),player:deep(this.player),opponent:deep(this.opponent),hazards:deep(this.hazards)};}
 exportState(){let snap=this.snapshot();delete snap.log;return snap;}
}
