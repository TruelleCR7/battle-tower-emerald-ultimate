import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {emeraldScore,emeraldRandom16,scoreEmeraldMoves,scoreEmeraldScripted,chooseEmeraldMove} from '../web/ai_emerald_scripted.mjs';
import {TowerEngine} from '../web/engine.mjs';
const D=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
const game=(mode='single')=>new TowerEngine(D,{mode,seed:12456,team:['METAGROSS','SWAMPERT','LATIOS',...(mode==='single'?[]:['SALAMENCE'])].map(k=>({...structuredClone(D.sets[k]),item:'NONE'}))});
function custom(e,blocks){e.data={...D,aiScript:{blocks:{AI_CheckBadMove:[['end']],AI_TryToFaint:[['end']],AI_CheckViability:[['end']],AI_DoubleBattle:[['end']],...blocks},order:Object.keys(blocks)}};}
test('Original compiled C Cmd_score: all 128 nonnegative scores × 256 byte operands',()=>{
 const source=fs.readFileSync(new URL('../data/upstream/src/battle_ai_script_commands.c',import.meta.url),'utf8');
 const extract=name=>source.match(new RegExp(`static void ${name}\\(void\\)\\n\\{[\\s\\S]*?\\n\\}`))[0];
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'emerald-ai-oracle-'));
 try{
 const c=path.join(dir,'oracle.c'),bin=path.join(dir,'oracle');
 fs.writeFileSync(c,`#include <stdint.h>\n#include <stdio.h>\ntypedef uint16_t u16;\nstruct {int8_t score[4];int movesetIndex;} thinking;\n#define AI_THINKING_STRUCT (&thinking)\nuint8_t bytes[16],*gAIScriptPtr; uint16_t randomValue;\nuint16_t Random(void){return randomValue;}\n#define T1_READ_PTR(p) (bytes+8)\n${['Cmd_score','Cmd_if_random_less_than','Cmd_if_random_greater_than','Cmd_if_random_equal','Cmd_if_random_not_equal'].map(extract).join('\n')}\nint main(void){for(int s=0;s<128;s++)for(int d=0;d<256;d++){thinking.score[0]=s;bytes[1]=d;gAIScriptPtr=bytes;Cmd_score();putchar(thinking.score[0]);}void (*fn[])(void)={Cmd_if_random_less_than,Cmd_if_random_greater_than,Cmd_if_random_equal,Cmd_if_random_not_equal};for(int r=0;r<65536;r++)for(int i=0;i<4;i++){randomValue=r;bytes[1]=128;gAIScriptPtr=bytes;fn[i]();putchar(gAIScriptPtr==bytes+8);}return 0;}`);
 execFileSync('cc',['-std=c99','-O2',c,'-o',bin]);const result=execFileSync(bin,[],{maxBuffer:1000000});let at=0;
 for(let s=0;s<128;s++)for(let d=0;d<256;d++)assert.equal(emeraldScore(s,d),result[at++],`${s}+${d}`);
 for(let r=0;r<65536;r++){const byte=emeraldRandom16({rng:()=>r/65536})&255;for(const b of [byte<128,byte>128,byte===128,byte!==128])assert.equal(+b,result[at++]);}
 assert.equal(at,result.length);
 }finally{for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);}
});
test('Script-major traversal, shared funcResult, exactly four setup draws',()=>{
 const e=game(),u=e.active('opponent')[0],t=e.active('player')[0];u.moves=['TACKLE','GROWL'];u.pp={TACKLE:10,GROWL:10};let n=0;e.rng=()=>[1,2,3,4,5,6][n++]/65536;
 custom(e,{AI_CheckBadMove:[['if_random_less_than','5','bonus'],['end']],bonus:[['score','1'],['get_curr_move_type'],['end']],AI_TryToFaint:[['if_equal','TYPE_NORMAL','bonus2'],['end']],bonus2:[['score','2'],['end']]});
 const r=scoreEmeraldMoves(e,u,t);assert.deepEqual(r.simulatedRNG,[99,98,97,96]);assert.deepEqual(r.scores,[100,100,0,0]);assert.equal(n,6);
 // Both slots read the result left by the last move of the preceding script.
 custom(e,{AI_CheckBadMove:[['get_curr_move_type'],['end']],AI_TryToFaint:[['if_equal','TYPE_NORMAL','bonus'],['end']],bonus:[['score','2'],['end']]});e.rng=()=>0;
 assert.deepEqual(scoreEmeraldMoves(e,u,t).scores,[102,102,0,0]);
});
test('Unknown opponent moves are not read; an observed move is recorded',()=>{
 const e=game(),u=e.active('opponent')[0],t=e.active('player')[0];t.moves=['PROTECT'];t.lastMove='';
 custom(e,{AI_CheckBadMove:[['if_has_move','AI_TARGET','MOVE_PROTECT','known'],['end']],known:[['score','-10'],['end']]});
 assert.equal(scoreEmeraldMoves(e,u,t).scores[0],100);t.lastMove='PROTECT';assert.equal(scoreEmeraldMoves(e,u,t).scores[0],90);assert.deepEqual(t.aiKnownMoves,['PROTECT']);
});
test('Turn count and unequal stat stage branch use original semantics',()=>{
 const e=game(),u=e.active('opponent')[0],t=e.active('player')[0];e.turn=3;
 custom(e,{AI_CheckBadMove:[['get_turn_count'],['if_equal','3','turn'],['end']],turn:[['if_stat_level_not_equal','AI_USER','STAT_ATK','6','bad'],['score','3'],['end']],bad:[['score','-9'],['end']]});
 assert.equal(scoreEmeraldScripted(e,u,t,u.moves[0]).score,103);
});
test('Doubles setup and tie selection consume 24 random words for three living targets',()=>{
 const e=game('double'),u=e.active('opponent')[0];let draws=0;e.rng=()=>{draws++;return 0;};custom(e,{});const a=chooseEmeraldMove(e,u);assert.equal(draws,24);assert.equal(a.target,e.active('player')[0].id);
});
test('Missing script entry is explicit, never silently skipped',()=>{
 const e=game(),u=e.active('opponent')[0],t=e.active('player')[0];custom(e,{});delete e.data.aiScript.blocks.AI_TryToFaint;
 assert.ok(scoreEmeraldMoves(e,u,t).unsupported.includes('missing_label:AI_TryToFaint'));
});
