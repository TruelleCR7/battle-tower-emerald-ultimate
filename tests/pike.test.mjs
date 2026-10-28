import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPike,pikeChoices,pikePickDoor,pikeResolveEvent,pikeFinishRoom,pikeNextPass,pikeBrainTier,pikeLucyTeam,PIKE_HINTS,PIKE_EVENTS} from '../web/pike.mjs';
const team=[{species:'A'},{species:'B'},{species:'C'}];
const party=()=>Array.from({length:3},(_,i)=>({name:'P'+i,hp:100,maxHp:100,status:'',sleep:0,toxic:0,pp:{A:10}}));
test('Pike starts with 3 doors and 7 decision rooms per pass',()=>{
 const p=createPike(team,()=>0);assert.equal(p.phase,'doors');assert.equal(p.choices.doors.length,3);
 for(let i=0;i<7;i++){pikePickDoor(p,2);p.phase='resolved';pikeFinishRoom(p,party(),()=>0);}
 assert.equal(p.totalRooms,7);assert.equal(p.phase,'pass_complete');assert.equal(p.pass,1);
 pikeNextPass(p,party(),()=>0);assert.equal(p.pass,2);assert.equal(p.room,0);
});
test('Hints only refer to the marked door and other doors cannot match that hint group',()=>{
 for(const n of [0,.15,.35,.55,.8,.99]){
  const c=pikeChoices(1,0,()=>n);assert.ok(c.hintDoor>=0&&c.hintDoor<3);
  const marked=c.doors[c.hintDoor];assert.ok(PIKE_EVENTS.includes(marked.event));
  const hinted=PIKE_HINTS.find(pair=>pair.text===c.hint);assert.ok(hinted);
  assert.ok(hinted.events.includes(marked.event));
  assert.ok(c.doors.filter(d=>d.id!==c.hintDoor).every(d=>!hinted.events.includes(d.event)));
 }
});
test('Silver and gold Pike Queen are gated at the correct boss passage',()=>{
 assert.equal(pikeBrainTier(1),null);assert.equal(pikeBrainTier(2),'silver');assert.equal(pikeBrainTier(10),'gold');assert.equal(pikeBrainTier(11),null);
 for(const pass of [2,10]){
  const choices=pikeChoices(pass,6,()=>0.25);
  assert.ok(choices.doors.every(x=>x.event==='brain'));
  assert.equal(choices.hintDoor,null);
 }
});
test('Status trap persists ailments and quiet room never damages party',()=>{
 const p=createPike(team,()=>0),mons=party();
 p.phase='event';p.roomEvent='status';pikeResolveEvent(p,mons,()=>0);
 assert.equal(mons[0].status,'poison');
 assert.equal(p.phase,'resolved');
 pikeFinishRoom(p,mons,()=>0);
 const before=structuredClone(mons);p.phase='event';p.roomEvent='quiet';
 pikeResolveEvent(p,mons,()=>0);assert.deepEqual(mons,before);
});
test('Full recovery cures HP and statuses; partial recovery affects only part of the team',()=>{
 const p=createPike(team,()=>0),mons=party();
 mons.forEach(m=>{m.hp=30;m.status='burn';});
 p.phase='event';p.roomEvent='partial_heal';pikeResolveEvent(p,mons,()=>0);
 assert.equal(mons.filter(m=>m.hp===100).length,1);
 p.phase='event';p.roomEvent='full_heal';pikeResolveEvent(p,mons,()=>0);
 assert.ok(mons.every(m=>m.hp===100&&!m.status));
});
test('Unresolved event cannot advance and choices cannot be selected twice',()=>{
 const p=createPike(team,()=>0);
 pikePickDoor(p,0);assert.throws(()=>pikePickDoor(p,1));
 assert.throws(()=>pikeFinishRoom(p,party()),/Termine/);
});
test('Lucy teams are fixed and use their expected three official species',()=>{
 const species=Object.fromEntries(['SEVIPER','SHUCKLE','MILOTIC','STEELIX','GYARADOS'].map(k=>[k,{abilities:['NONE']}]));
 const moveNames=['SWAGGER','CRUNCH','POISON_FANG','GIGA_DRAIN','TOXIC','SANDSTORM','PROTECT','REST','ICE_BEAM','MIRROR_COAT','SURF','RECOVER','SLUDGE_BOMB','EARTHQUAKE','ROCK_SLIDE','EXPLOSION','SCREECH','DRAGON_DANCE','RETURN','ROAR'];
 const data={species,moveData:Object.fromEntries(moveNames.map(k=>[k,{name:k}]))};
 const silver=pikeLucyTeam('silver',data),gold=pikeLucyTeam('gold',data);
 assert.deepEqual(silver.map(x=>x.species),['SEVIPER','SHUCKLE','MILOTIC']);
 assert.deepEqual(gold.map(x=>x.species),['SEVIPER','STEELIX','GYARADOS']);
 assert.equal(silver[0].ivs[0],16);assert.equal(gold[0].ivs[0],31);
});
test('Battle Pike UI is a separate page and existing app routes without mutating its saved runs',()=>{
 const page=readFileSync(new URL('../web/pike.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../web/pike-ui.mjs',import.meta.url),'utf8');
 const main=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(page,/id="pike-stage"/);assert.match(ui,/playLabTurn|turnActions\(choices\)/);
 assert.match(html,/<option value="pike">Reptile de Combat/);
 assert.match(main,/window\.location\.assign\('\.\/pike\.html'\)/);
 assert.doesNotMatch(ui,/RunStore|saveBattleSession|state\.runs/);
});

test('Pike page and game modules pass Node JavaScript syntax checks',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const filename of ['pike-ui.mjs','pike.mjs']){
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',new URL('../web/'+filename,import.meta.url).pathname],{stdio:'pipe'}),filename);
 }
});
