import test from 'node:test';
import assert from 'node:assert/strict';
import {createPikeBattle,repairPikeBattle} from '../web/pike-battle.mjs';
import {TowerEngine,makeMon} from '../web/engine.mjs';
import {readFileSync} from 'node:fs';
const data={
 species:{A:{stats:[100,100,100,100,100,100],types:['NORMAL'],abilities:['NONE']},B:{stats:[100,100,100,100,100,100],types:['NORMAL'],abilities:['NONE']}},
 speciesNames:{A:'Alpha',B:'Beta'},
 moveData:{TACKLE:{name:'Charge',type:'NORMAL',category:'physical',power:35,accuracy:100,pp:35,target:'enemy',originalEffect:'HIT',effect:'damage',priority:0}},
 aiScript:{blocks:{AI_CheckBadMove:[]}}
};
const set=species=>({species,level:50,ability:'NONE',nature:'HARDY',item:'NONE',moves:['TACKLE'],ivs:[31,31,31,31,31,31],evs:[0,0,0,0,0,0]});
const sets=[set('A'),set('B'),set('A')];
const party=()=>sets.map(p=>makeMon(p,data,'human',50));
const battle=(mons,mode='single')=>createPikeBattle(data,{sets,party:mons,opponents:[set('B'),set('A'),set('B')],mode,levelMode:'50',trainer:'Dresseur du Reptile',seed:42});
test('Pike picks a healthy lead instead of KO first or second party slots',()=>{
 const p=party();p[0].hp=0;p[1].hp=0;
 const e=battle(p);
 assert.equal(e.player.active[0],p[2].id);
 assert.equal(e.active('player').length,1);
 assert.equal(e.player.party[0].hp,0);
 assert.equal(e.player.party[1].hp,0);
 assert.equal(e.player.party[2].hp,e.player.party[2].maxHp);
 assert.equal(e.trainer,'Dresseur du Reptile');
 assert.ok(e.log.every(line=>!line.text.includes('Laboratoire')));
});
test('Pike CPU trainer uses normal opponent ownership and non-manual AI',()=>{
 const e=battle(party());
 assert.ok(e.opponent.party.every(p=>p.owner==='cpu'));
 assert.equal(e.opponent.party[0].active,true);
 assert.equal(e.player.party[0].owner,'human');
 assert.equal(e.aiAction,TowerEngine.prototype.aiAction);
 assert.ok(e.data.aiScript);
});
test('Duo room is playable with one survivor and does not lock the user',()=>{
 const p=party();p[0].hp=0;p[1].hp=0;
 const e=battle(p,'double');
 assert.equal(e.mode,'single');
 assert.equal(e.active('player').length,1);
 assert.equal(e.active('opponent').length,1);
});
test('Duo room uses two healthy starters when available, skipping the KO lead',()=>{
 const p=party();p[0].hp=0;
 const e=battle(p,'double');
 assert.equal(e.mode,'double');
 assert.deepEqual(e.player.active,[p[1].id,p[2].id]);
 assert.equal(e.active('player').length,2);
});
test('All KO challengers fail loudly instead of producing an empty, unplayable battle',()=>{
 const p=party();p.forEach(m=>m.hp=0);
 assert.throws(()=>battle(p),/Tous les Pokémon sont K.O./);
});
test('Old Pike saves with active KO lead are repaired without discarding progress',()=>{
 const p=party();p[0].hp=0;
 const e=battle(p);const second=e.player.party[1];
 second.active=false;
 e.player.active=[e.player.party[0].id];e.player.party[0].active=true;
 assert.equal(e.active('player').length,0);
 assert.equal(repairPikeBattle(e),true);
 assert.equal(e.player.active[0],second.id);
 assert.equal(e.active('player').length,1);
 assert.equal(e.player.party[0].hp,0);
});
test('Saved legacy laboratory opponent ownership is turned back into CPU AI',()=>{
 const e=battle(party());e.opponent.party.forEach(p=>p.owner='human2');
 repairPikeBattle(e);
 assert.ok(e.opponent.party.every(p=>p.owner==='cpu'));
});
test('Pike interface renders red framed K.O. badges, not normal status',()=>{
 const ui=readFileSync(new URL('../web/pike-ui.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/pike.css',import.meta.url),'utf8');
 assert.match(ui,/const ko=p.hp<=0/);
 assert.match(ui,/pike-ko-badge/);
 assert.match(css,/\.pike-mon-ko\{border-color:#b53c45/);
 assert.match(ui,/repairPikeBattle\(battle\)/);
 assert.doesNotMatch(ui,/createLabBattle/);
});
