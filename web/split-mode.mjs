// Per-battle physical/special classification. Gen III uses the attack TYPE;
// modern rules use the category recorded on each move in the catalogue.
export const SPLIT_MODES=Object.freeze({move:'Par capacité (moderne)',type:'Par type (Émeraude)'});
const GEN3_SPECIAL_TYPES=new Set(['FIRE','WATER','GRASS','ELECTRIC','ICE','PSYCHIC','DRAGON','DARK']);
export function normalizeSplitMode(mode){return mode==='type'?'type':'move';}
export function moveCategory(move,splitMode='move'){
 if(!move)return 'status';
 if(move.category==='status'||(!move.power&&move.category!=='physical'&&move.category!=='special'))return 'status';
 if(normalizeSplitMode(splitMode)==='move')return move.category;
 return GEN3_SPECIAL_TYPES.has(move.type)?'special':'physical';
}
export function splitCategory(engine,move){return moveCategory(move,engine?.splitMode);}
export function moveDetails(move,splitMode='move'){
 if(!move)return {category:'status',power:'—',accuracy:'—'};
 return {category:moveCategory(move,splitMode),
  power:move.category==='status'||!Number.isFinite(move.power)||move.power<=0?'—':String(move.power),
  accuracy:move.accuracy===0||move.accuracy===null||move.accuracy===undefined?'—':move.accuracy+' %'};
}
