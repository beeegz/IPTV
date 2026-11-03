# Mimou TV

Lecteur IPTV web moderne (HTML/CSS/JS, sans build), inspiré de l'interface de Chud IPTV.

- Interface type Netflix : bannière « À la une » et rails horizontaux par catégorie
- Lecteur vidéo HLS (hls.js) avec zapping, reconnexion automatique, liste de chaînes
- Import M3U/M3U8 (URL ou fichier), chaînes / films / séries détectés automatiquement
- Catégories (pastilles), recherche instantanée sans accents, favoris persistants
- Responsive : barre de navigation basse sur mobile, thème sombre

## Utilisation

```bash
cd app && python3 -m http.server 8080   # puis ouvrir http://localhost:8080
```

Cliquez sur **+ Source** puis **Charger la démo** ou importez votre playlist.
Raccourcis : `/` recherche · `←` `→` chaîne · `F` favori · `M` muet · `Échap` fermer.

Aucune chaîne n'est fournie. Les données restent dans le navigateur (localStorage).

## Applications Android et iOS (Capacitor)

Le dossier `app/` est emballé avec Capacitor (`android/`, `ios/` à la racine du dépôt). L'app native autorise le HTTP et n'est pas limitée par CORS : un serveur Xtream Codes ou une playlist en `http://` fonctionne.

Compilation automatique : onglet **Actions → Build Mimou TV (Android & iOS) → Artifacts**.
- `MimouTV-android-apk` : `app-debug.apk`, à copier sur le téléphone puis ouvrir.
- `MimouTV-ios-ipa` : IPA non signé, à installer avec Sideloadly ou AltStore (Apple ID gratuit, à renouveler tous les 7 jours).

En local : `npm install && npx cap sync`, puis `npx cap open android` ou `npx cap open ios`.
