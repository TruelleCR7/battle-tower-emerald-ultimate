import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TowerEngine} from '../web/engine.mjs';
import {aiCoverage, scoreEmeraldScripted} from '../web/ai_emerald_scripted.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
const baseTeam=['METAGROSS','SWAMPERT','LATIOS'].map(k=>structuredClone(data.sets[k]));
const script={format:1,entries:['AI_CheckBadMove'],blocks:{AI_TryToFaint:[['end']],AI_CheckViability:[['end']],
 AI_CheckBadMove:[['get_curr_move_type'],['if_equal_','TYPE_GROUND','Penalty'],['score','+4'],['end']],
 Penalty:[['score','-10'],['end']]},tables:{},audit:{instructions:6,commands:{get_curr_move_type:1,if_equal_:1,score:2,end:2}}};
function engine(){let d={...data,aiScript:script};return new TowerEngine(d,{team:baseTeam,mode:'single',seed:123456})}
test('Source AI: branchement original sur le type de capacite',()=>{
 let e=engine(),user=e.opponent.party[0],target=e.player.party[0];
 let earth=scoreEmeraldScripted(e,user,target,'EARTHQUAKE');
 let ice=scoreEmeraldScripted(e,user,target,'ICE_BEAM');
 assert.equal(earth.score,90);assert.equal(ice.score,104);
 assert.deepEqual(earth.unsupported,[]);
});
test('Source AI: usage prioritaire des scripts sur la heuristique',()=>{
 let e=engine(),user=e.opponent.party.find(m=>m.moves.includes('EARTHQUAKE')&&m.moves.some(k=>data.moveData[k].type!=='GROUND'));
 if(!user)return;
 let no=e.get(e.opponent.active[0]);e.opponent.active=[user.id];if(no)no.active=false;user.active=true;
 const best=e.aiAction(user);assert.notEqual(best.move,'EARTHQUAKE');
});
test('Couverture IA affichee sans promettre une fidelite totale',()=>{
 const audit=aiCoverage(script);assert.equal(audit.sourceInstructions,6);
 assert.equal(audit.exactMechanics,false);
});
