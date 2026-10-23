# Battle Tower — Samsung Galaxy S22

## Accès 1 : jouer directement depuis le téléphone

Copiez **`BattleTower_S22_SansInstallation.html`** sur le téléphone (Google Drive, câble USB ou téléchargement du fichier). Ouvrez-le dans un navigateur capable de lire les fichiers HTML locaux, depuis le gestionnaire de fichiers. Le fichier est autonome : aucun serveur, Python, ROM ou émulateur. Pour les **sprites GIF Noir/Blanc**, une connexion Internet reste nécessaire tant que vous ne les avez pas intégrés localement.

Attention : selon l’application utilisée pour ouvrir les fichiers et les permissions Android, les URL locales et `localStorage` peuvent être restreints ; dans ce cas, préférez le mode HTTPS ci-dessous.

## Accès 2 : site installé comme application Android (conseillé)

Publiez **le contenu du dossier `site/`** sur un hébergement statique **HTTPS** (par exemple GitHub Pages ou Cloudflare Pages). La version contient `manifest.webmanifest`, `sw.js`, les icônes, tous les scripts et le catalogue.

1. Ouvrez l’adresse HTTPS du site dans **Google Chrome sur le Galaxy S22**.
2. Menu **⋮ → Ajouter à l’écran d’accueil → Installer** (ou « Ajouter », selon Chrome).
3. Le jeu devient accessible depuis l’écran d’accueil, avec une sauvegarde locale indépendante du PC.
4. Le service worker conserve le moteur et les données après la première visite réussie ; les sprites sont mis en cache progressivement lorsqu’ils s’affichent.

### GitHub Pages sans serveur

- Créez un dépôt sur GitHub, par exemple `battle-tower-web`.
- Copiez **les fichiers contenus dans `site/`** à la racine de la branche `main`.
- Ouvrez **Settings → Pages → Build and deployment → Deploy from a branch**.
- Sélectionnez `main`, dossier `/ (root)` et enregistrez.
- Lorsque le site est publié, rendez-vous sur `https://VOTRE_PSEUDO.github.io/battle-tower-web/` depuis le S22.

Ne publiez pas une ROM : le projet utilise uniquement JavaScript, HTML et données JSON. Les sprites viennent de Pokémon Showdown et restent soumis aux droits des ayants droit de Pokémon.

## Accès 3 : depuis votre PC Windows, avec le même Wi-Fi

1. Le PC et le Galaxy S22 doivent utiliser **le même Wi-Fi privé**.
2. Sur Windows, exécutez **`LANCER_PC_POUR_GALAXY_S22.bat`**.
3. Notez l’URL « GALAXY S22 » dans la console, par exemple `http://192.168.1.50:8765/`.
4. Entrez cette adresse dans Chrome sur le S22.
5. Autorisez Python uniquement sur le **réseau privé** si Windows Defender le demande.

Il faut que le PC reste allumé et que le terminal du serveur reste ouvert. L’adresse **`localhost` du PC n’est jamais utilisable directement depuis le téléphone**. Le service worker ne s’installe généralement pas sur une connexion HTTP par IP locale ; privilégiez HTTPS pour un mode application et hors ligne.

## Contrôles et sauvegardes

- L'interface est optimisée pour **360 à 420 px**, portrait et paysage.
- Touches larges, validation de tour bien visible, défilement vertical en duo.
- Natures, EV/IV et objets tenus : éditeur tactile plein écran.
- La **composition, les records et le combat en cours** sont conservés dans `localStorage` par origine (site). Un changement d'URL/domaine ou l’effacement des données du navigateur peut faire perdre ces sauvegardes.
- Le mode Multi local reste un mode partagé sur **le même appareil**, pas du jeu en ligne.

## État du moteur

Cette adaptation mobile **ne rend pas l'IA ni les interactions exhaustives** : les limitations connues de la v0.3.0 restent présentes. Le moteur conserve les catégories physique/spéciale de la génération IV. Pour importer la base complète des espèces, capacités et sets, exécutez `SYNCHRONISER_SOURCE.bat` sur un PC, puis reconstruisez le dossier `site/` en remplaçant son `data/catalog.json` par celui du dossier `data/` et republiez.
