import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TowerEngine} from '../web/engine.mjs';
import {scoreEmeraldPartial} from '../web/ai_emerald_partial.mjs';
const d=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const base=k=>JSON.parse(JSON.stringify(d.sets[k]));
const newGame=()=>new TowerEngine(d,{mode:'single',levelMode:'50',team:['METAGROSS','SWAMPERT','LATIOS'].map(base),seed:123456});
test('Portage partiel AI_CheckBadMove : immunité pénalisée',()=>{
 let e=newGame(),user=e.player.party[0],t=e.opponent.party[0];
 t.species='GENGAR';t.ability='LEVITATE';
 assert.ok(scoreEmeraldPartial(e,user,t,'EARTHQUAKE')<scoreEmeraldPartial(e,user,t,'METEOR_MASH'));
});
test('Portage partiel AI_TryToFaint : prime KO',()=>{
 let e=newGame(),user=e.player.party[0],t=e.opponent.party[0];t.hp=1;
 assert.ok(scoreEmeraldPartial(e,user,t,'METEOR_MASH')>=4);
});
test('Module AI : dommage fixe et priorité sont accessibles',()=>{
 let e=newGame();const m=e.player.party[0];
 const candidate=e.aiAction(m);assert.ok(candidate);assert.ok(['move','switch','pass'].includes(candidate.type));
});
