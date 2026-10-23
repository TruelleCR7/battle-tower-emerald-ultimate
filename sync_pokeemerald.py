#!/usr/bin/env python3
"""Imports *data*, not the executable GBA engine, directly from pret/pokeemerald.
One-time Internet required; no ROM and no external Python dependencies.
All remote upstream source text is also cached for provenance and future AI port.
"""
import json
import os
import re
import sys
import urllib.request
from ai_source_compiler import compile_ai_script
from pathlib import Path

BASE=Path(__file__).resolve().parent
CACHE=BASE/'data'/'upstream'
BASEURL='https://raw.githubusercontent.com/pret/pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/'
SHOWDOWN_URL='https://raw.githubusercontent.com/smogon/pokemon-showdown/651b6fa8542bb75078fd66337ab150effe623d30/data/moves.ts'
PATHS=[
 'include/constants/species.h','include/constants/moves.h',
 'include/constants/items.h','include/constants/abilities.h',
 'src/data/pokemon/species_info.h','src/data/battle_moves.h',
 'src/data/battle_frontier/battle_frontier_mons.h',
 'src/battle_tower.c','src/frontier_util.c',
 'data/battle_ai_scripts.s','src/battle_ai_script_commands.c','src/battle_ai_switch_items.c',
]
STAT_KEYS=['HP','Attack','Defense','Speed','SpAttack','SpDefense']
STAT_FIELDS={'HP':'HP','Attack':'ATTACK','Defense':'DEFENSE','Speed':'SPEED','SpAttack':'SP_ATTACK','SpDefense':'SP_DEFENSE'}
TYPE_NAMES={'FIGHTING':'FIGHTING','NORMAL':'NORMAL','FIRE':'FIRE','WATER':'WATER','GRASS':'GRASS','ELECTRIC':'ELECTRIC','ICE':'ICE','POISON':'POISON','GROUND':'GROUND','FLYING':'FLYING','PSYCHIC':'PSYCHIC','BUG':'BUG','ROCK':'ROCK','GHOST':'GHOST','DRAGON':'DRAGON','DARK':'DARK','STEEL':'STEEL'}
EFFECTS={
 'SLEEP':'sleep','TOXIC':'toxic','POISON':'poison','PARALYZE':'paralyze',
 'BURN':'burn','LEECH_SEED':'seed','PROTECT':'protect','EXPLOSION':'explode',
 'RECOVER':'heal','SOFTBOILED':'heal','SYNTHESIS':'heal','MORNING_SUN':'heal',
 'REST':'rest','SPIKES':'spikes','RAIN_DANCE':'rain','SANDSTORM':'sand',
 'SUNNY_DAY':'sun','HAIL':'hail','REFLECT':'reflect','LIGHT_SCREEN':'light_screen',
 'ATTACK_UP_2':'swords','CALM_MIND':'calm','DRAGON_DANCE':'dragondance',
 'BULK_UP':'bulk','CURSE':'curse','SUBSTITUTE':'substitute',
 'BATON_PASS':'baton','ROAR':'whirlwind','WHIRLWIND':'whirlwind',
 'OHKO':'ohko','HIGH_CRITICAL':'crit','LEVEL_DAMAGE':'leveldamage',
 'RECHARGE':'recharge','DRAIN_HP':'drain','DRAIN':'drain',
 'SKY_ATTACK':'solar','TWO_TURNS_ATTACK':'solar',
}
MOVE_OVERRIDES={
 'PROTECT':'protect','DETECT':'protect', 'RECOVER':'heal','SOFT_BOILED':'heal',
 'MOONLIGHT':'heal','MORNING_SUN':'heal','SYNTHESIS':'heal',
 'REST':'rest', 'SWORDS_DANCE':'swords','CALM_MIND':'calm',
 'DRAGON_DANCE':'dragondance','BULK_UP':'bulk','CURSE':'curse',
 'SUBSTITUTE':'substitute','BATON_PASS':'baton',
 'THUNDER_WAVE':'paralyze','WILL_O_WISP':'burn','TOXIC':'toxic',
 'SLEEP_POWDER':'sleep','HYPNOSIS':'sleep','SING':'sleep','SPORE':'sleep',
 'LEECH_SEED':'seed','SPIKES':'spikes','RAIN_DANCE':'rain',
 'SUNNY_DAY':'sun','SANDSTORM':'sand', 'LIGHT_SCREEN':'light_screen',
 'REFLECT':'reflect','AROMATHERAPY':'aroma','HEAL_BELL':'aroma',
 'ROAR':'whirlwind','WHIRLWIND':'whirlwind','DESTINY_BOND':'destiny',
 'SEISMIC_TOSS':'leveldamage','NIGHT_SHADE':'leveldamage',
 'EXPLOSION':'explode','SELF_DESTRUCT':'explode',
 'GIGA_DRAIN':'drain','MEGA_DRAIN':'drain','ABSORB':'drain',
 'SUPERPOWER':'superpower','HYPER_BEAM':'recharge',
 'DOUBLE_EDGE':'recoil3','TAKE_DOWN':'recoil4',
 'SOLAR_BEAM':'solar','FISSURE':'ohko','HORN_DRILL':'ohko',
 'GUILLOTINE':'ohko','SHEER_COLD':'ohko',
}
# Moves with known Generation IV split; Showdown data is canonical when available.
GEN4_PHYSICAL={'SHADOW_CLAW','DRAGON_CLAW','CRUNCH','BITE','THUNDER_PUNCH','FIRE_PUNCH','ICE_PUNCH',
 'WATERFALL','SHADOW_PUNCH','SHADOW_SNEAK','LEAF_BLADE','POISON_TAIL','SLUDGE','IRON_TAIL',
 'SHADOW_BALL_NOT','AQUA_TAIL','ROCK_SLIDE','EARTHQUAKE','RETURN','BODY_SLAM','METEOR_MASH',
 'SLASH','WING_ATTACK','FURY_CUTTER','MEGAHORN','BRICK_BREAK','AERIAL_ACE'}
