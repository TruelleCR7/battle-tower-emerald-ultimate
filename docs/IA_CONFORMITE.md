> Mise à jour 0.6.2 : voir MISE_A_JOUR_0.6.2.md pour les corrections de statistiques, les options et les 80 tests actuels. La matrice ci-dessous décrit le portage IA v0.6.1 conservé.

# IA — correctif 0.6.1, conformité intégrale non acquise

Référence : pret/pokeemerald `731ad5bfd6e6f265508d0efcca0ba42f9dcf5881`, BUGFIX non défini.
La cible demandée est 100 % des routines IA, avec l'adaptation physique/spécial déjà demandée pour le projet. Ce correctif ne satisfait pas encore cette cible et ne livre pas la v0.7.0 complète.

| Routine / comportement | Portage et branchement | Vérification | Limite |
| --- | --- | --- | --- |
| Cmd_score | Addition, conversion s8 puis écrêtage à zéro | Fonction C source compilée : 128 scores × 256 opérandes | Validé pour cette opération |
| Cmd_if_random_* | Mot Random 16 bits, modulo 256 | Quatre fonctions C source compilées : 65 536 mots × 4 conditions au seuil 128 | Comparateur et extraction vérifiés, pas toutes les séquences de combat |
| BattleAI_SetupAIData | Scores initiaux, quatre simulatedRNG, tirage supplémentaire Duo | Fixtures du nombre et de la valeur des tirages | CheckMoveLimitations incomplet, Palais absent |
| BattleAI_DoAIProcessing | Scripts dans l'ordre de la table, quatre slots par script, funcResult partagé | Fixtures d'ordre, mémoire du résultat, labels absents | État global C représenté partiellement |
| ChooseMoveOrAction_Singles | Maximum et départage Random modulo | Tests de décision et stabilité | Actions flee/watch non complètes |
| ChooseMoveOrAction_Doubles | Ordre 0/1/2/3, setup par cible, choix par cible puis global, seuil allié 100 | Fixture 24 tirages sans branches aléatoires, tests de combat Duo/Multi | Contrôleur d'actions et état moteur non intégralement portés |
| Cmd_get_how_powerful_move_is | Liste d'effets ignorés, tous les slots, simulatedRNG | Utilisé par les tests de combat | AI_CalcDmg/TypeCalc utilisent encore le moteur JS partiel |
| Cmd_if_can_faint / cant_faint | Seuil puissance, simulatedRNG, différence de minimum 1 conservée | Exercés dans les scripts | Dégâts non certifiés |
| Historique des attaques | Enregistre la dernière attaque observée ; lecture des capacités connues ; réinitialisation au changement ; sauvegardé avec le Pokémon | Fixture d'attaque inconnue puis révélée, tests de reprise | Pas de reconstruction exhaustive de l'historique ancien |
| Talents | get_ability : supposition pour deux talents ; if_ability : réponse inconnue conservée | Exercés dans les combats | Révélation automatique par tous les effets non portée |
| Vitesse / premier tour | Paramètre 0/1 corrigé, égalité retourne 0 ou 2, compteur de tour corrigé | Fixtures compteur et branches | Vitesse exacte, Griffe Rapide et nombre aléatoire commun du tour incomplets |
| ShouldSwitch et auxiliaires | Non portés | Audit du C seulement | Bloquant |
| GetMostSuitableMonToSwitchInto | Non porté | Audit du C seulement | Remplacement automatique encore premier candidat |
| ShouldUseItem | Non porté | Audit du C seulement | Inventaire de dresseur vide en Tour dans le source ; autres contextes non couverts |
| Objets / genre / météo / autres commandes | Partiels | Tests non exhaustifs | Mémoire des objets, personnalité et valeurs numériques partagées incomplets |
| AI_CalcDmg, TypeCalc et moteur de combat | Partiels | Tests fonctionnels et stabilité | Nombreux effets, arrondis, talents et objets absents |
| Usine / Palais / autres installations | Absents | Aucune validation | Bloquant pour le périmètre v0.7 demandé |

## Tests réellement exécutés

`node --test tests/*.test.mjs` : 64 tests passent.
`python3 -m unittest discover -s tests -p 'test_*.py'` : 7 tests passent.
Le test `tests/ai_source_oracle.test.mjs` extrait cinq corps de fonctions du C figé, les compile avec `cc`, puis compare leurs sorties. Les variables globales et l'entrée Random sont injectées. Ce n'est pas l'exécution d'une ROM ou du moteur C complet.
La simulation des 80 positions de progression vérifie la stabilité ; elle ne démontre ni une série authentique de 80 victoires ni une IA conforme.

## Sauvegardes et interface

Le schéma 2, la base IndexedDB et les identifiants de défis sont conservés. Les propriétés de connaissance IA et de tour d'entrée sont stockées dans les Pokémon ; les tests existants contrôlent l'identité du prochain tour après export/import et reprise. Les anciens combats reprennent avec le moteur corrigé : leurs futures décisions peuvent donc différer de la v0.6.0.
Les cartes de ciblage utilisent les icônes statiques 32×32 des cartes de remplacement, avec texte sombre sur fond clair et coche de sélection. Les animations restent sur le terrain.

## Conditions encore nécessaires pour annoncer 100 %

Porter les routines de changement et remplacement avec leurs particularités de branche source ; porter les adaptateurs complets de dégâts, état, connaissances et limitations ; couvrir les règles spécifiques aux installations ; comparer actions, scores, cibles et consommation RNG contre le C pour des états reproductibles. Ne pas convertir un comptage de commandes en pourcentage de fidélité.

## Vérification K.O. et statistiques

Dix tests ciblés couvrent : choix humain sans tour/PP/RNG consommé, reprise du choix, deux K.O., réserve unique, K.O. sur Picots à l'entrée, facteurs de dégâts physiques/spéciaux et de vitesse, bornes −6/+6, précision/esquive réellement appliquées, Corps Sain distinct des baisses auto-infligées, Boost/Buée Noire et remise à zéro au switch.
Vérification dans le navigateur via un scénario de test isolé à largeur 360 px : Métalosse K.O., sélection de Latios (deuxième réserve), confirmation, retour aux quatre capacités de Latios avec PP intacts et journal toujours au tour initial. Les badges DÉF +2 ×2 et PRÉC −1 ×0,75 sont visibles et contrastés. Les fichiers temporaires QA sont exclus de la publication.
Cognobidon, Malédiction spectrale, toutes les interactions de talents/objets, l'ordre complet des entrées simultanées et Relais restent à compléter ; ne pas présenter tous les changements de statistiques comme certifiés.
