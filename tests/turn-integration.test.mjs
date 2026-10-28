import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {STAT_KEYS} from '../web/battle-stats.mjs';

const stages=()=>Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
const moves={
 SWORDS_DANCE:{name:'Danse-Lames',originalEffect:'ATTACK_UP_2',effect:'swords',target:'self',category:'status',accuracy:0,pp:20,priority:0},
 CALM_MIND:{name:'Plénitude',originalEffect:'CALM_MIND',effect:'calm',target:'self',category:'status',accuracy:0,pp:20,priority:0},
 DRAGON_DANCE:{name:'Danse Draco',originalEffect:'DRAGON_DANCE',effect:'dragondance',target:'self',category:'status',accuracy:0,pp:20,priority:0},
 GROWL:{name:'Rugissement',originalEffect:'ATTACK_DOWN',effect:'stat',target:'enemy',category:'status',type:'NORMAL',accuracy:100,pp:40,priority:0},
 SCREECH:{name:'Grincement',originalEffect:'DEFENSE_DOWN_2',effect:'stat',target:'enemy',category:'status',type:'NORMAL',accuracy:100,pp:40,priority:0},
 PSYCH_UP:{name:'Boost',originalEffect:'PSYCH_UP',effect:'stat',target:'enemy',category:'status',type:'NORMAL',accuracy:100,pp:10,priority:0},
 HAZE:{name:'Buée Noire',originalEffect:'HAZE',effect:'stat',target:'self',category:'status',type:'ICE',accuracy:0,pp:30,priority:0},
 SUPERPOWER:{name:'Surpuissance',originalEffect:'SUPERPOWER',effect:'superpower',target:'enemy',category:'physical',type:'FIGHTING',power:120,accuracy:100,pp:5,priority:0},
 OVERHEAT:{name:'Surchauffe',originalEffect:'OVERHEAT',effect:'damage',target:'enemy',category:'special',type:'FIRE',power:140,accuracy:100,pp:5,priority:0},
 CRUNCH:{name:'Mâchouille',originalEffect:'SPECIAL_DEFENSE_DOWN_HIT',effect:'damage',target:'enemy',category:'physical',type:'DARK',power:80,accuracy:100,secondaryChance:20,pp:15,priority:0},
 STRUGGLE:{name:'Lutte',originalEffect:'HIT',effect:'damage',target:'enemy',category:'physical',type:'NORMAL',power:50,accuracy:100,pp:0,priority:0}
};
function setup(playerMove,opts={}){
 const mk=(id,owner,move,ability='NONE')=>({id,name:id,owner,active:true,level:50,hp:500,maxHp:500,species:'TEST',stats:{atk:100,def:100,spa:100,spd:100,spe:100},stages:stages(),
  ability,item:'NONE',status:'',moves:[move],pp:{[move]:moves[move].pp},receivedDamage:{},substitute:0,protectCount:0,guarded:false,choiceLock:'',flinched:false,toxic:0,sleep:0});
 const player=mk('p','human',playerMove,opts.playerAbility);
 const enemy=mk('e','cpu','GROWL',opts.enemyAbility);
 const e=Object.create(TowerEngine.prototype);
 e.data={moveData:moves,species:{TEST:{types:['NORMAL']}}};
 e.player={party:[player],active:['p']};e.opponent={party:[enemy],active:['e']};
 e.status='active';e.mode='single';e.levelMode='50';e.round=1;e.series=1;e.streak=0;e.turn=0;e.weather='';e.weatherTurns=0;e.hazards={player:0,opponent:0};e.log=[];e.pendingReplacements=[];e.score=0;e.trainer='Test';
 e.rng=opts.rng||(()=>.5);e.aiAction=()=>({actor:'e',type:'pass'});
 e.damagePreview=()=>({damage:20,mult:1}); // Deterministic damage, but real turn ordering/validation/effects.
 return {e,player,enemy};
}
const play=(ctx,move,target='e')=>ctx.e.turnActions([{actor:'p',type:'move',move,target}]);
test('A real turn uses Swords Dance +2, consumes one PP, logs the stage, and preserves HP',()=>{
 const c=setup('SWORDS_DANCE');play(c,'SWORDS_DANCE');
 assert.equal(c.player.stages.atk,2);assert.equal(c.player.pp.SWORDS_DANCE,19);assert.equal(c.enemy.hp,500);
 assert.ok(c.e.log.some(x=>x.kind==='stat'&&x.stat==='atk'&&x.to===2));
});
test('A real turn applies both Calm Mind and Dragon Dance stat changes',()=>{
 for(const [move,expected] of [['CALM_MIND',{spa:1,spd:1}],['DRAGON_DANCE',{atk:1,spe:1}]]){
  const c=setup(move);play(c,move);
  for(const [stat,value] of Object.entries(expected))assert.equal(c.player.stages[stat],value,move+':'+stat);
  assert.equal(c.e.turn,1);
 }
});
test('Opponent stat reduction is blocked by Clear Body, while self increases are allowed',()=>{
 const blocked=setup('SCREECH',{enemyAbility:'CLEAR_BODY'});play(blocked,'SCREECH');
 assert.equal(blocked.enemy.stages.def,0);
 const normal=setup('SCREECH');play(normal,'SCREECH');assert.equal(normal.enemy.stages.def,-2);
});
test('A real turn changes both stats after a successful Superpower hit',()=>{
 const c=setup('SUPERPOWER');play(c,'SUPERPOWER');
 assert.equal(c.player.stages.atk,-1);assert.equal(c.player.stages.def,-1);
 assert.equal(c.enemy.hp,480);
});
test('A real turn lowers special attack two stages after Overheat',()=>{
 const c=setup('OVERHEAT');play(c,'OVERHEAT');
 assert.equal(c.player.stages.spa,-2);
 assert.equal(c.enemy.hp,480);
});
test('A real turn never grants secondary stat drops when the proc misses',()=>{
 const c=setup('CRUNCH',{rng:()=>.5});play(c,'CRUNCH');
 assert.equal(c.enemy.stages.spd,0);
});
test('A real turn applies secondary drops when the proc succeeds',()=>{
 const c=setup('CRUNCH',{rng:()=>0});play(c,'CRUNCH');
 assert.equal(c.enemy.stages.spd,-1);
});
test('Pressure consumes two PP on targeted moves and never modifies Struggle PP',()=>{
 const targeted=setup('SCREECH',{enemyAbility:'PRESSURE'});play(targeted,'SCREECH');
 assert.equal(targeted.player.pp.SCREECH,38);
 const desperate=setup('STRUGGLE',{enemyAbility:'PRESSURE'});
 desperate.player.pp.STRUGGLE=0;
 play(desperate,'STRUGGLE');
 assert.equal(desperate.player.pp.STRUGGLE,0);
 assert.ok(Number.isFinite(desperate.player.pp.STRUGGLE));
});
test('Status stat changes keep action logs and snapshot stage state in agreement',()=>{
 const c=setup('GROWL');play(c,'GROWL');
 assert.equal(c.enemy.stages.atk,-1);
 assert.equal(c.e.snapshot().opponent.party[0].stages.atk,-1);
 assert.equal(c.e.log.find(x=>x.kind==='stat'&&x.stat==='atk')?.to,-1);
});
