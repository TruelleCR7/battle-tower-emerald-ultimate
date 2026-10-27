# Source de vérité — Pokémon Émeraude

## Décision d'architecture

La seule référence normative du moteur, de l'IA et des sept installations est **pret/pokeemerald** : https://github.com/pret/pokeemerald.

Pokémon SDK et Pokémon Showdown ne doivent plus être utilisés comme références pour définir ou corriger les règles du jeu. Les fichiers déjà importés de Showdown sont des éléments historiques à inventorier et retirer progressivement des chemins de génération et de validation, sans casser les tests ni les sauvegardes existantes.

## Exception explicite du projet

Le split physique/spécial est déterminé **par capacité**, contrairement au jeu GBA original qui le détermine par type. Cette exception doit être isolée, documentée et testée ; tout le reste doit suivre pokeemerald, sauf demande explicite contraire.

## Méthode de portage

1. Identifier la fonction, la table ou le script source dans pokeemerald et épingler le commit de référence.
2. Porter le comportement dans le moteur JavaScript existant, sans prétendre exécuter le code GBA dans le navigateur.
3. Préserver l'interface, les sauvegardes et les fonctionnalités déjà opérationnelles.
4. Écrire des tests de conformité ciblés et, quand possible, un oracle compilé à partir de routines C de pokeemerald.
5. Documenter les écarts restants ; ne pas qualifier un sous-système de complet sans tests.

## Priorités

- Moteur : séquence de tour, priorités, précision, dégâts, statuts, capacités, talents, objets, météo, duo, remplacement et RNG.
- IA : scripts de score, sélection de capacité, changements stratégiques, choix du remplaçant et objets du dresseur.
- Installations : Tour, Usine, Dôme, Palais, Dojo, Reptile et Pyramide, avec progression et sauvegardes.
- Interface : garder les sprites, le teambuilder, les options d'animations et le jeu sur PC/mobile.

## Interdictions de régression

Ne pas supprimer ni réinitialiser les sauvegardes multi-runs. Ne pas remplacer silencieusement le split par capacité. Ne pas publier sur le site de production sans validation.
