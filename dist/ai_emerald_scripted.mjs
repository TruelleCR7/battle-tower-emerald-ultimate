/* Interpreteur de scripts de score IA extraits de pret/pokeemerald.
 * Ce VM applique des branches et des operations de score venant de l'ASM original.
 * La simulation d'etat depuis le moteur JS reste partielle : ce n'est PAS une
 * implementation exhaustive des routines C originales d'AI, switch ou items.
 */
// Random() returns the high 16 bits of the Emerald LCG; opcodes use its LOW byte.
export const emeraldRandom16=engine=>Math.floor(engine.rng()*65536)&65535;
export const emeraldScore=(score,delta)=>Math.max(0,((score+delta+128)&255)-128);
const STAT={STAT_HP:'hp',STAT_ATK:'atk',STAT_DEF:'def',STAT_SPEED:'spe',STAT_SPATK:'spa',STAT_SPDEF:'spd',STAT_ACC:'acc',STAT_EVASION:'eva'};
const TYPE_PREFIX='TYPE_', MOVE_PREFIX='MOVE_';
const ABIL_PREFIX='ABILITY_',EFF_PREFIX='EFFECT_';
const effLabel=x=> x?.startsWith('EFFECT_')?x.slice(7):x;
const conditionBoolean=x=>x===true?1:0;
function hpPercent(m){return m&&m.maxHp>0?Math.floor(100*m.hp/m.maxHp):0;}
function argValue(arg, ctx){
 if(arg===undefined)return null;
 const term=String(arg).trim();
 if(/^[-+]?\d+$/.test(term))return Number(term);
 if(term==='MAX_STAT_STAGE')return 12;
 if(term==='MIN_STAT_STAGE')return 0;
 if(term==='DEFAULT_STAT_STAGE')return 6;
 if(term==='MOVE_POWER_OTHER')return 0;
 if(term==='MOVE_NOT_MOST_POWERFUL')return 1;
 if(term==='MOVE_MOST_POWERFUL')return 2;
 if(term==='AI_EFFECTIVENESS_x0')return 0;
 if(term==='AI_EFFECTIVENESS_x0_25')return 10;
 if(term==='AI_EFFECTIVENESS_x0_5')return 20;
 if(term==='AI_EFFECTIVENESS_x1')return 40;
 if(term==='AI_EFFECTIVENESS_x2')return 80;
 if(term==='AI_EFFECTIVENESS_x4')return 160;
 if(term==='AI_WEATHER_NONE')return 'AI_WEATHER_NONE';
 if(term==='TRUE')return 1;
 if(term==='FALSE')return 0;
 // Bitwise status masks and other enumerator expressions in AI scripts.
 if(term.includes('|'))return term.split('|').map(s=>argValue(s.trim(),ctx));
 return term;
}
function currentType(mon,slot,ctx){if(!mon)return null;let types=ctx.data.species[mon.species]?.types||[];return TYPE_PREFIX+(types[slot]||types[0]||'NORMAL');}
function getMon(code,ctx){
 switch(code){case 'AI_USER':return ctx.user;case 'AI_TARGET':return ctx.target;
 case 'AI_USER_PARTNER':return ctx.engine.active(ctx.engine.sideOf(ctx.user)).find(x=>x.id!==ctx.user.id)||null;
 case 'AI_TARGET_PARTNER':return ctx.engine.active(ctx.engine.sideOf(ctx.target)).find(x=>x.id!==ctx.target.id)||null;
 default:return null;}
}
function hasStatus(mon,mask){
 if(!mon)return false;
 if(Array.isArray(mask))return mask.some(x=>hasStatus(mon,x));
 const m=String(mask);
 if(m==='STATUS1_ANY')return Boolean(mon.status);
 if(m.includes('STATUS1_')){
  if(m.includes('SLEEP'))return mon.status==='sleep';
  if(m.includes('TOXIC'))return mon.status==='toxic';
  if(m.includes('POISON'))return mon.status==='poison';
  if(m.includes('BURN'))return mon.status==='burn';
  if(m.includes('PARALYSIS'))return mon.status==='paralyze';
  if(m.includes('FREEZE'))return mon.status==='freeze';
 }
 if(m.includes('STATUS2_')){
  if(m.includes('SUBSTITUTE'))return (mon.substitute||0)>0;
  if(m.includes('FOCUS_ENERGY'))return Boolean(mon.focusEnergy);
  if(m.includes('CONFUSION'))return Boolean(mon.confused);
  if(m.includes('NIGHTMARE'))return Boolean(mon.nightmare);
  if(m.includes('CURSED'))return Boolean(mon.cursed);
  if(m.includes('MULTIPLETURNS'))return Boolean(mon.lockedTurns);
 }
 if(m.includes('STATUS3_')){
  if(m.includes('LEECHSEED'))return Boolean(mon.seeded);
  if(m.includes('PERISH_SONG'))return Boolean(mon.perish);
  if(m.includes('ROOTED'))return Boolean(mon.rooted);
  if(m.includes('ON_AIR'))return Boolean(mon.onAir);
  if(m.includes('UNDERGROUND'))return Boolean(mon.underground);
  if(m.includes('UNDERWATER'))return Boolean(mon.underwater);
 }
 return false;
}
function hasType(mon,type,ctx){return Boolean(mon && ctx.data.species[mon.species]?.types.includes(String(type).replace('TYPE_','')));}
function hasMove(mon,move){return Boolean(mon?.moves.includes(String(move).replace('MOVE_','')));}
function hasMoveEffect(mon,effect,ctx){return Boolean(mon?.moves.some(k=>ctx.data.moveData[k]?.originalEffect===effLabel(effect)));}
function typeEffectiveness(ctx){
 const {engine,user,target,move}=ctx;
 const r=engine.damagePreview(user,target,move);
 return Math.round(Math.min(4,Math.max(0,r.mult))*40);
}
const IGNORED_POWER=new Set(['EXPLOSION','DREAM_EATER','RAZOR_WIND','SKY_ATTACK','RECHARGE','SKULL_BASH','SOLAR_BEAM','SPIT_UP','FOCUS_PUNCH','SUPERPOWER','ERUPTION','OVERHEAT']);
function simulatedDamage(ctx,slot=ctx.slot){
 const move=ctx.data.moveData[ctx.user.moves[slot]];
 return move?Math.floor(ctx.engine.damagePreview(ctx.user,ctx.target,move).damage*(ctx.simulatedRNG?.[slot]??100)/100):0;
}
function powerClass(ctx){
 const eligible=m=>m?.power>1&&!IGNORED_POWER.has(m.originalEffect);
 if(!eligible(ctx.move))return 0;
 const damages=ctx.user.moves.map((k,i)=>eligible(ctx.data.moveData[k])?Math.max(1,simulatedDamage(ctx,i)):0);
 return damages.some(d=>d>damages[ctx.slot])?1:2;
}
function knownMoves(code,ctx,{negative=false,effect=false}={}){
 // Preserve vanilla's target-partner and user-partner quirks (BUGFIX unset).
 if(code==='AI_TARGET'||code==='AI_TARGET_PARTNER')return ctx.target.aiKnownMoves||[];
 if(code==='AI_USER_PARTNER'&&!negative&&!effect)return getMon(code,ctx)?.moves||[];
 return ctx.user.moves;
}
function guessedAbility(code,ctx){
 const m=code==='AI_USER'?ctx.user:ctx.target;
 if(m===ctx.user)return m.ability;
 if(m.aiKnownAbility)return m.aiKnownAbility;
 if(['SHADOW_TAG','MAGNET_PULL','ARENA_TRAP'].includes(m.ability))return m.ability;
 const a=ctx.data.species[m.species]?.abilities||[];
 return a[1]&&a[1]!=='NONE'?a[emeraldRandom16(ctx.engine)&1?0:1]:a[0]||'NONE';
}
function checkSide(mon,mask,ctx){
 if(!mon)return false;
 const side=ctx.engine.sideOf(mon),v=String(mask);
 if(v.includes('SPIKES'))return ctx.engine.hazards[side]>0;
 if(v.includes('REFLECT'))return Boolean(ctx.engine.reflections?.[side]);
 if(v.includes('LIGHTSCREEN'))return Boolean(ctx.engine.lightScreens?.[side]);
 if(v.includes('SAFEGUARD'))return Boolean(ctx.engine.safeguard?.[side]);
 return false;
}
function tableContains(ctx,table,val){
 const elements=ctx.script.tables?.[table]||[];
 return elements.some(elem=>{
  if(elem==0||elem==='-1'||elem==='0xFFFF')return false;
  return String(argValue(elem,ctx))===String(val);
 });
}
const comparisons={if_equal:(a,b)=>a===b,if_equal_:(a,b)=>a===b,if_not_equal:(a,b)=>a!==b,
 if_less_than:(a,b)=>a<b,if_more_than:(a,b)=>a>b,
 if_hp_less_than:(a,b)=>a<b,if_hp_more_than:(a,b)=>a>b,if_hp_equal:(a,b)=>a===b,if_hp_not_equal:(a,b)=>a!==b,
 if_stat_level_less_than:(a,b)=>a<b,if_stat_level_more_than:(a,b)=>a>b,if_stat_level_equal:(a,b)=>a===b,
 if_type_effectiveness:(a,b)=>a===b};
