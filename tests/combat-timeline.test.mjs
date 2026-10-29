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

test('les événements de dégâts et soins conservent leur index pour le replay PV',()=>{
 const events=[{kind:'move',actor:'a',target:'b',move:'TACKLE',text:'attaque'},{kind:'damage',actor:'b',amount:20,text:'perd 20 PV'},{kind:'heal',actor:'b',amount:8,text:'récupère 8 PV'}];
 const cues=presentationPlan(events,{moveAnimations:true,animationSpeed:'normal',respectReducedMotion:true});
 assert.deepEqual(cues.map(c=>c.index),[0,1,2]);
 assert.deepEqual(cues.map(c=>c.target),['b','b','b']);
});

test('statuts et remplacements produisent des animations ordonnées',()=>{
 const events=[{kind:'status',actor:'a',status:'burn'},{kind:'status',actor:'b',status:'poison'},{kind:'switch',actor:'a',to:'c'}];
 const cues=presentationPlan(events,{moveAnimations:true,animationSpeed:'normal',respectReducedMotion:false});
 assert.deepEqual(cues.map(c=>c.visual),['fire','poison','switch']);
 assert.deepEqual(cues.map(c=>c.index),[0,1,2]);
});

test('les six altérations disposent de leurs effets visuels',()=>{
 const statuses=['sleep','freeze','poison','toxic','paralyze','burn','confusion'];
 const cues=presentationPlan(statuses.map(status=>({kind:'status',status,actor:'target'})),{moveAnimations:true,animationSpeed:'normal',respectReducedMotion:true});
 assert.deepEqual(cues.map(c=>c.visual),['sleep','ice','poison','poison','electric','fire','confusion']);
});

test('K.O. et retour au combat disposent de transitions dédiées',()=>{
 const events=[{kind:'faint',actor:'old'},{kind:'replacement',actor:'new'}];
 const cues=presentationPlan(events,{moveAnimations:true,animationSpeed:'normal',respectReducedMotion:true});
 assert.deepEqual(cues.map(c=>c.visual),['faint','switch']);
});

test('le cycle de Clonage produit trois animations ordonnées',()=>{
 const events=[{kind:'substitute-create',actor:'a',amount:25},{kind:'substitute-hit',actor:'a',amount:12,remaining:13},{kind:'substitute-break',actor:'a'}];
 const cues=presentationPlan(events,{moveAnimations:true,animationSpeed:'fast',respectReducedMotion:true});
 assert.deepEqual(cues.map(c=>c.visual),['clone-create','clone-hit','clone-break']);
 assert.deepEqual(cues.map(c=>c.index),[0,1,2]);
});
