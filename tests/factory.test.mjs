import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFactoryDraft,proposeFactoryExchange,resolveFactoryExchange,validRentalTeam} from '../web/factory.mjs';
const mon=(species,item='NONE')=>({species,item,moves:['TACKLE']});
const pool=['A','B','C','D','E','F'].map(mon);
test('draft: choose exactly three distinct rentals',()=>{
 assert.deepEqual(beginFactoryDraft(pool,[0,2,4]).team.map(x=>x.species),['A','C','E']);
 assert.throws(()=>beginFactoryDraft(pool,[0,0,1]));
});
test('exchange: click offered Pokémon then replace own Pokémon',()=>{
 const draft=beginFactoryDraft(pool,[0,1,2]);
 const offered=proposeFactoryExchange(draft,[mon('X'),mon('Y'),mon('Z')]);
 const next=resolveFactoryExchange(offered,{give:1,take:2});
 assert.deepEqual(next.team.map(x=>x.species),['A','Z','C']);
 assert.equal(next.exchanges,1);assert.equal(next.phase,'battle');
 assert.deepEqual(draft.team.map(x=>x.species),['A','B','C']);
});
test('exchange: passing leaves rentals unchanged',()=>{
 const offered=proposeFactoryExchange(beginFactoryDraft(pool,[0,1,2]),[mon('X'),mon('Y'),mon('Z')]);
 const next=resolveFactoryExchange(offered,'pass');
 assert.deepEqual(next.team.map(x=>x.species),['A','B','C']);assert.equal(next.exchanges,0);
});
test('exchange: reject duplicate species or items',()=>{
 const offered=proposeFactoryExchange(beginFactoryDraft(pool,[0,1,2]),[mon('A'),mon('Z','HELMET'),mon('X')]);
 assert.throws(()=>resolveFactoryExchange(offered,{give:1,take:0}));
 assert.equal(validRentalTeam([mon('A','ORB'),mon('B','ORB'),mon('C')]),false);
});
