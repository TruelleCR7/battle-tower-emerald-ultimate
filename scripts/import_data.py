"""Rebuild pinned catalog from vendored reference files; no network required."""
import sys,json,re,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import sync_pokeemerald as s
U=ROOT/'data/upstream'
def read(p):return (U/p).read_text()
sources={p:read(p) for p in s.PATHS};sources['showdown_moves']=read('showdown_moves.ts')
d=s.generate(sources)
assert len(d['species'])==386 and len(d['moveData'])==354
# Preserve exact item-table mapping, EV spreads, trainer pools, and ordinal IDs.
itemmap=dict(re.findall(r'\[BATTLE_FRONTIER_ITEM_(\w+)\]\s*=\s*ITEM_(\w+)',sources['src/battle_tower.c']))
ids=s.constants(read('include/constants/battle_frontier_mons.h'),'FRONTIER_MON_')
for t in d['towerSets']:
 t['ordinal']=ids[t['id']];t['item']=itemmap[t['itemTableId']]
 flags=re.findall(r'F_EV_SPREAD_(\w+)',t['evSpread']);t['evs']=[510//len(flags) if k in flags else 0 for k in ['HP','ATTACK','DEFENSE','SPEED','SP_ATTACK','SP_DEFENSE']]
# Expand the original trainer pool macros using the C preprocessor.
pools=subprocess.check_output(['cpp','-P',str(U/'src/data/battle_frontier/battle_frontier_trainer_mons.h')],text=True)
poolmap={name:re.findall(r'FRONTIER_MON_(\w+)',body) for name,body in re.findall(r'const u16 (\w+)\[\]\s*=\s*\{(.*?)\}',pools,re.S)}
tids=s.constants(read('include/constants/battle_frontier_trainers.h'),'FRONTIER_TRAINER_')
d['trainers']=[]
for name,b in s.blocks(read('src/data/battle_frontier/battle_frontier_trainers.h'),r'\[FRONTIER_TRAINER_(\w+)\]\s*=\s*\{'):
 pool=re.search(r'\.monSet\s*=\s*(\w+)',b)[1]
 d['trainers'].append({'id':tids[name],'key':name,'name':re.search(r'\.trainerName\s*=\s*_\("(.*?)"\)',b)[1],'class':re.search(r'\.facilityClass\s*=\s*FACILITY_CLASS_(\w+)',b)[1],'sets':poolmap[pool]})
d['trainers'].sort(key=lambda t:t['id'])
for key,table in [('trainerRanges','sFrontierTrainerIdRanges'),('trainerRangesHard','sFrontierTrainerIdRangesHard')]:
 b=re.search(table+r'\[\]\[2\]\s*=\s*\{(.*?)\};',sources['src/battle_tower.c'],re.S)[1]
 d[key]=[[tids[a],tids[b]] for a,b in re.findall(r'\{FRONTIER_TRAINER_(\w+),\s*FRONTIER_TRAINER_(\w+)\}',b)]
# Species move pools: Emerald level-up/TM/HM/tutor/egg + inherited pre-evolution moves.
learn={k:set() for k in d['species']}
lev={name:set(re.findall(r'MOVE_(\w+)',body)) for name,body in re.findall(r'const u16 (\w+)\[\]\s*=\s*\{(.*?)\};',read('src/data/pokemon/level_up_learnsets.h'),re.S)}
for sp,ptr in re.findall(r'\[SPECIES_(\w+)\]\s*=\s*(\w+)',read('src/data/pokemon/level_up_learnset_pointers.h')):
 if sp in learn:learn[sp]|=lev.get(ptr,set())
for sp,b in s.blocks(read('src/data/pokemon/tmhm_learnsets.h'),r'\[SPECIES_(\w+)\]\s*=\s*\{'):
 if sp in learn:learn[sp]|=set(re.findall(r'\.(\w+)\s*=\s*TRUE',b))
for sp,b in re.findall(r'\[SPECIES_(\w+)\]\s*=\s*(.*?)(?=\[SPECIES_|\Z)',read('src/data/pokemon/tutor_learnsets.h'),re.S):
 if sp in learn:learn[sp]|=set(re.findall(r'TUTOR\(MOVE_(\w+)\)',b))
for sp,b in re.findall(r'egg_moves\((\w+),(.*?)\)',read('src/data/pokemon/egg_moves.h'),re.S):
 if sp in learn:learn[sp]|=set(re.findall(r'MOVE_(\w+)',b))
for _ in range(4):
 for sp,b in s.blocks(read('src/data/pokemon/evolution.h'),r'\[SPECIES_(\w+)\]\s*=\s*\{'):
  for dest in re.findall(r'SPECIES_(\w+)',b):
   if sp in learn and dest in learn:learn[dest]|=learn[sp]
# Official facility sets are also accepted reference combinations.
for t in d['towerSets']:learn[t['species']].update(t['moves'])
learn['SMEARGLE']=set(d['moveData'])-{'STRUGGLE','CHATTER'}
d['learnsets']={k:sorted(v&set(d['moveData'])) for k,v in learn.items()}
for code in d['species']:
 if code not in d['sets']:
  moves=d['learnsets'][code][:4]
  if moves:d['sets'][code]={'species':code,'item':'NONE','nature':'HARDY','ability':d['species'][code]['abilities'][0],'moves':moves,'evs':[0]*6,'ivs':[31]*6,'level':50,'role':'Personnalisé — à configurer'}
# Repair illegal moves in the supplied legacy recommendations (several were Gen IV).
repairs={'SNORLAX':{'CRUNCH':'SHADOW_BALL'},'ARCANINE':{'WILL_O_WISP':'TOXIC'},'BRELOOM':{'ROCK_SLIDE':'SUBSTITUTE'},'ZAPDOS':{'ROOST':'REST'},'GYARADOS':{'ROCK_SLIDE':'EARTHQUAKE'},'CHARIZARD':{'AIR_SLASH':'AERIAL_ACE','ROOST':'REST'},'SCIZOR':{'IRON_TAIL':'STEEL_WING','X_SCISSOR':'SILVER_WIND'}}
for sp,mapping in repairs.items():d['sets'][sp]['moves']=[mapping.get(m,m) for m in d['sets'][sp]['moves']]
for sp,t in d['sets'].items():
 assert all(m in d['learnsets'][sp] for m in t['moves']),(sp,t['moves'])
d['itemEffects']={k:re.search(r'\.holdEffect\s*=\s*HOLD_EFFECT_(\w+)',b)[1] for k,b in s.blocks(read('src/data/items.h'),r'\[ITEM_(\w+)\]\s*=\s*\{') if re.search(r'\.holdEffect\s*=\s*HOLD_EFFECT_(\w+)',b)}
d['version']='0.6.0-preview';d['provenance']=json.loads((ROOT/'sources.lock.json').read_text());d['coverage']['trainers']=len(d['trainers'])
assert len(d['trainers'])==300 and len(d['towerSets'])==882, (len(d['trainers']),len(d['towerSets']))
(ROOT/'data/catalog.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
print(d['coverage']);print(d['aiScript']['audit'])
