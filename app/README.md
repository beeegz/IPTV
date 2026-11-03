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
