import test from 'node:test';
import assert from 'node:assert/strict';
import {moveCategory,moveDetails} from '../web/split-mode.mjs';
import {baseDamage} from '../web/battle-stats.mjs';
import {TowerEngine} from '../web/engine.mjs';
import {createLabBattle} from '../web/lab-engine.mjs';
import {createPikeBattle} from '../web/pike-battle.mjs';
import {readFileSync} from 'node:fs';
const mkMove=(type,category,power=80)=>({type,category,power,accuracy:95,name:type,pp:15,target:'enemy',originalEffect:'HIT',effect:'damage'});
const data={species:{A:{types:['NORMAL'],stats:[100,150,50,50,150,100],abilities:['NONE']},B:{types:['NORMAL'],stats:[100,75,75,75,75,75],abilities:['NONE']}},speciesNames:{A:'A',B:'B'},moveData:{
 BITE:mkMove('DARK','physical'),FIRE_PUNCH:mkMove('FIRE','physical'),SHADOW_BALL:mkMove('GHOST','special'),TACKLE:mkMove('NORMAL','physical')}};
const set=(species)=>({species,level:50,nature:'HARDY',ability:'NONE',item:'NONE',moves:Object.keys(data.moveData),ivs:[31,31,31,31,31,31],evs:[0,0,0,0,0,0]});
test('Gen III type split maps Dark/Fire to special and Ghost to physical',()=>{
 assert.equal(moveCategory(data.moveData.BITE,'type'),'special');
 assert.equal(moveCategory(data.moveData.FIRE_PUNCH,'type'),'special');
 assert.equal(moveCategory(data.moveData.SHADOW_BALL,'type'),'physical');
 assert.equal(moveCategory(data.moveData.BITE,'move'),'physical');
 assert.equal(moveCategory(data.moveData.SHADOW_BALL,'move'),'special');
});
test('Status moves remain status and accuracy 0 is shown as never missing',()=>{
 assert.equal(moveCategory({category:'status',type:'NORMAL',power:0},'type'),'status');
 assert.deepEqual(moveDetails({category:'status',power:0,accuracy:0,type:'NORMAL'},'type'),
  {category:'status',power:'—',accuracy:'—'});
 assert.equal(moveDetails(data.moveData.BITE,'type').accuracy,'95 %');
 assert.equal(moveDetails(data.moveData.BITE,'type').power,'80');
});
test('Effective damage changes on changing split, without mutating catalogue moves',()=>{
 const e=createLabBattle(data,{mode:'single',player:[set('A')],opponent:[set('B')],splitMode:'move',seed:7});
 const p=e.player.party[0],o=e.opponent.party[0];
 const original=data.moveData.BITE.category;
 const byMove=baseDamage(e,p,o,data.moveData.BITE);
 e.splitMode='type';
 const byType=baseDamage(e,p,o,data.moveData.BITE);
 assert.notEqual(byMove,byType);
 assert.ok(byMove>byType,'high-attack Pokémon does more damage with a physical Bite');
 assert.equal(data.moveData.BITE.category,original);
 assert.equal(e.snapshot().splitMode,'type');
});
test('Full battle turn records damage under selected category for Counter or Mirror Coat',()=>{
 const e=createLabBattle(data,{mode:'single',player:[set('A')],opponent:[set('B')],splitMode:'type',seed:8});
 const p=e.player.party[0],o=e.opponent.party[0];
 e.rng=()=>.4;
 e.aiAction=()=>({actor:o.id,type:'pass'});
 e.turnActions([{actor:p.id,type:'move',move:'BITE',target:o.id}]);
 assert.ok(o.receivedDamage.special?.amount>0);
 assert.equal(o.receivedDamage.physical,undefined);
});
test('Reptile and Laboratory propagate chosen split into actual engine',()=>{
 const lab=createLabBattle(data,{mode:'single',player:[set('A')],opponent:[set('B')],splitMode:'type'});
 assert.equal(lab.splitMode,'type');
 const pike=createPikeBattle(data,{sets:[set('A'),set('B'),set('A')],party:[...lab.player.party, {...lab.player.party[0],id:'b',species:'B'}, {...lab.player.party[0],id:'c'}],opponents:[set('B')],mode:'single',splitMode:'type'});
 assert.equal(pike.splitMode,'type');
});
test('Main game, Pike and lab expose split selection and Power/Accuracy fields',()=>{
 const main=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const pike=readFileSync(new URL('../web/pike.html',import.meta.url),'utf8');
 const lab=readFileSync(new URL('../web/lab.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
 const pikeUi=readFileSync(new URL('../web/pike-battle-ui.mjs',import.meta.url),'utf8');
 const labUi=readFileSync(new URL('../web/lab.mjs',import.meta.url),'utf8');
 assert.match(main,/id="split-mode"/);
 assert.match(pike,/id="pike-split"/);
 assert.match(lab,/id="lab-split"/);
 assert.match(app,/moveDetails\(m,engine.splitMode\)/);
 assert.match(pikeUi,/moveDetails\(m,engine.splitMode\)/);
 assert.match(labUi,/moveDetails\(D.moveData\[k\],battle.splitMode\)/);
});
