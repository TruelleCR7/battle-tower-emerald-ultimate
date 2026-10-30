import {validateTeam} from './engine.mjs';
import {migrateState,RUN_RULES,CONTENT_PACK} from './runs.mjs';
export const SAVE_SCHEMA=2;
const ENGINE_KEYS=['facility','splitMode','inverseBattle','safeguards','mode','levelMode','level','rngState','trainerHistory','streak','round','series','log','turn','status','weather','weatherTurns','hazards','player','opponent','trainer','score','sets','originalConfig','trainerData','screens','reflections','lightScreens','mist','pendingReplacements'];
function finiteTree(x){if(typeof x==='number'&&!Number.isFinite(x))throw Error('Nombre invalide.');if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Clé interdite.');finiteTree(v);}}
function validateSnapshot(e,data){
 if(!e||!['active','won','lost'].includes(e.status)||!Number.isInteger(e.turn)||e.turn<0||!Number.isInteger(e.rngState)||e.rngState<0||e.rngState>0xffffffff||!Number.isInteger(e.streak)||e.streak<0)throw Error('État de combat invalide.');
 if(Object.keys(e).some(k=>!ENGINE_KEYS.includes(k)))throw Error('Propriété du moteur inconnue.');
 if(e.splitMode!==undefined&&!['move','type'].includes(e.splitMode))throw Error('Split physique/spécial invalide.');if(e.inverseBattle!==undefined&&typeof e.inverseBattle!=='boolean')throw Error('Combat inversé invalide.');
 if(e.facility!==undefined&&!['tower','factory','dome','palace'].includes(e.facility))throw Error('Installation invalide.');
 const ids=new Set();for(const side of ['player','opponent']){const s=e[side];if(!Array.isArray(s?.party)||!s.party.length||s.party.length>4||!Array.isArray(s.active)||s.active.length>2)throw Error('Groupe de combat invalide.');
 for(const m of s.party){if(typeof m.id!=='string'||ids.has(m.id)||!data.species[m.species]||!Number.isInteger(m.hp)||!Number.isInteger(m.maxHp)||m.maxHp<=0||m.maxHp>1000||m.hp<0||m.hp>m.maxHp||!m.stats||!m.stages||!m.pp||!Array.isArray(m.moves)||m.moves.some(k=>!data.moveData[k])||!['human','human2','cpu','cpu1','cpu2','partner'].includes(m.owner))throw Error('Pokémon de combat invalide.');ids.add(m.id);}
 if(s.active.some(id=>id!==null&&!s.party.some(m=>m.id===id&&m.active))||new Set(s.active.filter(Boolean)).size!==s.active.filter(Boolean).length)throw Error('Positions de combat invalides.');}
 for(const r of e.pendingReplacements||[]){if(!['player','opponent'].includes(r.side)||!Number.isInteger(r.slot)||r.slot<0||r.slot>=e[r.side].active.length||e[r.side].active[r.slot]!==null||!e[r.side].party.some(m=>m.id===r.fainted&&m.hp===0&&m.owner===r.owner))throw Error('Remplacement en attente invalide.');}
 if(!Array.isArray(e.log)||e.log.some(x=>!Number.isInteger(x.turn)||typeof x.text!=='string'))throw Error('Journal invalide.');
}
export function validateImport(raw,data){
 finiteTree(raw);
 if(!raw||![1,SAVE_SCHEMA].includes(raw.schema)||raw.application!=='battle-tower-emerald')throw Error('Format de sauvegarde non reconnu.');
 const s=structuredClone(raw.state);if(!s||!['single','double','multi'].includes(s.mode)||!['50','open'].includes(s.levelMode))throw Error('Format ou niveau invalide.');
 if(s.splitMode!==undefined&&!['move','type'].includes(s.splitMode))throw Error('Split physique/spécial invalide.');if(s.inverseBattle!==undefined&&typeof s.inverseBattle!=='boolean')throw Error('Combat inversé invalide.');
 // The editable team can be incomplete while a player is building it.
 if(!Array.isArray(s.team)||s.team.length>4)throw Error('Équipe invalide.');
 const errors=validateTeam(s.team,s.mode,s.levelMode,data).filter(x=>!x.startsWith('Ce mode nécessite'));if(errors.length)throw Error(errors.join(' · '));
 for(const t of s.savedTeams||[]){if(typeof t.name!=='string'||t.name.length>80||validateTeam(t.members,t.mode,t.levelMode,data).length)throw Error('Équipe enregistrée invalide.');}
 const ids=new Set();for(const r of s.runs||[]){if(typeof r.id!=='string'||ids.has(r.id)||!['tower','factory','dome','palace'].includes(r.facility)||r.rules!==RUN_RULES||r.pack!==CONTENT_PACK||typeof r.name!=='string'||r.name.length>80||validateTeam(r.team,r.mode,r.levelMode,data).length||!Array.isArray(r.completedBattles)||!Array.isArray(r.pastBattles)||!Number.isInteger(r.victories)||r.victories<0)throw Error('Défi invalide ou version incompatible.');ids.add(r.id);validateSnapshot(r.engine,data);if(r.engine.mode!==r.mode||r.engine.levelMode!==r.levelMode)throw Error('Contexte de combat incohérent.');for(const a of Object.values(r.actions||{})){if(!r.engine.player.party.some(m=>m.id===a.actor&&m.active)||!['move','switch'].includes(a.type))throw Error('Décision invalide.');if(a.type==='move'&&!data.moveData[a.move])throw Error('Capacité inconnue.');}}
 // Legacy v1 exports did not provide a validated combat snapshot contract.
 s.session=null;return migrateState(s);
}
export function exportSave(state){return {application:'battle-tower-emerald',schema:SAVE_SCHEMA,version:'0.6.2',state:structuredClone(state)};}
export function restoreEngine(data,session,Engine){
 // Restore without constructing a new battle: no new adversary, IDs or RNG draws.
 const e=Object.create(Engine.prototype);for(const k of ENGINE_KEYS)if(Object.hasOwn(session.engine,k))e[k]=structuredClone(session.engine[k]);e.data=data;e.rng=()=>e.random();return e;
}
