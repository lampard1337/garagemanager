"""Mischt Musik und Soundeffekte (Pixabay-Dateien aus assets/soundfx) zur Tonspur eines Clips.

Aufruf: python mix.py ereignisse.json ausgabe.wav
ereignisse.json: {"dauer": 26.0, "schnitt": null|"15", "ereignisse": [{"typ": "pling", "t": 7.65}, ...]}
Die Zeit t ist der Moment im Bild; jeder Effekt wird mit seinem lautesten Punkt (bzw. Ansatz) dorthin gelegt.
Braucht numpy und ffmpeg.
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
ORDNER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'soundfx')

MUSIK = 'alex-morgan-funky-corporate-startup-promo-556670.mp3'
TAKT = 60 / 105 * 4  # 105 BPM, gemessen

# typ: (Datei, Versatz in s = Stelle im Sample, die auf den Bildmoment fällt, Pegel in dB)
EFFEKTE = {
    'tuer_zu':  ('dragon-studio-door-close-effect-382710.mp3', .18, 0),
    'tuer_auf': ('dragon-studio-opening-door-sfx-454240.mp3', .05, -12),
    'whoosh':   ('dragon-studio-simple-whoosh-382724.mp3', .16, -7),
    'swoosh':   ('universfield-swoosh-06-351021.mp3', .38, -3),
    'erfolg':   ('freesound_gamestudio-purchase-success-384963.mp3', .05, -3),
    'pling':    ('universfield-new-notification-051-494246.mp3', .15, -1),
    'klick':    ('universfield-computer-mouse-click-352734.mp3', .16, 11),
    'logo':     ('universfield-clean-logo-reveal-139678.mp3', 1.2, 7),
    'wort':     ('dragon-studio-simple-whoosh-382724.mp3', .16, -17),  # leiser Wisch beim Wortwechsel
}
EFFEKTE_GESAMT = -3  # alle Effekte gemeinsam lauter/leiser (dB)
TIPPEN = 'u_a4gfvwagf1-iphone-keyboard-typing-sound-effect-336778.mp3'
# gut klingende Einzelanschläge aus der Tipp-Aufnahme (Ansatzzeiten, gemessen)
ANSCHLAEGE = [9.28, 9.49, 9.79, 10.05, 10.19, 13.67, 13.95, 14.09, 14.34, 14.51, 14.65, 6.36, 6.63, 6.98]


def lade(datei):
    """Datei per ffmpeg als 48-kHz-Stereo laden."""
    roh = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ORDNER, datei),
                          '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(roh, np.int16).reshape(-1, 2).astype(np.float64) / 32768


def db(x):
    return 10 ** (x / 20)


def fade(n, aus=False):
    k = np.linspace(0, 1, n) ** 2 if not aus else np.linspace(1, 0, n) ** 2
    return k[:, None]


def springe(m, bei, nach):
    """Musik bis 'bei' spielen, dann ab 'nach' weiter (vor- oder zurückspringen), mit 40 ms Überblendung."""
    xf = int(.04 * SR)
    a = m[:int(bei * SR) + xf].copy()
    b = m[int(nach * SR):].copy()
    a[-xf:] *= fade(xf, aus=True)
    b[:xf] *= fade(xf)
    spur = np.zeros((len(a) + len(b) - xf, 2))
    spur[:len(a)] += a
    spur[len(a) - xf:] += b
    return spur


def musikspur(dauer, schnitt, einschub=0):
    m = lade(MUSIK)
    n = int(dauer * SR)
    if schnitt == '15':
        # 6 Takte herausschneiden, damit das natürliche Ende der Musik am Clipende liegt
        spur = springe(m, 8.15, 8.15 + 6 * TAKT)
    elif einschub:
        # Takte ab 8,15 s wiederholen (dort wiederholt sich der Groove am saubersten), Video ist entsprechend länger
        spur = springe(m, 8.15 + einschub * TAKT, 8.15)
    else:
        spur = m
    out = np.zeros((n, 2))
    k = min(n, len(spur))
    out[:k] = spur[:k]
    # sanft ausblenden, falls die Musik am Clipende noch läuft
    ende = int(.8 * SR)
    out[-ende:] *= fade(ende, aus=True)
    out[:int(.01 * SR)] *= fade(int(.01 * SR))
    return out


def setze(spur, x, start):
    a = int(round(start * SR))
    if a < 0:
        x, a = x[-a:], 0
    if a >= len(spur):
        return
    x = x[:len(spur) - a]
    spur[a:a + len(x)] += x


def effektspur(dauer, ereignisse):
    n = int(dauer * SR)
    spur = np.zeros((n, 2))
    cache = {}
    tipp = None
    k_tipp = 0
    for ev in ereignisse:
        typ, t = ev['typ'], ev['t']
        if typ == 'tap':
            if tipp is None:
                tipp = lade(TIPPEN)
            s = ANSCHLAEGE[k_tipp % len(ANSCHLAEGE)]
            k_tipp += 1
            x = tipp[int((s - .01) * SR):int((s + .11) * SR)].copy()
            x = x / (np.abs(x).max() + 1e-9) * db(-4)
            x[-int(.02 * SR):] *= fade(int(.02 * SR), aus=True)
            setze(spur, x, t - .01)
            continue
        if typ not in EFFEKTE:
            continue
        datei, versatz, pegel = EFFEKTE[typ]
        if datei not in cache:
            cache[datei] = lade(datei)
        setze(spur, cache[datei] * db(pegel), t - versatz)
    return spur


def ducking(musik, fx):
    """Musik kurz absenken, solange ein Effekt klingt (max. -5 dB)."""
    e = np.abs(fx).max(axis=1)
    blk = int(.01 * SR)
    n = len(e) // blk
    h = e[:n * blk].reshape(n, blk).max(axis=1)
    g = np.ones(n)
    tiefe = 1 - db(-5)
    dt = blk / SR
    vorher = 1.0
    for i in range(n):  # schnell runter (20 ms), langsam zurück (300 ms)
        ziel = 1 - tiefe * min(1, h[i] / .15)
        zeitk = .02 if ziel < vorher else .3
        vorher = vorher + (ziel - vorher) * min(1, dt / zeitk)
        g[i] = vorher
    g = np.repeat(g, blk)
    g = np.r_[g, np.full(len(musik) - len(g), g[-1] if len(g) else 1)]
    return musik * g[:, None]


def main(ein, aus):
    d = json.load(open(ein, encoding='utf-8'))
    dauer = d['dauer']
    musik = musikspur(dauer, d.get('schnitt'), d.get('einschub', 0)) * db(-6)
    fx = effektspur(dauer, d['ereignisse'])
    fx = fx * db(EFFEKTE_GESAMT)
    mix = ducking(musik, fx) + fx
    roh = aus.replace('.wav', '.roh.wav')
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(roh, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # auf Social-Media-Lautheit bringen: -14 LUFS, Spitzen max. -1,5 dBTP (zwei Durchgänge)
    mess = subprocess.run(['ffmpeg', '-hide_banner', '-i', roh, '-af',
                           'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                          capture_output=True, text=True).stderr
    j = json.loads(mess[mess.rindex('{'):mess.rindex('}') + 1])
    af = ('loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:'
          f"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}"
          + ',alimiter=limit=0.79:attack=2:release=60:level=disabled')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', roh, '-af', af, '-ar', str(SR), aus], check=True)
    os.remove(roh)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
