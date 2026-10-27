# Garagenmanager – Webseiten-Entwürfe

Sechs Vorschläge für eine neue Seite von garagenmanager.de:

- `entwurf-1-garagenhof.html` – Garagentore, beim Scrollen fährt ein Tor hoch
- `entwurf-2-zaehler.html` – Stromzähler, Schwerpunkt Stromabrechnung
- `entwurf-3-schluesselbrett.html` – Schlüsselbrett mit antippbaren Anhängern
- `entwurf-4-pro.html` – Produktseite im Apple-Stil mit 3D-Handy und Scroll-Story
- `entwurf-5-garagenzeile.html` – fotorealistische 3D-Garagenzeile (three.js), Schwingtore öffnen sich beim Scrollen, Stromrechner. Modelle, Texturen und HDRI von Poly Haven (CC0) liegen in `assets/garagenzeile/`
- `entwurf-6-lageplan.html` – grafischer Lageplan des Garagenhofs mit Mietstatus je Garage, Schriftfeld und Grundriss mit Anmerkungen

`index.html` verlinkt alle sechs. Reines HTML/CSS/JS, kein Build-Schritt.
GSAP, Lenis und three.js kommen per CDN. App-Ansichten und Zahlen sind Beispiele.

## Online stellen
Settings → Pages → Deploy from a branch → `main` / `(root)`.
Danach: https://lampard1337.github.io/garagemanager/
