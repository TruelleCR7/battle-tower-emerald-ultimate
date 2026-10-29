import test from 'node:test';
import assert from 'node:assert/strict';
import {createPikeBattle,repairPikeBattle,resetPikePartyForBattle} from '../web/pike-battle.mjs';
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

test('Restoring a Pike battle removes stale Laboratory introductions',()=>{
 const e=battle(party());
 e.log.unshift({turn:0,text:'Laboratoire : les deux équipes sont sous ton contrôle.'});
 assert.equal(repairPikeBattle(e),true);
 assert.ok(e.log.every(x=>!x.text.includes('Laboratoire')));
});
test('The surviving third Pokémon can complete a real combat turn',()=>{
 const p=party();p[0].hp=0;p[1].hp=0;
 const e=battle(p),lead=e.active('player')[0],enemy=e.active('opponent')[0];
 // The real engine resolves the full turn. Keep the CPU decision deterministic in
 // this test; the production Pike uses TowerEngine.prototype.aiAction.
 e.aiAction=m=>({actor:m.id,type:'move',move:'TACKLE',target:lead.id});
 assert.doesNotThrow(()=>e.turnActions([{actor:lead.id,type:'move',move:'TACKLE',target:enemy.id}]));
 assert.equal(e.turn,1);
 assert.ok(e.log.some(x=>x.text.includes('utilise Charge')));
 assert.ok(e.player.party.slice(0,2).every(x=>x.hp===0));
});

test('Choice Band locks only the current fight; a new Pike battle offers all remaining-PP moves',()=>{
 const original=party(),metagross=original[0];
 metagross.item='CHOICE_BAND';
 metagross.moves=['TACKLE','SWORDS_DANCE'];
 metagross.pp.SWORDS_DANCE=9;
 metagross.pp.TACKLE=20;
 metagross.choiceLock='TACKLE';
 metagross.lastMove='TACKLE';
 metagross.hp=Math.max(1,metagross.maxHp-47);
 metagross.status='paralyze';
 metagross.stages.atk=4;
 metagross.protectCount=2;
 metagross.substitute=27;
 metagross.charging={move:'TACKLE',kind:'fly',target:'someone'};
 metagross.seeded=true;
 const opponentSet=set('B');
 const e=createPikeBattle(data,{
  sets:[{...sets[0],item:'CHOICE_BAND',moves:['TACKLE','SWORDS_DANCE']},sets[1],sets[2]],
  party:original,opponents:[opponentSet],mode:'single',levelMode:'50',trainer:'Nouvelle salle'
 });
 const next=e.player.party[0];
 assert.equal(next.item,'CHOICE_BAND');
 assert.equal(next.choiceLock,'');
 assert.equal(next.lastMove,'');
 assert.equal(next.stages.atk,0);
 assert.equal(next.protectCount,0);
 assert.equal(next.substitute,0);
 assert.equal(next.charging,undefined);
 assert.equal(next.seeded,false);
 assert.equal(next.hp,metagross.hp);
 assert.equal(next.status,'paralyze');
 assert.equal(next.pp.TACKLE,20);
 assert.equal(next.pp.SWORDS_DANCE,9);
 assert.deepEqual(next.moves,['TACKLE','SWORDS_DANCE']);
 assert.equal(next.id,metagross.id);
});
test('Entering a fresh room resets temporary effects for all three party members',()=>{
 const old=party();
 for(const p of old){p.choiceLock='TACKLE';p.stages.def=-3;p.flinched=true;p.confused=3;p.recharge=1;p.focusEnergy=1;}
 old[1].hp=0;old[2].status='sleep';old[2].sleep=2;
 const clean=resetPikePartyForBattle(data,sets,old);
 assert.ok(clean.every(p=>p.choiceLock===''&&p.stages.def===0&&!p.flinched&&p.recharge===0&&p.confused===undefined));
 assert.equal(clean[1].hp,0);
 assert.equal(clean[2].status,'sleep');
 assert.equal(clean[2].sleep,2);
 assert.deepEqual(clean.map(p=>p.id),old.map(p=>p.id));
});
test('Choice Band lock still functions inside the same battle',()=>{
 const setBand={...sets[0],item:'CHOICE_BAND',moves:['TACKLE']};
 const e=createPikeBattle(data,{sets:[setBand,sets[1],sets[2]],party:[makeMon(setBand,data,'human',50),...party().slice(1)],
  opponents:[set('B')],mode:'single',levelMode:'50',trainer:'Dresseur'});
 const p=e.active('player')[0],enemy=e.active('opponent')[0];
 e.aiAction=mon=>({actor:mon.id,type:'move',move:'TACKLE',target:p.id});
 e.turnActions([{actor:p.id,type:'move',move:'TACKLE',target:enemy.id}]);
 assert.equal(p.choiceLock,'TACKLE');
});
