import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {STAT_KEYS} from '../web/battle-stats.mjs';

const moves={
 SAFEGUARD:{name:'Rune Protect',originalEffect:'SAFEGUARD',effect:'safeguard',type:'NORMAL',category:'status',target:'self',accuracy:0,pp:25,priority:0},
 SPORE:{name:'Spore',originalEffect:'SLEEP',effect:'sleep',type:'GRASS',category:'status',target:'enemy',accuracy:100,pp:15,priority:0},
 TOXIC:{name:'Toxic',originalEffect:'TOXIC',effect:'toxic',type:'POISON',category:'status',target:'enemy',accuracy:100,pp:10,priority:0},
 TACKLE:{name:'Charge',originalEffect:'HIT',effect:'damage',type:'NORMAL',category:'physical',target:'enemy',power:40,accuracy:100,pp:35,priority:0},
 BITE:{name:'Morsure',originalEffect:'FLINCH_HIT',secondaryChance:100,effect:'damage',type:'DARK',category:'physical',target:'enemy',power:60,accuracy:100,pp:25,priority:0}
};
function setup({double=false,foeAbility='NONE',playerAbility='NONE'}={}){
 const make=(id,owner,ability)=>({id,name:id,species:'TEST',owner,ability,item:'NONE',level:50,active:true,
 hp:500,maxHp:500,status:'',sleep:0,toxic:0,moves:Object.keys(moves),pp:Object.fromEntries(Object.keys(moves).map(k=>[k,moves[k].pp])),
 stats:{atk:100,def:100,spa:100,spd:100,spe:100},stages:Object.fromEntries(STAT_KEYS.map(k=>[k,0])),receivedDamage:{},protectCount:0,guarded:false,choiceLock:'',substitute:0});
 const p=make('p','human',playerAbility),q=make('q','human','NONE'),o=make('o','cpu',foeAbility),r=make('r','cpu','NONE');
 const e=Object.create(TowerEngine.prototype);e.player={party:[p,q],active:double?['p','q']:['p']};
 e.opponent={party:[o,r],active:double?['o','r']:['o']};
 e.data={species:{TEST:{types:['NORMAL']}},moveData:moves};e.status='active';e.mode=double?'double':'single';
 e.levelMode='50';e.round=1;e.series=1;e.streak=0;e.turn=0;e.weather='';e.weatherTurns=0;
 e.hazards={player:0,opponent:0};e.log=[];e.pendingReplacements=[];e.score=0;e.trainer='Test';
 e.rng=()=>.5;e.damagePreview=()=>({damage:15,mult:1});
 e.aiAction=mon=>({actor:mon.id,type:'pass'});
 return {e,p,q,o,r};
}
test('Safeguard prevents enemy sleep and toxic during a full battle turn',()=>{
 const {e,p,o}=setup();e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'}]);
 assert.equal(e.safeguards.player,4);
 // Use targetStatus directly as a CPU-initiated move, with real source attribution.
 e.targetStatus(o,p,moves.SPORE);assert.equal(p.status,'');
 e.targetStatus(o,p,moves.TOXIC);assert.equal(p.status,'');
 assert.ok(e.log.some(x=>x.text.includes('Rune Protect protège p')));
});
test('Safeguard protects a partner in a double battle',()=>{
 const {e,p,q,o}=setup({double:true});
 e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'},{actor:'q',type:'move',move:'TACKLE',target:'o'}]);
 assert.equal(e.safeguards.player,4);
 e.targetStatus(o,q,moves.SPORE);assert.equal(q.status,'');
});
test('Safeguard expires after five complete turns and then allows status',()=>{
 const {e,p,o}=setup();
 e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'}]);
 for(let i=0;i<4;i++)e.turnActions([{actor:'p',type:'move',move:'TACKLE',target:'o'}]);
 assert.equal(e.safeguards.player,0);
 e.targetStatus(o,p,moves.SPORE);assert.equal(p.status,'sleep');
});
test('Safeguard cannot be stacked or refreshed before it expires',()=>{
 const {e,p}=setup();
 e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'}]);
 e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'}]);
 assert.equal(e.safeguards.player,3);
 assert.ok(e.log.some(x=>x.text.includes('déjà actif')));
});
test('Safeguard does not block a previously inflicted status',()=>{
 const {e,p,o}=setup();
 p.status='burn';e.turnActions([{actor:'p',type:'move',move:'SAFEGUARD'}]);
 assert.equal(p.status,'burn');
});
test('Inner Focus prevents secondary flinch, unlike an ordinary target',()=>{
 for(const [ability,expected] of [['INNER_FOCUS',false],['NONE',true]]){
  const {e,p,o}=setup({foeAbility:ability});
  e.afterHit(p,o,moves.BITE);
  assert.equal(Boolean(o.flinched),expected,ability);
 }
});
test('Safeguard effects are captured in battle snapshots',()=>{
 const {e}=setup();
 e.safeguards={player:3,opponent:1};
 assert.deepEqual(e.snapshot().safeguards,{player:3,opponent:1});
});
