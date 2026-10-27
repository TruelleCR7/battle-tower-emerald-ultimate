/* Usine de Combat — logique de location/échange, indépendante de l'interface.
 * Portage progressif : sélection du pool et règles de sets à vérifier contre
 * src/battle_factory.c et les tables de pret/pokeemerald avant conformité complète.
 */
import {officialSet} from './frontier.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const key=s=>s.item&&s.item!=='NONE'?s.item:null;
export function validRentalTeam(team){
 if(!Array.isArray(team)||team.length!==3)return false;
 return new Set(team.map(x=>x.species)).size===3 &&
  new Set(team.map(key).filter(Boolean)).size===team.map(key).filter(Boolean).length;
}
export function rentalPool(data,{size=6,levelMode='50',iv=15,rng=Math.random,exclude=[]}={}){
 if(!Number.isInteger(size)||size<3)throw Error('Taille de location invalide');
 const species=new Set(exclude.map(x=>x.species));
 const items=new Set(exclude.map(key).filter(Boolean));
 const candidates=(data.towerSets||[]).filter(s=>data.species[s.species]&&(!data.banned||!data.banned.includes(s.species))&&(levelMode!=='50'||s.ordinal<=849));
 const result=[];let attempts=0;
 while(result.length<size){
  if(++attempts>30000)throw Error('Pool de location insuffisant');
  const raw=candidates[Math.floor(rng()*candidates.length)];
  if(!raw||species.has(raw.species)||(key(raw)&&items.has(key(raw))))continue;
  const mon=officialSet(data,raw,iv);result.push(mon);species.add(mon.species);if(key(mon))items.add(key(mon));
 }
 return result;
}
export function beginFactoryDraft(pool,indices){
 if(!Array.isArray(pool)||pool.length!==6)throw Error('Six locations sont nécessaires');
 if(!Array.isArray(indices)||indices.length!==3||new Set(indices).size!==3||indices.some(i=>!Number.isInteger(i)||i<0||i>=6))throw Error('Sélectionne trois Pokémon distincts');
 const team=indices.map(i=>copy(pool[i]));
 if(!validRentalTeam(team))throw Error('Équipe de location invalide');
 return {team,offers:[],exchanges:0,history:[],phase:'battle'};
}
export function proposeFactoryExchange(state,opponentTeam){
 if(state.phase!=='battle')throw Error('Échange indisponible');
 if(!Array.isArray(opponentTeam)||opponentTeam.length!==3)throw Error('Trois adversaires requis');
 const offers=opponentTeam.map(copy);
 return {...copy(state),offers,phase:'exchange'};
}
export function resolveFactoryExchange(state,choice){
 if(state.phase!=='exchange')throw Error('Aucune proposition en attente');
 if(choice===null||choice==='pass')return {...copy(state),offers:[],phase:'battle',history:[...state.history,{action:'pass'}]};
 const {give,take}=choice||{};
 if(!Number.isInteger(give)||give<0||give>=3||!Number.isInteger(take)||take<0||take>=state.offers.length)throw Error('Choix d’échange invalide');
 const team=copy(state.team);const received=copy(state.offers[take]);const surrendered=team[give];team[give]=received;
 if(!validRentalTeam(team))throw Error('Échange interdit : espèce ou objet en double');
 return {...copy(state),team,offers:[],phase:'battle',exchanges:state.exchanges+1,history:[...state.history,{action:'exchange',give:surrendered.species,take:received.species}]};
}
