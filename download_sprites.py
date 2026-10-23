"""Cache sprites animés Pokémon Noir et Blanc en local, sans ROM.
Droits Nintendo / Creatures / GAME FREAK ; hébergement Pokémon Showdown.
Un téléchargement initial est nécessaire. Les GIF déjà présents sont conservés.
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent
CAT=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf8'))
FILES=[]
for side in ('front','back'):
 for species, metadata in CAT['species'].items():
  code=metadata.get('sprite',species.lower().replace('_',''))
  dest=ROOT/'assets'/'sprites'/side/f'{code}.gif'
  if not dest.exists() or dest.stat().st_size<100:FILES.append((side,code,dest))

def fetch(job):
 side,code,dest=job
 folder='gen5ani-back' if side=='back' else 'gen5ani'
 url=f'https://play.pokemonshowdown.com/sprites/{folder}/{code}.gif'
 try:
  req=Request(url,headers={'User-Agent':'BattleTowerStudio/0.3 (personal-local-use)'})
  with urlopen(req,timeout=15) as response: payload=response.read(1_500_000)
  if payload[:6] not in (b'GIF87a',b'GIF89a'):raise ValueError('Réponse non GIF')
  dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_bytes(payload)
  return True,side,code
 except Exception as exc:return False,side,f'{code}: {exc}'

print(f'{len(FILES)} sprites à synchroniser (8 téléchargements simultanés).')
if FILES:
 ok=bad=0
 with ThreadPoolExecutor(max_workers=8) as pool:
  for count,future in enumerate(as_completed([pool.submit(fetch,f) for f in FILES]),1):
   success,side,detail=future.result()
   if success:ok+=1
   else:bad+=1
   print(f'[{count}/{len(FILES)}] {"✓" if success else "×"} {side}/{detail}',flush=True)
 print(f'Terminé : {ok} sprites récupérés, {bad} indisponibles. Le site local est prêt.')
else:print('Tous les sprites sont déjà présents.')
