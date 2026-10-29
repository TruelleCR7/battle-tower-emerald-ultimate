import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationPlan} from '../web/battle-presentation.mjs';

test('animations attachées aux événements, dans l’ordre du moteur',()=>{
 const events=[
  {turn:1,text:'— Tour 1 —'},
  {kind:'move',actor:'a',target:'b',move:'THUNDERBOLT',text:'attaque'},
  {kind:'damage',actor:'b',text:'perd 40 PV'},
  {kind:'stat',actor:'a',from:0,to:1,text:'attaque augmente'},
  {kind:'heal',actor:'a',text:'soin'}
 ];
 const cues=presentationPlan(events,{moveAnimations:true,animationSpeed:'normal',respectReducedMotion:true},false);
 assert.deepEqual(cues.map(c=>c.visual),['electric','impact','raise','heal']);
 assert.deepEqual(cues.map(c=>c.index),[1,2,3,4]);
});
test('les paramètres de mouvement réduits désactivent les animations',()=>{
 const events=[{kind:'move',actor:'a',move:'TACKLE'}];
 assert.deepEqual(presentationPlan(events,{moveAnimations:false,animationSpeed:'normal',respectReducedMotion:false}),[]);
 assert.deepEqual(presentationPlan(events,{moveAnimations:true,animationSpeed:'fast',respectReducedMotion:true},true),[]);
 assert.equal(presentationPlan(events,{moveAnimations:true,animationSpeed:'fast',respectReducedMotion:false},true)[0].duration,160);
});
