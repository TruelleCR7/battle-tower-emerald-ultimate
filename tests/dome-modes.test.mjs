import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TowerEngine} from '../web/engine.mjs';

const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
const engineSource=readFileSync(new URL('../web/engine.mjs',import.meta.url),'utf8');

function demoEngine(){
 const e=Object.create(TowerEngine.prototype);
 const mon=(id,owner)=>({id,owner,hp:100,active:id.endsWith('0')});
 e.player={party:[mon('p0','human'),mon('p1','human'),mon('p2','human')],active:['p0']};
 e.opponent={party:[mon('e0','cpu'),mon('e1','cpu'),mon('e2','cpu')],active:['e0']};
 e.sets=[{species:'A'},{species:'B'},{species:'C'}];
 e.originalConfig={team:e.sets,mode:'single'};
 e.turn=0;e.status='active';e.log=[];
 e.entryEffects=mons=>{e.entered=mons.map(m=>m.id);};
 e.write=msg=>e.log.push({text:msg});
 return e;
}
test('Dome Solo starts with two selected per side, first in play, and entry effects once',()=>{
 const e=demoEngine();
 e.startDomeBattle([2,0],[1,2],'single');
 assert.deepEqual(e.player.party.map(p=>p.id),['p2','p0']);
 assert.deepEqual(e.opponent.party.map(p=>p.id),['e1','e2']);
 assert.deepEqual(e.player.active,['p2']);
 assert.deepEqual(e.opponent.active,['e1']);
 assert.deepEqual(e.entered,['e1','p2']);
 assert.deepEqual(e.sets.map(m=>m.species),['C','A']);
 assert.throws(()=>e.startDomeBattle([0,1],[0,1],'single'),/déjà commencé/);
});
test('Dome Duo activates both entrants on each side with deferred entry effects',()=>{
 const e=demoEngine();
 e.startDomeBattle([1,2],[2,0],'double');
 assert.deepEqual(e.player.active,['p1','p2']);
 assert.deepEqual(e.opponent.active,['e2','e0']);
 assert.deepEqual(e.entered,['e2','e0','p1','p2']);
 assert.equal(e.originalConfig.mode,'double');
});
test('Dome rejects invalid registration without changing parties',()=>{
 const e=demoEngine();
 assert.throws(()=>e.startDomeBattle([0,0],[1,2],'single'),/différents/);
 assert.deepEqual(e.player.party.map(p=>p.id),['p0','p1','p2']);
 assert.equal(e.domeBattleStarted,undefined);
});
test('Other facilities keep entry effects at battle constructor time',()=>{
 assert.match(engineSource,/if\(!config\.deferEntryEffects\)this\.entryEffects/);
 assert.match(app,/deferEntryEffects:isDome/);
 assert.match(app,/engine\.startDomeBattle\(indices,cpuIndices,run\.mode\)/);
});
test('Dome replay is saved without deleting past battle logs',()=>{
 assert.match(app,/run\.recordedBattles\?\?=\[\]/);
 assert.match(app,/run\.recordedBattles\.push\(previous\.number\)/);
 assert.match(app,/showDomeSavedReplay\(run,previous\)/);
 assert.match(app,/id="dome-replay-export"/);
});
test('Tower-specific Brain medals never leak into Dome or Factory records',()=>{
 assert.match(app,/state\.facility==='tower'&&state\.mode==='single'/);
});
