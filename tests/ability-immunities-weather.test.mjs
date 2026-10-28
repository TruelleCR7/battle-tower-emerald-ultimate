import test from 'node:test';
import assert from 'node:assert/strict';
import {TowerEngine} from '../web/engine.mjs';
import {effectiveStat} from '../web/battle-stats.mjs';

function scenario(ability='NONE'){
 const mon=(id,owner,talent)=>({id,name:id,owner,ability:talent,species:'MON',level:50,active:true,hp:160,maxHp:160,item:'NONE',status:'',moves:['FLAMETHROWER','EARTHQUAKE'],pp:{FLAMETHROWER:15,EARTHQUAKE:10},stats:{atk:100,def:100,spa:100,spd:100,spe:100},stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0},guarded:false,protectCount:0,receivedDamage:{},choiceLock:''});
 const p=mon('p','human','NONE'),o=mon('o','cpu',ability);
 const e=Object.create(TowerEngine.prototype);
 e.player={party:[p],active:['p']};e.opponent={party:[o],active:['o']};
 e.data={species:{MON:{types:['NORMAL']}},moveData:{
  FLAMETHROWER:{name:'Lance-Flammes',type:'FIRE',category:'special',power:90,accuracy:100,pp:15,target:'enemy',originalEffect:'HIT',effect:'damage'},
  EARTHQUAKE:{name:'Séisme',type:'GROUND',category:'physical',power:100,accuracy:100,pp:10,target:'enemy',originalEffect:'HIT',effect:'damage'}}};
 e.mode='single';e.weather='';e.weatherTurns=0;e.hazards={player:0,opponent:0};e.turn=0;e.log=[];
 e.rng=()=>.5;e.write=(text,event={})=>e.log.push({text,...event});
 return {e,p,o};
}
test('Levitate gives complete immunity to Ground damaging moves',()=>{
 const {e,p,o}=scenario('LEVITATE');
 assert.equal(e.damagePreview(p,o,e.data.moveData.EARTHQUAKE).mult,0);
 e.execute(p,{type:'move',move:'EARTHQUAKE',target:'o'});
 assert.equal(o.hp,160);
 assert.ok(e.log.some(x=>x.text.includes("n'affecte pas")));
});
test('Ground moves still hit Pokémon without Levitate',()=>{
 const {e,p,o}=scenario('NONE');
 assert.ok(e.damagePreview(p,o,e.data.moveData.EARTHQUAKE).damage>0);
});
test('Flash Fire absorbs incoming Fire damage and boosts the holder’s next Fire attack',()=>{
 const {e,p,o}=scenario('FLASH_FIRE');
 e.execute(p,{type:'move',move:'FLAMETHROWER',target:'o'});
 assert.equal(o.hp,160);
 assert.equal(o.flashFire,true);
 assert.ok(e.log.some(x=>x.text.includes('Torche')));
 const move=e.data.moveData.FLAMETHROWER;
 assert.ok(effectiveStat(e,o,'spa',{move,target:p})===100);
 // The multiplier is applied at the damage stage, not on the base Sp. Atk stat.
 const boosted=e.damagePreview(o,p,move).damage;
 o.flashFire=false;
 const normal=e.damagePreview(o,p,move).damage;
 assert.ok(boosted>normal);
});
test('Drizzle and Drought set persistent weather on entry',()=>{
 const {e,p,o}=scenario('DRIZZLE');
 e.entryEffects([o]);
 assert.equal(e.weather,'rain');assert.equal(e.weatherTurns,-1);
 o.ability='DROUGHT';e.entryEffects([o]);
 assert.equal(e.weather,'sun');assert.equal(e.weatherTurns,-1);
});
test('Cloud Nine still suppresses damage effects of weather without erasing its state',()=>{
 const {e,p,o}=scenario('DRIZZLE');
 p.ability='CLOUD_NINE';
 e.entryEffects([o]);
 assert.equal(e.weather,'rain');assert.equal(e.weatherTurns,-1);
 const physical=e.damagePreview(o,p,e.data.moveData.EARTHQUAKE).damage;
 assert.ok(physical>0);
});

test('Flash Fire blocks Fire-type status attacks including Will-O-Wisp',()=>{
 const {e,p,o}=scenario('FLASH_FIRE');
 const willo={name:'Feu Follet',type:'FIRE',category:'status',effect:'burn',originalEffect:'WILL_O_WISP',accuracy:85,target:'enemy'};
 e.targetStatus(p,o,willo);
 assert.equal(o.status,'');
 assert.equal(o.flashFire,true);
 assert.ok(e.log.some(x=>x.text.includes('Torche')));
});
