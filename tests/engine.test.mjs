import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TowerEngine,validateTeam,statsFor,effectiveness} from '../web/engine.mjs';
const D=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const fresh=(s)=>JSON.parse(JSON.stringify(D.sets[s]));
const config=(mode,team)=>({mode,team:team.map(fresh),levelMode:'50',seed:123456});
test('data: 386 espèces et séparation Gen IV',()=>{
 assert.equal(Object.keys(D.sets).length,386);
 assert.equal(D.moveData.SHADOW_BALL.category,'special');
 assert.equal(D.moveData.DRAGON_CLAW.category,'physical');
 assert.equal(D.moveData.ICE_PUNCH.category,'physical');
 assert.equal(D.moveData.THUNDERBOLT.category,'special');
 assert.equal(D.moveData.SLUDGE_BOMB.category,'special');
});
test('validateur de règles',()=>{
 const good=['METAGROSS','SWAMPERT','LATIOS'].map(fresh);
 assert.deepEqual(validateTeam(good,'single','50',D),[]);
 let bad=JSON.parse(JSON.stringify(good));bad[1].species='METAGROSS';assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('double')));
 bad=JSON.parse(JSON.stringify(good));bad[1].item=bad[0].item;assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('Objets')));
 bad=JSON.parse(JSON.stringify(good));bad[1].evs=[252,252,252,0,0,0];assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('EV')));
 bad=JSON.parse(JSON.stringify(good));bad[1].level=52;assert.ok(validateTeam(bad,'single','50',D).some(x=>x.includes('niveau')));
});
test('calcul de statistiques: nature Modeste réduit attaque',()=>{
 const st=fresh('LATIOS');let timid={...st,nature:'TIMID'},mod={...st,nature:'MODEST'};
 assert.ok(statsFor(mod,D).spa>statsFor(timid,D).spa);
 assert.ok(statsFor(mod,D).atk===statsFor(timid,D).atk);
});
test('immunités Pokémon Gen III',()=>{
 const a={species:'FLYGON',ability:'LEVITATE'},b={species:'METAGROSS',ability:'CLEAR_BODY'};
 assert.equal(effectiveness('GROUND',a,D),0);
 assert.equal(effectiveness('GROUND',b,D),2);
 assert.equal(effectiveness('NORMAL',{species:'GENGAR',ability:'LEVITATE'},D),0);
});
test('mode Solo : tour jouable contre IA',()=>{
 const e=new TowerEngine(D,config('single',['METAGROSS','SWAMPERT','LATIOS']));
 assert.equal(e.active('player').length,1);
 let act=e.aiAction(e.active('player')[0]);let r=e.turnActions([act]);assert.equal(r.turn,1);assert.ok(r.player.party[0].hp>=0);
});
test('mode Duo : deux décisions par tour',()=>{
 const e=new TowerEngine(D,config('double',['SALAMENCE','METAGROSS','STARMIE','SNORLAX']));
 assert.equal(e.active('player').length,2);
 assert.throws(()=>e.turnActions([e.aiAction(e.active('player')[0])]),/chaque Pokémon/);
 const r=e.turnActions(e.active('player').map(m=>e.aiAction(m)));assert.equal(r.turn,1);
});
test('Multi IA : partenaire autonome + adversaires',()=>{
 const e=new TowerEngine(D,config('multi',['METAGROSS','LATIOS']));
 assert.equal(e.player.party.length,4);
 assert.equal(e.required().length,1);
 assert.equal(e.player.party[2].owner,'partner');
 const r=e.turnActions([e.aiAction(e.active('player')[0])]);assert.equal(r.turn,1);
});
test('Multi local : deux contrôles humains distincts',()=>{
 const c=config('link',['METAGROSS','LATIOS']);c.partner=[fresh('MILOTIC'),fresh('SALAMENCE')];
 const e=new TowerEngine(D,c);assert.equal(e.required().length,2);
 const r=e.turnActions(e.active('player').map(m=>e.aiAction(m)));assert.equal(r.turn,1);
});
test('dégâts du split : Ball’Ombre spéciale exploitant l’attaque spéciale',()=>{
 const e=new TowerEngine(D,config('single',['GENGAR','SNORLAX','MILOTIC']));
 const g=e.player.party[0],target=e.opponent.party[0];const base=e.damagePreview(g,target,D.moveData.SHADOW_BALL).damage;
 g.stats.spa*=3;const buffed=e.damagePreview(g,target,D.moveData.SHADOW_BALL).damage;assert.ok(buffed>base);
});
test('simulation en chaîne sans crash sur 50 tours',()=>{
 for(const mode of ['single','double','multi','link']){
  const arr=mode==='double'?['METAGROSS','SALAMENCE','SWAMPERT','GENGAR']:mode==='single'?['METAGROSS','SWAMPERT','LATIOS']:['METAGROSS','LATIOS'];
  const c=config(mode,arr);if(mode==='link')c.partner=[fresh('SNORLAX'),fresh('MILOTIC')];
  const e=new TowerEngine(D,c);
  for(let i=0;i<50&&e.status==='active';i++){
   while(e.pendingReplacements?.length&&e.status==='active'){const r=e.pendingReplacements[0];e.replaceFainted(r.fainted,e.bench(r.side,r.owner)[0].id);}
   if(e.status!=='active')break;
   const acts=e.active('player').filter(m=>m.owner==='human'||m.owner==='human2').map(m=>e.aiAction(m));
   e.turnActions(acts);
  }
  assert.ok(['active','won','lost'].includes(e.status),mode);
 }
});
