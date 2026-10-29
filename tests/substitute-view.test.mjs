import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCombatMon} from '../web/battle-view.mjs';
const data={species:{PIKACHU:{types:['ELECTRIC'],sprite:'pikachu'}},speciesNames:{PIKACHU:'Pikachu'}};
const mon={id:'p1',species:'PIKACHU',name:'Pikachu',level:50,hp:90,maxHp:100,status:'',stages:{},substitute:25};
test('Clonage actif masque et grise le Pokémon derrière la poupée',()=>{
 const html=renderCombatMon(mon,false,data);
 assert.match(html,/battler-substitute/);assert.match(html,/substitute-doll/);assert.match(html,/CLONE · 25 PV/);
 assert.match(html,/pokemon-img/);
});
test('Clonage détruit ou Pokémon K.O. masque la poupée',()=>{
 for(const override of [{substitute:0},{hp:0}]){
  const html=renderCombatMon({...mon,...override},false,data);
  assert.doesNotMatch(html,/substitute-doll/);
 }
});
