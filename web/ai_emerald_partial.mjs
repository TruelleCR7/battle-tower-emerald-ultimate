/**
 * Auditable partial mapping of pret/pokeemerald `data/battle_ai_scripts.s`:
 *   AI_CheckBadMove, AI_TryToFaint, AI_SetupFirstTurn, AI_HPAware,
 *   parts of AI_DoubleBattle and AI_CheckViability.
 *
 * Original Emerald starts every considered move at score 100 and modifies
 * scores by small signed integers. It finally selects randomly among ties.
 * This module returns a delta, NOT the full upstream scripted interpreter.
 */
import {effectiveness} from './engine.mjs';
const boosts=new Set(['swords','dragondance','calm','bulk','curse','spikes','reflect','light_screen']);
const primaryStatus=new Set(['sleep','burn','paralyze','toxic','poison']);
const screens=new Set(['reflect','light_screen']);
const heals=new Set(['heal','rest']);
export function scoreEmeraldPartial(engine,user,target,moveKey){
 const move=engine.data.moveData[moveKey];if(!move||!user||!target)return -100;
 let score=0;
 const myHP=100*user.hp/user.maxHp, yourHP=100*target.hp/target.maxHp;
 const eff=effectiveness(move.type,target,engine.data);
 const estimated=engine.damagePreview(user,target,move).damage;
 const all=engine.active(engine.sideOf(user)==='player'?'opponent':'player');
 // AI_CheckBadMove: type immunity and absorption/disallowed status effects.
 if(move.category!=='status'&&eff===0)score-=10;
 if((target.ability==='VOLT_ABSORB'&&move.type==='ELECTRIC')||
    (target.ability==='WATER_ABSORB'&&move.type==='WATER')||
    (target.ability==='FLASH_FIRE'&&move.type==='FIRE'))score-=12;
 if(target.ability==='WONDER_GUARD'&&eff<=1&&move.category!=='status')score-=10;
 if(target.ability==='SOUNDPROOF'&&['ROAR','SING','SCREECH','UPROAR','SNORE','METAL_SOUND','GRASS_WHISTLE'].includes(moveKey))score-=10;
 if(move.category==='status'){
   if(primaryStatus.has(move.effect)&&target.status)score-=10;
   if(move.effect==='seed'&&target.seeded)score-=10;
   if(boosts.has(move.effect)&&myHP<30)score-=3;
   if(move.effect==='swords'&&user.stages.atk>=6)score-=10;
   if(move.effect==='calm'&&(user.stages.spa>=6||user.stages.spd>=6))score-=10;
   if(move.effect==='dragondance'&&(user.stages.atk>=6||user.stages.spe>=6))score-=10;
   if(move.effect==='spikes'&&engine.hazards[engine.sideOf(user)==='player'?'opponent':'player']>=3)score-=10;
   if(screens.has(move.effect)&&all.length===0)score-=5;
   if(heals.has(move.effect))score+=myHP<40?4:myHP>80?-8:0;
   if(move.effect==='rain'&&engine.weather==='rain')score-=8;
   if(move.effect==='sun'&&engine.weather==='sun')score-=8;
   if(move.effect==='sand'&&engine.weather==='sand')score-=8;
   if(move.effect==='protect'&&user.protectCount)score-=4;
 }else{
   // AI_TryToFaint: +6 if this move KOs; +2 for priority in that situation.
   if(estimated>=target.hp&&target.hp>0&&move.effect!=='explode'){
     score+=4;
     if(move.priority>0)score+=2;
   }
   if(eff>=4)score+=2;
   if(estimated===0||!Number.isFinite(estimated))score-=10;
   if(move.effect==='explode'&&engine.bench(engine.sideOf(user),user.owner).length===0)score-=2;
   if(move.effect==='drain'&&myHP<50)score+=2;
   if(move.effect==='recharge'&&myHP<30)score-=3;
 }
 // AI_SetupFirstTurn: conditional small opening encouragement.
 if(engine.turn===0&&boosts.has(move.effect))score+=2;
 // AI_HPAware: minor score reductions in low-HP/high-HP scenarios.
 if(myHP>70&&['rest','heal','destiny','explode'].includes(move.effect))score-=2;
 if(yourHP<30&&boosts.has(move.effect))score-=2;
 // AI_DoubleBattle: punish hitting your own partner.
 if(engine.mode!=='single'&&move.category!=='status'&&['EARTHQUAKE','MAGNITUDE'].includes(moveKey)){
   const ally=engine.active(engine.sideOf(user)).find(x=>x.id!==user.id);
   if(ally){const d=engine.damagePreview(user,ally,move);if(d.mult>0)score+=['FIRE','ELECTRIC','POISON','ROCK'].some(k=>engine.data.species[ally.species].types.includes(k))?-10:-3;else score+=2;}
 }
 return score;
}
