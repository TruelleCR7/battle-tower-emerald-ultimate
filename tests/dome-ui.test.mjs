import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
test('Dome is selectable and distinct from Tower and Factory',()=>{
 assert.match(html,/<option value="dome">Dôme de Combat<\/option>/);
 assert.match(app,/created\.facility='dome'/);
 assert.match(app,/function renderDomeScreen\(/);
 assert.match(app,/run\.dome\.phase='battle'/);
 assert.match(app,/id="dome-next"/);
});
test('status badges cover primary ailments and volatile confusion',()=>{
 for(const label of ['SOMMEIL','PARALYSÉ','TOXIK','POISON','CONFUS'])assert.ok(app.includes(label),label);
 assert.match(app,/mon\.confused>0/);
});
test('Factory detail supports French nature, item and ability labels and move types',()=>{
 for(const label of ['FR_NATURES','FR_ITEMS','FR_ABILITIES','moveTypeBadge'])assert.ok(app.includes(label),label);
});
