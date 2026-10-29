import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMon} from '../web/engine.mjs';
import {pikeStatusEffect,pikeResolveEvent,createPike} from '../web/pike.mjs';
import {resetPikePartyForBattle} from '../web/pike-battle.mjs';
const species={
 METAGROSS:{types:['STEEL','PSYCHIC'],stats:[80,135,130,95,90,70],abilities:['CLEAR_BODY']},
 SWAMPERT:{types:['WATER','GROUND'],stats:[100,110,90,85,90,60],abilities:['TORRENT']},
 LATIOS:{types:['DRAGON','PSYCHIC'],stats:[80,90,80,130,110,110],abilities:['LEVITATE']},
 FLAREON:{types:['FIRE'],stats:[65,130,60,95,110,65],abilities:['FLASH_FIRE']},
 MUK:{types:['POISON'],stats:[105,105,75,65,100,50],abilities:['STENCH']}
};
const moveData={TACKLE:{name:'Charge',pp:35,type:'NORMAL',power:40,category:'physical',target:'enemy',accuracy:100}};
const data={species,moveData,speciesNames:Object.fromEntries(Object.keys(species).map(k=>[k,k]))};
const set=(species,item='NONE')=>({species,item,level:50,ability:data.species[species].abilities[0],nature:'HARDY',moves:['TACKLE'],ivs:[31,31,31,31,31,31],evs:[0,0,0,0,0,0]});
const mon=(species,item='NONE')=>makeMon(set(species,item),data,'human',50);
test('Pike poison trap obeys Steel and Poison-type immunity',()=>{
 const metals=[mon('METAGROSS')];
 assert.match(pikeStatusEffect(metals,()=>0,data),/résiste/);
 assert.equal(metals[0].status,'');
 const poisons=[mon('MUK')];
 pikeStatusEffect(poisons,()=>0,data);
 assert.equal(poisons[0].status,'');
});
test('Pike status traps trigger held Lum Berry and consume it',()=>{
 const team=[mon('SWAMPERT','LUM_BERRY')];
 const text=pikeStatusEffect(team,()=>0,data);
 assert.match(text,/soigné par une baie/);
 assert.equal(team[0].status,'');
 assert.equal(team[0].item,'NONE');
});
test('Pike sleep trap obeys engine sleep duration and persists until a new room',()=>{
 const team=[mon('LATIOS')];
 pikeStatusEffect(team,()=>.99,data);
 assert.equal(team[0].status,'sleep');
 assert.equal(team[0].sleep,4);
 const after=resetPikePartyForBattle(data,[set('LATIOS')],team);
 assert.equal(after[0].status,'sleep');
 assert.equal(after[0].sleep,4);
});
test('Pike full heal restores HP and PP but never recreates consumed berries',()=>{
 const m=mon('SWAMPERT','NONE');m.hp=8;m.pp.TACKLE=1;m.status='burn';
 const p=createPike([set('SWAMPERT'),set('METAGROSS'),set('LATIOS')]);
 p.phase='event';p.roomEvent='full_heal';
 pikeResolveEvent(p,[m],()=>0,moveData,data);
 assert.equal(m.hp,m.maxHp);
 assert.equal(m.pp.TACKLE,35);
 assert.equal(m.status,'');
 assert.equal(m.item,'NONE');
});
test('A burned Fire-type Pokémon keeps an existing status on entering the next room',()=>{
 const f=mon('FLAREON');f.status='burn';f.hp-=10;
 const carried=resetPikePartyForBattle(data,[set('FLAREON')],[f]);
 assert.equal(carried[0].status,'burn');
 assert.equal(carried[0].hp,f.hp);
});
