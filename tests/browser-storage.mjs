import {RunStore,SaveConflict} from '../web/runs.mjs';
export async function testStorage(){
 const name='battle-tower-qa-'+Date.now(),a=await new RunStore(indexedDB,name).open(),b=await new RunStore(indexedDB,name).open();let checks=[];
 try{
  if(await a.load()!==null)throw Error('Fresh database not empty');
  const original={runs:[{id:'solo',victories:4},{id:'duo',victories:2}],records:{best:4}};await a.commit(original,0);
  const copy=await b.load();if(copy.revision!==1||copy.state.runs[1].victories!==2)throw Error('Cross-connection read failed');checks.push('Atomic whole-save persistence');
  const race=await Promise.allSettled([a.commit({runs:[{id:'winner-a'}]},1),b.commit({runs:[{id:'winner-b'}]},1)]);
  if(race.filter(x=>x.status==='fulfilled').length!==1||!race.some(x=>x.status==='rejected'&&x.reason instanceof SaveConflict))throw Error('Concurrency did not reject stale writer');checks.push('Two concurrent writers: one winner, one explicit conflict');
  const latest=await a.load();if(latest.revision!==2||latest.state.runs.length!==1)throw Error('Torn write');checks.push('Conflict leaves winning transaction intact');
  a.db.close();const reopened=await new RunStore(indexedDB,name).open();if((await reopened.load()).revision!==2)throw Error('Reopen failed');reopened.db.close();checks.push('Close/reopen preserves committed revision');return checks;
 }finally{a.db.close();b.db.close();indexedDB.deleteDatabase(name);}
}