GEN4_SPECIAL={'SHADOW_BALL','SLUDGE_BOMB','SWIFT','SILVER_WIND','HIDDEN_POWER','TWISTER',
 'DRAGON_BREATH','FLAMETHROWER','ICE_BEAM','THUNDERBOLT','SURF','PSYCHIC','FIRE_BLAST'}
SPECIAL_TYPES={'FIRE','WATER','GRASS','ELECTRIC','ICE','PSYCHIC','DRAGON','DARK'}

def retrieve(path, url=None, optional=False):
    target=CACHE/path
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and target.stat().st_size>300:
        return target.read_text(encoding='utf-8')
    try:
        req=urllib.request.Request(url or BASEURL+path,headers={'User-Agent':'BattleTowerStudio-DataImporter/0.3', 'Accept':'text/plain'})
        with urllib.request.urlopen(req,timeout=40) as f:
            raw=f.read(5_000_000)
        text=raw.decode('utf-8')
        target.write_text(text,encoding='utf-8')
        print('  ✓',path,len(raw),'bytes')
        return text
    except Exception as e:
        if not optional:print('  ✗',path,repr(e))
        if target.exists():return target.read_text(encoding='utf-8')
        if optional:return ''
        raise

def constants(txt,prefix):
    result={}
    for key,value in re.findall(r'^\s*#define\s+'+re.escape(prefix)+r'([\w]+)\s+(\d+)\b',txt,re.M):result[key]=int(value)
    return result

def enum_items(txt):
    # items header enum order, accounting for explicit values, and skipping macros
    body=txt.split('enum {',1)[1].split('};',1)[0]
    result={}; idx=-1
    for row in body.splitlines():
        m=re.match(r'\s*ITEM_([A-Z0-9_]+)\s*(?:=\s*(\d+))?\s*,',row)
        if m:
            idx=int(m[2]) if m[2] else idx+1
            result[m[1]]=idx
    return result

def blocks(source,pattern):
    # Balanced-brace blocks in generated C initializer, not fragile to nested arrays.
    for m in re.finditer(pattern,source,re.M):
        start=source.find('{',m.end()-1)
        if start<0:continue
        depth=0
        for i in range(start,len(source)):
            if source[i]=='{':depth+=1
            elif source[i]=='}':
                depth-=1
                if depth==0:
                    yield m.group(1),source[start+1:i]
                    break

