#!/usr/bin/env python3
"""Reconstruit une PWA et un HTML autonome pour Galaxy S22 apres synchronisation.
Standard library only. Aucun acces Internet, aucun chargement ROM.
"""
from pathlib import Path
import json,re,shutil

ROOT=Path(__file__).resolve().parent
SITE=ROOT/'site'
MODULES=['ai_emerald_partial.mjs','ai_emerald_scripted.mjs','engine.mjs','app.mjs']

def build():
    SITE.mkdir(exist_ok=True)
    for file in ['index.html','style.css',*MODULES]:
        shutil.copy2(ROOT/'web'/file,SITE/file)
    (SITE/'data').mkdir(exist_ok=True)
    shutil.copy2(ROOT/'data'/'catalog.json',SITE/'data'/'catalog.json')
    catalog=json.loads((SITE/'data'/'catalog.json').read_text(encoding='utf-8'))
    manifest=json.loads((SITE/'manifest.webmanifest').read_text(encoding='utf-8'))
    manifest['name']='Battle Tower Émeraude — Galaxy S22'
    manifest['description']='Tour de Combat sans ROM, scripts IA source pokeemerald en cours de portage.'
    (SITE/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    sw='''/* Cache smartphone, utilisable apres premiere visite HTTPS. */
const STATIC='battle-tower-v041-shell',RUNTIME='battle-tower-v041-sprites';
const SHELL=['./','./index.html','./style.css','./app.mjs','./engine.mjs','./ai_emerald_scripted.mjs','./ai_emerald_partial.mjs','./data/catalog.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(STATIC).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('battle-tower-v')&&![STATIC,RUNTIME].includes(key))await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);
 if(u.pathname.includes('/sprites/')||u.hostname==='play.pokemonshowdown.com'){
  e.respondWith((async()=>{const cache=await caches.open(RUNTIME),cached=await cache.match(req);if(cached)return cached;try{const r=await fetch(req);if(r.ok||r.type==='opaque')await cache.put(req,r.clone());return r}catch{return Response.error()}})());return;
 }
 if(u.origin!==location.origin)return;
 if(u.pathname.endsWith('/catalog.json')){e.respondWith((async()=>{try{let r=await fetch(req);if(r.ok)(await caches.open(STATIC)).put(req,r.clone());return r}catch{return await caches.match(req)||Response.error()}})());return}
 e.respondWith((async()=>{const r=await caches.match(req);if(r)return r;try{return await fetch(req)}catch{return Response.error()}})());
});
'''
    (SITE/'sw.js').write_text(sw,encoding='utf-8')
    css=(SITE/'style.css').read_text(encoding='utf-8')
    html=(SITE/'index.html').read_text(encoding='utf-8')
    combined=[]
    for f in MODULES:
        src=(SITE/f).read_text(encoding='utf-8')
        src=re.sub(r'^import .*?;\s*$', '', src,flags=re.M)
        src=re.sub(r'\bexport\s+(?=(?:const|let|class|function|async)\b)', '', src)
        if f=='app.mjs':
            src=src.replace("await fetch('./data/catalog.json')","Promise.resolve({ok:true,json:async()=>PRELOADED_CATALOG})")
        combined.append(src)
    html=re.sub(r'<link rel="stylesheet" href="\./style\.css">','<style>'+css+'</style>',html)
    for patt in [r'<link rel="manifest" href="\./manifest\.webmanifest">',r'<link rel="icon" href="\./icons/icon-192\.png">',r'<link rel="apple-touch-icon" href="\./icons/icon-192\.png">']:
        html=re.sub(patt,'',html)
    html=re.sub(r'<script>if\(\'serviceWorker\'.*?</script>','',html,flags=re.S)
    html=html.replace('<script type="module" src="./app.mjs"></script>', '<script>\nconst PRELOADED_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n'+'\n'.join(combined)+'</script>')
    out=ROOT/'BattleTower_S22_SansInstallation.html'
    out.write_text(html,encoding='utf-8')
    print('Version Web/S22 generee :',len(catalog['species']),'especes,',len(catalog['moveData']),'capacites.',
          'Script IA disponible :',bool(catalog.get('aiScript')))
    print('Livrable smartphone:',out,'(',out.stat().st_size,'octets )')
    print('Site HTTPS:',SITE)

if __name__=='__main__':build()
