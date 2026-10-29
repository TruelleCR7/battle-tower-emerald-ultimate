export const DEFAULT_PREFERENCES={moveAnimations:true,animationSpeed:'normal',respectReducedMotion:true};
export function preferences(state){return {...DEFAULT_PREFERENCES,...state.preferences};}
export const MOVE_VISUALS={THUNDERBOLT:'electric',THUNDER:'electric',THUNDER_PUNCH:'electric',ICE_BEAM:'ice',ICE_PUNCH:'ice',BLIZZARD:'ice',FLAMETHROWER:'fire',FIRE_BLAST:'fire',FIRE_PUNCH:'fire',OVERHEAT:'fire',SURF:'water',WATER_GUN:'water',HYDRO_PUMP:'water',METEOR_MASH:'contact',EARTHQUAKE:'ground',DRAGON_CLAW:'contact',TACKLE:'contact',SHADOW_BALL:'ghost',PSYCHIC:'psychic'};
export function presentationPlan(events,prefs,reduced=false){
 if(!prefs.moveAnimations||(prefs.respectReducedMotion&&reduced))return [];
 const duration=prefs.animationSpeed==='fast'?160:380;
 return events.flatMap((e,index)=>e.kind==='move'?[{actor:e.actor,target:e.target,visual:MOVE_VISUALS[e.move]||'impact',duration,index}]:e.kind==='damage'?[{target:e.actor,visual:'impact',duration:Math.round(duration*.65),index}]:e.kind==='stat'?[{target:e.actor,visual:e.to>e.from?'raise':'lower',duration,index}]:e.kind==='heal'?[{target:e.actor,visual:'heal',duration,index}]:[]);
}
export class BattlePresenter{
 constructor(root){this.root=root;this.generation=0;this.running=[];}
 cancel(){this.generation++;for(const a of this.running)a.cancel();this.running=[];}
 async play(events,prefs){
  this.cancel();const generation=this.generation;
  const plan=presentationPlan(events,prefs,globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false);
  for(const cue of plan){if(generation!==this.generation)break;
   const feed=this.root.querySelector('#battle-dialogue');const entries=feed?.querySelectorAll('.log-turn li');
   const precedingMarkers=events.slice(0,cue.index).filter(e=>e.text?.startsWith('— Tour ')).length;const current=entries?.[cue.index-precedingMarkers];if(current){feed.querySelector('.is-playing')?.classList.remove('is-playing');current.classList.add('is-playing');current.scrollIntoView?.({block:'nearest',behavior:'instant'});}
   const target=this.root.querySelector(`[data-battler="${cue.target||cue.actor}"]`),actor=this.root.querySelector(`[data-battler="${cue.actor}"]`);if(!target)continue;
   let element=target,frames;
   if(cue.visual==='contact'){element=actor||target;frames=[{transform:'translateX(0)'},{transform:'translateX(18px)',offset:.35},{transform:'translateX(-3px)',offset:.7},{transform:'translateX(0)'}];}
   else if(cue.visual==='impact')frames=[{transform:'translateX(0)',filter:'brightness(1)'},{transform:'translateX(-5px)',filter:'brightness(1.7)',offset:.25},{transform:'translateX(5px)',filter:'brightness(1.5)',offset:.5},{transform:'translateX(-2px)',filter:'brightness(1.3)',offset:.75},{transform:'translateX(0)',filter:'brightness(1)'}];
   else if(cue.visual==='ground')frames=[{transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},{transform:'translate(6px,-3px)'},{transform:'translate(-4px,2px)'},{transform:'translate(0,0)'}];
   else{const colors={electric:'#ffed57',ice:'#92e9ff',fire:'#ff8044',water:'#429aff',ghost:'#b590eb',psychic:'#ff80cd',raise:'#75df99',lower:'#ff9b7c',heal:'#86f1bd'};
    frames=[{filter:'brightness(1)',boxShadow:'inset 0 0 0 0 transparent'},{filter:'brightness(1.5)',boxShadow:`inset 0 0 0 7px ${colors[cue.visual]}`,offset:.45},{filter:'brightness(1)',boxShadow:'inset 0 0 0 0 transparent'}];}
   if(!element.animate)continue;const animation=element.animate(frames,{duration:cue.duration,easing:'steps(5,end)'});this.running.push(animation);await animation.finished.catch(()=>{});
  }
  this.root.querySelector('.is-playing')?.classList.remove('is-playing');this.running=[];
 }
}
