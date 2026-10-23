# Import des sources v0.6.2

L'archive `BattleTower_Emerald_v0.6.2_GitHub_Ready.zip` contient les sources et les ressources du jeu. Elle doit être décompressée avant import GitHub.

## Avec GitHub Desktop (Windows)
1. Dans GitHub Desktop : File > Clone repository > URL, coller `https://github.com/TruelleCR7/battle-tower-emerald-ultimate.git`.
2. Sélectionner la branche `develop` (Current branch).
3. Décompresser l'archive dans un dossier temporaire.
4. Copier **le contenu** du dossier `battle-tower-work` dans le dossier du dépôt cloné, sans recopier le dossier enveloppe. Conserver le dossier `.github` existant.
5. Dans GitHub Desktop : vérifier les fichiers, saisir `Import full Battle Tower Emerald v0.6.2 sources`, cliquer `Commit to develop`, puis `Push origin`.
6. Vérifier l'onglet Actions sur GitHub.

Ne pas téléverser l'archive ZIP comme seul fichier : le code doit rester modifiable et testable dans GitHub.

## Précautions
- Ne pas effacer `.github/workflows/ci.yml` déjà présent.
- Ne pas importer `__pycache__`, `*.pyc` ni d'identifiants privés.
- Le Site ChatGPT de production n'est pas modifié par cette opération.
