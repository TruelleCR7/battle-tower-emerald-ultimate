import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabBattle,playLabTurn} from '../web/lab-engine.mjs';

const move=(name,type,category,power=0)=>({name,type,category,power,pp:15,accuracy:100,priority:0,target:'enemy',originalEffect:'HIT',effect:'damage'});
const data={
 species:{A:{stats:[100,95,95,95,95,95],types:['NORMAL'],abilities:['NONE']},B:{stats:[100,95,95,95,95,95],types:['NORMAL'],abilities:['NONE']}},
 speciesNames:{A:'A',B:'B'},
 moveData:{
 FLY:move('Vol','FLYING','physical',80),
 DIG:move('Tunnel','GROUND','physical',80),
 DIVE:move('Plongée','WATER','physical',80),
 SOLAR_BEAM:move('Lance-Soleil','GRASS','special',120),
 TACKLE:move('Charge','NORMAL','physical',40),
 EARTHQUAKE:move('Séisme','GROUND','physical',100),
 SURF:move('Surf','WATER','special',95),
 THUNDER:move('Fatal-Foudre','ELECTRIC','special',120)
 }};
const set=(species,moves)=>({species,level:50,nature:'HARDY',ability:'NONE',item:'NONE',moves,evs:[0,0,0,0,0,0],ivs:[31,31,31,31,31,31]});
function battle(a=['FLY','TACKLE'],b=['TACKLE']){
 const e=createLabBattle(data,{mode:'single',player:[set('A',a)],opponent:[set('B',b)],seed:333});
 e.rng=()=>.5; // no status interruptions or lucky criticals
 return e;
}
function turn(e,playerMove,enemyMove='TACKLE',target=null){
 const p=e.active('player')[0],o=e.active('opponent')[0];
 return playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:playerMove,target:o.id},[o.id]:{actor:o.id,type:'move',move:enemyMove,target:target||p.id}});
}
test('Fly charges, avoids ordinary attacks, then lands automatically with PP spent once',()=>{
 const e=battle(),p=e.player.party[0],o=e.opponent.party[0],before=o.hp;
 turn(e,'FLY');assert.equal(p.charging.kind,'fly');assert.equal(p.pp.FLY,14);assert.equal(p.hp,p.maxHp);
 turn(e,'TACKLE');assert.equal(p.charging,null);assert.equal(p.pp.FLY,14);assert.ok(o.hp<before);
});
test('Dig is protected from ordinary attacks but vulnerable to Earthquake',()=>{
 const e=battle(['DIG','TACKLE'],['EARTHQUAKE']),p=e.player.party[0],o=e.opponent.party[0];
 turn(e,'DIG','EARTHQUAKE');
 assert.ok(p.hp<p.maxHp);assert.equal(p.charging.kind,'dig');
 const after=o.hp;turn(e,'TACKLE','EARTHQUAKE');assert.ok(o.hp<after);assert.equal(p.pp.DIG,14);
});
test('Dive is vulnerable to Surf while underwater',()=>{
 const e=battle(['DIVE','TACKLE'],['SURF']),p=e.player.party[0];
 turn(e,'DIVE','SURF');assert.ok(p.hp<p.maxHp);assert.equal(p.charging.kind,'dive');
});
test('Solar Beam charges without sunlight and fires on turn two',()=>{
 const e=battle(['SOLAR_BEAM','TACKLE']),p=e.player.party[0],o=e.opponent.party[0],before=o.hp;
 turn(e,'SOLAR_BEAM');assert.equal(p.charging.kind,'solar');assert.equal(o.hp,before);assert.equal(p.pp.SOLAR_BEAM,14);
 turn(e,'TACKLE');assert.ok(o.hp<before);assert.equal(p.pp.SOLAR_BEAM,14);
});
test('Solar Beam bypasses charge under sun and keeps normal PP consumption',()=>{
 const e=battle(['SOLAR_BEAM','TACKLE']),p=e.player.party[0],o=e.opponent.party[0];
 e.weather='sun';e.weatherTurns=4;turn(e,'SOLAR_BEAM');
 assert.equal(p.charging,undefined);assert.ok(o.hp<o.maxHp);assert.equal(p.pp.SOLAR_BEAM,14);
});
test('Switching clears a stored charge, and the state is part of combat snapshots',()=>{
 const e=createLabBattle(data,{mode:'single',player:[set('A',['FLY','TACKLE']),set('A',['TACKLE'])],opponent:[set('B',['TACKLE'])],seed:10});
 e.rng=()=>.5;const p=e.player.party[0],other=e.player.party[1],o=e.opponent.party[0];
 playLabTurn(e,{[p.id]:{actor:p.id,type:'move',move:'FLY',target:o.id},[o.id]:{actor:o.id,type:'move',move:'TACKLE',target:p.id}});
 assert.equal(e.snapshot().player.party[0].charging.move,'FLY');
 e.switchMon(p,other.id);assert.equal(p.charging,null);
});

test('Charging interrupts the consecutive Protect counter',()=>{
 const e=battle(['FLY','TACKLE']),p=e.player.party[0],o=e.opponent.party[0];
 p.protectCount=4;
 turn(e,'FLY');
 assert.equal(p.protectCount,0);
 assert.equal(p.charging.kind,'fly');
});
test('A two-turn move can finish when its first use spent the last PP',()=>{
 const e=battle(['FLY','TACKLE']),p=e.player.party[0],o=e.opponent.party[0];
 p.pp.FLY=1;
 turn(e,'FLY');
 assert.equal(p.pp.FLY,0);
 assert.equal(p.charging.move,'FLY');
 const hp=o.hp;
 turn(e,'FLY');
 assert.equal(p.pp.FLY,0);
 assert.equal(p.charging,null);
 assert.ok(o.hp<hp);
});
test('Two-turn moves retarget an available opponent after the original target switches',()=>{
 const e=createLabBattle(data,{mode:'single',
  player:[set('A',['FLY','TACKLE'])],
  opponent:[set('B',['TACKLE']),set('B',['TACKLE'])],seed:77});
 e.rng=()=>.5;
 const p=e.player.party[0],original=e.opponent.party[0],replacement=e.opponent.party[1];
 playLabTurn(e,{
  [p.id]:{actor:p.id,type:'move',move:'FLY',target:original.id},
  [original.id]:{actor:original.id,type:'move',move:'TACKLE',target:p.id}
 });
 assert.equal(p.charging.move,'FLY');
 playLabTurn(e,{
  [p.id]:{actor:p.id,type:'move',move:'FLY',target:original.id},
  [original.id]:{actor:original.id,type:'switch',to:replacement.id}
 });
 assert.equal(p.charging,null);
 assert.equal(original.active,false);
 assert.ok(replacement.hp<replacement.maxHp);
});
test('A charging Pokémon loses its charge when it is prevented from moving',()=>{
 const e=battle(['FLY','TACKLE']),p=e.player.party[0];
 turn(e,'FLY');assert.equal(p.charging.kind,'fly');
 p.status='paralyze';e.rng=()=>0;
 turn(e,'FLY');
 assert.equal(p.charging,null);
 assert.ok(e.log.some(x=>x.text.includes('interrompt sa préparation')));
});
