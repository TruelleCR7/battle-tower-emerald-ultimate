# Battle Tower Studio — v0.4.1 | Galaxy S22

## Statut technique exact (20 octobre 2026)

**Sans ROM.** Jeu HTML/JavaScript jouable depuis Chrome Android ou un site statique HTTPS ; pixel-art, sprites animés Gen V lorsqu'ils sont disponibles. Portrait 360–420 px. Mode PC local également disponible.

**IA : progression concrète, mais PAS encore une copie exhaustive du moteur d’Émeraude.**
Le moteur ajoute un compilateur des scripts ASM de score du fichier `data/battle_ai_scripts.s` et un interpréteur de branches et de scores en JavaScript. Lorsque les sources ont été synchronisées, les routines de Tour actives (`AI_CheckBadMove`, `AI_TryToFaint`, `AI_CheckViability`, avec `AI_DoubleBattle` en duo) sont choisies d'après `src/battle_ai_script_commands.c`. Les sources C d'IA sont aussi archivées pour audit.

Les différences restantes sont significatives : calcul des prévisions et de certains états, changement stratégique et objets IA (`battle_ai_switch_items.c`), combats double complexes, nombreuses interactions talent/objet/capacité, effets rares, génération des dresseurs et leurs probabilités exactes. Le module `ai_emerald_scripted.mjs` **ne doit pas être qualifié de portage identique**. Il n'a pas encore été validé par comparaison tour-par-tour avec le moteur d'origine.

### Deux niveaux de données

* **Livraison ZIP immédiate :** 38 espèces, 76 capacités, sets prédéfinis, IA tactique locale de secours. Le module de scripts d'origine est présent mais **ne sera exécuté qu'après import des sources**.
* **Après synchronisation sur PC avec Internet :** l'importateur télécharge les espèces, les capacités, les sets officiels de la Tour et le texte des scripts IA de `pret/pokeemerald`, ainsi que les catégories physique/spéciale depuis Pokémon Showdown. Il compile les règles de score dans `data/catalog.json`. La procédure reconstruit ensuite le site PWA et le fichier HTML autonome avec ces nouvelles données. Cet import complet n'a pas été exécuté dans l'environnement de génération, faute d'accès réseau direct.

## Jouer sur Galaxy S22

### Option recommandée — Installer une PWA

Publier les **fichiers intérieurs de `site/`** sur GitHub Pages ou Cloudflare Pages. Ouvrir l'URL HTTPS dans Chrome sur le S22, puis menu **⋮ → Ajouter à l'écran d'accueil**. Le cache conserve le site et les données après la première visite. Les GIF Noir/Blanc sont mis en cache progressivement et nécessitent le réseau lors du premier affichage.

### Sans hébergement

Copier `BattleTower_S22_SansInstallation.html` sur le Galaxy S22 et l'ouvrir dans un navigateur acceptant les documents HTML locaux. Restrictions variables selon Android : si les scripts ou la sauvegarde locale sont bloqués sur `file://`, utiliser l'option HTTPS. Aucun Python et aucune ROM ne sont nécessaires **sur le téléphone**.

### Via le même Wi-Fi que ton ordinateur

Lancer `LANCER_PC_POUR_GALAXY_S22.bat`, puis ouvrir sur le téléphone l'URL IP affichée. Garder le PC allumé. Ne pas utiliser `localhost` depuis le téléphone.

### Activer l'import complet des données et du code IA

Sur le PC Windows avec Python 3 et Internet : lancer **`PREPARER_VERSION_S22.bat`**. Ce script télécharge les fichiers publics d'origine, génère le catalogue et reconstruit `site/` et `BattleTower_S22_SansInstallation.html`. Pour l'installation Android en PWA, republier ensuite `site/` sur ton hébergeur HTTPS.

Sur macOS/Linux : `python3 sync_pokeemerald.py && python3 pack_site.py`.

## Tests

- Node 22+ : `node --test tests/*.mjs`
- Python : `python -m unittest discover tests`
- Tests vérifiés : 16 tests JavaScript + 7 tests Python. Tests navigateur et source synchronisée sur Internet : **non confirmés dans cette livraison**.

## Conception

- `web/engine.mjs` : moteur de combat JS autonome, split physique/spécial par capacité.
- `web/ai_emerald_scripted.mjs` : interprétation de script IA de score (port partiel des primitives originales).
- `ai_source_compiler.py` : conversion des instructions ASM et des tables de données vers JSON.
- `sync_pokeemerald.py` : source importer, compilation et extraction des sets.
- `pack_site.py` : création statique mobile et HTML autonome.
- `site/` : contenu prêt à héberger en HTTPS.

### Sources

- [pret/pokeemerald](https://github.com/pret/pokeemerald), `data/battle_ai_scripts.s`, `src/battle_ai_script_commands.c`, `src/battle_ai_switch_items.c`.
- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) pour la catégorie Gen IV et les sprites animés Gen V.

Projet amateur non officiel. Pokémon et sprites restent soumis aux droits de leurs ayants droit. Aucune ROM n'est incluse.
