import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {STAT_KEYS} from '../web/battle-stats.mjs';

const moves={
 ABSORB:{name:'Vol-Vie',originalEffect:'ABSORB',effect:'drain',type:'GRASS',category:'special',target:'enemy',power:20,accuracy:100,pp:25,priority:0},
 LEECH_SEED:{name:'Vampigraine',originalEffect:'LEECH_SEED',effect:'seed',type:'GRASS',category:'status',target:'enemy',accuracy:100,pp:10,priority:0},
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

function seed(e,caster,target){e.execute(caster,{move:'LEECH_SEED',target:target.id});}
function absorb(e,caster,target){e.execute(caster,{move:'ABSORB',target:target.id});}
test('Duo: Leech Seed heals the caster position, even when it is slot 1',()=>{
 const {e,p,q,o}=setup({double:true});p.hp=q.hp=200;
 seed(e,q,o);e.endOfTurn();
 assert.equal(p.hp,200);assert.equal(q.hp,262);assert.equal(o.hp,438);
});
test('A second seed fails and cannot steal the original beneficiary',()=>{
 const {e,p,q,o}=setup({double:true});p.hp=q.hp=200;
 seed(e,q,o);seed(e,p,o);e.endOfTurn();
 assert.equal(p.hp,200);assert.equal(q.hp,262);
 assert.ok(e.log.some(x=>x.text==='Vampigraine échoue.'));
});
test('Grass and Substitute prevent seeding; existing seeds bypass Substitute',()=>{
 const {e,p,o}=setup();o.substitute=50;seed(e,p,o);assert.ok(!o.seeded);
 o.substitute=0;e.data.species.TEST.types=['GRASS'];seed(e,p,o);assert.ok(!o.seeded);
 e.data.species.TEST.types=['NORMAL'];seed(e,p,o);o.substitute=50;p.hp=200;
 e.endOfTurn();assert.equal(o.hp,438);assert.equal(o.substitute,50);assert.equal(p.hp,262);
});
test('A caster switch sends the recovery to its replacement',()=>{
 const {e,p,q,o}=setup();q.active=false;q.hp=200;seed(e,p,o);
 e.switchMon(p,q.id);e.endOfTurn();assert.equal(q.hp,262);
});
test('A fainted or vacant caster slot suspends damage without healing its partner',()=>{
 for(const vacant of [false,true]){
  const {e,p,q,o}=setup({double:true});seed(e,q,o);q.hp=0;p.hp=200;
  if(vacant)e.player.active[1]=null;
  e.endOfTurn();assert.equal(o.hp,500);assert.equal(p.hp,200);
 }
});
test('Ordinary switch clears seeds; Baton Pass preserves seed position',()=>{
 for(const carry of [false,true]){
  const {e,p,o,r}=setup();r.active=false;p.hp=200;seed(e,p,o);
  e.switchMon(o,r.id,carry);e.endOfTurn();
  assert.equal(r.hp,carry?438:500);assert.equal(p.hp,carry?262:200);
  assert.ok(!o.seeded);assert.ok(!o.seedSource);
 }
});
test('Seeds heal only actual damage and resolve before poison',()=>{
 const {e,p,o}=setup();p.hp=200;o.hp=3;o.status='poison';seed(e,p,o);
 e.endOfTurn();assert.equal(o.hp,0);assert.equal(p.hp,203);
});
test('Liquid Ooze reverses Leech Seed, including a lethal final drain',()=>{
 const {e,p,o}=setup({foeAbility:'LIQUID_OOZE'});p.hp=2;o.hp=3;seed(e,p,o);
 e.endOfTurn();assert.equal(o.hp,0);assert.equal(p.hp,0);
 assert.ok(e.log.some(x=>x.text.includes('Suintement')));
});
test('Saved seed slot survives JSON roundtrip; legacy boolean saves remain usable',()=>{
 const {e,p,q,o}=setup({double:true});p.hp=q.hp=200;seed(e,q,o);
 e.player=JSON.parse(JSON.stringify(e.player));e.opponent=JSON.parse(JSON.stringify(e.opponent));
 e.endOfTurn();assert.equal(e.get('q').hp,262);assert.equal(e.get('p').hp,200);
 const old=setup();old.o.seeded=true;old.p.hp=200;old.e.endOfTurn();assert.equal(old.p.hp,262);
});
test('Absorb recovers half actual damage, rounded down, minimum one HP',()=>{
 for(const [hp,heal] of [[500,7],[3,1],[1,1]]){
  const {e,p,o}=setup();p.hp=200;o.hp=hp;absorb(e,p,o);
  assert.equal(p.hp,200+heal);
 }
});
test('Absorb and Liquid Ooze use damage to Substitute without damaging target HP',()=>{
 for(const ability of ['NONE','LIQUID_OOZE']){
  const {e,p,o}=setup({foeAbility:ability});p.hp=200;o.substitute=3;
  absorb(e,p,o);assert.equal(o.hp,500);assert.equal(o.substitute,0);
  assert.equal(p.hp,ability==='NONE'?201:199);
 }
});
test('Liquid Ooze reverses Absorb even at full HP and when target faints',()=>{
 const {e,p,o}=setup({foeAbility:'LIQUID_OOZE'});o.hp=3;
 absorb(e,p,o);assert.equal(p.hp,499);assert.equal(o.hp,0);
});
test('Protected and immune targets do not trigger drain recovery',()=>{
 for(const blocked of ['protect','immune']){
  const {e,p,o}=setup({foeAbility:'LIQUID_OOZE'});p.hp=200;
  if(blocked==='protect')o.guarded=true;
  else e.damagePreview=()=>({damage:15,mult:0});
  absorb(e,p,o);assert.equal(p.hp,200);assert.equal(o.hp,500);
 }
});

test('Shell Bell cannot revive a Pokémon knocked out by Liquid Ooze',()=>{
 const {e,p,o}=setup({foeAbility:'LIQUID_OOZE'});p.hp=1;p.item='SHELL_BELL';
 absorb(e,p,o);assert.equal(p.hp,0);
});
