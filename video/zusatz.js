// Ergänzungen für beide Fassungen (werbevideo.html und werbevideo-echt.html):
// - Wortwechsel im Titel am Tor: Garagen -> Parkplätze -> Tiefgaragenstellplätze -> Parkhausstellplätze
// - Preis-Szene nach dem Datenschutz
// - "Auch für"-Chips und Preis-Zeile unter dem Play-Button
// Die beiden neuen Abschnitte werden als Einschübe in die bestehende Zeitachse gelegt:
// Während eines Einschubs bleibt die alte Zeitachse stehen, darüber laufen die neuen Animationen.

// ---- Texte und Preise (hier anpassen, falls sich der Preis ändert) ----
const ZUSATZ_TEXTE = {
  woerter: ['Garagen', 'Parkplätze', 'Tiefgaragenstellplätze', 'Parkhausstellplätze'],
  preisPille: 'Preise',
  preisTitel: ['Kostet weniger als', 'eine Garagenmiete.'],
  // [Bezeichnung, Preis, Zusatz] – die erste Stufe wird hervorgehoben
  stufen: [['Bis 2 Garagen', 'Kostenlos', ''], ['3 bis 11 Garagen', '8,99 €', '/ Monat'], ['Ab 12 Garagen', '12,99 €', '/ Monat']],
  auchFuer: 'Auch für',
  chips: ['Parkplätze', 'Tiefgaragen', 'Parkhäuser'],
  info: 'Für Android · bis 2 Garagen kostenlos',
};