def species_data(source, ids):
    result={}
    for code,body in blocks(source,r'\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{'):
        if code not in ids or ids[code]<=0 or ids[code]>411:continue
        st=[]
        for k in STAT_KEYS:
            m=re.search(r'\.base'+k+r'\s*=\s*(\d+)',body)
            if m:st.append(int(m[1]))
        if len(st)!=6:continue
        ty=re.search(r'\.types\s*=\s*\{\s*TYPE_(\w+)\s*,\s*TYPE_(\w+)',body)
        if not ty:continue
        types=list(dict.fromkeys(ty.groups()))
        ab=re.search(r'\.abilities\s*=\s*\{([^}]*)}',body)
        abilities=list(dict.fromkeys(a for a in re.findall(r'ABILITY_(\w+)',ab[1] if ab else '') if a!='NONE'))
        if not abilities:continue
        grow=re.search(r'\.growthRate\s*=\s*GROWTH_(\w+)',body)
        result[code]={'id':ids[code], 'stats':st,'growth':grow[1] if grow else 'MEDIUM_FAST',
            'types':types,'abilities':abilities,'sprite':sprite_alias(code)}
    return result

def sprite_alias(code):
    aliases={'NIDORAN_F':'nidoranf','NIDORAN_M':'nidoranm','MR_MIME':'mrmime',
             'FARFETCHD':'farfetchd','HO_OH':'hooh','PORYGON2':'porygon2',
             'DEOXYS':'deoxys','UNOWN':'unown'}
    return aliases.get(code,code.lower().replace('_',''))

def split_metadata(source):
    result={}
    # Showdown modern move index uses physical/special exactly where Gen IV split was introduced
    pat=r'^\s*([a-z][a-z0-9]*):\s*\{'
    for key,txt in blocks(source,pat):
        m=re.search(r'\bcategory:\s*["\'](Physical|Special|Status)["\']',txt[:2500])
        if m:result[key]=m[1].lower()
    return result

def move_data(source, idmap, split):
    result={}
    for code,body in blocks(source,r'\[MOVE_([A-Z0-9_]+)\]\s*=\s*\{'):
        if code=='NONE' or code not in idmap:continue
        def f(name,default):
            m=re.search(r'\.'+name+r'\s*=\s*(\d+)',body)
            return int(m[1]) if m else default
        typ=re.search(r'\.type\s*=\s*TYPE_(\w+)',body)
        eff=re.search(r'\.effect\s*=\s*EFFECT_(\w+)',body)
        tar=re.search(r'\.target\s*=\s*MOVE_TARGET_(\w+)',body)
        if not typ:continue
        t=typ[1];pow=f('power',0)
        key=code.lower().replace('_','')
        cat=split.get(key,'status' if pow==0 else 'special' if t in SPECIAL_TYPES else 'physical')
        # Split read from pinned source; no hand-written override.
        # No category fallback overrides.
        if pow==0:cat='status'
        effkey=eff[1] if eff else 'HIT'
        effect=MOVE_OVERRIDES.get(code,EFFECTS.get(effkey,''))
        target='self' if tar and tar[1] in ('USER','USER_OR_SELECTED','USER_SIDE') else 'enemies' if tar and tar[1] in ('BOTH','BOTH_ENEMIES') else 'all' if tar and tar[1]=='FOES_AND_ALLY' else 'random' if tar and tar[1]=='RANDOM' else 'enemyfield' if tar and tar[1]=='OPPONENTS_FIELD' else 'enemy'
        if effect=='spikes':target='enemyfield'
        if cat=='status' and effect in ('heal','rain','sun','sand','hail','rest','swords','calm','dragondance','bulk','curse','protect','substitute','aroma','destiny','baton','reflect','light_screen'):target='self'
        secondary=f('secondaryEffectChance',0)
        if code=='THUNDER_WAVE':
            # Gen III accuracy = 100. Use original source, not modern battle logic.
            pass
        result[code]={'name':code.replace('_',' ').title(),'type':t,'category':cat,
            'power':pow,'accuracy':f('accuracy',100),'pp':f('pp',10),
            'priority':int(re.search(r'\.priority\s*=\s*(-?\d+)',body).group(1)) if re.search(r'\.priority\s*=\s*(-?\d+)',body) else 0,
            'effect':effect, 'originalEffect':effkey,'secondaryChance':secondary,'target':target,'id':idmap[code],
            'fidelity':'basic' if effkey in ('HIT','HIGH_CRITICAL','PARALYZE_HIT','BURN_HIT','FREEZE_HIT') or effect else 'unported'}
    return result

