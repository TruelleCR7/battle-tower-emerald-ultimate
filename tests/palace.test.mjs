import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {palaceChances,palaceMoveGroup,palaceChooseMove,palaceTier,PALACE_NATURES,palaceBrainSets} from '../web/palace.mjs';
import {TowerEngine} from '../web/engine.mjs';
const moveData={
 TACKLE:{name:'Charge',category:'physical',power:40,pp:35,target:'enemy',effect:'damage',type:'NORMAL',accuracy:100},
 PROTECT:{name:'Abri',category:'status',power:0,pp:10,target:'self',effect:'protect',type:'NORMAL',accuracy:0},
 TOXIC:{name:'Toxik',category:'status',power:0,pp:10,target:'enemy',effect:'toxic',type:'POISON',accuracy:85}
};
const mon=(id,owner,nature='HARDY')=>({id,name:id,owner,species:'TEST',nature,hp:100,maxHp:100,
 moves:['TACKLE','PROTECT','TOXIC'],pp:{TACKLE:35,PROTECT:10,TOXIC:10},active:true,status:'',
 item:'NONE',ability:'NONE',level:50,stats:{atk:80,def:80,spa:80,spd:80,spe:80},
 stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0},choiceLock:'',protectCount:0});
function battle(rng=()=>0){
 const p=mon('p','human'),o=mon('o','cpu');
 const e=Object.create(TowerEngine.prototype);
 Object.assign(e,{data:{species:{TEST:{types:['NORMAL']}},moveData},facility:'palace',splitMode:'move',mode:'single',
 levelMode:'50',level:50,turn:0,status:'active',streak:0,round:1,series:1,trainer:'Palais',
 player:{party:[p],active:['p']},opponent:{party:[o],active:['o']},hazards:{player:0,opponent:0},
 log:[],rng,weather:'',weatherTurns:0,pendingReplacements:[],score:0});
 return {e,p,o};
}
test('All 25 Emerald nature likelihood rows preserved',()=>{
 assert.equal(Object.keys(PALACE_NATURES).length,25);
 assert.deepEqual(PALACE_NATURES.BRAVE,[70,15,32,60]);
 assert.deepEqual(PALACE_NATURES.GENTLE,[18,70,90,5]);
 assert.deepEqual(PALACE_NATURES.SASSY,[88,6,22,20]);
 for(const row of Object.values(PALACE_NATURES))for(const low of [false,true]){
  const index=low?2:0;
  const chances=palaceChances(Object.keys(PALACE_NATURES).find(k=>PALACE_NATURES[k]===row),low);
  assert.equal(chances.attack,row[index]);
  assert.equal(chances.defense,row[index+1]);
  assert.equal(Object.values(chances).reduce((a,b)=>a+b,0),100);
 }
});
test('Palace groups are offensive, self defensive and target-support, irrespective of split',()=>{
 assert.equal(palaceMoveGroup(moveData.TACKLE),'attack');
 assert.equal(palaceMoveGroup(moveData.PROTECT),'defense');
 assert.equal(palaceMoveGroup(moveData.TOXIC),'support');
});
test('Nature selects attack above half and defense at exactly half HP',()=>{
 const {e,p}=battle(()=>0.6);p.nature='BRAVE';
 assert.equal(palaceChooseMove(e,p).move,'TACKLE');
 p.hp=50;
 assert.equal(palaceChooseMove(e,p).move,'PROTECT');
});
test('Missing chosen group has a one-half chance of no action',()=>{
 const {e,p}=battle(()=>.99);p.nature='CALM';p.moves=['TACKLE'];p.pp={TACKLE:1};
 const a=palaceChooseMove(e,p);
 assert.equal(a.type,'pass');
 assert.ok(e.log.some(x=>x.text.includes("n'attaque pas")));
});
test('Missing chosen group can fall back to another available move',()=>{
 const {e,p}=battle(()=>0);p.nature='CALM';p.moves=['TACKLE'];p.pp={TACKLE:1};
 // calm roll at 95% selects Support, then 0 allows fallback and final 0 chooses Tackle
 let index=0;e.rng=()=>[.99,0,0][index++];
 const a=palaceChooseMove(e,p);
 assert.equal(a.type,'move');assert.equal(a.move,'TACKLE');
});
test('No PP available chooses Struggle; choice-lock is respected',()=>{
 const {e,p}=battle(()=>0);p.pp={TACKLE:0,PROTECT:0,TOXIC:0};
 assert.equal(palaceChooseMove(e,p).move,'STRUGGLE');
 p.pp.TACKLE=4;p.pp.PROTECT=4;p.choiceLock='TACKLE';
 assert.equal(palaceChooseMove(e,p).move,'TACKLE');
});
test('Palace full battle turn automatically chooses a move and respects held PP',()=>{
 const {e,p,o}=battle(()=>0);
 const result=e.turnActions([{actor:'p',type:'palace'}]);
 assert.equal(e.turn,1);
 assert.ok(e.log.some(x=>x.text.includes('décide de')&&x.turn===e.turn));
 assert.equal(p.pp.TACKLE,34);
 assert.ok(o.hp<100);
 assert.equal(result.facility,'palace');
});
test('Player can explicitly switch rather than follow Palace automatic actions',()=>{
 const {e,p,o}=battle(()=>0);
 const bench=mon('reserve','human');bench.active=false;e.player.party.push(bench);
 e.turnActions([{actor:'p',type:'switch',to:bench.id}]);
 assert.equal(e.active('player')[0].id,bench.id);
 assert.equal(p.pp.TACKLE,35);
});
test('Palace symbols and Esteban rosters match Emerald sequence',()=>{
 assert.equal(palaceTier(20),'silver');assert.equal(palaceTier(41),'gold');assert.equal(palaceTier(21),null);
 const rosterSpecies=['CROBAT','SLAKING','LAPRAS','ARCANINE','SUICUNE'];
 const data={species:Object.fromEntries(rosterSpecies.map(k=>[k,{abilities:['NONE']}])),moveData:Object.fromEntries([
 'FLY','CONFUSE_RAY','TOXIC','DOUBLE_TEAM','BRICK_BREAK','SHADOW_BALL','EARTHQUAKE','SWAGGER','HORN_DRILL',
 'ICE_BEAM','PROTECT','OVERHEAT','EXTREME_SPEED','ROAR','HYPER_BEAM','YAWN','SURF','BITE','BLIZZARD','CALM_MIND'
 ].map(k=>[k,{name:k}]))};
 assert.deepEqual(palaceBrainSets('silver',data).map(x=>x.species),['CROBAT','SLAKING','LAPRAS']);
 assert.deepEqual(palaceBrainSets('gold',data).map(x=>x.species),['ARCANINE','SLAKING','SUICUNE']);
});
test('Palace is available through the normal mode selection and uses no manual move buttons',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
 assert.match(html,/<option value="palace">Palais de Combat/);
 assert.match(app,/run\?\.facility==='palace'/);
 assert.match(app,/id="palace-turn"/);
 assert.match(app,/type:'palace'/);
 assert.match(app,/created.facility='palace'/);
});
