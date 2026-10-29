# Vampigraine et absorption — correctifs moteur

Référence : pret/pokeemerald, commit `731ad5bfd6e6f265508d0efcca0ba42f9dcf5881`.

- `src/battle_script_commands.c`, `Cmd_setseeded`, `Cmd_negativedamage`, `Cmd_datahpupdate` : position du lanceur, refus de réapplication, immunité Plante, moitié des dégâts réellement infligés avec un minimum de 1 PV, dégâts au clone.
- `src/battle_util.c`, `ENDTURN_LEECH_SEED` : bénéficiaire vivant requis, prélèvement de 1/8 des PV maximum avant le poison.
- `data/battle_scripts_1.s`, `BattleScript_EffectAbsorb`, `BattleScript_LeechSeedTurnDrain` : Suintement inverse les soins, y compris après un coup fatal et lors des dégâts au clone.

Le bénéficiaire est enregistré sous `seedSource: {side, slot}` dans le Pokémon affecté. Le remplaçant du lanceur reçoit les soins. Relais transmet cette position avec Vampigraine ; un changement ordinaire efface les deux. Un clone empêche la pose mais ne bloque pas une graine déjà posée. Grelot Coque ne ranime pas un attaquant mis K.O. par Suintement.

Les sauvegardes restent compatibles : les anciennes graines sans position utilisent la position adverse 0. Leur lanceur réel en Duo ne peut pas être reconstitué, puisque cette information n'était pas enregistrée.

Validation : 14 tests ciblés, 256 tests JavaScript et 7 tests Python réussis ; compilation `scripts/build.py` réussie. Aucun test visuel navigateur pour ce lot moteur.

Limites : ce lot ne porte pas intégralement l'ordre global de fin de tour, les timings des baies, Tour Rapide ni tous les autres effets de capacités. Le moteur et l'IA restent partiels. Les fichiers dist historiques ne sont pas inclus dans ce correctif : reconstruire avec `python3 scripts/build.py` pour préparer un déploiement.
