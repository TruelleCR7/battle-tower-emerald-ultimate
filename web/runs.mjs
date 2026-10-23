// One IndexedDB transaction commits profile, runs and results together.
export const RUN_RULES='emerald-split4-v060';
export const CONTENT_PACK='emerald-731ad5b';
export const clone=x=>structuredClone(x);
export const contextKey=s=>`${s.facility||'tower'}:${s.mode}:${s.levelMode}`;
export function serializeEngine(e){return clone(Object.fromEntries(Object.entries(e).filter(([k])=>!['data','rng'].includes(k))));}
export function createRun(state,engine,id=globalThis.crypto?.randomUUID?.()||('run-'+Date.now().toString(36)+'-'+Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-'))){
 const now=new Date().toISOString();return {id,facility:'tower',mode:state.mode,levelMode:state.levelMode,name:`Tour ${state.mode} · ${now.slice(0,10)}`,createdAt:now,updatedAt:now,version:'0.6.2',rules:RUN_RULES,pack:CONTENT_PACK,team:clone(state.team),partner:clone(state.partner||[]),engine:serializeEngine(engine),actions:{},victories:engine.streak||0,trainerHistory:[],completedBattles:[],pastBattles:[],events:{},archived:false};
}
export function captureRun(run,engine,actions={}){
 const next=clone(run);next.engine=serializeEngine(engine);next.actions=clone(actions);next.updatedAt=new Date().toISOString();
 const resultKey=`${engine.streak}:${engine.trainerData?.id??engine.trainer}`;
 if(engine.status!=='active'&&!next.completedBattles.includes(resultKey)){
  next.completedBattles.push(resultKey);
  if(engine.status==='won'){next.victories=engine.streak+1;next.trainerHistory.push(engine.trainerData?.id);next.trainerHistory=next.victories%7===0?[]:next.trainerHistory.filter(Number.isInteger);}
 }
 return next;
}
export function migrateState(input){
 const s=clone(input);s.runs??=[];
 if(s.session?.engine&&!s.runs.some(r=>r.id==='migrated-v05')){
  const session=s.session;const run=createRun({...s,...session},session.engine,'migrated-v05');run.name='Défi repris de v0.5.0';run.victories=session.engine.streak+(session.engine.status==='won'?1:0);run.trainerHistory=clone(s.trainerHistory||[]);
  if(session.engine.status!=='active')run.completedBattles=[`${session.engine.streak}:${session.engine.trainerData?.id??session.engine.trainer}`];s.runs.push(run);
 }
 delete s.session;s.schema=2;s.records??={};s.savedTeams??=[];return s;
}
export class SaveConflict extends Error {constructor(){super('Cette sauvegarde a changé dans un autre onglet. Recharge la page pour reprendre la version enregistrée.');}}
export class RunStore {
 constructor(indexedDB=globalThis.indexedDB,name='battle-tower-emerald-v06'){this.indexedDB=indexedDB;this.name=name;}
 async open(){this.db=await new Promise((resolve,reject)=>{const r=this.indexedDB.open(this.name,1);r.onupgradeneeded=()=>r.result.createObjectStore('save');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Ferme les autres onglets du jeu puis recharge.'));});this.db.onversionchange=()=>this.db.close();return this;}
 async load(){return new Promise((resolve,reject)=>{const tx=this.db.transaction('save','readonly'),r=tx.objectStore('save').get('profile');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
 async commit(state,expectedRevision){const snapshot=clone(state);return new Promise((resolve,reject)=>{const tx=this.db.transaction('save','readwrite'),s=tx.objectStore('save');let conflict=false;const r=s.get('profile');r.onsuccess=()=>{if((r.result?.revision||0)!==expectedRevision){conflict=true;tx.abort();return;}s.put({revision:expectedRevision+1,state:snapshot},'profile');};tx.oncomplete=()=>resolve(expectedRevision+1);tx.onabort=()=>reject(conflict?new SaveConflict():tx.error||Error('Sauvegarde interrompue'));tx.onerror=()=>{};});}
}
