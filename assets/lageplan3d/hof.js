/* Lageplan 3D (Entwurf 6b): Der gezeichnete Plan kippt beim Scrollen
   und die Garagen wachsen zu schlichten Blöcken. Nur three.js, keine Modelle. */
import * as THREE from 'three';

const html = document.documentElement;
const box = document.getElementById('plan3d');
const canvas = box.querySelector('canvas');
const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) { renderer = null; }

if (renderer) {
  html.classList.add('mit-3d');
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
}

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const FARBE = {
    blau: new THREE.Color('#2B5FA0'), blauWahl: new THREE.Color('#6C9BD6'),
    rot: new THREE.Color('#E3412F'), rotWahl: new THREE.Color('#FF7462'),
    weiss: new THREE.Color('#FFFFFF')
  };

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8fbf, 1.9));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.5);
  sonne.position.set(-6, 10, 7);
  scene.add(sonne);

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 200);

  /* Planmaße wie im SVG, 100 px = 1 Einheit, Mitte = Ursprung */
  const B = 1.6, T = 1.9, HOEHE = 0.88;
  const garagen = window.garagen || [];
  const bloecke = [];

  const boxGeo = new THREE.BoxGeometry(B, 1, T); boxGeo.translate(0, 0.5, 0);
  const kantenGeo = new THREE.EdgesGeometry(boxGeo);
  const torGeo = new THREE.PlaneGeometry(B - 0.36, 0.86); torGeo.translate(0, 0.43, 0);
  const torTex = torTextur();
  const nummerGeo = new THREE.PlaneGeometry(0.9, 0.9); nummerGeo.rotateX(-Math.PI / 2);

  garagen.forEach((g, i) => {
    const oben = i < 6;
    const cx = (120 + (i % 6) * 160 + 80 - 600) / 100;
    const cz = ((oben ? 155 : 565) - 360) / 100;
    const frei = g[2] === 'frei';

    const gruppe = new THREE.Group();
    gruppe.position.set(cx, 0, cz);
    scene.add(gruppe);

    const huelle = new THREE.Group(); // wird in der Höhe skaliert
    gruppe.add(huelle);

    const mat = frei
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false })
      : new THREE.MeshLambertMaterial({ color: g[2] === 'offen' ? FARBE.rot : FARBE.blau });
    const koerper = new THREE.Mesh(boxGeo, mat);
    koerper.userData.index = i;
    huelle.add(koerper);

    const kanten = new THREE.LineSegments(kantenGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: frei ? 0.7 : 1 }));
    huelle.add(kanten);

    const tor = new THREE.Mesh(torGeo, new THREE.MeshBasicMaterial({ map: torTex, transparent: true, opacity: frei ? 0.35 : 1 }));
    tor.position.z = oben ? T / 2 + 0.002 : -T / 2 - 0.002;
    if (!oben) tor.rotation.y = Math.PI;
    huelle.add(tor);

    const nummer = new THREE.Mesh(nummerGeo, new THREE.MeshBasicMaterial({ map: nummerTextur(String(i + 1).padStart(2, '0')), transparent: true, depthWrite: false }));
    gruppe.add(nummer);
    if (frei) { // freie Garage: schraffierte Grundfläche wie im Plan
      const schraffur = new THREE.Mesh(new THREE.PlaneGeometry(B, T).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: schraffurTextur(), transparent: true, depthWrite: false }));
      schraffur.position.y = 0.002;
      gruppe.add(schraffur);
    }

    bloecke.push({ gruppe, huelle, koerper, nummer, oben, frei, offen: g[2] === 'offen', abstand: Math.abs(cx) * 0.3 + (oben ? 0 : 0.4) });
  });

  /* Zufahrt: Mittellinie, Pfeile, Grundstücksgrenze */
  const linienMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62 });
  for (let x = -5.3; x < 5.3; x += 0.38) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.025), linienMat);
    s.rotation.x = -Math.PI / 2; s.position.set(x + 0.11, 0.001, 0);
    scene.add(s);
  }
  const pfeil = new THREE.Shape();
  pfeil.moveTo(0, -0.05); pfeil.lineTo(0.46, -0.05); pfeil.lineTo(0.46, -0.15); pfeil.lineTo(0.68, 0.03);
  pfeil.lineTo(0.46, 0.21); pfeil.lineTo(0.46, 0.11); pfeil.lineTo(0, 0.11); pfeil.closePath();
  const pfeilGeo = new THREE.ShapeGeometry(pfeil); pfeilGeo.rotateX(-Math.PI / 2);
  const p1 = new THREE.Mesh(pfeilGeo, linienMat); p1.position.set(-4.5, 0.001, -0.33); scene.add(p1);
  const p2 = new THREE.Mesh(pfeilGeo, linienMat); p2.rotation.y = Math.PI; p2.position.set(4.5, 0.001, 0.4); scene.add(p2);

  const grenze = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5.86, 0, -3.46), new THREE.Vector3(5.86, 0, -3.46),
    new THREE.Vector3(5.86, 0, 3.46), new THREE.Vector3(-5.86, 0, 3.46), new THREE.Vector3(-5.86, 0, -3.46)
  ]);
  const grenzLinie = new THREE.Line(grenze, new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, dashSize: 0.14, gapSize: 0.08 }));
  grenzLinie.computeLineDistances();
  scene.add(grenzLinie);

  /* Zustand */
  let ziel = ruhig ? 1 : 0, p = ziel, wahl = window.gewaehlt ?? -1, hover = -1, muss = true;

  function setzeWahl() {
    bloecke.forEach((b, i) => {
      if (b.frei) { b.koerper.material.opacity = i === wahl ? 0.22 : (i === hover ? 0.14 : 0.07); return; }
      const an = i === wahl || i === hover;
      b.koerper.material.color.copy(b.offen ? (an ? FARBE.rotWahl : FARBE.rot) : (an ? FARBE.blauWahl : FARBE.blau));
    });
    muss = true;
  }
  setzeWahl();
  addEventListener('garage', (e) => { wahl = e.detail; setzeWahl(); });

  /* Kamera und Höhe aus dem Fortschritt p (0 = flacher Plan, 1 = 3D-Hof) */
  const glatt = (t) => t * t * (3 - 2 * t);
  const klemm = (v) => Math.min(1, Math.max(0, v));
  function anwenden() {
    const e = glatt(klemm(p));
    const polar = 0.0001 + e * 0.9;
    const azimut = -e * 0.42;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const breite = 12.4, tiefe = 7.6;
    const dist = Math.max(tiefe / 2 / Math.tan(fov / 2), breite / 2 / (Math.tan(fov / 2) * camera.aspect)) * (1.02 + e * 0.04);
    camera.position.set(
      dist * Math.sin(polar) * Math.sin(azimut),
      dist * Math.cos(polar),
      dist * Math.sin(polar) * Math.cos(azimut)
    );
    camera.up.set(0, e < 0.02 ? 0 : 1, e < 0.02 ? -1 : 0);
    camera.lookAt(0, e * 0.35, 0);

    bloecke.forEach((b) => {
      const lokal = glatt(klemm((e - b.abstand * 0.12) / 0.75));
      const h = Math.max(0.001, lokal * HOEHE);
      b.huelle.scale.y = h;
      b.nummer.position.y = h + 0.004;
    });
  }

  /* Größe */
  function groesse() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    muss = true;
  }
  new ResizeObserver(groesse).observe(box);
  groesse();

  /* Antippen per Raycast */
  const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
  const koerper = bloecke.map((b) => b.koerper);
  function treffer(ev) {
    const r = canvas.getBoundingClientRect();
    maus.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(maus, camera);
    const t = ray.intersectObjects(koerper, false)[0];
    if (t) return t.object.userData.index;
    // flacher Plan: Bodenfläche der Garage zählt auch
    const boden = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), boden)) {
      return bloecke.findIndex((b) => Math.abs(boden.x - b.gruppe.position.x) < B / 2 && Math.abs(boden.z - b.gruppe.position.z) < T / 2);
    }
    return -1;
  }
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const i = treffer(ev);
    if (i !== hover) { hover = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; setzeWahl(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hover !== -1) { hover = -1; setzeWahl(); } });
  canvas.addEventListener('click', (ev) => { const i = treffer(ev); if (i >= 0 && window.waehle) window.waehle(i); });

  /* Scroll steuert den Fortschritt */
  if (!ruhig && window.gsap && window.ScrollTrigger) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 981px)', () => {
      ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: '+=110%', pin: true, onUpdate: (s) => { ziel = s.progress; } });
    });
    mm.add('(max-width: 980px)', () => {
      ScrollTrigger.create({ trigger: box, start: 'top 70%', end: 'bottom 30%', onUpdate: (s) => { ziel = s.progress; } });
    });
  }

  /* Nur zeichnen, wenn sich etwas ändert */
  function schleife() {
    const d = ziel - p;
    if (Math.abs(d) > 0.0005) { p += d * 0.12; muss = true; }
    if (muss) { anwenden(); renderer.render(scene, camera); muss = false; }
    requestAnimationFrame(schleife);
  }
  if (!ruhig && window.gsap) gsap.from(canvas, { opacity: 0, duration: 0.8, ease: 'power2.out' });
  schleife();
}

/* Texturen aus Canvas: Garagennummer und Sektionaltor */
function nummerTextur(text) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.font = '700 110px "Barlow Condensed", "Arial Narrow", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 132);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function schraffurTextur() {
  const c = document.createElement('canvas'); c.width = 160; c.height = 190;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2;
  for (let i = -190; i < 160; i += 14) { x.beginPath(); x.moveTo(i, 190); x.lineTo(i + 190, 0); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function torTextur() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#F4F7FB'; x.fillRect(0, 0, 256, 160);
  x.fillStyle = '#B8C6D8';
  for (let y = 40; y < 160; y += 40) x.fillRect(0, y - 2, 256, 4);
  x.fillRect(108, 136, 40, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
