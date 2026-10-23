# Battle Tower Emerald Ultimate

Dépôt source du jeu Battle Tower Emerald Ultimate.

## État de migration
Le projet ChatGPT Sites existant doit encore être exporté ici dans son intégralité. **Ce dépôt ne contient pas encore le moteur ni les ressources du jeu.** Ne pas remplacer l'application existante par une reconstruction simplifiée.

Site de production actuel : https://battle-tower-emerald-gregory.cuddly-mars-9562.chatgpt.site

## Workflow cible
- `develop` : développement, tests et prévisualisation PC/mobile.
- `main` : version stable validée.
- Release versionnée : compilation et paquet de déploiement.
- ChatGPT Sites : production, mise à jour uniquement à partir d'une release validée, sans recréer le Site.

## Conditions préalables à la prévisualisation
1. Importer **toutes** les sources du Site existant : code, données, ressources, dépendances, tests et scripts.
2. Auditer le framework et les scripts de compilation.
3. Configurer un hébergement de prévisualisation HTTPS indépendant (ex. Cloudflare Pages si application statique).
4. Vérifier les interactions tactiles, le responsive et la compatibilité des sauvegardes sur smartphone et PC.
5. Mettre en place les tests GitHub Actions et la procédure de publication.

## Principes
- GitHub est la source de vérité.
- Ne jamais écraser les sauvegardes utilisateur.
- Aucune publication automatique sur ChatGPT Sites depuis `develop`.
- Les modifications quotidiennes et les tests doivent rester réalisables sans ChatGPT Work.
- Le déploiement Sites doit être groupé et documenté, sous réserve des capacités réelles de la plateforme.
