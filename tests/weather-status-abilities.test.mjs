import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';

function scenario({weather='',playerAbility='NONE',enemyAbility='NONE'}={}){
 const mon=(id,ability)=>({id,name:id,active:true,owner:id==='p'?'human':'cpu',species:'NORMALMON',ability,
  item:'NONE',status:'',hp:160,maxHp:160,sleep:0,toxic:0,stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}});
 const p=mon('p',playerAbility),e=mon('e',enemyAbility);
 const engine=Object.create(TowerEngine.prototype);
 engine.player={party:[p],active:['p']};engine.opponent={party:[e],active:['e']};
 engine.data={species:{NORMALMON:{types:['NORMAL']}}};
 engine.weather=weather;engine.weatherTurns=-1;engine.log=[];engine.rng=()=>.5;
 engine.write=(text,event={})=>engine.log.push({text,...event});
 engine.heal=TowerEngine.prototype.heal;engine.hpLoss=TowerEngine.prototype.hpLoss;
 return {engine,p,e};
}
test('Cloud Nine prevents sandstorm chip damage for both active Pokémon',()=>{
 const c=scenario({weather:'sand',playerAbility:'CLOUD_NINE'});
 c.engine.endOfTurn();
 assert.equal(c.p.hp,160);assert.equal(c.e.hp,160);
});
test('Air Lock prevents hail chip damage, but weather remains displayed',()=>{
 const c=scenario({weather:'hail',enemyAbility:'AIR_LOCK'});
 c.engine.endOfTurn();
 assert.equal(c.p.hp,160);assert.equal(c.e.hp,160);assert.equal(c.engine.weather,'hail');
});
test('Weather chip damage resumes without suppression, while immune weather types are protected',()=>{
 const c=scenario({weather:'sand'});
 c.engine.endOfTurn();assert.equal(c.p.hp,150);assert.equal(c.e.hp,150);
 c.p.ability='CLOUD_NINE';c.engine.endOfTurn();
 assert.equal(c.p.hp,150);assert.equal(c.e.hp,150);
});
test('Rain Dish only restores HP when rain is not suppressed',()=>{
 const c=scenario({weather:'rain',playerAbility:'RAIN_DISH',enemyAbility:'AIR_LOCK'});
 c.p.hp=90;c.engine.endOfTurn();assert.equal(c.p.hp,90);
 c.e.ability='NONE';c.engine.endOfTurn();assert.equal(c.p.hp,100);
});
test('Gen III immunity abilities prevent major status conditions',()=>{
 const cases=[['WATER_VEIL','burn'],['VITAL_SPIRIT','sleep'],['INSOMNIA','sleep'],
  ['IMMUNITY','poison'],['IMMUNITY','toxic'],['MAGMA_ARMOR','freeze'],['LIMBER','paralyze']];
 for(const [ability,status] of cases){
  const {engine,p}=scenario({playerAbility:ability});
  assert.equal(engine.inflict(p,status),false,ability+' '+status);
  assert.equal(p.status,'');
 }
});
test('Major statuses are still inflicted on unprotected targets',()=>{
 for(const status of ['burn','sleep','poison','toxic','freeze','paralyze']){
  const {engine,p}=scenario();
  assert.equal(engine.inflict(p,status),true,status);
  assert.equal(p.status,status);
 }
});
