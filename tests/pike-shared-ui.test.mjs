import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabBattle} from '../web/lab-engine.mjs';
import {pikeBattleFrame,pikeMoveControls,pikeReplacementControls} from '../web/pike-battle-ui.mjs';
import {renderBattleArena,renderCombatMon} from '../web/battle-view.mjs';
const moveData={
 TACKLE:{name:'Charge',type:'NORMAL',category:'physical',pp:35,power:40,accuracy:100,target:'enemy',effect:'damage'},
 SWORDS_DANCE:{name:'Danse-Lames',type:'NORMAL',category:'status',pp:20,power:0,accuracy:0,target:'self',effect:'swords',originalEffect:'ATTACK_UP_2'}
};
const data={
 species:{A:{stats:[100,80,80,80,80,80],types:['NORMAL'],abilities:['NONE']},B:{stats:[90,80,80,80,80,80],types:['NORMAL'],abilities:['NONE']}},
 speciesNames:{A:'Alpha',B:'Beta'},moveData
};
const set=(species)=>({species,level:50,nature:'HARDY',ability:'NONE',item:'NONE',moves:['TACKLE','SWORDS_DANCE'],evs:[0,0,0,0,0,0],ivs:[31,31,31,31,31,31]});
const battle=mode=>createLabBattle(data,{mode,player:[set('A'),set('A')],opponent:[set('B'),set('B')],seed:1});
test('Pike and regular battle renderers generate the exact same arena DOM',()=>{
 for(const mode of ['single','double']){
  const e=battle(mode);
  const pike=pikeBattleFrame(e,'PLACEHOLDER');
  const standard=renderBattleArena(e);
  assert.ok(pike.includes('<div class="arena" id="battle-arena">'+standard+'</div>'));
  assert.match(pike,/class="pixel-frame"/);
  assert.match(pike,/class="controls"/);
  assert.match(pike,/class="dialogue"/);
  assert.match(pike,/class="battle-bottom"/);
  assert.match(pike,/id="battle-log"/);
 }
});
test('Pike uses regular move buttons, targets and switch cards, not selectors',()=>{
 const e=battle('double'),m=e.active('player')[0],t=e.active('opponent')[0];
 const initial=pikeMoveControls(e,{});
 assert.match(initial,/class="moves"/);
 assert.match(initial,/class="move /);
 assert.match(initial,/data-move="TACKLE"/);
 assert.match(initial,/data-pike-switch-actor/);
 assert.match(initial,/disabled>VALIDER LE TOUR/);
 const actions=Object.fromEntries(e.active('player').map(p=>[p.id,{actor:p.id,type:'move',move:'TACKLE',target:t.id}]));
 const selected=pikeMoveControls(e,actions);
 assert.match(selected,/class="target-cards"/);
 assert.match(selected,/data-pike-target-id/);
 assert.match(selected,/id="pike-turn"/);
 assert.doesNotMatch(selected,/id="pike-turn" disabled/);
 assert.match(selected,/VALIDER LE TOUR/);
});
test('Pike replacement interface uses standard bench cards',()=>{
 const e=battle('single');
 const active=e.active('player')[0],reserve=e.player.party[1];
 active.hp=0;active.active=false;e.player.active=[null];
 e.pendingReplacements=[{fainted:active.id,owner:'human',side:'player'}];
 const html=pikeReplacementControls(e);
 assert.match(html,/class="forced-replacement"/);
 assert.match(html,/class="bench-card"/);
 assert.ok(html.includes('data-pike-replace="'+reserve.id+'"'));
});
test('Shared battler renders animated BW sprites, HP meters and status',()=>{
 const e=battle('single');
 const p=e.active('player')[0];p.status='paralyze';p.stages.atk=2;
 const html=renderCombatMon(p,true,e.data);
 assert.match(html,/gen5ani-back/);
 assert.match(html,/data-battler/);
 assert.match(html,/class="hp-meter"/);
 assert.match(html,/PARALYSÉ/);
 assert.match(html,/class="stat-changes"/);
 assert.match(html,/data-stat-info/);
});