function scriptStep(state,inst,ctx){
 const [cmd,...args]=inst;
 const val=i=>argValue(args[i],ctx);
 const mon=i=>getMon(args[i],ctx);
 const move=ctx.move;
 const user=ctx.user,target=ctx.target,engine=ctx.engine;
 const jumpLabel=args.at(-1);
 const branch=v=>({jump:Boolean(v)?jumpLabel:null});
 const efx=move.originalEffect||'';
 const hp=(m)=>hpPercent(m);
 const stage=(m,s)=>6+(m?.stages[STAT[s]||s]||0);
 if(cmd==='end')return {end:true};
 if(cmd==='goto')return {jump:args[0]};
 if(cmd==='call')return {call:args[0]};
 if(cmd==='score')return {score:Number(args[0])||0};
 if(cmd==='flee'||cmd==='watch')return {end:true};
 if(cmd==='get_curr_move_type'){state.result='TYPE_'+move.type;return {};}
 if(cmd==='get_considered_move_effect'){state.result='EFFECT_'+efx;return {};}
 if(cmd==='get_how_powerful_move_is'){state.result=powerClass(ctx);return {};}
 if(cmd==='get_turn_count'){state.result=engine.turn;return {};}
 if(cmd==='get_ability'){state.result=ABIL_PREFIX+guessedAbility(args[0],ctx);return {};}
 if(cmd==='get_gender'){state.result=mon(0)?.gender??0;return {};}
 if(cmd==='get_weather'){if(engine.weather)state.result='AI_WEATHER_'+(engine.weather==='sand'?'SANDSTORM':engine.weather.toUpperCase());return {};}
 if(cmd==='get_stockpile_count'){state.result=mon(0)?.stockpile||0;return {};}
 if(cmd==='get_protect_count'){state.result=mon(0)?.protectCount||0;return {};}
 if(cmd==='get_last_used_bank_move'){state.result=mon(0)?.lastMove?'MOVE_'+mon(0).lastMove:'MOVE_NONE';return {};}
 if(cmd==='get_used_held_item'){state.result='ITEM_'+(mon(0)?.usedItem||'NONE');return {};}
 if(cmd==='get_hold_effect'){state.result='HOLD_EFFECT_'+(ctx.data.itemEffects?.[mon(0)?.item]||'NONE');return {};}
 if(cmd==='get_move_type_from_result'){
  state.result='TYPE_'+(ctx.data.moveData[String(state.result).replace('MOVE_','')]?.type||'NORMAL');return {};
 }
 if(cmd==='get_move_power_from_result'){
  state.result=ctx.data.moveData[String(state.result).replace('MOVE_','')]?.power||0;return {};
 }
 if(cmd==='get_move_effect_from_result'){
  state.result='EFFECT_'+(ctx.data.moveData[String(state.result).replace('MOVE_','')]?.originalEffect||'HIT');return {};
 }
 if(cmd==='get_target_type1'||cmd==='get_target_type2'||cmd==='get_user_type1'||cmd==='get_user_type2'){
  state.result=currentType(cmd.includes('target')?target:user,cmd.endsWith('2')?1:0,ctx);return {};
 }
 if(cmd==='is_first_turn_for'){state.result=conditionBoolean((mon(0)?.enteredTurn??0)===engine.turn);return {};}
 if(cmd==='count_usable_party_mons'){let m=mon(0);state.result=m?engine.bench(engine.sideOf(m)).length:0;return {};}
 if(cmd==='get_type'){state.result=args[0]==='AI_TYPE_MOVE'?'TYPE_'+move.type:currentType(args[0]?.includes('TARGET')?target:user,args[0]?.includes('TYPE2')?1:0,ctx);return {};}
 if(cmd==='if_target_is_ally')return branch(engine.sideOf(user)===engine.sideOf(target));
 if(cmd==='if_move')return branch('MOVE_'+ctx.moveKey===args[0]);
 if(cmd==='if_not_move')return branch('MOVE_'+ctx.moveKey!==args[0]);
 if(cmd==='if_effect')return branch('EFFECT_'+efx===args[0]);
 if(cmd==='if_not_effect')return branch('EFFECT_'+efx!==args[0]);
 if(cmd==='if_random_less_than')return branch((emeraldRandom16(engine)&255)<Number(args[0]));
 if(cmd==='if_random_greater_than')return branch((emeraldRandom16(engine)&255)>Number(args[0]));
 if(cmd==='if_random_equal')return branch((emeraldRandom16(engine)&255)===Number(args[0]));
 if(cmd==='if_random_not_equal')return branch((emeraldRandom16(engine)&255)!==Number(args[0]));
 if(cmd==='if_type_effectiveness')return branch(typeEffectiveness(ctx)===val(0));
 if(cmd==='if_has_move')return branch(knownMoves(args[0],ctx).includes(args[1].replace('MOVE_','')));
 if(cmd==='if_doesnt_have_move')return branch(!knownMoves(args[0],ctx,{negative:true}).includes(args[1].replace('MOVE_','')));
 if(cmd==='if_has_move_with_effect')return branch(knownMoves(args[0],ctx,{effect:true}).some((k,i)=>user.moves[i]&&ctx.data.moveData[k]?.originalEffect===effLabel(args[1])));
 if(cmd==='if_doesnt_have_move_with_effect')return branch(!knownMoves(args[0],ctx,{effect:true,negative:true}).some(k=>ctx.data.moveData[k]?.originalEffect===effLabel(args[1])));
 if(cmd==='if_ability'||cmd==='if_no_ability'){
  const m=mon(0),wanted=args[1]?.replace('ABILITY_','');let ability=m?.ability;
  if(args[0]==='AI_TARGET'||args[0]==='AI_TARGET_PARTNER'){
   if(m?.aiKnownAbility)ability=m.aiKnownAbility;
   else if(!['SHADOW_TAG','MAGNET_PULL','ARENA_TRAP'].includes(ability)){
    const a=ctx.data.species[m?.species]?.abilities||[];
    ability=a[1]&&a[1]!=='NONE'?(a.includes(wanted)?'NONE':a[0]):a[0];
   }
  }
  const answer=!ability||ability==='NONE'?2:ability===wanted?1:0;
  state.result=answer;return branch(answer===(cmd==='if_ability'?1:0));
 }
 if(cmd==='if_type')return branch(hasType(mon(0),args[1],ctx));
 if(cmd==='if_no_type')return branch(!hasType(mon(0),args[1],ctx));
 if(cmd==='if_holds_item')return branch(mon(0)?.item===args[1]?.replace('ITEM_',''));
 if(cmd==='if_flash_fired')return branch(Boolean(mon(0)?.flashFire));
 if(cmd==='if_status'||cmd==='if_status2'||cmd==='if_status3')return branch(hasStatus(mon(0),val(1)));
 if(cmd==='if_not_status'||cmd==='if_not_status2'||cmd==='if_not_status3')return branch(!hasStatus(mon(0),val(1)));
 if(cmd==='if_status_in_party'){let m=mon(0);return branch(Boolean(m&&engine[engine.sideOf(m)].party.some(p=>hasStatus(p,val(1)))));}
 if(cmd==='if_status_not_in_party'){let m=mon(0);return branch(Boolean(m&&!engine[engine.sideOf(m)].party.some(p=>hasStatus(p,val(1)))));}
 if(cmd==='if_side_affecting')return branch(checkSide(mon(0),args[1],ctx));
 if(cmd==='if_not_side_affecting')return branch(!checkSide(mon(0),args[1],ctx));
 if(cmd==='if_hp_less_than')return branch(hp(mon(0))<val(1));
 if(cmd==='if_hp_more_than')return branch(hp(mon(0))>val(1));
 if(cmd==='if_hp_equal')return branch(Math.floor(hp(mon(0)))===val(1));
 if(cmd==='if_hp_not_equal')return branch(Math.floor(hp(mon(0)))!==val(1));
 if(cmd.startsWith('if_stat_level_')){
  const lhs=stage(mon(0),args[1]);const rhs=val(2);
  return branch((cmd.endsWith('less_than')&&lhs<rhs)||(cmd.endsWith('more_than')&&lhs>rhs)||(cmd==='if_stat_level_equal'&&lhs===rhs)||(cmd.endsWith('not_equal')&&lhs!==rhs));
 }
 if(['if_target_faster','if_user_faster','if_user_goes','if_user_doesnt_go'].includes(cmd)){
  const a=engine.effectiveSpeed(user),b=engine.effectiveSpeed(target);
  // GetWhoStrikesFirst(..., TRUE) returns 2, not 1, for its random tie branch.
  const first=a===b?(emeraldRandom16(engine)&1?2:0):a<b?1:0;
  const expected=cmd==='if_target_faster'?1:cmd==='if_user_faster'?0:Number(args[0]);
  return branch(cmd==='if_user_doesnt_go'?first!==expected:first===expected);
 }
 if(cmd==='if_level_cond')return branch(Number(args[0])===1?user.level<target.level:Number(args[0])===2?user.level===target.level:user.level>target.level);
 if(cmd==='if_not_double_battle')return branch(engine.mode==='single');
 if(cmd==='is_double_battle'){state.result=engine.mode==='single'?0:1;return {};}
 if(cmd==='if_is_double_battle')return branch(engine.mode!=='single');
 if(cmd==='if_can_faint')return branch(move.power>=2&&Math.max(1,simulatedDamage(ctx))>=target.hp);
 if(cmd==='if_cant_faint')return branch(move.power>=2&&simulatedDamage(ctx)<target.hp);
 if(cmd==='if_user_has_no_attacking_moves')return branch(!user.moves.some(k=>ctx.data.moveData[k]?.power>0));
 if(cmd==='if_user_has_attacking_move')return branch(user.moves.some(k=>ctx.data.moveData[k]?.power>0));
 if(cmd==='if_target_not_taunted')return branch(!target.taunted);
 if(cmd==='if_target_taunted')return branch(Boolean(target.taunted));
 if(cmd==='if_any_move_disabled')return branch(Boolean(mon(0)?.disabled));
 if(cmd==='if_any_move_encored')return branch(Boolean(mon(0)?.encored));
 if(cmd==='if_any_move_disabled_or_encored')return branch(Boolean(Number(args[1])===0?mon(0)?.disabled:mon(0)?.encored));
 if(cmd==='if_curr_move_disabled_or_encored')return branch(Boolean(Number(args[0])===0?user.disabled===ctx.moveKey:user.encored===ctx.moveKey));
 if(cmd==='if_in_bytes'||cmd==='if_in_hwords')return branch(tableContains(ctx,args[0],state.result));
 if(cmd==='if_not_in_bytes'||cmd==='if_not_in_hwords')return branch(!tableContains(ctx,args[0],state.result));
 if(comparisons[cmd]){
  const val0=['if_equal','if_equal_','if_not_equal','if_less_than','if_more_than'].includes(cmd)?state.result:cmd.includes('hp')?hp(mon(0)):0;
  const val1=cmd.includes('hp')?val(1):val(0);
  return branch(comparisons[cmd](val0,val1));
 }
 if(cmd==='if_more_than_ptr'||cmd==='if_less_than_ptr'||cmd==='if_equal_ptr'||cmd==='if_not_equal_ptr')return {unsupported:cmd};
 if(cmd.startsWith('nop'))return {unsupported:cmd+':non_advancing_source_opcode'};
 return {unsupported:cmd};
}
export const SCRIPTED_AI_COMMANDS=new Set([
 'end','goto','call','score','flee','watch','get_curr_move_type','get_considered_move_effect',
 'get_how_powerful_move_is','get_turn_count','get_ability','get_gender','get_weather',
 'get_stockpile_count','get_protect_count','get_last_used_bank_move','get_used_held_item','get_hold_effect',
 'get_move_type_from_result','get_move_power_from_result','get_move_effect_from_result',
 'get_target_type1','get_target_type2','get_user_type1','get_user_type2','is_first_turn_for',
 'count_usable_party_mons','get_type','if_target_is_ally','if_move','if_not_move','if_effect','if_not_effect',
 'if_random_less_than','if_random_greater_than','if_random_equal','if_random_not_equal',
 'if_type_effectiveness','if_has_move','if_doesnt_have_move','if_has_move_with_effect',
 'if_doesnt_have_move_with_effect','if_ability','if_no_ability','if_type','if_no_type',
 'if_holds_item','if_flash_fired','if_status','if_status2','if_status3','if_not_status',
 'if_not_status2','if_not_status3','if_status_in_party','if_status_not_in_party',
 'if_side_affecting','if_not_side_affecting','if_hp_less_than','if_hp_more_than',
 'if_hp_equal','if_hp_not_equal','if_stat_level_less_than','if_stat_level_more_than',
 'if_stat_level_equal','if_stat_level_not_equal','if_target_faster','if_user_faster',
 'if_user_goes','if_user_doesnt_go','if_level_cond','if_not_double_battle',
 'is_double_battle','if_is_double_battle','if_can_faint','if_cant_faint',
 'if_user_has_no_attacking_moves','if_user_has_attacking_move','if_target_not_taunted',
 'if_target_taunted','if_any_move_disabled','if_any_move_encored',
 'if_any_move_disabled_or_encored','if_curr_move_disabled_or_encored',
 'if_in_bytes','if_not_in_bytes','if_in_hwords','if_not_in_hwords',
 'if_equal','if_equal_','if_not_equal','if_less_than','if_more_than',
 'nop_2A','nop_2B','nop_32','nop_33','nop_52','nop_53','nop_54','nop_55','nop_56','nop_57'
]);
export function aiCoverage(script){
 const commands=script?.audit?.commands||{};
 const missing=Object.keys(commands).filter(k=>!SCRIPTED_AI_COMMANDS.has(k));
 return {parsed:!!script?.blocks,sourceInstructions:script?.audit?.instructions||0,
   totalCommands:Object.keys(commands).length,implementedCommands:Object.keys(commands).filter(k=>SCRIPTED_AI_COMMANDS.has(k)).length,
   missingCommands:missing,exactMechanics:false};
}
const TOWER_LOGIC=['AI_CheckBadMove','AI_TryToFaint','AI_CheckViability'];
function runScript(ctx,state,entry,initial){
 let result=initial,ticks=0,label=entry,idx=0;const stack=[],unsupported=new Set();
 for(let limit=0;limit<2000;limit++){
  ticks++;const steps=ctx.script.blocks[label];
  if(!steps){unsupported.add('missing_label:'+label);break;}
  if(idx>=steps.length){const order=ctx.script.order||[],at=order.indexOf(label);if(at<0||at>=order.length-1){unsupported.add('fallthrough_out_of_script:'+label);break;}label=order[at+1];idx=0;continue;}
  const action=scriptStep(state,steps[idx++],ctx);
  if(action.unsupported){unsupported.add(action.unsupported);break;}
  if(action.score!==undefined)result=emeraldScore(result,action.score);
  if(action.end){if(stack.length){[label,idx]=stack.pop();continue;}break;}
  if(action.call){stack.push([label,idx]);label=action.call;idx=0;continue;}
  if(action.jump){label=action.jump;idx=0;}
  if(limit===1999)unsupported.add('instruction_limit');
 }
 return {score:result,unsupported:[...unsupported],ticks};
}
// Diagnostic single-move API; live decisions must use scoreEmeraldMoves below.
export function scoreEmeraldScripted(engine,user,target,moveKey,{logic=null}={}){
 const script=engine.data.aiScript,move=engine.data.moveData[moveKey];
 if(!script?.blocks?.AI_CheckBadMove||!move||!user||!target)return null;
 const ctx={engine,user,target,move,moveKey,script,data:engine.data,slot:user.moves.indexOf(moveKey)},state={result:0};
 let score=100,ticks=0,unsupported=[];
 for(const entry of logic||[...TOWER_LOGIC,...(engine.mode==='single'?[]:['AI_DoubleBattle'])]){
  const r=runScript(ctx,state,entry,score);score=r.score;ticks+=r.ticks;unsupported.push(...r.unsupported);
 }
 return {score,ticks,unsupported:[...new Set(unsupported)]};
}
function setup(engine,user){
 const scores=Array.from({length:4},(_,i)=>{
  const k=user.moves[i],move=engine.data.moveData[k];
  return k&&user.pp[k]>0&&(!user.choiceLock||user.choiceLock===k)&&user.disabled!==k&&(!user.encored||user.encored===k)&&(!user.taunted||move.category!=='status')?100:0;
 });
 const simulatedRNG=Array.from({length:4},()=>100-emeraldRandom16(engine)%16);
 if(engine.mode!=='single')emeraldRandom16(engine); // Setup chooses a target, then doubles overrides it.
 return {scores,simulatedRNG,result:0};
}
export function scoreEmeraldMoves(engine,user,target,{logic=null,state=setup(engine,user)}={}){
 const script=engine.data.aiScript;
 const entries=logic||[...TOWER_LOGIC,...(engine.mode==='single'?[]:['AI_DoubleBattle'])];
 const unsupported=new Set();let ticks=0;
 if(engine.sideOf(target)!==engine.sideOf(user)&&target.lastMove){
  target.aiKnownMoves??=[];
  if(!target.aiKnownMoves.includes(target.lastMove)&&target.aiKnownMoves.length<4)target.aiKnownMoves.push(target.lastMove);
 }
 // Source traverses all four slots for EACH script. funcResult survives both loops.
 for(const entry of entries)for(let slot=0;slot<4;slot++){
  const moveKey=user.moves[slot],move=engine.data.moveData[moveKey];
  if(!move||!(user.pp[moveKey]>0)){state.scores[slot]=0;continue;}
  const ctx={engine,user,target,move,moveKey,script,data:engine.data,slot,simulatedRNG:state.simulatedRNG};
  const r=runScript(ctx,state,entry,state.scores[slot]);state.scores[slot]=r.score;ticks+=r.ticks;r.unsupported.forEach(x=>unsupported.add(x));
 }
 return {scores:state.scores,simulatedRNG:state.simulatedRNG,unsupported:[...unsupported],ticks};
}
export function chooseEmeraldMove(engine,user){
 const initial=setup(engine,user),single=engine.mode==='single';
 const side=engine.sideOf(user),enemy=side==='player'?'opponent':'player';
 // Battler order is player-left, opponent-left, player-right, opponent-right.
 const field=[engine.get(engine.player.active[0]),engine.get(engine.opponent.active[0]),engine.get(engine.player.active[1]),engine.get(engine.opponent.active[1])];
 const targets=single?engine.active(enemy).slice(0,1):field.filter(m=>m&&m!==user&&m.hp>0);
 const picks=[];
 for(const target of targets){
  const r=scoreEmeraldMoves(engine,user,target,{state:single?initial:setup(engine,user)});
  if(r.unsupported.length)throw Error('Commande IA non portée : '+r.unsupported.join(', '));
  const max=Math.max(...user.moves.map((_,i)=>r.scores[i]));
  const slots=user.moves.map((_,i)=>i).filter(i=>r.scores[i]===max);
  const slot=slots[emeraldRandom16(engine)%slots.length];
  picks.push({target,move:user.moves[slot],score:side===engine.sideOf(target)&&max<100?-1:max});
 }
 if(!picks.length)throw Error('Aucune cible IA vivante.');
 const max=Math.max(...picks.map(p=>p.score)),best=picks.filter(p=>p.score===max);
 const selected=single?best[0]:best[emeraldRandom16(engine)%best.length];
 const move=engine.data.moveData[selected.move];
 return {actor:user.id,type:'move',move:selected.move,target:move.target==='self'?user.id:selected.target.id};
}
