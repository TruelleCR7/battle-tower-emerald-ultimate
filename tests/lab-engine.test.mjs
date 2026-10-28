import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabBattle,labRequiredActions,playLabTurn,labReplacements,labReplace} from '../web/lab-engine.mjs';
import {readFileSync} from 'node:fs';

const moves={
 HIT:{name:'Frappe',category:'physical',type:'NORMAL',power:35,accuracy:100,pp:35,priority:0,target:'enemy',originalEffect:'HIT',effect:'damage'},
 BOOST:{name:'Boost',category:'status',type:'NORMAL',power:0,accuracy:0,pp:20,priority:0,target:'self',originalEffect:'ATTACK_UP_2',effect:'swords'},
 GROWL:{name:'Rugissement',category:'status',type:'NORMAL',power:0,accuracy:100,pp:40,priority:0,target:'enemy',originalEffect:'ATTACK_DOWN',effect:'stat'}
};
const data={species:{A:{stats:[110,100,100,100,100,100],types:['NORMAL'],abilities:['NONE']},B:{stats:[110,100,100,100,100,100],types:['NORMAL'],abilities:['NONE']},C:{stats:[110,100,100,100,100,100],types:['NORMAL'],abilities:['NONE']}},
 speciesNames:{A:'Alpha',B:'Beta',C:'Gamma'},moveData:moves};
const set=(species,mv='BOOST')=>({species,level:50,ability:'NONE',nature:'HARDY',item:'NONE',moves:[mv,'HIT','GROWL'],evs:[0,0,0,0,0,0],ivs:[31,31,31,31,31,31]});
function lab(mode='single'){return createLabBattle(data,{mode,player:[set('A'),set('C')],opponent:[set('B'),set('A')],seed:45});}
test('Lab initializes all Pokémon from the actual battle engine and keeps independent parties',()=>{
 const e=lab();assert.equal(e.mode,'single');assert.equal(e.player.party.length,2);assert.equal(e.opponent.party.length,2);
 assert.equal(e.player.active.length,1);assert.equal(e.opponent.active.length,1);
 assert.notEqual(e.player.party[0].id,e.opponent.party[0].id);
});
test('All four Pokémon in doubles require explicit manual orders with no AI',()=>{
 const e=lab('double'),required=labRequiredActions(e);
 assert.equal(required.length,4);assert.equal(required.filter(x=>x.side==='opponent').length,2);
 assert.throws(()=>playLabTurn(e,{}),/chaque Pokémon/);assert.equal(e.turn,0);
 const selected=Object.fromEntries(required.map(x=>[x.id,{actor:x.id,type:'move',move:'BOOST'}]));
 playLabTurn(e,selected);assert.equal(e.turn,1);
 assert.equal(e.player.party[0].stages.atk,2);assert.equal(e.player.party[1].stages.atk,2);
 assert.equal(e.opponent.party[0].stages.atk,2);assert.equal(e.opponent.party[1].stages.atk,2);
});
test('Opponent can manually target and debuff player during a real Solo turn',()=>{
 const e=lab(),p=e.active('player')[0],o=e.active('opponent')[0];
 playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'BOOST'},[o.id]:{actor:o.id,type:'move',move:'GROWL',target:p.id}});
 assert.equal(e.turn,1);assert.equal(p.stages.atk,1);
 assert.equal(o.pp.GROWL,39);
});
test('Manual opponent switch is executed by shared battle logic',()=>{
 const e=lab(),p=e.active('player')[0],o=e.active('opponent')[0],next=e.opponent.party[1];
 playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'BOOST'},[o.id]:{actor:o.id,type:'switch',to:next.id}});
 assert.equal(e.opponent.active[0],next.id);assert.equal(next.active,true);assert.equal(o.active,false);
});
test('Invalid opponent orders do not advance the turn',()=>{
 const e=lab(),p=e.active('player')[0],o=e.active('opponent')[0];
 assert.throws(()=>playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'BOOST'},[o.id]:{actor:o.id,type:'move',move:'NOT_REAL',target:p.id}}),/invalide/);
 assert.equal(e.turn,0);
});
test('Battle laboratory has its own page and no access to profile save stores',()=>{
 const app=readFileSync(new URL('../web/lab.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/lab.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(main,/href="\.\/lab\.html"/);
 assert.match(html,/id="lab-start"/);assert.match(html,/id="lab-play"/);
 assert.match(app,/playLabTurn\(battle,selected\)/);
 assert.doesNotMatch(app,/RunStore|localStorage|indexedDB|saveBattleSession/);
});

test('The laboratory UI modules parse as JavaScript before deployment',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const file of ['lab.mjs','lab-engine.mjs'])assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',new URL('../web/'+file,import.meta.url).pathname],{stdio:'pipe'}),file);
});
test('Unknown target IDs and impossible opponent switches are rejected before advancing the turn',()=>{
 const e=lab(),p=e.active('player')[0],o=e.active('opponent')[0];
 assert.throws(()=>playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'BOOST'},[o.id]:{actor:o.id,type:'move',move:'HIT',target:'absent'}}),/Cible inconnue/);
 assert.equal(e.turn,0);
 assert.throws(()=>playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'BOOST'},[o.id]:{actor:o.id,type:'switch',to:'absent'}}),/Remplaçant invalide/);
 assert.equal(e.turn,0);
});
