import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
test('Tower new-game navigation remains unchanged',()=>{
 assert.match(app,/\$\('#to-team'\)\.onclick=\(\)=>nav\('team'\)/);
 assert.match(app,/\$\('#start'\)\.onclick=\(\)=>begin\(false\)/);
 assert.match(app,/function renderTeam\(\)/);
 assert.match(app,/if\(state\.facility==='factory'\)\{renderFactoryDraft\(\);return;\}/);
});
test('facility selector, rental draft, and exchange buttons are wired',()=>{
 assert.match(html,/id="facility-select"/);
 assert.match(app,/\$\('#facility-select'\)\.onchange=/);
 for(const key of ['data-rental','data-offer','data-give','factory-pass','factory-confirm'])assert.ok(app.includes(key),key);
});
test('no undefined selector helpers or single-element forEach',()=>{
 assert.doesNotMatch(app,/\$\$\$\s*\(/);
 assert.doesNotMatch(app,/(?<!\$)\$\('[^']+'\)\.forEach\(/);
});
test('Tower records retain their original keys',()=>{
 assert.match(app,/state\.facility==='factory'\?'factory:':''/);
});
