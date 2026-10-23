import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai_source_compiler import compile_ai_script
class ScriptCompilerTests(unittest.TestCase):
    def test_emeralda_parser(self):
        src='''\ngBattleAI_ScriptsTable::\n .4byte AI_CheckBadMove\nAI_CheckBadMove:\n get_curr_move_type\n if_equal_ TYPE_GROUND, Penalty\n if_in_bytes TypeList, Reward\n end\nPenalty:\n score -10\n end\nReward:\n score +2\n end\nTypeList:\n .byte TYPE_WATER, TYPE_FIRE, -1\n'''
        src+=''.join(f'Dummy{i}:\n score +1\n' for i in range(110))
        parsed=compile_ai_script(src)
        self.assertEqual(parsed['blocks']['AI_CheckBadMove'][1],['if_equal_','TYPE_GROUND','Penalty'])
        self.assertEqual(parsed['tables']['TypeList'],['TYPE_WATER','TYPE_FIRE','-1'])
        self.assertEqual(parsed['entries'],['AI_CheckBadMove'])
        self.assertGreaterEqual(parsed['audit']['instructions'],100)
    def test_reject_truncated(self):
        with self.assertRaises(ValueError):compile_ai_script('AI_CheckBadMove:\n end')
if __name__=='__main__':unittest.main()
