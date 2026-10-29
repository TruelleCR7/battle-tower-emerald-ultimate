import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {rawEffectiveStat} from '../web/battle-stats.mjs';
const data={species:{TEST:{types:['NORMAL']}},moveData:{
 HYPER_BEAM:{name:'Ultralaser',category:'special',type:'NORMAL',power:150,accuracy:90,pp:5,priority:0,target:'enemy',originalEffect:'HIT',effect:'recharge'},
 TACKLE:{name:'Charge',category:'physical',type:'NORMAL',power:40,accuracy:100,pp:35,priority:0,target:'enemy',originalEffect:'HIT',effect:'damage'}
}};
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0});
function mon(id,owner,ability='NONE'){return {id,name:id,owner,ability,species:'TEST',item:'NONE',level:50,
 hp:500,maxHp:500,active:true,moves:['HYPER_BEAM','TACKLE'],pp:{HYPER_BEAM:5,TACKLE:35},
 stats:{atk:100,def:100,spa:100,spd:100,spe:100},stages:stages(),status:'',receivedDamage:{},guarded:false,substitute:0,protectCount:0,choiceLock:''};}
function setup({mode='single',rng=()=>.5}={}){
 const p=mon('p','human'),q=mon('q','human'),e=mon('e','cpu'),r=mon('r','cpu');
 const eng=Object.create(TowerEngine.prototype);eng.data=data;eng.mode=mode;eng.status='active';eng.levelMode='50';
 eng.round=1;eng.series=1;eng.streak=0;eng.turn=0;eng.weather='';eng.weatherTurns=0;
 eng.hazards={player:0,opponent:0};eng.log=[];eng.pendingReplacements=[];eng.rng=rng;eng.trainer='Test';
 eng.player={party:[p,q],active:mode==='double'?['p','q']:['p']};
 eng.opponent={party:[e,r],active:mode==='double'?['e','r']:['e']};
 eng.aiAction=()=>({actor:'e',type:'pass'});eng.damagePreview=()=>({damage:40,mult:1});
 return {eng,p,q,e,r};
}
test('Plus/Minus only boost special attack with opposite ability on an active ally',()=>{
 const {eng,p,q,e}=setup({mode:'double'});
 p.ability='PLUS';q.ability='MINUS';e.ability='MINUS';
 assert.equal(rawEffectiveStat(eng,p,'spa'),150);
 q.ability='NONE';
 assert.equal(rawEffectiveStat(eng,p,'spa'),100,'enemy Minus must not activate player Plus');
 q.ability='MINUS';q.active=false;eng.player.active=['p',null];
 assert.equal(rawEffectiveStat(eng,p,'spa'),100,'bench partner must not activate Plus');
});
test('Plus/Minus are never activated by an opponent in Singles',()=>{
 const {eng,p,e}=setup();
 p.ability='PLUS';e.ability='MINUS';
 assert.equal(rawEffectiveStat(eng,p,'spa'),100);
 assert.equal(rawEffectiveStat(eng,e,'spa'),100);
});
test('Hyper Beam hits and requires recharging on the next turn',()=>{
 const {eng,p,e}=setup();
 eng.turnActions([{actor:'p',type:'move',move:'HYPER_BEAM',target:'e'}]);
 assert.equal(p.recharge,1);
 const pp=p.pp.HYPER_BEAM;
 eng.turnActions([{actor:'p',type:'move',move:'TACKLE',target:'e'}]);
 assert.equal(p.recharge,0);
 assert.equal(p.pp.HYPER_BEAM,pp);
 assert.equal(p.pp.TACKLE,35);
 assert.ok(eng.log.some(x=>x.text.includes('doit se recharger')));
});
test('Hyper Beam miss never causes recharge',()=>{
 const {eng,p}=setup({rng:()=>99/65536});
 eng.turnActions([{actor:'p',type:'move',move:'HYPER_BEAM',target:'e'}]);
 assert.equal(p.recharge||0,0);
 assert.equal(p.pp.HYPER_BEAM,4);
});
test('Hyper Beam hitting Protect or an immune target never causes recharge',()=>{
 const {eng,p,e}=setup();
 e.guarded=true;eng.execute(p,{type:'move',move:'HYPER_BEAM',target:'e'});
 assert.equal(p.recharge||0,0);
 const next=setup();next.eng.damagePreview=()=>({damage:0,mult:0});
 next.eng.execute(next.p,{type:'move',move:'HYPER_BEAM',target:'e'});
 assert.equal(next.p.recharge||0,0);
});
