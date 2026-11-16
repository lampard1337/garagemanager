# Werbevideo Garagenmanager

Zwei Fassungen, 30 fps, im Design von `entwurf-7-marke.html`: Markenfassung (30,6 s) und Fassung mit nachgebauter echter App
(`werbevideo-echt.html`, `--variante echt`, 34,1 s), jeweils mit 15-Sekunden-Kurzfassung.

- `werbevideo.html` – die Animation (im Browser öffnen zum Ansehen, `?format=9x16|4x5|1x1|16x9`, `&t=8.3` friert ein Bild ein)
- `render.js` – rendert alle Formate nach `out/` (braucht Chrome und ffmpeg)

```
npm install
node render.js            # alle Formate
node render.js 9x16       # nur eins
node render.js --schnitt 15   # 15-Sekunden-Kurzfassung (Hook, Wortwechsel, Übersicht, Preise, Schluss)
```

Texte ändern: direkt in der HTML-Datei, die Zeiten stehen in `renderAlt(t)`.

`zusatz.js` gilt für beide Fassungen: Wortwechsel am Tor (Garagen, Parkplätze, Tiefgaragen-, Parkhausstellplätze),
Preis-Szene nach dem Datenschutz und die „Auch für“-Chips im Schlussbild. **Preise und diese Texte stehen oben in
`ZUSATZ_TEXTE`.** Beide Abschnitte sind als Einschübe gebaut (`D1`, `D2` in der HTML-Datei): Dort bleibt die alte
Zeitachse stehen. Die Kurzfassungen (`SCHNITTE`) und die Soundeffekte rechnen in der neuen Zeitachse.

## Ton: Musik und Soundeffekte
Quelle: Pixabay-Dateien in `../assets/soundfx/` (Musik „Funky Corporate Startup Promo“ von Alex Morgan, dazu Effekte).
`mix.py` legt die Effekte an die Bildmomente aus `SFX_LANG` (in der jeweiligen HTML-Datei), senkt die Musik bei Effekten
kurz ab und bringt alles auf -14 LUFS (Spitzen max. -1,5 dB).

- Musik: 105 BPM. Ihr Stopp bei 3,0–3,5 s fällt auf den Torschlag, danach setzt sie voll ein.
  Langfassungen: 2 Takte ab 8,15 s werden wiederholt (Länge der beiden Einschübe). Echte-App-Fassung endet damit
  von selbst, Markenfassung wird ausgeblendet. 15 s: 6 Takte herausgeschnitten, damit das Ende passt.
- Effekte und Pegel stehen oben in `mix.py` (`EFFEKTE`), die Zeitpunkte in `SFX_LANG`.

```
node render.js --nur-ton                               # nur Tonspur neu mischen, Bild bleibt
node render.js --nur-ton --variante echt --schnitt 15
node render.js --stumm                                 # ohne Ton
```

Voraussetzung: Python mit numpy, ffmpeg.
