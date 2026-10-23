# Prévisualisation PC et smartphone

## Développement local
- Windows : lancer `LANCER.bat`, puis ouvrir l'URL indiquée sur le PC.
- Téléphone sur le même Wi-Fi : lancer `LANCER_PC_POUR_GALAXY_S22.bat` et suivre `GUIDE_GALAXY_S22.md`.
- Les données et sauvegardes sont propres à chaque origine (domaine/port) et navigateur. Exporter/importer les sauvegardes pour les transférer.

## Prévisualisation HTTPS (recommandée)
Configurer Cloudflare Pages sur le dépôt GitHub, branche `develop`, commande de build `python scripts/build.py`, répertoire de sortie `dist`. Vérifier la disponibilité de Python dans l'environnement de build. Sinon construire `dist` en CI et déployer l'artefact via une action adaptée avec un secret Cloudflare.
Ne pas activer la publication tant que les paramètres de confidentialité et les droits des ressources ne sont pas vérifiés. La prévisualisation Cloudflare Pages est généralement accessible publiquement via son URL ; la confidentialité du dépôt GitHub ne protège pas automatiquement l'URL.

## Production
Ne pas modifier automatiquement le Site ChatGPT existant. Publier une release validée, puis effectuer une mise à jour groupée de Sites si le mécanisme d'import du projet le permet.
