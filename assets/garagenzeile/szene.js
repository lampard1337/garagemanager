/* Garagenzeile: fotorealistische 3D-Szene für Entwurf 5 (three.js).
   Texturen, Modelle und HDRI: Poly Haven (CC0), polyhaven.com */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const BASIS = new URL('./', import.meta.url).href;
const PH = BASIS + 'ph/';
const html = document.documentElement;
const wrap = document.querySelector('.zeile');
const buehne = document.querySelector('.buehne');
const bild = document.querySelector('.buehne__bild');
const canvas = bild.querySelector('canvas');
const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fein = matchMedia('(pointer: fine)').matches;
const stark = fein && (navigator.hardwareConcurrency || 4) >= 4;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) { html.classList.add('kein-3d'); }
if (renderer) start().catch((e) => { console.error(e); html.classList.add('kein-3d'); });

async function start() {
  const dprWunsch = Number(new URLSearchParams(location.search).get('dpr')) || 0;
  renderer.setPixelRatio(dprWunsch || Math.min(devicePixelRatio, stark ? 1.5 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  RectAreaLightUniformsLib.init();

  /* ---------- Dateien laden ---------- */
  const tl = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (url, farbe = false, wdh = true) => tl.loadAsync(url).then((t) => {
    if (farbe) t.colorSpace = THREE.SRGBColorSpace;
    if (wdh) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  });
  const satz = (name) => Promise.all([tex(PH + name + '/diff.jpg', true), tex(PH + name + '/nor.jpg'), tex(PH + name + '/rough.jpg')]);
  const bildLaden = (url) => new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fehler; i.src = url; });
  const [hdr, asphalt, putz, sicht, boden, [blechN, blechR], blechGrau, schmutz, hoF, liM] = await Promise.all([
    new HDRLoader().loadAsync(BASIS + 'nacht_1k.hdr'),
    satz('asphalt_02'), satz('plaster_grey_04'), satz('concrete_wall_008'), satz('asphalt_04'),
    Promise.all([tex(PH + 'box_profile_metal_sheet/nor.jpg'), tex(PH + 'box_profile_metal_sheet/rough.jpg')]),
    bildLaden(PH + 'box_profile_metal_sheet/grau.jpg'), bildLaden(BASIS + 'tor_schmutz.jpg'),
    tex(BASIS + 'holz_farbe.jpg', true), tex(BASIS + 'linie_maske.jpg', false, false)
  ]);
  hdr.mapping = THREE.EquirectangularReflectionMapping;

  /* ---------- Szene, Himmel, Nebel ---------- */
  const scene = new THREE.Scene();
  scene.background = hdr;
  scene.backgroundIntensity = 0.022;
  scene.backgroundBlurriness = 0.12;
  scene.backgroundRotation.y = -0.6;
  scene.environment = hdr;
  scene.environmentIntensity = 0.09;
  scene.environmentRotation.y = -0.6;
  scene.fog = new THREE.FogExp2(0x0d1014, 0.028);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);

  /* Weltkoordinaten als UV, damit Flächen nicht gestreckt wirken */
  const weltUV = (geo, mass) => {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v;
      if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
      else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
      else { u = p.getX(i); v = p.getY(i); }
      uv.setXY(i, u / mass, v / mass);
    }
    uv.needsUpdate = true;
    return geo;
  };
  const pbr = ([map, normalMap, roughnessMap], extra = {}) => new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, ...extra });

  /* ---------- Materialien ---------- */
  const putzMat = pbr(putz, { color: 0xb9bab8, normalScale: new THREE.Vector2(0.8, 0.8) });
  const sichtMat = pbr(sicht, { color: 0xc6cacd, side: THREE.BackSide, envMapIntensity: 0.25 });
  const bodenMat = pbr(boden, { color: 0xa6a6a6, side: THREE.BackSide, envMapIntensity: 0.3 });
  const attika = new THREE.MeshStandardMaterial({ color: 0x2c2f32, roughness: 0.5, metalness: 0.7 });
  const verzinkt = new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.42, metalness: 0.85 });
  const holz = new THREE.MeshStandardMaterial({ map: hoF, roughness: 0.7 });

  const kiste = (geo, mat, x, y, z, { uv = 0, schatten = true, ry = 0 } = {}) => {
    if (uv) { geo.translate(x, y, z); weltUV(geo, uv); geo.translate(-x, -y, -z); }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = schatten; m.receiveShadow = true;
    scene.add(m); return m;
  };
  const rbox = (w, h, d, r = 0.015) => new RoundedBoxGeometry(w, h, d, 2, r);

  /* ---------- Boden ---------- */
  const bodenGeo = new THREE.PlaneGeometry(220, 160);
  bodenGeo.rotateX(-Math.PI / 2); bodenGeo.translate(0, 0, 40);
  weltUV(bodenGeo, 3.5);
  const platz = new THREE.Mesh(bodenGeo, pbr(asphalt, { color: 0x9a9a9a, normalScale: new THREE.Vector2(0.9, 0.9) }));
  platz.receiveShadow = true; scene.add(platz);

  const ABSTAND = 3.1, ANZAHL = 7, TOR_B = 2.4, TOR_H = 2.1, WAND_H = 2.65, TIEFE = 6, WAND = 0.25;
  const L = ABSTAND * ANZAHL;
  const xVon = (i) => (i - (ANZAHL - 1) / 2) * ABSTAND;

  const farbeLinie = new THREE.MeshStandardMaterial({ color: 0xd9ad2b, roughness: 0.62, alphaMap: liM, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (let i = 0; i <= ANZAHL; i++) {
    const g = new THREE.PlaneGeometry(0.12, 4.8); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, farbeLinie); m.position.set(xVon(i) - ABSTAND / 2, 0.002, 2.75); m.receiveShadow = true; scene.add(m);
  }

  /* ---------- Garagenblock ---------- */
  for (let i = 0; i <= ANZAHL; i++) kiste(rbox(ABSTAND - TOR_B, TOR_H, WAND, 0.02), putzMat, xVon(i) - ABSTAND / 2, TOR_H / 2, -WAND / 2, { uv: 2.5 });
  kiste(rbox(L + (ABSTAND - TOR_B), WAND_H - TOR_H, WAND, 0.02), putzMat, 0, TOR_H + (WAND_H - TOR_H) / 2, -WAND / 2, { uv: 2.5 });
  kiste(rbox(L + 0.7, WAND_H, WAND), putzMat, 0, WAND_H / 2, -TIEFE + WAND / 2, { uv: 2.5 });
  kiste(rbox(WAND, WAND_H, TIEFE), putzMat, -L / 2 - 0.35 + WAND / 2, WAND_H / 2, -TIEFE / 2, { uv: 2.5 });
  kiste(rbox(WAND, WAND_H, TIEFE), putzMat, L / 2 + 0.35 - WAND / 2, WAND_H / 2, -TIEFE / 2, { uv: 2.5 });
  kiste(rbox(L + 1.0, 0.16, TIEFE + 0.3, 0.01), putzMat, 0, WAND_H + 0.08, -TIEFE / 2 + 0.12, { uv: 2.5 });
  kiste(rbox(L + 1.1, 0.26, 0.05, 0.01), attika, 0, WAND_H + 0.1, 0.3);
  kiste(rbox(L + 1.1, 0.04, 0.32, 0.01), attika, 0, WAND_H + 0.21, 0.15);

  for (let i = 0; i < ANZAHL; i++) {
    const g = new THREE.BoxGeometry(ABSTAND - 0.25, WAND_H - 0.01, TIEFE - 2 * WAND);
    g.translate(xVon(i), WAND_H / 2, -TIEFE / 2); weltUV(g, 3);
    const m = new THREE.Mesh(g, [sichtMat, sichtMat, sichtMat, bodenMat, sichtMat, sichtMat]);
    m.receiveShadow = true; scene.add(m);
  }

  /* ---------- Schwingtore aus Trapezblech ---------- */
  const torTextur = (farbe) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 896;
    const g = c.getContext('2d');
    const kachel = 1024 / 1.2;
    for (let x = 0; x < 1024; x += kachel) g.drawImage(blechGrau, x, 0, kachel, 896);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#' + new THREE.Color(farbe).getHexString(); g.fillRect(0, 0, 1024, 896);
    g.drawImage(schmutz, 0, 0, 1024, 896);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return t;
  };
  blechN.repeat.set(1.2, 0.9); blechR.repeat.set(1.2, 0.9);
  const farben = [0xa9b0b3, 0x46685a, 0x8a4334, 0x7a867f, 0x3d5c7d, 0xc4b99c, 0x45494d];
  const tore = [];
  farben.forEach((farbe, i) => {
    const mat = new THREE.MeshStandardMaterial({ map: torTextur(farbe), normalMap: blechN, roughnessMap: blechR, metalness: 0.5, side: THREE.DoubleSide });
    const tor = new THREE.Group();
    const blatt = new THREE.Mesh(new THREE.PlaneGeometry(TOR_B - 0.04, TOR_H - 0.03), mat);
    blatt.castShadow = true; blatt.receiveShadow = true;
    const griff = new THREE.Mesh(rbox(0.16, 0.035, 0.035, 0.012), verzinkt); griff.position.set(0, -0.35, 0.03);
    const schloss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 20), verzinkt);
    schloss.rotation.x = Math.PI / 2; schloss.position.set(0, -0.28, 0.02);
    tor.add(blatt, griff, schloss);
    tor.position.set(xVon(i), TOR_H / 2, -0.12);
    scene.add(tor); tore.push(tor);

    kiste(rbox(0.07, TOR_H, 0.09, 0.01), verzinkt, xVon(i) - TOR_B / 2 - 0.035, TOR_H / 2, -0.05);
    kiste(rbox(0.07, TOR_H, 0.09, 0.01), verzinkt, xVon(i) + TOR_B / 2 + 0.035, TOR_H / 2, -0.05);
    kiste(rbox(TOR_B + 0.14, 0.07, 0.09, 0.01), verzinkt, xVon(i), TOR_H + 0.035, -0.05);

    const c = document.createElement('canvas'); c.width = 160; c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = '#ECEBE6'; g.fillRect(0, 0, 160, 120);
    g.strokeStyle = '#1F3F7A'; g.lineWidth = 8; g.strokeRect(8, 8, 144, 104);
    g.fillStyle = '#1D1F22'; g.font = '800 76px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 80, 66);
    const schildTex = new THREE.CanvasTexture(c); schildTex.colorSpace = THREE.SRGBColorSpace;
    const schild = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.195), new THREE.MeshStandardMaterial({ map: schildTex, roughness: 0.35 }));
    schild.position.set(xVon(i) + 0.95, 2.38, 0.006); scene.add(schild);

    kiste(rbox(0.34, 0.1, 0.16, 0.02), attika, xVon(i) - 0.25, 2.42, 0.08, { schatten: false });
    const glas = new THREE.Mesh(rbox(0.3, 0.02, 0.12, 0.008), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xFFE6C8, emissiveIntensity: 9 }));
    glas.position.set(xVon(i) - 0.25, 2.365, 0.09); scene.add(glas);
    if (stark || (i >= 1 && i <= 4)) {
      const s = new THREE.SpotLight(0xFFE0BC, 22, 11, 1.05, 0.85, 2);
      s.position.set(xVon(i) - 0.25, 2.33, 0.2); s.target.position.set(xVon(i) - 0.25, 0, 1.9);
      scene.add(s, s.target);
    }
  });

  /* Werkbank in Garage 4 (Holzplatte, Stahlbeine) */
  { const o = xVon(3), hz = -TIEFE + WAND;
    kiste(rbox(1.5, 0.05, 0.62, 0.008), holz, o + 0.55, 0.9, hz + 0.45, { uv: 1.2 });
    [[-0.68, -0.25], [0.68, -0.25], [-0.68, 0.25], [0.68, 0.25]].forEach(([dx, dz]) => kiste(rbox(0.045, 0.88, 0.045, 0.005), verzinkt, o + 0.55 + dx, 0.44, hz + 0.45 + dz));
    kiste(rbox(1.4, 0.02, 0.5, 0.004), verzinkt, o + 0.55, 0.22, hz + 0.45);
    const rohr = new THREE.MeshStandardMaterial({ color: 0x8C8F90, roughness: 0.55 });
    kiste(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 16), rohr, o - 0.6, 2.25, hz + 0.05);
  }

  /* ---------- Licht ---------- */
  const mond = new THREE.DirectionalLight(0x9FB6DA, 0.55);
  mond.position.set(-16, 22, 20);
  mond.castShadow = true;
  mond.shadow.mapSize.set(stark ? 2048 : 1024, stark ? 2048 : 1024);
  Object.assign(mond.shadow.camera, { left: -16, right: 16, top: 10, bottom: -12, near: 1, far: 70 });
  mond.shadow.bias = -0.0003; mond.shadow.normalBias = 0.02; mond.shadow.radius = 3;
  scene.add(mond);

  const laterne = new THREE.SpotLight(0xFFCB8E, 160, 30, 0.75, 0.6, 2);
  laterne.position.set(-L / 2 - 2.6, 5.6, 6.5); laterne.target.position.set(-L / 2 + 2, 0, 1.5);
  laterne.castShadow = stark; laterne.shadow.mapSize.set(1024, 1024); laterne.shadow.bias = -0.0005;
  scene.add(laterne, laterne.target);
  kiste(new THREE.CylinderGeometry(0.06, 0.08, 5.8, 16), attika, -L / 2 - 2.9, 2.9, 6.5);
  kiste(rbox(0.75, 0.1, 0.26, 0.03), attika, -L / 2 - 2.6, 5.75, 6.5, { schatten: false });
  const lglas = new THREE.Mesh(rbox(0.6, 0.02, 0.18, 0.008), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xFFBE77, emissiveIntensity: 14 }));
  lglas.position.set(-L / 2 - 2.6, 5.69, 6.5); scene.add(lglas);

  const STUFEN = [1, 2, 3, 4];
  const innenLicht = STUFEN.map((i) => {
    const l = new THREE.RectAreaLight(0xF4F2EC, 0, 1.25, 0.12);
    l.position.set(xVon(i), WAND_H - 0.12, -3.0); l.lookAt(xVon(i), 0, -3.0); scene.add(l);
    const fuell = new THREE.PointLight(0xF2EEE6, 0, 7, 2);
    fuell.position.set(xVon(i), 1.4, -1.2); scene.add(fuell);
    return { l, fuell, leuchte: [] };
  });

  /* ---------- Modelle von Poly Haven (laden nach dem ersten Bild) ---------- */
  const gltf = new GLTFLoader();
  const modell = (name) => gltf.loadAsync(`${PH}${name}/${name}.gltf`).then((g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g.scene;
  });
  const aufBoden = (obj, x, z, { hoehe, ry = 0, y = 0 } = {}) => {
    obj.rotation.y = ry;
    if (hoehe) { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); obj.scale.multiplyScalar(hoehe / (b.max.y - b.min.y)); }
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    obj.position.x += x - (b.min.x + b.max.x) / 2;
    obj.position.z += z - (b.min.z + b.max.z) / 2;
    obj.position.y += y - b.min.y;
    scene.add(obj); return obj;
  };
  const modelleLaden = async () => {
    const [auto, regal, karton, reifen, kasten, werkzeug, roehren] = await Promise.all(
      ['covered_car', 'steel_frame_shelves_01', 'cardboard_box_01', 'old_tyre', 'power_box_01', 'metal_toolbox', 'mounted_fluorescent_lights'].map(modell));

    aufBoden(auto, xVon(1), -TIEFE / 2 + 0.2, { ry: Math.PI });
    { /* weicher Kontaktschatten unter dem Auto */
      const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
      g.filter = 'blur(18px)'; g.fillStyle = '#fff'; g.fillRect(38, 44, 52, 168);
      const t = new THREE.CanvasTexture(c);
      const schatten = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.9), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, opacity: 0.55, depthWrite: false }));
      schatten.rotation.x = -Math.PI / 2; schatten.position.set(xVon(1), 0.014, -TIEFE / 2 + 0.2); scene.add(schatten);
    }

    const r = aufBoden(regal, xVon(2), -TIEFE + WAND + 0.32, { hoehe: 2.0 });
    r.updateMatrixWorld(true);
    const rb = new THREE.Box3().setFromObject(r);
    if (rb.max.x - rb.min.x > 2.5) { const f = 2.5 / (rb.max.x - rb.min.x); r.scale.x *= f; r.scale.z *= f; aufBoden(r, xVon(2), -TIEFE + WAND + 0.32); }
    const kartons = [[2, -0.8, -TIEFE + 1.2, 0.1, 0], [2, 0.75, -TIEFE + 1.25, -0.2, 0], [2, 0.2, -TIEFE + 1.3, 0.35, 0.34], [4, -0.75, -TIEFE + 0.9, 0.05, 0], [4, -0.2, -TIEFE + 1.0, -0.3, 0], [4, -0.5, -TIEFE + 0.95, 0.6, 0.34], [4, 0.1, -TIEFE + 1.9, 0.4, 0]];
    kartons.forEach(([g, dx, z, ry, y]) => aufBoden(karton.clone(), xVon(g) + dx, z, { ry, y }));
    [[-0.35, 0.62, 0.08], [0.32, 0.62, -0.12], [0.05, 1.09, 0.2]].forEach(([dx, y, ry]) => aufBoden(karton.clone(), xVon(2) + dx, -TIEFE + WAND + 0.32, { ry, y }));

    for (let k = 0; k < 4; k++) {
      const t = reifen.clone(); t.rotation.x = Math.PI / 2;
      const huelle = new THREE.Group(); huelle.add(t);
      aufBoden(huelle, xVon(4) + 0.8, -TIEFE + 0.9, { y: k * 0.165, ry: k * 0.7 });
    }

    const pb = aufBoden(kasten, xVon(3) - 0.35, -TIEFE + WAND + 0.06, { hoehe: 0.62, y: 1.3 });
    pb.updateMatrixWorld(true);
    const pbb = new THREE.Box3().setFromObject(pb);
    pb.position.z += (-TIEFE + WAND + 0.005) - pbb.min.z;
    aufBoden(werkzeug, xVon(3) + 0.8, -TIEFE + WAND + 0.42, { y: 0.925, ry: 0.15, hoehe: 0.18 });

    let einzel = null;
    roehren.traverse((o) => { if (!einzel && /_a$/.test(o.name)) einzel = o; });
    einzel = einzel || roehren.children[0];
    innenLicht.forEach((li, s) => {
      const l = einzel.clone(true);
      l.position.set(0, 0, 0); l.rotation.set(0, 0, 0);
      l.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (o.material.emissiveMap || /glass/i.test(o.material.name)) li.leuchte.push(o.material); o.castShadow = false; } });
      const huelle = new THREE.Group(); huelle.add(l);
      aufBoden(huelle, xVon(STUFEN[s]), -3.0, { y: WAND_H - 0.07 });
    });
    window.__garagenModelle = true;
  };

  /* ---------- Nachbearbeitung ---------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  if (stark) {
    const gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.blendIntensity = 1;
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(gtao);
  }
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.55, 0.9));
  composer.addPass(new OutputPass());
  const korn = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uZeit: { value: 0 }, uKorn: { value: 0.045 }, uVignette: { value: 0.28 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uZeit, uKorn, uVignette; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uZeit) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float v = smoothstep(0.95, 0.25, length(vUv - 0.5)); c.rgb *= mix(1.0 - uVignette, 1.0, v);
        c.rgb += (h(vUv * 1000.0) - 0.5) * uKorn; gl_FragColor = c; }`
  });
  composer.addPass(korn);

  /* ---------- Kamerafahrt ---------- */
  const V = THREE.Vector3;
  let hoch = false, breit = true;
  const punkte = () => {
    const k = [hoch ? { pos: new V(-6.2, 2.7, 13), ziel: new V(-2.2, 1.0, 0) } : { pos: new V(-11.2, 3.2, 14), ziel: new V(-0.6, 1.0, 0) }];
    STUFEN.forEach((i) => { const x = xVon(i); k.push(hoch ? { pos: new V(x - 0.9, 1.6, 7.2), ziel: new V(x + 0.1, 1.05, -2.4) } : { pos: new V(x - 1.5, 1.55, 5.4), ziel: new V(x + 0.15, 1.0, -2.6) }); });
    return k;
  };
  let K = punkte();
  let breite = 0, hoehe = 0;
  const groesse = () => {
    const w = buehne.clientWidth, h = buehne.clientHeight;
    if (w === breite && h === hoehe) return;
    breite = w; hoehe = h;
    hoch = w / h < 0.9; breit = w >= 900;
    camera.fov = hoch ? 56 : 36; camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    K = punkte();
  };
  groesse();
  addEventListener('resize', groesse);

  const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const weich = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const stufe = (a, b, x) => { const t = klemme((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  const kamPos = new V(), kamZiel = new V(), sollPos = new V(), sollZiel = new V();
  const offen = [0, 0, 0, 0];
  let ersterBild = true, sichtbar = true, zuletzt = performance.now(), alterClip = '';
  const einflug = performance.now();
  const marken = [document.querySelector('.hero'), ...document.querySelectorAll('.schritt')];
  new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }).observe(wrap);

  /* Schwingtor: Oberkante läuft in der Führung nach hinten, Unterkante schwenkt nach außen und oben */
  const torStellen = (tor, o) => {
    const th = o * Math.PI / 2 * 0.97, H = TOR_H - 0.03, Y0 = 0.015;
    const topY = Y0 + H, topZ = -0.12 - 0.7 * H * Math.sin(th);
    const botY = topY - H * Math.cos(th), botZ = topZ + H * Math.sin(th);
    tor.position.set(tor.position.x, (topY + botY) / 2, (topZ + botZ) / 2);
    tor.rotation.x = -th;
  };

  const bildchen = (jetzt) => {
    requestAnimationFrame(bildchen);
    if (!sichtbar && !ersterBild) return;
    groesse();
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000); zuletzt = jetzt;

    const anker = breit ? 0 : hoehe * 0.44;
    const tops = marken.map((m, k) => m.getBoundingClientRect().top - (k ? anker : 0));
    let p = 0;
    for (let k = tops.length - 1; k >= 0; k--) {
      if (tops[k] > 0) continue;
      p = k === tops.length - 1 ? k : k + klemme(-tops[k] / (tops[k + 1] - tops[k]));
      break;
    }
    if (ruhig) p = Math.round(p);

    const seg = Math.min(STUFEN.length - 1, Math.floor(p));
    const t = weich(klemme((p - seg - 0.1) / 0.8));
    sollPos.lerpVectors(K[seg].pos, K[seg + 1].pos, t);
    sollZiel.lerpVectors(K[seg].ziel, K[seg + 1].ziel, t);
    const ein = ruhig ? 1 : 1 - Math.pow(1 - klemme((jetzt - einflug) / 1800), 4);
    sollPos.z += (1 - ein) * 4; sollPos.y += (1 - ein) * 1.0; sollPos.x -= (1 - ein) * 1.5;

    const k = ruhig || ersterBild ? 1 : 1 - Math.exp(-dt * 6);
    kamPos.lerp(sollPos, k); kamZiel.lerp(sollZiel, k);
    if (ersterBild) { kamPos.copy(sollPos); kamZiel.copy(sollZiel); }
    camera.position.copy(kamPos); camera.lookAt(kamZiel);

    STUFEN.forEach((i, s) => {
      const soll = 1 - stufe(0.2, 0.72, Math.abs(p - (s + 1)));
      offen[s] += (soll - offen[s]) * (ruhig ? 1 : 1 - Math.exp(-dt * 4));
      const o = offen[s];
      torStellen(tore[i], o);
      const licht = stufe(0.15, 0.5, o);
      innenLicht[s].l.intensity = licht * 40;
      innenLicht[s].fuell.intensity = licht * 2.2;
      innenLicht[s].leuchte.forEach((m) => { m.emissive.set(0xFFF2DE); m.emissiveIntensity = licht * 5; });
    });

    const e = weich(klemme(p / 0.55));
    let ox = 0, oy, clip;
    if (breit) { ox = (-0.16 * (1 - e) - 0.21 * e) * breite; oy = -0.3 * hoehe * (1 - e); clip = `inset(0 0 0 ${(42 * e).toFixed(2)}%)`; }
    else { oy = (-0.24 * (1 - e) + 0.28 * e) * hoehe; clip = `inset(0 0 ${(56 * e).toFixed(2)}% 0)`; }
    camera.setViewOffset(breite, hoehe, ox, oy, breite, hoehe);
    const oben = !breit && p > 0.6 && wrap.getBoundingClientRect().bottom > hoehe;
    if (oben !== buehne.classList.contains('oben')) buehne.classList.toggle('oben', oben);
    if (clip !== alterClip) { bild.style.clipPath = clip; alterClip = clip; }

    korn.uniforms.uZeit.value = ruhig ? 0 : (jetzt % 10000) / 1000;
    composer.render(dt);
    if (ersterBild) {
      ersterBild = false; window.__garagen3d = true; html.classList.remove('kein-3d');
      modelleLaden().catch((e) => console.warn('Modelle', e));
    }
  };
  requestAnimationFrame(bildchen);
}
