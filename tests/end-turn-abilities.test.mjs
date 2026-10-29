import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {STAT_KEYS} from '../web/battle-stats.mjs';
function scenario(ability='NONE',random=()=>.5){
 const mk=(id,talent)=>({id,name:id,owner:id==='p'?'human':'cpu',species:'MON',ability:talent,active:true,
  hp:160,maxHp:160,item:'NONE',status:'',sleep:0,toxic:0,stages:Object.fromEntries(STAT_KEYS.map(k=>[k,0]))});
 const p=mk('p',ability),o=mk('o','NONE');
 const e=Object.create(TowerEngine.prototype);
 e.data={species:{MON:{types:['NORMAL']}}};
 e.player={party:[p],active:['p']};e.opponent={party:[o],active:['o']};
 e.weather='';e.weatherTurns=0;e.log=[];e.turn=1;e.rng=random;
 e.write=(text,event={})=>e.log.push({text,...event});
 return {e,p,o};
}
test('Emerald Shed Skin cures poison before end-of-turn damage at 1/3 probability',()=>{
 const {e,p}=scenario('SHED_SKIN',()=>.2);
 p.status='poison';e.endOfTurn();
 assert.equal(p.status,'');assert.equal(p.hp,160);
 assert.ok(e.log.some(x=>x.text.includes('Mue')));
});
test('Shed Skin does not activate above one-third and poison causes residual damage',()=>{
 const {e,p}=scenario('SHED_SKIN',()=>.5);
 p.status='poison';e.endOfTurn();
 assert.equal(p.status,'poison');assert.equal(p.hp,140);
});
test('Shed Skin also cures toxic, sleep and paralysis, resetting toxic counter',()=>{
 for(const ailment of ['toxic','sleep','paralyze','burn','freeze']){
  const {e,p}=scenario('SHED_SKIN',()=>0);
  p.status=ailment;p.toxic=4;p.sleep=3;
  e.endOfTurn();assert.equal(p.status,'',ailment);
  assert.equal(p.sleep,0);assert.equal(p.toxic,0);
 }
});
test('Speed Boost raises Speed every turn without exceeding +6',()=>{
 const {e,p}=scenario('SPEED_BOOST');
 e.turn=1;p.enteredTurn=undefined;
 for(let t=1;t<=8;t++){e.turn=t;e.endOfTurn();}
 assert.equal(p.stages.spe,6);
});
test('Speed Boost never activates on the turn of a switch-in',()=>{
 const {e,p}=scenario('SPEED_BOOST');
 e.turn=5;p.enteredTurn=5;
 e.endOfTurn();assert.equal(p.stages.spe,0);
 e.turn=6;e.endOfTurn();assert.equal(p.stages.spe,1);
});
