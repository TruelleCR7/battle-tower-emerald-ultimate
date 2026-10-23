import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sync_pokeemerald import species_data,move_data,frontier_sets,official_brains,sprite_alias,enum_items,split_metadata
class ImportTests(unittest.TestCase):
 def test_mon_parser(self):
  s='[SPECIES_METAGROSS]={.baseHP=80,.baseAttack=135,.baseDefense=130,.baseSpeed=70,.baseSpAttack=95,.baseSpDefense=90,.types={TYPE_STEEL,TYPE_PSYCHIC},.abilities={ABILITY_CLEAR_BODY,ABILITY_NONE},.growthRate=GROWTH_SLOW},'
  p=species_data(s,{'METAGROSS':400})
  self.assertEqual(p['METAGROSS']['stats'],[80,135,130,70,95,90]);self.assertEqual(p['METAGROSS']['abilities'],['CLEAR_BODY'])
 def test_moves_parser(self):
  txt='[MOVE_DRAGON_CLAW]={.effect=EFFECT_HIT,.power=80,.type=TYPE_DRAGON,.accuracy=100,.pp=15,.priority=0,.target=MOVE_TARGET_SELECTED},'
  self.assertEqual(move_data(txt,{'DRAGON_CLAW':337},{'dragonclaw':'physical'})['DRAGON_CLAW']['category'],'physical')
 def test_frontier_set(self):
  txt='[FRONTIER_MON_TEST] = {.species=SPECIES_METAGROSS,.moves={MOVE_DRAGON_CLAW,MOVE_NONE,MOVE_NONE,MOVE_NONE},.itemTableId=BATTLE_FRONTIER_ITEM_LUM_BERRY,.evSpread=F_EV_SPREAD_ATTACK | F_EV_SPREAD_HP,.nature=NATURE_ADAMANT},'
  r=frontier_sets(txt,{'METAGROSS':{}},{'DRAGON_CLAW':{}},{},[])
  self.assertEqual(len(r),1);self.assertEqual(r[0]['moves'],['DRAGON_CLAW'])
 def test_sprite_aliases(self):
  self.assertEqual(sprite_alias('NIDORAN_F'),'nidoranf')
 def test_item_enum(self):
  r=enum_items('enum {\n ITEM_NONE,\n ITEM_MASTER_BALL,\n ITEM_ULTRA_BALL=9,\n ITEM_LEFTOVERS,\n};')
  self.assertEqual(r['LEFTOVERS'],10)
if __name__=='__main__':unittest.main()