window.Zusatz = (function () {
  const cl = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const p = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 4);
  const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const back = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const q = s => document.querySelector(s);
  const sicht = (el, an) => { el.style.visibility = an ? '' : 'hidden'; };
  function zeilen(el, tIn, t, stagger, dur) {
    el.querySelectorAll('.ln>span').forEach((s, i) => {
      const a = eo(p(t, tIn + i * stagger, tIn + i * stagger + dur));
      s.style.transform = `translateY(${(1 - a) * 115}%)`;
    });
  }
  function pop(el, t0, t) {
    const a = back(p(t, t0, t0 + .55));
    el.style.opacity = cl(p(t, t0, t0 + .2));
    el.style.transform = `translateY(${(1 - a) * 30}px) scale(${.85 + .15 * a})`;
  }
  function hoch(el, t0, t, weg = 16) {
    const a = eo(p(t, t0, t0 + .6));
    el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * weg}px)`;
  }

  let C, WECHSEL, I2N;

  // C: {F, W, H, L, i1, D1, i2, D2, torZu, ende} – Zeiten i1, i2, torZu, ende in der alten Zeitachse
  function einrichten(c) {
    C = c;
    WECHSEL = [c.i1 + .15, c.i1 + .85, c.i1 + 1.55]; // Wortwechsel (neue Zeitachse)
    I2N = c.i2 + c.D1;                               // Beginn Preis-Szene (neue Zeitachse)
    const T = ZUSATZ_TEXTE;

    const st = document.createElement('style');
    st.textContent = `
      .wort>span{display:block;position:relative;height:1.02em}
      .wort .w{position:absolute;left:0;bottom:0;white-space:nowrap;transform-origin:0 100%}
      .preis{color:var(--weiss)}
      .preis .stufe{display:flex;justify-content:space-between;align-items:baseline;background:#22262D;border-radius:.55em;padding:.6em .85em .65em;margin-top:.4em;box-shadow:0 0 0 1px #2E333B inset}
      .preis .stufe span{color:#B4BAC3;font-weight:500;letter-spacing:-.01em}
      .preis .stufe b{font-size:1.55em;font-weight:750;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
      .preis .stufe:first-child{box-shadow:0 0 0 2px var(--orange) inset}
      .preis .stufe:first-child b{color:var(--orange)}
      .preis .stufe small{font-size:.42em;font-weight:500;color:#B4BAC3;letter-spacing:0;margin-left:.35em}
      #chipsB{display:flex;flex-wrap:wrap;align-items:center;gap:.4em}
      #chipsB .lab{font-weight:500;color:var(--ink);opacity:.75;margin-right:.1em}
      #chipsB .chip-s{background:rgba(20,23,28,.12);color:var(--ink);font-weight:600;letter-spacing:-.01em;border-radius:999px;padding:.32em .8em}
    `;
    document.head.appendChild(st);

    // Titel am Tor: Wort in eigener Zeile, damit es wechseln kann
    q('#titelA').innerHTML =
      `<span class="ln wort"><span>${T.woerter.map(w => `<span class="w">${w}</span>`).join('')}</span></span>` +
      `<span class="ln"><span>vermieten.</span></span><span class="ln"><span>Ohne Papierkram.</span></span>`;

    // Preis-Szene (unter dem Tor, damit es sich darüber schließt)
    const pr = document.createElement('div');
    pr.className = 'abs preis'; pr.id = 'preis';
    pr.innerHTML = `<div class="pille"><i></i>${T.preisPille}</div>` +
      `<div class="gross" id="preisT">${T.preisTitel.map(z => `<span class="ln"><span>${z}</span></span>`).join('')}</div>` +
      `<div id="stufen">${T.stufen.map(([a, b, z], i) => `<div class="stufe" id="st${i}"><span>${a}</span><b>${b}${z ? `<small>${z}</small>` : ''}</b></div>`).join('')}</div>`;
    q('#stage').insertBefore(pr, q('#tor'));

    // Schlussbild: Chips unter dem Play-Button, Preis-Zeile darunter
    const ch = document.createElement('div');
    ch.id = 'chipsB';
    ch.innerHTML = `<span class="lab">${T.auchFuer}</span>` + T.chips.map(c => `<span class="chip-s">${c}</span>`).join('');
    q('#playB').after(ch);
    q('#infoB').textContent = T.info;

    // Größen je Format
    const PL = {
      '9x16': {fs: 84, stufe: 36, w: 920, pill: 30, chips: 30},
      '4x5':  {fs: 76, stufe: 32, w: 920, pill: 26, chips: 27},
      '1x1':  {fs: 64, stufe: 28, w: 920, pill: 24, chips: 24},
      '16x9': {fs: 96, stufe: 36, w: 1000, pill: 30, chips: 30},
    }[c.F];
    pr.style.left = c.L.vers.x + 'px';
    q('#preisT').style.fontSize = PL.fs + 'px';
    pr.querySelector('.pille').style.fontSize = PL.pill + 'px';
    const stf = q('#stufen'); stf.style.fontSize = PL.stufe + 'px'; stf.style.width = PL.w + 'px'; stf.style.marginTop = '.9em';
    ch.style.fontSize = PL.chips + 'px'; ch.style.marginTop = '1.1em';
    q('#torA').style.width = (c.W - 2 * c.L.torA.x) + 'px';
  }

  function messen() {
    const frei = C.W - 2 * C.L.torA.x;
    document.querySelectorAll('#titelA .w').forEach(w => { w.dataset.s = Math.min(1, frei / w.offsetWidth); });
    const pr = q('#preis'); pr.style.top = Math.round((C.H - pr.offsetHeight) / 2) + 'px';
  }

  // neue Zeit -> alte Zeit
  function altZeit(t) {
    const {i1, D1, i2, D2} = C;
    if (t < i1) return t;
    if (t < i1 + D1) return i1;
    if (t < I2N) return t - D1;
    if (t < I2N + D2) return i2;
    return t - D1 - D2;
  }
  // alte Zeit -> neue Zeit (für Soundeffekte)
  function neuZeit(ta) {
    return ta <= C.i1 ? ta : ta <= C.i2 ? ta + C.D1 : ta + C.D1 + C.D2;
  }

  function render(t, ta) {
    // Wortwechsel
    if (ta < 10) {
      document.querySelectorAll('#titelA .w').forEach((w, j) => {
        const ein = j === 0 ? 1 : eo(p(t, WECHSEL[j - 1], WECHSEL[j - 1] + .45));
        const aus = j < WECHSEL.length ? eio(p(t, WECHSEL[j], WECHSEL[j] + .4)) : 0;
        w.style.transform = `translateY(${((1 - ein) - aus) * 112}%) scale(${w.dataset.s || 1})`;
        sicht(w, ein > 0 && aus < 1);
      });
    }

    // Datenschutz ausblenden, Preise einblenden
    const vers = q('#vers');
    const v = 1 - eio(p(t, I2N, I2N + .4));
    vers.style.opacity = v; vers.style.transform = `translateY(${-(1 - v) * 40}px)`;
    const pr = q('#preis');
    const an = t > I2N && ta < C.torZu + .7;
    sicht(pr, an);
    if (an) {
      const pl = pr.querySelector('.pille');
      hoch(pl, I2N + .15, t, 14);
      zeilen(q('#preisT'), I2N + .2, t, .1, .65);
      document.querySelectorAll('#stufen .stufe').forEach((s, i) => pop(s, I2N + .55 + i * .16, t));
    }

    // Schlussbild: Chips und Preis-Zeile
    if (ta > 14) { // vorher unsichtbar halten, auch während sich das Tor schließt
      const e = C.ende;
      const ch = q('#chipsB');
      hoch(ch.querySelector('.lab'), e + 1.15, ta);
      ch.querySelectorAll('.chip-s').forEach((s, i) => pop(s, e + 1.25 + i * .12, ta));
      hoch(q('#infoB'), e + 1.75, ta);
    }
  }

  function sfx() {
    return [...WECHSEL.map(w => ['wort', w + .05]), ['whoosh', I2N + .2]];
  }

  return {einrichten, messen, altZeit, neuZeit, render, sfx};
})();
