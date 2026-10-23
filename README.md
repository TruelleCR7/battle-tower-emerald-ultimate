# Mise à jour 0.6.2

Rapport : [docs/MISE_A_JOUR_0.6.2.md](docs/MISE_A_JOUR_0.6.2.md). 80 tests réussis ; moteur et Zone de Combat encore incomplets.

# Battle Tower Emerald — v0.6.1 (portage en cours)

Site existant conservé : https://battle-tower-emerald-gregory.cuddly-mars-9562.chatgpt.site

Cette livraison améliore le jeu v0.5.0 ; elle ne constitue pas « Ultimate » terminé.
Le moteur et l'IA restent partiels. Les six autres installations, le Studio de Champions,
les Points de Combat et le réseau ne sont pas implémentés.

## Correctif IA, K.O. et statistiques 0.6.1

Après K.O., le joueur choisit et confirme son remplaçant sans consommer de tour.
Les niveaux de statistiques et leurs multiplicateurs sont visibles en combat.
Les effets simples manquants sont ajoutés (Agilité, Grincement, baisses/hausses, Buée Noire, Boost, Force Cosmik, Chatouille, Brume, baisse de Surchauffe, bonus multi-statistiques).
Les limites du moteur restent documentées : ce correctif ne certifie pas toutes les interactions.

Voir `docs/IA_CONFORMITE.md` : ordre des scripts, scores signés, tirages 16 bits,
évaluation des cibles Duo et connaissance des attaques observées corrigés.
64 tests JavaScript et 7 tests Python passent, dont un oracle C ciblé (compilateur `cc` requis).
L’objectif demandé de 100 % **reste non atteint** ; la livraison complète v0.7.0 n’est pas déclarée.

## Livré
- Défis multiples indépendants par format/niveau, y compris plusieurs Solo.
- Équipe initiale copiée par défi, état complet du combat, RNG, décisions, historique et progression.
- Sauvegarde IndexedDB transactionnelle, révision anti-écrasement entre onglets, abandon distinct de la pause.
- Reprise, renommage, suppression confirmée et archivage des défis terminés.
- Migration automatique de la session locale v0.5.0 ; sa clé localStorage originale reste intacte.
- Export/import JSON v2 comprenant les défis ; validation préalable avant remplacement confirmé.
- Capacités par couleur/type/catégorie/PP, badges de types et cartes de ciblage.
- Remplacements avec icônes statiques de menu, PV, statut et confirmation explicite.
- Journal complet par tour et par combat, dégâts/soins en valeurs et pourcentages.
- PV à 1 ou 3 décimales ; option pour masquer le pourcentage dans les fiches adverses.
- Correction MOVE_TARGET_BOTH (Surf, Éboulement…) et ciblage RANDOM.
- Noyau de Riposte / Voile Miroir adapté aux catégories des capacités, avec tests ciblés.
- Rejet des actions et remplacements invalides avant le début du tour.

## Construction et tests
Node.js 22+ et Python 3 ; aucune dépendance npm pour le jeu.

```sh
python3 scripts/import_data.py
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/build.py
```

Publier `dist/` sur le Site existant. Le manifeste `.openai/hosting.json` conserve son identifiant.
Le navigateur suffit pour jouer ; pas de ROM, émulateur ou serveur local côté joueur.
Pour le développement facultatif, les lanceurs BAT existants sont conservés.

## Maintenance
- `web/engine.mjs` : moteur partiel ; `web/ai_emerald_scripted.mjs` : interpréteur des scripts source.
- `web/runs.mjs` : transactions et modèles de défis ; `web/storage.mjs` : contrat import/reprise.
- `web/battle-ui.mjs` : palette, ciblage et groupement du journal.
- `sources.lock.json`, `data/upstream/` : références figées et code C/ASM utilisé.
- `docs/LIVRAISON_v0.6.0.md` : matrice de conformité, tests et suite des travaux.
- `tests/browser-storage.mjs` : tests IndexedDB à exécuter dans une page QA du navigateur, hors distribution.

## Données et migration
Les sauvegardes restent locales au navigateur et à l'origine du Site. Pas de synchronisation appareil à appareil.
La première ouverture importe la session v0.5.0 dans un défi nommé « Défi repris de v0.5.0 ».
Le format v1 d'export conserve équipes/records à l'import mais pas le combat (ancien contrat non validé).
Les fichiers v2 conservent les combats. Le fichier importé remplace la sauvegarde après confirmation : exporter avant.
Une ancienne session reprend dans le moteur corrigé v0.6.0 ; on ne conserve pas une copie du moteur v0.5.0.
Les références règles/pack sont enregistrées, mais l'exécution de plusieurs versions du moteur et l'installation de packs futurs restent à développer.
Les écritures concurrentes sont bloquées au niveau du profil entier : recharger l'onglet périmé, sans fusion automatique.
Une coupure avant la fin de la transaction peut perdre la dernière action non confirmée ; les transactions précédentes restent intactes.

## Source et sauvegarde de sécurité
Base préservée : commit Sites `4f80573ca13a2d89cf3f1e3242d37fb3220814a4` (v0.5.0).
Une archive de sécurité a été créée avant modification. L'export v0.5.0 livré précédemment reste disponible.
Le dépôt source lié au Site est synchronisé par le workflow Sites. Ce dépôt n'est pas un dépôt GitHub.
La recherche de `battle-tower-emerald-web` n'a retourné aucun dépôt accessible ; les outils GitHub disponibles ne permettent pas de créer ce dépôt.
Le ZIP contient les sources complètes et l'historique de maintenance ; le répertoire `.git` n'y est pas inclus.

## Ressources externes
Sprites animés et images de repli : Pokémon Showdown. Icônes statiques de menu : fichiers PNG 32×64 de pret/pokeemerald, première frame affichée, commit figé.
Ces images ne sont pas incluses dans le ZIP et nécessitent le réseau. Les 386 chemins d'icônes ont été contrôlés dans la source (Zarbi : forme A).
Les droits Pokémon restent aux ayants droit. Projet amateur non officiel, accès privé conservé.
