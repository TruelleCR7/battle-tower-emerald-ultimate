# Livraison v0.6.0 — étape vérifiée, 21 octobre 2026

## Portée réelle
Mise à jour du Site existant. Sauvegarde avant travaux : commit v0.5.0 `4f80573ca13a2d89cf3f1e3242d37fb3220814a4`, archive `BattleTower_before_v060.zip` créée avant modification. Aucun effacement de l'ancienne clé locale.
Les données restent 386 espèces, 354 capacités, 882 sets et 300 dresseurs. Ces comptes sont testés, mais ne signifient pas couverture mécanique complète.

## Matrice des installations
| Installation | Jouabilité | Restrictions appliquées | Non implémenté / non certifié |
|---|---|---|---|
| Tour Solo | Oui, moteur partiel | 3 Pokémon, espèces exclues importées, doublons espèces/objets, EV/IV/nature/talent/objet, niveau max 50, pool de capacités, œufs et K.O. | Exhaustivité combat/IA, légalité croisée, récompenses |
| Tour Duo | Oui, moteur partiel | 4 Pokémon et mêmes contrôles ; remplaçant déjà réservé interdit ; cibles actives vérifiées | Interactions Duo complètes, redirections, RNG original |
| Tour Multi IA | Oui, moteur partiel | 2 Pokémon du joueur et génération du partenaire existante | Partenaires et mélange de records authentiques non portés |
| Tour Multi réseau | Non | Mode désactivé | Backend synchronisé, deux clients, reprise réseau |
| Usine | Non | Aucun défi proposé | Location, échanges, pools et Noland |
| Dôme | Non | Aucun défi proposé | Tournoi à 16, choix d'équipe, calculs et Tucker |
| Palais | Non | Aucun défi proposé | Nature, catégories d'action, Spenser |
| Dojo | Non | Aucun défi proposé | Mind/Skill/Body, jugement, changements interdits, Greta |
| Reptile | Non | Aucun défi proposé | 14 salles, événements, Lucy |
| Pyramide | Non | Aucun défi proposé | 7 étages, exploration, sac et Brandon |

Le niveau libre conserve le comportement existant : niveau adverse minimum 60, selon le maximum de l'équipe. Aucun contrôle exhaustif des combinaisons d'apprentissage / légalité historique. La matrice des sept installations n'est donc pas une certification de règles implémentées partout.

## Moteur et IA
Corrections : `MOVE_TARGET_BOTH` lu correctement (Surf/Éboulement ciblent les deux adversaires), ciblage RANDOM automatique, actions invalides rejetées avant consommation du hasard. Riposte/Voile Miroir mémorisent par catégorie le dernier dégât direct réel du tour et renvoient le double à son auteur adverse vivant. Les types immunisés restent immunisés. Références : `Cmd_counterdamagecalculator`, `Cmd_mirrorcoatdamagecalculator` et enregistrement de `gHpDealt` dans `src/battle_script_commands.c`, scripts dans `data/battle_scripts_1.s`.

Limites de ces corrections : Follow Me/redirections non portés, moteur de précision/Pression/Abri toujours incomplet, pas de validation différentielle GBA pour toutes les interactions. Les primitives IA d'estimation de ces capacités restent partielles. Ne pas considérer ces capacités comme exhaustivement conformes.
Les changements et objets de l'IA, l'état d'information connu, de nombreuses interactions et les arrondis exacts restent à porter. Les scripts ASM importés sont exécutés ; leur présence n'est pas une preuve de fidélité complète. Aucun nouvel algorithme heuristique de secours n'a été ajouté.

## Sauvegardes
IndexedDB enregistre tout le profil (défis, résultats, équipes, préférences) dans une transaction avec comparaison de révision. Un onglet périmé est bloqué avant écrasement, avec message et rechargement explicites. Une victoire terminale est identifiée et comptée une seule fois ; aucune récompense en PC n'est distribuée car ce système est absent.
Chaque défi garde équipe initiale, moteur, état RNG, décisions, historique, progression et références règles/contenu. Modifier l'équipe générale ne change pas celle du défi. Reprise sans construction d'un adversaire supplémentaire. Progression des événements Champions : champ prévu mais aucun moteur d'événements livré.
Migration locale v0.5.0 idempotente. Exports v2 validés avant confirmation de remplacement ; les exports v1 conservent uniquement équipes/records, comme auparavant. Pas de checksum signé ni synchronisation distante. Archive de défis terminés disponible, pas de duplication de défis officiels.

## Tests effectués
- Suite Node : voir `tests-node.txt` (moteur, imports, AI VM, migration, runs, ciblage, compteur idempotent, import v2, couleurs).
- Suite Python : voir `tests-python.txt` (import/compilateur).
- Tests IndexedDB en navigateur : persistance atomique, deux écritures concurrentes (une acceptée/une refusée), sauvegarde gagnante intacte, fermeture/réouverture.
- Parcours UI à largeur iframe 360 px : Solo, un tour, remplacement Métalosse → Laggron confirmé, sauvegarder/quitter ; démarrer Duo, choisir explicitement les deux cibles, jouer un tour ; reprendre Solo au tour 2, mêmes PV et journal ; terminer le combat Solo, passer au combat 2.
- Deux défis Solo simultanés visibles ; test unitaire des deux équipes initiales différentes et indépendantes.
- Deux vrais onglets : changement de format dans l'un ; l'autre affiche « Cette sauvegarde a changé dans un autre onglet » et bloque l'écriture.
- Pas de débordement : largeur contenu/scroll égales à 345 px dans l'iframe de 360 px (barre de défilement du navigateur comprise).
- Icônes de remplacement chargées, statiques 32×32 (première frame PNG 32×64), texte sombre ; confirmation et annulation visibles. Cibles avec bordure, coche, nom/types/PV. Palette testée à un contraste minimum 4,5:1 pour le texte des capacités.

Les scénarios Solo 4 victoires / Duo 2 victoires sont des fixtures de progression, pas six victoires jouées dans l'UI. Les tests de simulation existants vérifient la stabilité, pas la fidélité. Pas de Samsung Galaxy S22 physique disponible ; pas de validation matérielle ou paysage complet. Les six installations, le Studio et le réseau n'ont pas de test de bout en bout puisqu'ils ne sont pas implémentés.

## Suite des travaux, dépendances et critères
1. Porter l'interpréteur de scripts de combat C, leurs états et la séquence des déclenchements ; créer des fixtures différentielles pour chaque effet, talent, objet et arrondi. Corriger les remplacements après K.O., multi-coups et états volatils avant certification.
2. Porter `battle_ai_switch_items.c` et les primitives / connaissances de l'interpréteur AI ; comparer scores, décisions et tirages au code original. Ne pas substituer une heuristique.
3. Centraliser les profils de règles par installation et tester validateur joueur, adversaire et Champion. Implémenter d'abord Usine (location/échanges), puis les autres machines d'état propres aux installations.
4. Studio : définir persistance serveur compatible Sites et accès administrateur, puis CRUD, médias, équipes, triggers, priorités, mode classique/enrichi et combats de test sans records. Tester les apparitions sur 200 combats et les conflits avec les chefs officiels.
5. Packs : registres versionnés et compatibilité d'effets ; chargement explicite, migration ou maintien de l'ancien moteur pour chaque défi épinglé.
6. Réseau : serveur de sessions autoritaire, reprise et idempotence ; tests à deux appareils. Mise en service GitHub quand un dépôt privé accessible existe ou qu'une capacité de création est disponible.
