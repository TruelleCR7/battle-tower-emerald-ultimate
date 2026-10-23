import {stageRatio} from './battle-stats.mjs';
export const TYPES={NORMAL:['Normal','#b8b6a0'],FIRE:['Feu','#f29859'],WATER:['Eau','#83b5f2'],GRASS:['Plante','#9dce70'],ELECTRIC:['Électrik','#f5d65b'],ICE:['Glace','#a5e3e4'],FIGHTING:['Combat','#de8e82'],POISON:['Poison','#d4a0d9'],GROUND:['Sol','#e1c482'],FLYING:['Vol','#c5b8ef'],PSYCHIC:['Psy','#f4a0b9'],BUG:['Insecte','#c4d16a'],ROCK:['Roche','#c7b680'],GHOST:['Spectre','#b6a4d3'],DRAGON:['Dragon','#b4a1ef'],DARK:['Ténèbres','#b7a99e'],STEEL:['Acier','#bbc9d7'],FAIRY:['Fée','#efb6d7']};
export const typeName=t=>TYPES[t]?.[0]||t;
export function percent(hp,max,precision=1){return (max>0?100*Math.max(0,hp)/max:0).toFixed(precision).replace('.',',');}
export function targetPlan(engine,actor,move){const m=engine.get(actor),meta=engine.data.moveData[move];if(!m||!meta)return {automatic:true,targets:[]};const side=engine.sideOf(m),foe=side==='player'?'opponent':'player';
 if(meta.target==='self'||meta.target==='enemyfield')return {automatic:true,targets:[m],label:meta.target==='self'?'Sur soi-même':'Terrain adverse'};
 if(['COUNTER','MIRROR_COAT'].includes(meta.originalEffect))return {automatic:true,targets:engine.active(foe),label:'Dernier attaquant '+(meta.originalEffect==='COUNTER'?'physique':'spécial')};
 if(meta.target==='random')return {automatic:true,targets:engine.active(foe),label:'Adversaire aléatoire (moteur)'};
 if(meta.target==='enemies')return {automatic:true,targets:engine.active(foe),label:'Tous les adversaires'};
 if(meta.target==='all')return {automatic:true,targets:[...engine.active(foe),...engine.active(side).filter(t=>t.id!==actor)],label:'Tous les autres Pokémon'};
 return {automatic:false,targets:[...engine.active(foe),...engine.active(side).filter(t=>t.id!==actor)]};
}
export function groupedLog(log){const groups=new Map();for(const event of [...log].reverse()){if(!groups.has(event.turn))groups.set(event.turn,[]);if(!event.text.startsWith('— Tour '))groups.get(event.turn).push(event);}return [...groups].reverse();}

export function statChanges(mon){
 const labels={atk:'ATQ',def:'DÉF',spa:'ATQ SPÉ',spd:'DÉF SPÉ',spe:'VIT',acc:'PRÉC',eva:'ESQ'};
 return Object.entries(labels).filter(([key])=>mon.stages?.[key]).map(([key,label])=>{
  const stage=mon.stages[key],ratio=stageRatio(stage,['acc','eva'].includes(key)),mult=ratio[0]/ratio[1];
  return {key,label,stage,multiplier:mult,labelText:`${label} ${stage>0?'+':''}${stage} · ×${Number(mult.toFixed(2)).toString().replace('.',',')}`};
 });
}
