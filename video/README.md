# Werbevideo Garagenmanager

26 Sekunden, 30 fps, im Design von `entwurf-7-marke.html`.

- `werbevideo.html` – die Animation (im Browser öffnen zum Ansehen, `?format=9x16|4x5|1x1|16x9`, `&t=8.3` friert ein Bild ein)
- `render.js` – rendert alle Formate nach `out/` (braucht Chrome und ffmpeg)

```
npm install
node render.js            # alle Formate
node render.js 9x16       # nur eins
node render.js --schnitt 15   # 15-Sekunden-Kurzfassung (Hook, Übersicht, Strom, Datenschutz, Schluss)
```

Texte ändern: direkt in `werbevideo.html`, die Zeiten stehen in `render(t)`.
Die Videos haben eine stille Tonspur. Musik am besten in Instagram/TikTok aus der lizenzierten Bibliothek wählen.
