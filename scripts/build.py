from pathlib import Path
import shutil,json,hashlib
R=Path(__file__).resolve().parents[1];out=R/'dist';out.mkdir(exist_ok=True)
for p in (R/'web').iterdir():
 if p.is_file() and p.name!='ai_emerald_partial.mjs':shutil.copy2(p,out/p.name)
(out/'data').mkdir(exist_ok=True);shutil.copy2(R/'data/catalog.json',out/'data/catalog.json')
shutil.copytree(R/'assets/icons',out/'icons',dirs_exist_ok=True)
(out/'manifest.webmanifest').write_text(json.dumps({'name':'Battle Tower Emerald','short_name':'Battle Tower','start_url':'./','scope':'./','display':'standalone','background_color':'#141e27','theme_color':'#192733','icons':[{'src':f'./icons/icon-{n}.png','sizes':f'{n}x{n}','type':'image/png'} for n in [192,512]]}))
shell=['./','./index.html','./style.css','./app.mjs','./engine.mjs','./factory.mjs','./frontier.mjs','./storage.mjs','./runs.mjs','./battle-ui.mjs','./battle-stats.mjs','./battle-presentation.mjs','./ai_emerald_scripted.mjs','./data/catalog.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./conformite.html']
cache_version='battle-tower-v'+hashlib.sha256(b''.join((out/p.removeprefix('./')).read_bytes() for p in shell if (out/p.removeprefix('./')).is_file())).hexdigest()[:12]
(out/'sw.js').write_text('''const CACHE='''+json.dumps(cache_version)+''';const SHELL='''+json.dumps(shell)+''';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('battle-tower-v')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith((async()=>{try{const r=await fetch(e.request);if(r.ok&&(SHELL.some(p=>new URL(p,location.href).href===e.request.url)))(await caches.open(CACHE)).put(e.request,r.clone());return r}catch{return await caches.match(e.request)||Response.error()}})())});
''')
print('Built dist, catalog '+str((out/'data/catalog.json').stat().st_size)+' bytes')
