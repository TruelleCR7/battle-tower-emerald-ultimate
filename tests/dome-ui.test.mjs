import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDomeTournament,domeNextOpponent,domeResolveRound,domeSelectTwo,domeCpuSelection,DOME_PAIRS} from '../web/dome.mjs';
const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
test('Dome is selectable and tournament screens are wired',()=>{
 assert.match(html,/<option value="dome">Dôme de Combat<\/option>/);
 assert.match(app,/created\.facility='dome'/);
 assert.match(app,/function renderDomeScreen\(/);
 assert.match(app,/data-dome-pick/);
 assert.match(app,/domeSelectTwo\(run\.team,indices\)/);
});
test('status labels and factory translation are present',()=>{
 for(const label of ['SOMMEIL','PARALYSÉ','TOXIK','POISON','CONFUS','FR_NATURES','FR_ITEMS','FR_ABILITIES','moveTypeBadge'])assert.ok(app.includes(label),label);
});
const data={species:Object.fromEntries(Array.from({length:16},(_,i)=>['MON'+i,{baseStats:{hp:50+i,atk:60,def:70,spa:80,spd:90,spe:100},types:['NORMAL']}]))};
const team=i=>[{species:'MON'+i,level:50},{species:'MON'+i,level:50},{species:'MON'+i,level:50}];
test('Dome seeds 16 trainers and places player in exactly one match',()=>{
 const dome=createDomeTournament(team(0),Array.from({length:15},(_,i)=>({name:'CPU '+i,team:team(i+1)})),data);
 assert.equal(dome.participants.length,16);
 assert.deepEqual(DOME_PAIRS[0],[1,9]);
 assert.equal(dome.rounds[0].length,8);
 assert.equal(dome.rounds[0].filter(pair=>pair.includes('player')).length,1);
 assert.ok(domeNextOpponent(dome));
});
test('Dome resolves exactly four elimination rounds with 16 to 1 participants',()=>{
 const dome=createDomeTournament(team(0),Array.from({length:15},(_,i)=>({name:'CPU '+i,team:team(i+1)})),data);
 for(const n of [8,4,2,1]){
  assert.equal(dome.rounds[dome.round].length,n);
  domeResolveRound(dome,true,()=>0.3);
 }
 assert.equal(dome.champion,'player');
 assert.equal(dome.results.length,4);
 assert.equal(dome.rounds.length,4);
});
test('Dome selection allows only two distinct Pokémon',()=>{
 assert.deepEqual(domeSelectTwo(['a','b','c'],[2,0]),['c','a']);
 assert.throws(()=>domeSelectTwo(['a','b','c'],[0,0]));
 assert.throws(()=>domeSelectTwo(['a','b','c'],[0,1,2]));
});

test('Dome CPU picks two distinct registered Pokémon',()=>{
 const data={species:{A:{types:['NORMAL']},B:{types:['WATER']},C:{types:['FIRE']},D:{types:['GRASS']}},moveData:{HIT:{power:60,type:'NORMAL'}}};
 const party=['A','B','C'].map(species=>({species,moves:['HIT']}));
 const result=domeCpuSelection(party,[{species:'D',moves:['HIT']}],data,{NORMAL:{}},()=>0.1);
 assert.equal(result.length,2);assert.notEqual(result[0],result[1]);
});

test('Dome reception, profile and both battle formats are available',()=>{
 for(const label of ['ADVERSAIRE','TABLEAU','COMBATTRE','ENREGISTRER','REPOS','PARTIR','PROFIL DU DRESSEUR'])assert.ok(app.includes(label),label);
 assert.match(app,/run\.mode==='double'\?selected\.map/);
 assert.match(app,/state\.facility==='dome'\?'single':state\.mode/);
});
