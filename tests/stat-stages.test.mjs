import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {STAT_KEYS,applyStage,effectiveStat,accuracyChance,stageRatio} from '../web/battle-stats.mjs';
import {statChanges} from '../web/battle-ui.mjs';

const mon=(id,extra={})=>({id,name:id,hp:100,maxHp:100,stats:{atk:100,def:100,spa:100,spd:100,spe:100},stages:Object.fromEntries(STAT_KEYS.map(k=>[k,0])),ability:'NONE',item:'NONE',species:'A',status:'',...extra});
function scenario(){
 const a=mon('a'),b=mon('b');
 const e=Object.create(TowerEngine.prototype);
 e.player={party:[a],active:['a']};e.opponent={party:[b],active:['b']};
 e.log=[];e.weather='';e.write=(text,event={})=>e.log.push({text,...event});e.rng=()=>0;
 return {e,a,b};
}
test('All seven stage modifiers clamp at minus six and plus six',()=>{
 const {e,a}=scenario();
 for(const key of STAT_KEYS){assert.equal(e.modify(a,key,30),true);assert.equal(a.stages[key],6);assert.equal(e.modify(a,key,1),false);assert.equal(e.modify(a,key,-40),true);assert.equal(a.stages[key],-6);assert.equal(e.modify(a,key,-1),false);}
});
test('Attack, special attack, defenses and speed use standard Gen III stage ratios',()=>{
 assert.equal(applyStage(100,2),200);
 assert.equal(applyStage(100,-2),50);
 assert.equal(applyStage(100,6),400);
 assert.equal(applyStage(100,-6),25);
 const {e,a}=scenario();
 for(const key of ['atk','def','spa','spd','spe']){a.stages[key]=2;assert.equal(effectiveStat(e,a,key),200);a.stages[key]=-2;assert.equal(effectiveStat(e,a,key),50);a.stages[key]=0;}
});
test('Precision and evasion use the Emerald accuracy stage table',()=>{
 assert.deepEqual(stageRatio(-6,true),[33,100]);
 assert.deepEqual(stageRatio(0,true),[1,1]);
 assert.deepEqual(stageRatio(6,true),[3,1]);
 const {e,a,b}=scenario(),move={accuracy:60,originalEffect:'',category:'physical'};
 a.stages.acc=2;assert.equal(accuracyChance(e,a,b,move),99);
 a.stages.acc=0;b.stages.eva=2;assert.equal(accuracyChance(e,a,b,move),36);
});
test('Critical hits ignore attacker penalties and target bonuses, but not other stages',()=>{
 const {e,a,b}=scenario();
 a.stages.atk=-3;b.stages.def=3;
 assert.equal(effectiveStat(e,a,'atk',{critical:true}),100);
 assert.equal(effectiveStat(e,b,'def',{critical:true,defending:true}),100);
 a.stages.atk=2;b.stages.def=-2;
 assert.equal(effectiveStat(e,a,'atk',{critical:true}),200);
 assert.equal(effectiveStat(e,b,'def',{critical:true,defending:true}),50);
});
test('Intimidate-like external penalties honor Clear Body, Mist, Substitute and Hyper Cutter',()=>{
 const {e,a,b}=scenario();
 for(const ability of ['CLEAR_BODY','WHITE_SMOKE','HYPER_CUTTER']){b.ability=ability;assert.equal(e.modify(b,'atk',-1,a),false);assert.equal(b.stages.atk,0);}
 b.ability='NONE';b.substitute=10;assert.equal(e.modify(b,'atk',-1,a),false);b.substitute=0;
 e.mist={opponent:2};assert.equal(e.modify(b,'atk',-1,a),false);e.mist.opponent=0;
 assert.equal(e.modify(b,'atk',-1,a),true);assert.equal(b.stages.atk,-1);
 assert.equal(e.modify(b,'atk',-1,b),true);assert.equal(b.stages.atk,-2);
});
test('Stage changes are reflected in UI change badges',()=>{
 const {e,a}=scenario();e.modify(a,'spe',2);e.modify(a,'atk',-1);
 const changes=statChanges(a);
 assert.equal(changes.find(x=>x.key==='spe').multiplier,2);
 assert.equal(changes.find(x=>x.key==='atk').stage,-1);
});
test('Secondary stat drop probability is ten percent, not guaranteed',()=>{
 const {e,a,b}=scenario();
 const move={originalEffect:'SPECIAL_DEFENSE_DOWN_HIT',secondaryChance:10};
 e.rng=()=>.5;e.afterHit(a,b,move);assert.equal(b.stages.spd,0);
 e.rng=()=>0;e.afterHit(a,b,move);assert.equal(b.stages.spd,-1);
});
test('Serene Grace doubles secondary stat drop chance and Shield Dust blocks it',()=>{
 const {e,a,b}=scenario();
 const move={originalEffect:'DEFENSE_DOWN_HIT',secondaryChance:10};
 a.ability='SERENE_GRACE';e.rng=()=>15/65536;
 // RNG rolls are modulo 100 of integer [0, 65535].
 e.rng=()=>15/65536;e.afterHit(a,b,move);assert.equal(b.stages.def,-1);
 b.ability='SHIELD_DUST';e.rng=()=>0;e.afterHit(a,b,move);assert.equal(b.stages.def,-1);
});
