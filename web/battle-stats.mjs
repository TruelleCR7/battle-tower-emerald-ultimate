// Emerald pokemon.c CalculateBaseDamage / battle_main.c GetWhoStrikesFirst /
// battle_script_commands.c sAccuracyStageRatios. Categories follow this project's split.
export const STAT_KEYS=['atk','def','spa','spd','spe','acc','eva'];
export const STAT_NAMES={atk:'Attaque',def:'Défense',spa:'Atq. Spéciale',spd:'Déf. Spéciale',spe:'Vitesse',acc:'Précision',eva:'Esquive'};
export const ACCURACY_RATIOS=[[33,100],[36,100],[43,100],[50,100],[60,100],[75,100],[1,1],[133,100],[166,100],[2,1],[233,100],[133,50],[3,1]];
export const clampStage=n=>Math.max(-6,Math.min(6,Math.trunc(n||0)));
export function stageRatio(stage,accuracy=false){const n=clampStage(stage);return accuracy?ACCURACY_RATIOS[n+6]:n>=0?[2+n,2]:[2,2-n];}
export function applyStage(value,stage){const [a,b]=stageRatio(stage);return Math.max(1,Math.floor(value*a/b));}
export function weatherActive(engine){return ![...engine.active('player'),...engine.active('opponent')].some(m=>['AIR_LOCK','CLOUD_NINE'].includes(m.ability));}
const TYPE_ITEMS={SILK_SCARF:'NORMAL',CHARCOAL:'FIRE',MYSTIC_WATER:'WATER',MAGNET:'ELECTRIC',MIRACLE_SEED:'GRASS',NEVER_MELT_ICE:'ICE',BLACK_BELT:'FIGHTING',POISON_BARB:'POISON',SOFT_SAND:'GROUND',SHARP_BEAK:'FLYING',TWISTED_SPOON:'PSYCHIC',SILVER_POWDER:'BUG',HARD_STONE:'ROCK',SPELL_TAG:'GHOST',DRAGON_FANG:'DRAGON',BLACK_GLASSES:'DARK',METAL_COAT:'STEEL'};
export function rawEffectiveStat(engine,m,key,{move=null,target=null}={}){
 let value=m.stats[key];const scale=(a,b)=>{value=Math.floor(value*a/b);};
 if(key==='atk'&&['HUGE_POWER','PURE_POWER'].includes(m.ability))value*=2;
 if(move&&['atk','spa'].includes(key)&&TYPE_ITEMS[m.item]===move.type)scale(110,100);
 if(key==='atk'&&m.item==='CHOICE_BAND')scale(150,100);
 if(key==='spa'&&m.item==='DEEP_SEA_TOOTH'&&m.species==='CLAMPERL')value*=2;
 if(key==='spd'&&m.item==='DEEP_SEA_SCALE'&&m.species==='CLAMPERL')value*=2;
 if(key==='spa'&&m.item==='LIGHT_BALL'&&m.species==='PIKACHU')value*=2;
 if(key==='def'&&m.item==='METAL_POWDER'&&m.species==='DITTO')value*=2;
 if(key==='atk'&&m.item==='THICK_CLUB'&&['CUBONE','MAROWAK'].includes(m.species))value*=2;
 if(move&&target?.ability==='THICK_FAT'&&['FIRE','ICE'].includes(move.type)&&key===(move.category==='physical'?'atk':'spa'))scale(1,2);
 if(key==='atk'&&m.ability==='HUSTLE')scale(150,100);
 if(key==='spa'&&['PLUS','MINUS'].includes(m.ability)&&[...engine.active('player'),...engine.active('opponent')].some(p=>p.ability===(m.ability==='PLUS'?'MINUS':'PLUS')))scale(150,100);
 if(key==='atk'&&m.ability==='GUTS'&&m.status)scale(150,100);
 if(key==='def'&&m.ability==='MARVEL_SCALE'&&m.status)scale(150,100);
 if(key==='def'&&move?.originalEffect==='EXPLOSION')scale(1,2);
 return Math.max(1,value);
}
export function effectiveStat(engine,m,key,{critical=false,defending=false,move=null,target=null}={}){
 let n=m.stages[key]||0;
 if(critical&&((defending&&n>0)||(!defending&&n<0)))n=0;
 if(key==='spe'){
  let base=m.stats.spe;
  if(weatherActive(engine)&&((m.ability==='SWIFT_SWIM'&&engine.weather==='rain')||(m.ability==='CHLOROPHYLL'&&engine.weather==='sun')))base*=2;
  let value=applyStage(base,n);if(m.item==='MACHO_BRACE')value=Math.floor(value/2);if(m.status==='paralyze')value=Math.floor(value/4);return Math.max(1,value);
 }
 return applyStage(rawEffectiveStat(engine,m,key,{move,target}),n);
}
export function accuracyChance(engine,user,target,move){
 if(move.accuracy===0||move.originalEffect==='ALWAYS_HIT'||(move.originalEffect==='THUNDER'&&engine.weather==='rain'&&weatherActive(engine))||target.lockedOnBy===user.id)return 100;
 const n=clampStage((user.stages.acc||0)-(target.foresight?0:target.stages.eva||0)),[a,b]=stageRatio(n,true);
 let base=move.originalEffect==='THUNDER'&&engine.weather==='sun'&&weatherActive(engine)?50:move.accuracy;
 let chance=Math.floor(base*a/b);
 if(user.ability==='COMPOUND_EYES')chance=Math.floor(chance*130/100);
 if(target.ability==='SAND_VEIL'&&engine.weather==='sand'&&weatherActive(engine))chance=Math.floor(chance*80/100);
 if(user.ability==='HUSTLE'&&move.category==='physical')chance=Math.floor(chance*80/100);
 if(['BRIGHT_POWDER','LAX_INCENSE'].includes(target.item))chance=Math.floor(chance*(target.item==='LAX_INCENSE'?95:90)/100);
 return Math.min(100,chance);
}
export function baseDamage(engine,user,target,move,{critical=false,spread=false}={}){
 const physical=move.category==='physical',atk=physical?'atk':'spa',def=physical?'def':'spd';
 let power=move.power;if(['RETURN','FRUSTRATION'].includes(move.originalEffect))power=102;
 if(user.hp<=Math.floor(user.maxHp/3)&&({OVERGROW:'GRASS',BLAZE:'FIRE',TORRENT:'WATER',SWARM:'BUG'})[user.ability]===move.type)power=Math.floor(power*150/100);
 let damage=effectiveStat(engine,user,atk,{critical,move,target})*power*(Math.floor(2*user.level/5)+2);
 damage=Math.floor(damage/effectiveStat(engine,target,def,{critical,defending:true,move}));damage=Math.floor(damage/50);
 if(physical&&user.status==='burn'&&user.ability!=='GUTS')damage=Math.floor(damage/2);
 if(!critical&&(physical?engine.reflections:engine.lightScreens)?.[engine.sideOf(target)])damage=engine.mode!=='single'&&engine.active(engine.sideOf(target)).length===2?2*Math.floor(damage/3):Math.floor(damage/2);
 if(spread&&move.target==='enemies')damage=Math.floor(damage/2);
 if(physical&&damage===0)damage=1;
 // Weather applies by move type after the category split (intentional adaptation).
 if(weatherActive(engine)){
  if((engine.weather==='rain'&&move.type==='FIRE')||(engine.weather==='sun'&&move.type==='WATER'))damage=Math.floor(damage/2);
  if((engine.weather==='rain'&&move.type==='WATER')||(engine.weather==='sun'&&move.type==='FIRE'))damage=Math.floor(damage*15/10);
  if(['rain','sand','hail'].includes(engine.weather)&&move.originalEffect==='SOLAR_BEAM')damage=Math.floor(damage/2);
 }
 if(user.flashFire&&move.type==='FIRE')damage=Math.floor(damage*15/10);
 return (damage+2)*(critical?2:1);
}