def frontier_sets(source,species,moves,items,banned):
    """Complete original FacilityMon roster, preserving reference data even for unsupported effects."""
    result=[]
    for name,body in blocks(source,r'\[FRONTIER_MON_([A-Z0-9_]+)\]\s*=\s*\{'):
        s=re.search(r'\.species\s*=\s*SPECIES_(\w+)',body)
        m=re.search(r'\.moves\s*=\s*\{([^}]+)}',body)
        nat=re.search(r'\.nature\s*=\s*NATURE_(\w+)',body)
        es=re.search(r'\.evSpread\s*=\s*([^,\n]+)',body)
        it=re.search(r'\.itemTableId\s*=\s*BATTLE_FRONTIER_ITEM_(\w+)',body)
        if not (s and m and nat):continue
        code=s[1]
        if code not in species:continue
        atk=[k for k in re.findall(r'MOVE_(\w+)',m[1]) if k!='NONE' and k in moves]
        if not atk:continue
        result.append({'id':name,'species':code,'moves':atk,
                       'nature':nat[1], 'itemTableId':it[1] if it else 'NONE',
                       'evSpread':es[1].strip() if es else '', 'source':'pret/pokeemerald'})
    return result

def try_base_item(item_table_id, item_names):
    if item_table_id in item_names:return item_table_id
    return 'NONE'

