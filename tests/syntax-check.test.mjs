import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const dir=new URL('../web/',import.meta.url);
test('all browser JavaScript modules parse successfully',()=>{
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.mjs')||n.endsWith('.js'))){
  const file=new URL(name,dir);
  const result=spawnSync(process.execPath,['--check',file.pathname],{encoding:'utf8'});
  assert.equal(result.status,0,name+': '+result.stderr);
 }
});
