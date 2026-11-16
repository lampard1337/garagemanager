// Rendert werbevideo.html Bild für Bild zu MP4.
// node render.js                 -> alle Formate
// node render.js 9x16 16x9       -> nur diese
// node render.js --stills 1,4,8  -> nur Standbilder (PNG) zum Prüfen
// node render.js --schnitt 15    -> 15-Sekunden-Kurzfassung
// node render.js --variante echt -> Fassung mit nachgebauter echter App (werbevideo-echt.html)
// node render.js --nur-ton       -> nur die Tonspur der vorhandenen MP4s ersetzen (Bild bleibt)
// node render.js --stumm         -> stille Tonspur statt Musik und Effekte
// Ton: mix.py mischt Musik und Effekte aus assets/soundfx an die Zeitpunkte aus window.SFX (Python mit numpy).
const puppeteer = require('puppeteer-core');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);

const args = process.argv.slice(2);
const si = args.indexOf('--stills');
const stills = si >= 0 ? args[si + 1].split(',').map(Number) : null;
const ci = args.indexOf('--schnitt');
const schnitt = ci >= 0 ? args[ci + 1] : null;
const vi = args.indexOf('--variante');
const variante = vi >= 0 ? args[vi + 1] : null; // z. B. echt -> werbevideo-echt.html
const DATEI = variante ? `werbevideo-${variante}.html` : 'werbevideo.html';
const PRAEFIX = 'garagenmanager-' + (variante ? variante + '-' : '');
const wertIdx = [si, ci, vi].filter(x => x >= 0).map(x => x + 1);
const formate = args.filter((a, i) => !a.startsWith('--') && !wertIdx.includes(i));
const LISTE = formate.length ? formate : ['9x16', '4x5', '1x1', '16x9'];
const nurTon = args.includes('--nur-ton');
const stumm = args.includes('--stumm'); // ohne Musik und Effekte
const OUT = path.join(__dirname, 'out');
const TON = path.join(OUT, 'ton');
fs.mkdirSync(TON, { recursive: true });

// Tonspur mit Soundeffekten als WAV erzeugen
async function tonErzeugen(page, dauer, name) {
  const ereignisse = await page.evaluate(() => window.SFX || []);
  const einschub = await page.evaluate(() => window.MUSIK_TAKTE || 0); // Takte Musik, die eingeschoben werden
  const json = path.join(TON, name + '.json');
  const wav = path.join(TON, name + '.wav');
  fs.writeFileSync(json, JSON.stringify({ dauer, schnitt, einschub, ereignisse }));
  if (stumm) {
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(dauer), wav]);
    return wav;
  }
  const r = spawnSync('python', [path.join(__dirname, 'mix.py'), json, wav], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('mix.py fehlgeschlagen');
  return wav;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  for (const f of LISTE) {
    const page = await browser.newPage();
    const [w, h] = f === '16x9' ? [1920, 1080] : f === '4x5' ? [1080, 1350] : f === '1x1' ? [1080, 1080] : [1080, 1920];
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const url = 'file:///' + path.join(__dirname, DATEI).replace(/\\/g, '/') + `?format=${f}&render=1` + (schnitt ? `&schnitt=${schnitt}` : "");
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => window.bereit);
    const font = await page.evaluate(() => document.fonts.check('700 40px Geist'));
    if (!font) console.warn('WARNUNG: Geist nicht geladen');

    if (stills) {
      for (const t of stills) {
        await page.evaluate(t => window.render(t), t);
        await page.screenshot({ path: path.join(OUT, `still-${variante ? variante + "-" : ""}${f}-${String(t).replace('.', '_')}.png`) });
      }
      console.log(`${f}: ${stills.length} Standbilder`);
      await page.close();
      continue;
    }

    const dauer = await page.evaluate(() => window.DAUER);
    const n = Math.round(dauer * FPS);
    const name = `${PRAEFIX}${schnitt ? schnitt + "s-" : ""}${f}`;
    const ziel = path.join(OUT, name + '.mp4');
    const wav = await tonErzeugen(page, dauer, name);

    if (nurTon) {
      // vorhandenes Video behalten, nur die Tonspur ersetzen
      const tmp = ziel.replace(/\.mp4$/, '.tmp.mp4');
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ziel, '-i', wav,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('ffmpeg fehlgeschlagen: ' + ziel);
      fs.renameSync(tmp, ziel);
      console.log(`${f}: Ton eingesetzt -> ${ziel}`);
      await page.close();
      continue;
    }

    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-i', wav,
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-r', String(FPS), '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k', ziel], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) process.stdout.write(`${f}: ${i}/${n}\n`);
    }
    // Titelbild (Endkarte)
    if (!schnitt) {
      await page.evaluate(() => window.render(window.DAUER - 1));
      await page.screenshot({ path: path.join(OUT, `titelbild-${variante ? variante + "-" : ""}${f}.png`) });
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(`${f}: fertig in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${ziel}`);
    await page.close();
  }
  await browser.close();
})();