def tier_team(s, template, item_names):
    sp=s[template['species']]; flags=template['evSpread']; attr={
        'hp':'HP','atk':'ATTACK','def':'DEFENSE','spe':'SPEED','spa':'SP_ATTACK','spd':'SP_DEFENSE'}
    allocated=[k for k,v in attr.items() if 'F_EV_SPREAD_'+v in flags]
    evs={k:0 for k in attr}
    if allocated:
        # Original frontend assigns 510 across active flags, subject to 255 bound (exact assign to be audited).
        n=min(255,510//len(allocated))
        for k in allocated:evs[k]=n
    else:evs.update(hp=252,atk=252)
    return {'species':template['species'],'item':try_base_item(template['itemTableId'],item_names),
     'nature':template['nature'],'moves':template['moves'][:4],
     'evs':[evs[k] for k in attr], 'ivs':[31]*6,
     'ability':sp['abilities'][0], 'role':'Set Tour d’Émeraude : '+template['id'],
     'summary':'Set de la Tour importé depuis pret/pokeemerald. Vérifier les mécaniques non encore portées.',
     'level':50}

def battle_tower_items(source):
    start=source.find('gBattleFrontierHeldItems[]')
    end=source.find('};',start)
    if start<0 or end<0:return []
    items=re.findall(r'\[BATTLE_FRONTIER_ITEM_(\w+)\]\s*=\s*ITEM_(\w+)',source[start:end])
    return list(dict.fromkeys(right for left,right in items if right!='NONE'))

def official_brains(source,species,moves,items):
    head=source.find('sFrontierBrainsMons[][2]')
    start=source.find('[FRONTIER_FACILITY_TOWER] =',max(0,head))
    end=source.find('[FRONTIER_FACILITY_DOME] =',start)
    if start<0 or end<0:return {}
    txt=source[start:end]
    found=[]
    for m in re.finditer(r'\.species\s*=\s*SPECIES_(\w+)',txt):
        code=m[1]
        body=txt[m.end():m.end()+900]
        it=re.search(r'\.heldItem\s*=\s*ITEM_(\w+)',body)
        fixed=re.search(r'\.fixedIV\s*=\s*(\w+)',body)
        nature=re.search(r'\.nature\s*=\s*NATURE_(\w+)',body)
        ev=re.search(r'\.evs\s*=\s*\{([^}]+)}',body)
        mv=re.search(r'\.moves\s*=\s*\{([^}]+)}',body)
        if not (code in species and nature and ev and mv):continue
        moveset=[key for key in re.findall(r'MOVE_(\w+)',mv[1]) if key in moves]
        evs=[int(x) for x in re.findall(r'\d+',ev[1])][:6]
        if not moveset or len(evs)!=6:continue
        iv=31 if fixed and fixed[1]=='MAX_PER_STAT_IVS' else int(fixed[1]) if fixed and fixed[1].isdigit() else 31
        found.append({'species':code,'item':it[1] if it and it[1] in items else 'NONE',
                      'nature':nature[1],'moves':moveset,'evs':evs,'ivs':[iv]*6,
                      'ability':species[code]['abilities'][0],'level':50,'role':'Anabel / Tour officielle'})
    return {'silver':found[:3],'gold':found[3:6]} if len(found)>=6 else {}

def generate(source):
    legacy=json.loads((BASE/'data'/'catalog.json').read_text(encoding='utf-8'))
    sd=species_data(source['src/data/pokemon/species_info.h'],constants(source['include/constants/species.h'],'SPECIES_'))
    names=constants(source['include/constants/moves.h'],'MOVE_')
    split=split_metadata(source.get('showdown_moves',''))
    if len(split)<340:raise ValueError('Classification physique/spéciale non importée : refus d’utiliser un split incorrect')
    mo=move_data(source['src/data/battle_moves.h'],names,split)
    it=enum_items(source['include/constants/items.h'])
    ban=re.search(r'gFrontierBannedSpecies\s*\[\]\s*=\s*\{([^}]+)}',source.get('src/frontier_util.c',''),re.S)
    banned=re.findall(r'SPECIES_(\w+)',ban[1]) if ban else legacy.get('banned',[])
    towers=frontier_sets(source['src/data/battle_frontier/battle_frontier_mons.h'],sd,mo,it,banned)
    if len(sd)<350 or len(mo)<320 or len(towers)<200:raise ValueError(f'Import incomplet : {len(sd)} espèces, {len(mo)} capacités, {len(towers)} sets Tour')
    merged=dict(legacy)
    merged['species']=sd
    merged['items']=it
    merged['moveData']={**mo, **{k:{**mo.get(k,{}),**v} for k,v in legacy['moveData'].items() if k in mo}}
    # Set the original moves parsed; keep the more complete (but optional) previously-written effects.
    merged['moveData']={k:({**mo[k], **{'name': legacy['moveData'][k].get('name',mo[k]['name'])},
      **{x:legacy['moveData'][k][x] for x in ('effect',) if x in legacy['moveData'][k] and legacy['moveData'][k][x]}} if k in legacy['moveData'] else mo[k]) for k in mo}
    merged['moves']={k:v['id'] for k,v in mo.items()}
    merged['movePP']={k:v['pp'] for k,v in mo.items()}
    merged['speciesNames']={s:legacy.get('speciesNames',{}).get(s,s.title().replace('_',' ')) for s in sd}
    merged['banned']=[x for x in banned if x in sd]
    # Prefer existing genuinely curated sets, synthesize a suggested set from tower official pool for others.
    teamsets={s:legacy['sets'][s] for s in legacy['sets'] if s in sd}
    for t in reversed(towers):
        if t['species'] not in teamsets:teamsets[t['species']]=tier_team(sd,t,it)
    merged['sets']=teamsets
    merged['towerSets']=towers
    merged['towerItems']=battle_tower_items(source.get('src/battle_tower.c',''))
    merged['towerBrains']=official_brains(source.get('src/frontier_util.c',''),sd,mo,it)
    merged['aiScript']=compile_ai_script(source['data/battle_ai_scripts.s'])
    merged['version']='0.4.1-source-synced'
    merged['coverage']={'species':len(sd),'moves':len(mo),'frontierSets':len(towers),
                        'aiExecution':'SOURCE_SCRIPT_INTERPRETER_PARTIAL_MECHANICS',
                        'mechanics':'PARTIAL',
                        'split':'gen4'}
    return merged

def main():
    print('Synchronisation des données originales de pokeemerald (aucune ROM)')
    sources={p:retrieve(p) for p in PATHS}
    sources['showdown_moves']=retrieve('showdown_moves.ts',SHOWDOWN_URL,optional=True)
    data=generate(sources)
    target=BASE/'data'/'catalog.json'
    prev=BASE/'data'/'catalog_baseline_v02.json'
    if not prev.exists():prev.write_bytes(target.read_bytes())
    tmp=target.with_suffix('.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    os.replace(tmp,target)
    print('Synchronisation terminée :',data['coverage'])
    print('Scripts ASM de score importes et interpretes ; switch, items IA et interactions non encore exhaustifs.')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('ERREUR:',exc,file=sys.stderr)
        sys.exit(1)
