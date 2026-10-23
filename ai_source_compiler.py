"""Compile les scripts ASM de l'IA pret/pokeemerald vers une representation JSON.

Ce module conserve toutes les instructions et tables de donnees des scripts sources,
sans pretendre porter les routines C du jeu GBA.
"""
from __future__ import annotations
import re

ENTRY = [
    'AI_CheckBadMove','AI_TryToFaint','AI_CheckViability','AI_SetupFirstTurn',
    'AI_Risky','AI_PreferPowerExtremes','AI_PreferBatonPass',
    'AI_DoubleBattle','AI_HPAware','AI_TrySunnyDayStart',
]


def compile_ai_script(src: str) -> dict:
    blocks: dict[str, list] = {}
    order: list[str] = []
    tables: dict[str, list] = {}
    block = None
    instructions = 0
    active = [True]
    for raw in src.splitlines():
        directive = raw.strip().split('@')[0].strip()
        if directive in ('#ifdef BUGFIX', '#ifndef BUGFIX'):
            active.append(active[-1] and directive == '#ifndef BUGFIX')
            continue
        if directive == '#else':
            active[-1] = active[-2] and not active[-1]
            continue
        if directive == '#endif':
            active.pop()
            continue
        if not active[-1]: continue
        line = raw.split('@', 1)[0].split('//', 1)[0].strip()
        if not line: continue
        # Labels may have a leading period, but .align directives are not labels.
        m = re.match(r'^([A-Za-z_][\w.]*)\s*:(?::)?\s*$', line)
        if m:
            block = m[1]
            if block not in blocks: order.append(block)
            blocks.setdefault(block, [])
            continue
        if block is None:continue
        if line.startswith(('.byte ','.2byte ','.4byte ','.hword ','.word ')):
            args = [part.strip() for part in line.split(None,1)[1].split(',')]
            tables.setdefault(block,[]).extend(args)
            continue
        if line.startswith(('.', '#')):continue
        m = re.match(r'^([a-z][a-z\d_]*)\b(?:\s+(.*?))?$',line)
        if not m:continue
        args=[x.strip() for x in (m[2] or '').split(',')] if m[2] else []
        blocks[block].append([m[1],*args]);instructions += 1
    entries=[x for x in ENTRY if x in blocks]
    if 'AI_CheckBadMove' not in entries:raise ValueError('Script principal AI_CheckBadMove absent')
    if len(blocks)<30 or instructions<100:raise ValueError('Source IA tronquee')
    # Audit: never throw away a command without reporting it.
    op_counts={}
    for b in blocks.values():
        for a in b:op_counts[a[0]]=op_counts.get(a[0],0)+1
    return {'provenance':'pret/pokeemerald/data/battle_ai_scripts.s',
        'format':1, 'entries':entries, 'order':order, 'blocks':blocks, 'tables':tables,
        'audit':{'labels':len(blocks),'instructions':instructions,
                 'commands':dict(sorted(op_counts.items()))}}


def compile_script_for_test():
    return compile_ai_script('''
AI_CheckBadMove:\n get_curr_move_type\n if_equal_ TYPE_GROUND, Miss\n score +2\n end
Miss:\n score -10\n end
AI_TryToFaint:\n end
AI_CheckViability:\n end
AI_SetupFirstTurn:\n end
AI_Risky:\n end
AI_PreferPowerExtremes:\n end
AI_DoubleBattle:\n end
AI_HPAware:\n end
''')
