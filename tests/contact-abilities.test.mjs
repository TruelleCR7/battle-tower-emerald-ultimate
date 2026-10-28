import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
const make=(id,ability='NONE',types=['NORMAL'])=>({id,name:id,ability,species:id,hp:160,maxHp:160,status:'',item:'NONE',active:true,stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}});
function battle(ability='NONE',rng=()=>0){
 const p=make('p'),o=make('o',ability);const e=Object.create(TowerEngine.prototype);
 e.player={party:[p],active:['p']};e.opponent={party:[o],active:['o']};
 e.data={species:{p:{types:['NORMAL']},o:{types:['NORMAL']}}};e.log=[];e.rng=rng;
 e.write=(text,event={})=>e.log.push({text,...event});return {e,p,o};
}
test('Rough Skin damages physical contact but not non-contact ranged moves',()=>{
 const {e,p,o}=battle('ROUGH_SKIN');
 e.contactEffects(p,o,'TACKLE',{category:'physical',makesContact:true});
 assert.equal(p.hp,150);
 e.contactEffects(p,o,'EARTHQUAKE',{category:'physical',makesContact:false});
 assert.equal(p.hp,150);
});
test('Static, Poison Point and Flame Body activate on contact only',()=>{
 for(const [ability,status] of [['STATIC','paralyze'],['POISON_POINT','poison'],['FLAME_BODY','burn']]){
  const {e,p,o}=battle(ability,()=>0);
  e.contactEffects(p,o,'TACKLE',{makesContact:true});
  assert.equal(p.status,status,ability);
  p.status='';
  e.contactEffects(p,o,'SURF',{category:'special',makesContact:false});
  assert.equal(p.status,'',ability);
 }
});
test('Contact chance of thirty percent respects deterministic rolls',()=>{
 const {e,p,o}=battle('STATIC',()=>.5);
 e.contactEffects(p,o,'TACKLE',{makesContact:true});assert.equal(p.status,'');
 e.rng=()=>.2;e.contactEffects(p,o,'TACKLE',{makesContact:true});assert.equal(p.status,'paralyze');
});
test('Effect Spore applies one of three possible statuses',()=>{
 for(const [roll,status] of [[0,'poison'],[.4,'paralyze'],[.8,'sleep']]){
  let n=0;const {e,p,o}=battle('EFFECT_SPORE',()=>n++===0?0:roll);
  e.contactEffects(p,o,'TACKLE',{makesContact:true});
  assert.equal(p.status,status);
 }
});
test('Defensive contact abilities do not activate through immunity or from teammates',()=>{
 const {e,p,o}=battle('STATIC');
 e.contactEffects(p,o,'SURF',{contact:false});assert.equal(p.status,'');
 e.player.party.push(o);e.opponent.party=[];e.opponent.active=[];
 e.contactEffects(p,o,'TACKLE',{makesContact:true});
 assert.equal(p.status,'');
});
test('Fire-type Pokémon cannot be burned by Flame Body',()=>{
 const {e,p,o}=battle('FLAME_BODY');e.data.species.p.types=['FIRE'];
 e.contactEffects(p,o,'TACKLE',{makesContact:true});
 assert.equal(p.status,'');
});
