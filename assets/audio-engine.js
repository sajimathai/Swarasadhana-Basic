// (loaded as a classic script -> window.SwsAudio)
(function(){
"use strict";
// ============================================================================
//  Carnatic Practice — Audio Engine + Music Theory  (plain ES module)
//  All real Web Audio: metronome, tanpura (Karplus–Strong), mridangam,
//  song player with independent pitch/tempo, mic recording, pitch detection,
//  and rendering analysis (pitch / rhythm / raga).
// ============================================================================

// ---------------------------------------------------------------------------
//  SWARA THEORY  — 12 swarasthanas mapped to semitone positions 0..11
// ---------------------------------------------------------------------------
// Malayalam basic swaras: സ രി ഗ മ പ ധ നി
const SWARAS = [
  { pos: 0,  base: "സ",  sub: "",  latin: "S",  full: "ഷഡ്ജം" },
  { pos: 1,  base: "രി", sub: "₁", latin: "R₁", full: "ശുദ്ധ ഋഷഭം" },
  { pos: 2,  base: "രി", sub: "₂", latin: "R₂", full: "ചതുശ്രുതി ഋഷഭം" },
  { pos: 3,  base: "ഗ",  sub: "₂", latin: "G₂", full: "സാധാരണ ഗാന്ധാരം" },
  { pos: 4,  base: "ഗ",  sub: "₃", latin: "G₃", full: "അന്തര ഗാന്ധാരം" },
  { pos: 5,  base: "മ",  sub: "₁", latin: "M₁", full: "ശുദ്ധ മധ്യമം" },
  { pos: 6,  base: "മ",  sub: "₂", latin: "M₂", full: "പ്രതി മധ്യമം" },
  { pos: 7,  base: "പ",  sub: "",  latin: "P",  full: "പഞ്ചമം" },
  { pos: 8,  base: "ധ",  sub: "₁", latin: "D₁", full: "ശുദ്ധ ധൈവതം" },
  { pos: 9,  base: "ധ",  sub: "₂", latin: "D₂", full: "ചതുശ്രുതി ധൈവതം" },
  { pos: 10, base: "നി", sub: "₂", latin: "N₂", full: "കൈശികി നിഷാദം" },
  { pos: 11, base: "നി", sub: "₃", latin: "N₃", full: "കാകലി നിഷാദം" },
];

function swaraLabel(pos) {
  const s = SWARAS[((pos % 12) + 12) % 12];
  return s.base + s.sub;
}

// Convert a frequency + tonic into { pos, octave, cents }
function freqToSwara(freq, tonicHz) {
  if (!freq || freq <= 0) return null;
  const semis = 12 * Math.log2(freq / tonicHz);
  const nearest = Math.round(semis);
  const cents = (semis - nearest) * 100;
  const pos = ((nearest % 12) + 12) % 12;
  const octave = Math.floor(nearest / 12); // 0 = madhya, +1 tara, -1 mandra
  return { pos, octave, cents, semis };
}

// ---------------------------------------------------------------------------
//  RAGA DATABASE  (positions = semitone offsets from Sa)
// ---------------------------------------------------------------------------
const RAGAS = [
  { id: "mayamalavagowla", name: "മായാമാളവഗൗള", latin: "Mayamalavagowla",
    aro: [0,1,4,5,7,8,11,12], ava: [12,11,8,7,5,4,1,0],
    note: "അടിസ്ഥാന അഭ്യാസ രാഗം. സരളിവരിശകൾ ഇതിലാണ് തുടങ്ങുന്നത്.", mela: 15 },
  { id: "sankarabharanam", name: "ധീരശങ്കരാഭരണം", latin: "Sankarabharanam",
    aro: [0,2,4,5,7,9,11,12], ava: [12,11,9,7,5,4,2,0],
    note: "പാശ്ചാത്യ മേജർ സ്കെയിലിന് സമാനം. ശാന്തവും ഗംഭീരവും.", mela: 29 },
  { id: "kalyani", name: "മേചകല്യാണി", latin: "Kalyani",
    aro: [0,2,4,6,7,9,11,12], ava: [12,11,9,7,6,4,2,0],
    note: "പ്രതിമധ്യമം ഉള്ള രാഗം. ഉത്സവ ഭാവം.", mela: 65 },
  { id: "kharaharapriya", name: "ഖരഹരപ്രിയ", latin: "Kharaharapriya",
    aro: [0,2,3,5,7,9,10,12], ava: [12,10,9,7,5,3,2,0],
    note: "കരുണരസ പ്രധാന രാഗം.", mela: 22 },
  { id: "todi", name: "ഹനുമതോടി", latin: "Todi",
    aro: [0,1,3,5,7,8,10,12], ava: [12,10,8,7,5,3,1,0],
    note: "ഗഹനവും ഭക്തിനിർഭരവുമായ രാഗം.", mela: 8 },
  { id: "mohanam", name: "മോഹനം", latin: "Mohanam",
    aro: [0,2,4,7,9,12], ava: [12,9,7,4,2,0],
    note: "ഔഡവ (5 സ്വര) രാഗം. മ, നി ഇല്ല. പ്രസന്നഭാവം.", mela: null },
  { id: "hindolam", name: "ഹിന്ദോളം", latin: "Hindolam",
    aro: [0,3,5,8,10,12], ava: [12,10,8,5,3,0],
    note: "ഔഡവ രാഗം. രി, പ ഇല്ല.", mela: null },
  { id: "hamsadhwani", name: "ഹംസധ്വനി", latin: "Hamsadhwani",
    aro: [0,2,4,7,11,12], ava: [12,11,7,4,2,0],
    note: "മംഗളകരമായ രാഗം. വിഘ്നേശ്വര സ്തുതികൾക്ക് പ്രിയം.", mela: null },
  { id: "abhogi", name: "ആഭോഗി", latin: "Abhogi",
    aro: [0,2,3,5,9,12], ava: [12,9,5,3,2,0],
    note: "നി ഇല്ലാത്ത മധുര രാഗം.", mela: null },
  { id: "bhairavi", name: "ഭൈരവി", latin: "Bhairavi",
    aro: [0,2,3,5,7,9,10,12], ava: [12,10,8,7,5,3,2,0],
    note: "ഭാവസാന്ദ്രമായ രാഗം (ആരോഹണത്തിൽ ധ₂, അവരോഹണത്തിൽ ധ₁).", mela: null },
];

function ragaPositionSet(raga) {
  const s = new Set();
  raga.aro.concat(raga.ava).forEach(p => s.add(((p % 12) + 12) % 12));
  return s;
}

// Identify best-matching raga from a histogram of swara positions
function identifyRaga(posCounts) {
  const used = new Set();
  let total = 0;
  posCounts.forEach((c, p) => { if (c > 0) { used.add(p); total += c; } });
  if (total === 0) return null;
  // weighted: prominent positions matter more
  let best = null, bestScore = -1;
  for (const raga of RAGAS) {
    const set = ragaPositionSet(raga);
    let inside = 0, outside = 0;
    posCounts.forEach((c, p) => {
      if (c <= 0) return;
      if (set.has(p)) inside += c; else outside += c;
    });
    // coverage of raga's notes that the singer actually used
    let covered = 0;
    set.forEach(p => { if (posCounts[p] > 0) covered++; });
    const coverage = covered / set.size;
    const purity = inside / (inside + outside);
    const score = purity * 0.7 + coverage * 0.3;
    if (score > bestScore) { bestScore = score; best = raga; }
  }
  return { raga: best, confidence: Math.round(bestScore * 100) };
}

// ---------------------------------------------------------------------------
//  PITCH DETECTION  (autocorrelation, Chris Wilson style)
// ---------------------------------------------------------------------------
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) { const v = buf[i]; rms += v * v; }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.006) return { freq: -1, rms }; // low gate so soft humming / vowels still register

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }
  const b = buf.slice(r1, r2);
  SIZE = b.length;
  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++) c[i] += b[j] * b[j + i];

  let d = 0; while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
  let T0 = maxpos;
  if (T0 <= 0) return { freq: -1, rms };
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);
  return { freq: sampleRate / T0, rms };
}

// ---------------------------------------------------------------------------
//  JUNGLE  — independent pitch shifter (Chris Rogers). Wrapped + guarded.
// ---------------------------------------------------------------------------
const J_delay = 0.100, J_fade = 0.050, J_buffer = 0.100;
function createFadeBuffer(ctx, activeTime, fadeTime) {
  const len1 = activeTime * ctx.sampleRate;
  const len2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = Math.floor(len1 + len2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  const fadeLength = fadeTime * ctx.sampleRate;
  const fadeIndex1 = fadeLength, fadeIndex2 = len1 - fadeLength;
  for (let i = 0; i < len1; i++) {
    let v;
    if (i < fadeIndex1) v = Math.sqrt(i / fadeLength);
    else if (i >= fadeIndex2) v = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
    else v = 1;
    p[i] = v;
  }
  for (let i = len1; i < length; i++) p[i] = 0;
  return buffer;
}
function createDelayTimeBuffer(ctx, activeTime, fadeTime, shiftUp) {
  const len1 = activeTime * ctx.sampleRate;
  const len2 = (activeTime - 2 * fadeTime) * ctx.sampleRate;
  const length = Math.floor(len1 + len2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < len1; i++) {
    if (shiftUp) p[i] = (len1 - i) / length;
    else p[i] = i / len1;
  }
  for (let i = len1; i < length; i++) p[i] = 0;
  return buffer;
}
function Jungle(ctx) {
  this.context = ctx;
  this.input = ctx.createGain();
  this.output = ctx.createGain();
  const mod1 = ctx.createBufferSource(), mod2 = ctx.createBufferSource();
  const mod3 = ctx.createBufferSource(), mod4 = ctx.createBufferSource();
  const down = createDelayTimeBuffer(ctx, J_buffer, J_fade, false);
  const up = createDelayTimeBuffer(ctx, J_buffer, J_fade, true);
  mod1.buffer = down; mod2.buffer = down; mod3.buffer = up; mod4.buffer = up;
  [mod1, mod2, mod3, mod4].forEach(m => m.loop = true);
  const mod1Gain = ctx.createGain(), mod2Gain = ctx.createGain();
  const mod3Gain = ctx.createGain(), mod4Gain = ctx.createGain();
  mod3Gain.gain.value = 0; mod4Gain.gain.value = 0;
  mod1.connect(mod1Gain); mod2.connect(mod2Gain);
  mod3.connect(mod3Gain); mod4.connect(mod4Gain);
  const modGain1 = ctx.createGain(), modGain2 = ctx.createGain();
  const delay1 = ctx.createDelay(), delay2 = ctx.createDelay();
  mod1Gain.connect(modGain1); mod3Gain.connect(modGain1);
  mod2Gain.connect(modGain2); mod4Gain.connect(modGain2);
  modGain1.connect(delay1.delayTime);
  modGain2.connect(delay2.delayTime);
  const fade1 = ctx.createBufferSource(), fade2 = ctx.createBufferSource();
  const fadeBuffer = createFadeBuffer(ctx, J_buffer, J_fade);
  fade1.buffer = fadeBuffer; fade2.buffer = fadeBuffer;
  fade1.loop = true; fade2.loop = true;
  const mix1 = ctx.createGain(), mix2 = ctx.createGain();
  mix1.gain.value = 0; mix2.gain.value = 0;
  fade1.connect(mix1.gain); fade2.connect(mix2.gain);
  this.input.connect(delay1); this.input.connect(delay2);
  delay1.connect(mix1); delay2.connect(mix2);
  mix1.connect(this.output); mix2.connect(this.output);
  const t = ctx.currentTime + 0.050;
  const t2 = t + J_buffer - J_fade;
  mod1.start(t); mod2.start(t2); mod3.start(t); mod4.start(t2);
  fade1.start(t); fade2.start(t2);
  this._mod1Gain = mod1Gain; this._mod2Gain = mod2Gain;
  this._mod3Gain = mod3Gain; this._mod4Gain = mod4Gain;
  this._modGain1 = modGain1; this._modGain2 = modGain2;
  this.setPitchOffset(0);
}
Jungle.prototype.setDelay = function (d) {
  this._modGain1.gain.setTargetAtTime(0.5 * d, this.context.currentTime, 0.01);
  this._modGain2.gain.setTargetAtTime(0.5 * d, this.context.currentTime, 0.01);
};
Jungle.prototype.setPitchOffset = function (mult) {
  if (mult > 0) {
    this._mod1Gain.gain.value = 0; this._mod2Gain.gain.value = 0;
    this._mod3Gain.gain.value = 1; this._mod4Gain.gain.value = 1;
  } else {
    this._mod1Gain.gain.value = 1; this._mod2Gain.gain.value = 1;
    this._mod3Gain.gain.value = 0; this._mod4Gain.gain.value = 0;
  }
  this.setDelay(J_delay * Math.abs(mult));
};

// ===========================================================================
//  AUDIO ENGINE
// ===========================================================================
class AudioEngine {
  constructor() {
    this.ac = null;
    this.master = null;
    this.tonicHz = 146.83; // D3 default Sa
    // metronome
    this.met = { running: false, bpm: 70, beats: 8, timer: null, next: 0, beat: 0, gain: 0.9 };
    // tanpura
    this.tan = { running: false, timer: null, next: 0, step: 0, gain: 0.2, bus: null, together: false, gap: 1.3 };
    // mridangam
    this.mri = { running: false, timer: null, next: 0, idx: 0, bpm: 70, thala: "adi", gain: 0.9, inst: "mridangam", andSound: false };
    // song
    this.song = { buffer: null, source: null, jungle: null, gain: null, playing: false,
                  startedAt: 0, offset: 0, tempo: 1, pitch: 0, dur: 0 };
    // recording
    this.rec = { stream: null, analyser: null, recorder: null, chunks: [],
                 raf: null, track: [], t0: 0, blobUrl: null };
    // exercise vocal player
    this.ex = { running: false, bus: null, curVB: null, raf: null, times: [], _lastIdx: -2 };
    this._exDest = null;
    this._unlocked = false;
    // iOS / mobile Safari: Web Audio is silenced until it is unlocked inside a
    // real user gesture, and a standalone (home-screen) PWA often resumes with
    // the context suspended. Install global one-touch unlock + resume handlers.
    this.installUnlockHandlers();
  }

  ensure() {
    if (!this.ac) {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.gain.value = this._masterVol != null ? this._masterVol : 1;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === "suspended") this.ac.resume();
    return this.ac;
  }

  // ---- iOS audio unlock ------------------------------------------------
  // Builds a short silent WAV once; a looping <audio> element playing it holds
  // the iOS media audio session open, which lets Web Audio play through the
  // speaker even when the ring/silent switch is on.
  _silentClipUrl() {
    if (this._silentUrl) return this._silentUrl;
    const sr = 8000, n = 1600; // ~0.2s of mono silence
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); ws(8, "WAVE");
    ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, "data"); v.setUint32(40, n * 2, true); // samples already zero = silence
    this._silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    return this._silentUrl;
  }

  // Call inside a user gesture: create + resume the context, kick a silent
  // Web Audio buffer, and start the looping silent <audio> session opener.
  unlock() {
    try {
      this.ensure();
      if (this.ac && this.ac.state === "suspended") this.ac.resume();
      // a 1-frame silent buffer is the classic Web Audio unlock
      const b = this.ac.createBuffer(1, 1, 22050);
      const s = this.ac.createBufferSource();
      s.buffer = b; s.connect(this.ac.destination);
      s.start(0);
    } catch (e) {}
    // silent-switch bypass via a looping muted-free <audio> element
    try {
      if (!this._silentAudio && typeof Audio !== "undefined") {
        const a = new Audio(this._silentClipUrl());
        a.loop = true; a.preload = "auto"; a.volume = 1;
        a.setAttribute("playsinline", ""); a.setAttribute("webkit-playsinline", "");
        this._silentAudio = a;
      }
      if (this._silentAudio && this._silentAudio.paused) {
        const p = this._silentAudio.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {}
    this._unlocked = true;
  }

  installUnlockHandlers() {
    if (this._unlockInstalled || typeof document === "undefined") return;
    this._unlockInstalled = true;
    const handler = () => { this.unlock(); };
    const evs = ["touchstart", "touchend", "pointerdown", "mousedown", "click", "keydown"];
    evs.forEach(ev => document.addEventListener(ev, handler, { capture: true, passive: true }));
    // A standalone PWA frequently returns from background with the context
    // suspended — resume it (and re-arm the silent session) on refocus.
    const resume = () => {
      if (this.ac && this.ac.state === "suspended") { try { this.ac.resume(); } catch (e) {} }
      if (this._silentAudio && this._silentAudio.paused) { try { this._silentAudio.play().catch(() => {}); } catch (e) {} }
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { resume(); this._refreshWakeLock(); }
    });
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
  }

  // ---- Screen Wake Lock ------------------------------------------------
  // setTimeout/setInterval (which drive the metronome, tanpura and mridangam
  // schedulers) are frozen once the phone screen sleeps, so no new beats get
  // queued and they fall silent — while the tanpura's long overlapping notes
  // keep ringing, making it *seem* like only it survives. Holding a screen
  // wake lock while anything is playing keeps the page alive so every
  // scheduler keeps filling the audio timeline.
  _anyPlaying() {
    return !!(this.met.running || this.tan.running || this.mri.running ||
              this.ex.running || (this.song && this.song.playing));
  }
  async _acquireWakeLock() {
    if (typeof navigator === "undefined" || !navigator.wakeLock) return;
    if (this._wakeLock || document.hidden) return;
    try {
      this._wakeLock = await navigator.wakeLock.request("screen");
      this._wakeLock.addEventListener("release", () => { this._wakeLock = null; });
    } catch (e) { this._wakeLock = null; }
  }
  _releaseWakeLock() {
    if (this._wakeLock) { try { this._wakeLock.release(); } catch (e) {} this._wakeLock = null; }
  }
  // Re-acquire when returning to the foreground (the OS auto-releases the lock
  // when the page is hidden), or drop it once nothing is playing.
  _refreshWakeLock() {
    if (this._anyPlaying()) this._acquireWakeLock();
    else this._releaseWakeLock();
  }

  setTonic(hz) { this.tonicHz = hz; }
  setMasterVolume(v) { this._masterVol = v; if (this.master) this.master.gain.value = v; }

  // ---- generic scheduler tick helper ----
  _now() { return this.ac.currentTime; }

  // =========================================================================
  //  METRONOME
  // =========================================================================
  startMetronome() {
    this.ensure();
    const m = this.met;
    if (m.running) return;
    m.running = true; m.beat = 0; m.next = this._now() + 0.06;
    this._acquireWakeLock();
    const lookahead = 0.1;
    const tick = () => {
      if (!m.running) return;
      const spb = 60 / m.bpm;
      while (m.next < this._now() + lookahead) {
        const accent = m.beat % m.beats === 0;
        this._click(m.next, accent, m.gain);
        // fire a UI beat callback at the precise sounding time
        if (typeof m.onBeat === "function") {
          const beat = m.beat, total = m.beats;
          const delay = Math.max(0, (m.next - this._now()) * 1000);
          setTimeout(() => { if (m.running) m.onBeat(beat, accent, total); }, delay);
        }
        m.beat = (m.beat + 1) % m.beats;
        m.next += spb;
      }
      m.timer = setTimeout(tick, 25);
    };
    tick();
  }
  stopMetronome() { this.met.running = false; clearTimeout(this.met.timer); this._refreshWakeLock(); }
  _click(time, accent, gain, dest) {
    const ac = this.ac;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime((accent ? 1 : 0.6) * gain, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0008, time + 0.05);
    osc.connect(g).connect(dest || this.master);
    osc.start(time); osc.stop(time + 0.06);
  }
  // bell-style click for the exercise metronome — short, clean "ting"
  _bellClick(time, accent, gain, dest) {
    const ac = this.ac;
    const d = dest || this.master;
    const fund = accent ? 1568 : 1047; // higher ting on the sam/accent
    const partials = [
      { r: 1.00, g: 1.00, decay: 0.7 },
      { r: 2.76, g: 0.40, decay: 0.45 },
      { r: 5.40, g: 0.15, decay: 0.22 },
    ];
    for (const p of partials) {
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(fund * p.r, time);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain * (accent ? 1 : 0.7) * p.g, time + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, time + p.decay);
      o.connect(g).connect(d);
      o.start(time); o.stop(time + p.decay + 0.05);
    }
  }

  // =========================================================================
  //  TANPURA  (Karplus–Strong plucked strings, Sa–Pa tuning)
  // =========================================================================
  _pluck(time, freq, dur, gain, soft) {
    // Tanpura string with jvari (buzzing shimmer). Built from detuned sawtooth
    // harmonics through a resonant filter sweep + a buzz peak, with a soft
    // pluck attack and long sustain — the characteristic kacheri drone, rather
    // than a dry plucked-string tone. `soft` = gentle swell with no percussive
    // attack/transient (used for the continuous chord so it doesn't hammer).
    const ac = this.ac;
    const dest = this.tan.bus || this.master;
    // --- body: three slightly detuned sawtooths → natural beating/shimmer ---
    const detunes = [-5, 0, 6];
    const oscs = detunes.map(d => {
      const o = ac.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = d;
      return o;
    });
    const body = ac.createGain(); body.gain.value = 0.22;
    oscs.forEach(o => o.connect(body));
    // warm sub sine at the fundamental for grounding
    const sub = ac.createOscillator(); sub.type = "sine"; sub.frequency.value = freq;
    const subG = ac.createGain(); subG.gain.value = 0.32;
    sub.connect(subG);
    // --- jvari: resonant low-pass that blooms open after the pluck then
    //     slowly closes — this is what makes the overtones "buzz" and shimmer.
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = soft ? 4 : 7;
    const open = Math.min(5600, freq * 11);
    lp.frequency.setValueAtTime(Math.max(300, freq * 2), time);
    lp.frequency.linearRampToValueAtTime(open, time + (soft ? 0.6 : 0.22));
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 4), time + dur);
    // cotton-thread buzz emphasis around 2.6 kHz
    const buzz = ac.createBiquadFilter();
    buzz.type = "peaking"; buzz.frequency.value = 2600; buzz.Q.value = 0.9; buzz.gain.value = 9;
    // --- amplitude envelope: soft pluck, long sustain, slow decay ---
    const g = ac.createGain();
    g.gain.setValueAtTime(0, time);
    // soft mode = slow swell (no percussive onset → no hammering when re-struck)
    g.gain.linearRampToValueAtTime(gain * 0.95, time + (soft ? 0.45 : 0.035));
    g.gain.setTargetAtTime(0.0001, time + dur * 0.55, dur * 0.42);
    body.connect(lp);
    subG.connect(g); // sub bypasses the bright filter for clean low end
    lp.connect(buzz).connect(g).connect(dest);
    oscs.forEach(o => { o.start(time); o.stop(time + dur + 0.05); });
    sub.start(time); sub.stop(time + dur + 0.05);
    if (soft) return; // no attack transient for the continuous chord
    // --- pluck transient: short soft noise "tha" so the strike is felt ---
    const nf = Math.floor(ac.sampleRate * 0.05);
    const nb = ac.createBuffer(1, nf, ac.sampleRate); const nd = nb.getChannelData(0);
    for (let i = 0; i < nf; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nf, 2.5);
    const ns = ac.createBufferSource(); ns.buffer = nb;
    const nbp = ac.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = freq * 4; nbp.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.setValueAtTime(gain * 0.25, time); ng.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    ns.connect(nbp).connect(ng).connect(dest);
    ns.start(time); ns.stop(time + 0.07);
  }
  startTanpura() {
    this.ensure();
    const t = this.tan;
    if (!t.bus) { t.bus = this.ac.createGain(); t.bus.connect(this.master); }
    // un-mute the tanpura bus (clean fade-in). Capped below unity so the
    // overlapping drone keeps headroom and stays governed by master volume
    // instead of dominating / clipping the output.
    const now = this.ac.currentTime;
    // Headroom for the tanpura bus. The drone is continuous and polyphonic, so
    // its perceived loudness is far higher than its peak gain suggests — kept
    // well below the percussion buses (which hit master directly) so the
    // metronome / thala vadya read clearly above the drone.
    const TAN_HEADROOM = 0.3;
    t.bus.gain.cancelScheduledValues(now);
    t.bus.gain.setValueAtTime(t.bus.gain.value, now);
    t.bus.gain.linearRampToValueAtTime(TAN_HEADROOM, now + 0.06);
    if (t.running) return;
    t.running = true; t.step = 0; t.next = this._now() + 0.08;
    this._acquireWakeLock();
    const tick = () => {
      if (!t.running) return;
      const strum = t.gap || 1.3; // seconds between swara strikes (user-set)
      while (t.next < this._now() + 0.3) {
        const f = this.tonicHz;
        // Tanpura strings: Sa – Pa – upper Sa
        const strings = [f, f * 1.5, f * 2];
        const n = strings.length;
        if (t.together) {
          // Collective drone: strike each string in rotation (never all at
          // once) with a long overlapping sustain, so they continuously ring
          // together as one drone without any hammering chord-strike.
          const freq = strings[t.step % n];
          const dur = strum * 4.6;
          this._pluck(t.next, freq, dur, t.gain * 0.92, true);
          t.step++;
          t.next += strum; // continuous, no gap
        } else {
          // Sequence: Sa · Pa · upper Sa, then a one-swara gap before repeating.
          const idx = t.step % (n + 1);
          if (idx < n) {
            const freq = strings[idx];
            const dur = strum * 3.2; // each string rings into the next
            this._pluck(t.next, freq, dur, t.gain);
          }
          // idx === n → silent gap between repetitions
          t.step++;
          t.next += strum;
        }
      }
      t.timer = setTimeout(tick, 60);
    };
    tick();
  }
  stopTanpura() {
    this.tan.running = false;
    clearTimeout(this.tan.timer);
    this._refreshWakeLock();
    // hard-mute the bus so any in-flight plucks are silenced immediately
    if (this.tan.bus && this.ac) {
      const now = this.ac.currentTime;
      this.tan.bus.gain.cancelScheduledValues(now);
      this.tan.bus.gain.setValueAtTime(this.tan.bus.gain.value, now);
      this.tan.bus.gain.linearRampToValueAtTime(0, now + 0.08);
    }
  }
  setTanpuraVolume(v) { this.tan.gain = v; }

  // =========================================================================
  //  MRIDANGAM THALA
  // =========================================================================
  // patterns: array per subdivision (8th notes). type: B=bass(thom), T=tap,
  // K=high(ki/ta), null=rest. "|" markers conceptually = anga boundaries.
  static THALAS = {
    adi:        { name: "ആദി താളം", beats: 8, count: "8 (4+2+2)",
                  pat: ["B","K","T","K","B","K","T","K","B","K","T","T","B","K","T","K"] },
    rupaka:     { name: "രൂപക താളം", beats: 6, count: "6 (2+4)",
                  pat: ["B","K","T","K","B","K","T","K","T","T","B","K"] },
    misrachapu: { name: "മിശ്ര ചാപു", beats: 7, count: "7 (3+2+2)",
                  pat: ["B","K","T","B","K","T","T","B","K","T","T","K","T","K"] },
    khandachapu:{ name: "ഖണ്ഡ ചാപു", beats: 5, count: "5 (2+1+2)",
                  pat: ["B","K","T","K","B","T","K","T","T","K"] },
    tisra:      { name: "തിശ്ര ഏകം", beats: 3, count: "3",
                  pat: ["B","K","T","T","K","T"] },
    eka:        { name: "ചതുശ്ര ഏകം", beats: 4, count: "4",
                  pat: ["B","K","T","K","B","K","T","K"] },
    jhampa:     { name: "മിശ്ര ഝമ്പ", beats: 10, count: "10 (7+1+2)",
                  pat: ["B","K","T","K","B","K","T","K","B","K","T","K","T","T","B","K","T","K","T","K"] },
    triputa:    { name: "തിശ്ര ത്രിപുട", beats: 7, count: "7 (3+2+2)",
                  pat: ["B","K","T","T","K","T","B","K","T","T","B","K","T","K"] },
    matya:      { name: "ചതുശ്ര മഠ്യ", beats: 10, count: "10 (4+2+4)",
                  pat: ["B","K","T","K","B","K","T","K","B","T","T","K","B","K","T","K","B","K","T","K"] },
    ata:        { name: "ഖണ്ഡ അട", beats: 14, count: "14 (5+5+2+2)",
                  pat: ["B","K","T","K","B","K","T","K","B","T","B","K","T","K","B","K","T","K","B","T","T","K","B","K","T","T","B","K"] },
    dhruva:     { name: "ചതുശ്ര ധ്രുവ", beats: 14, count: "14 (4+2+4+4)",
                  pat: ["B","K","T","K","B","K","T","K","B","T","T","K","B","K","T","K","B","K","T","K","B","K","T","K","B","K","T","K"] },
  };
  _bass(time, gain) {
    // mridangam thom — left head with sustained low pitch + body harmonic + attack slap
    const ac = this.ac;
    const dest = this.master;
    const f0 = Math.max(70, this.tonicHz * 0.5); // around Sa one octave down
    // 1) attack slap (short noise burst, low-mid filtered)
    if (!this._noiseBuf) {
      const n = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = n;
    }
    const slap = ac.createBufferSource(); slap.buffer = this._noiseBuf;
    const slapBP = ac.createBiquadFilter(); slapBP.type = "bandpass"; slapBP.frequency.value = 220; slapBP.Q.value = 0.8;
    const slapG = ac.createGain();
    slapG.gain.setValueAtTime(gain * 0.55, time);
    slapG.gain.exponentialRampToValueAtTime(0.0008, time + 0.05);
    slap.connect(slapBP).connect(slapG).connect(dest);
    slap.start(time); slap.stop(time + 0.06);
    // 2) pitched body — tuned drum mode (fundamental) + 2nd mode (~1.6x)
    const o1 = ac.createOscillator(); o1.type = "sine";
    o1.frequency.setValueAtTime(f0 * 1.6, time);
    o1.frequency.exponentialRampToValueAtTime(f0, time + 0.09);
    const g1 = ac.createGain();
    g1.gain.setValueAtTime(0, time);
    g1.gain.linearRampToValueAtTime(gain, time + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0008, time + 0.45);
    o1.connect(g1).connect(dest); o1.start(time); o1.stop(time + 0.5);
    // upper mode for that characteristic resonant ring
    const o2 = ac.createOscillator(); o2.type = "sine";
    o2.frequency.setValueAtTime(f0 * 2.5, time);
    o2.frequency.exponentialRampToValueAtTime(f0 * 1.55, time + 0.12);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0, time);
    g2.gain.linearRampToValueAtTime(gain * 0.35, time + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0008, time + 0.32);
    o2.connect(g2).connect(dest); o2.start(time); o2.stop(time + 0.35);
  }
  _tap(time, gain, high) {
    // mridangam right side — tha (open ringing, tuned to Sa) or ki (closed snap)
    const ac = this.ac;
    const dest = this.master;
    const sa = this.tonicHz;
    // noise transient — short, filtered
    const frames = Math.floor(ac.sampleRate * (high ? 0.06 : 0.10));
    const nb = ac.createBuffer(1, frames, ac.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.4);
    const src = ac.createBufferSource(); src.buffer = nb;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = high ? 4200 : 2000; bp.Q.value = high ? 1.4 : 0.9;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0, time);
    ng.gain.linearRampToValueAtTime(gain * (high ? 0.55 : 0.7), time + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0008, time + (high ? 0.05 : 0.10));
    src.connect(bp).connect(ng).connect(dest);
    src.start(time); src.stop(time + 0.12);
    if (high) {
      // ki: brief metallic ping, no long ring
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = sa * 4;
      const og = ac.createGain();
      og.gain.setValueAtTime(gain * 0.25, time);
      og.gain.exponentialRampToValueAtTime(0.0008, time + 0.06);
      o.connect(og).connect(dest); o.start(time); o.stop(time + 0.08);
      return;
    }
    // tha: ringing tone tuned to Sa with body harmonic — multiple modes for natural decay
    const modes = [
      { f: sa,        amp: 1.00, dec: 0.55 },
      { f: sa * 2,    amp: 0.55, dec: 0.40 },
      { f: sa * 2.96, amp: 0.28, dec: 0.30 },
      { f: sa * 4.05, amp: 0.14, dec: 0.20 },
    ];
    modes.forEach(({ f, amp, dec }) => {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ac.createGain();
      og.gain.setValueAtTime(0, time);
      og.gain.linearRampToValueAtTime(gain * 0.55 * amp, time + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0006, time + dec);
      o.connect(og).connect(dest); o.start(time); o.stop(time + dec + 0.04);
    });
  }
  // percussion dispatcher: slot B(bass) / T(mid) / K(high) per instrument
  _perc(time, slot, gain, inst) {
    if (!inst || inst === "mridangam") {
      if (slot === "B") this._bass(time, gain); else this._tap(time, gain, slot === "K");
      return;
    }
    if (inst === "tabla") return this._tabla(time, slot, gain);
    if (inst === "drum") return this._drum(time, slot, gain);
    if (inst === "chenda") return this._chenda(time, slot, gain);
  }
  _tabla(time, slot, gain) {
    // baya (bass dha/ge) — slappy noise + deep pitch-bend tone
    // dayan (na/tin/te) — tuned ringing with strong fundamental + odd partials
    const ac = this.ac;
    const dest = this.master;
    if (!this._noiseBuf) {
      const n = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      this._noiseBuf = n;
    }
    if (slot === "B") {
      // attack slap
      const slap = ac.createBufferSource(); slap.buffer = this._noiseBuf;
      const sbp = ac.createBiquadFilter(); sbp.type = "bandpass"; sbp.frequency.value = 300; sbp.Q.value = 0.7;
      const sg = ac.createGain();
      sg.gain.setValueAtTime(gain * 0.5, time);
      sg.gain.exponentialRampToValueAtTime(0.0008, time + 0.04);
      slap.connect(sbp).connect(sg).connect(dest); slap.start(time); slap.stop(time + 0.05);
      // gliding low tone
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(220, time); o.frequency.exponentialRampToValueAtTime(70, time + 0.20);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, time + 0.42);
      o.connect(g).connect(dest); o.start(time); o.stop(time + 0.45);
      // body 2nd harmonic
      const o2 = ac.createOscillator(); o2.type = "sine";
      o2.frequency.setValueAtTime(360, time); o2.frequency.exponentialRampToValueAtTime(115, time + 0.18);
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(gain * 0.3, time);
      g2.gain.exponentialRampToValueAtTime(0.0008, time + 0.25);
      o2.connect(g2).connect(dest); o2.start(time); o2.stop(time + 0.28);
      return;
    }
    // na / tin: tonal with characteristic tabla "twang"
    const f = slot === "K" ? 720 : 480;
    // attack click
    const click = ac.createBufferSource(); click.buffer = this._noiseBuf;
    const chp = ac.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 3000;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(gain * 0.35, time);
    cg.gain.exponentialRampToValueAtTime(0.0008, time + 0.02);
    click.connect(chp).connect(cg).connect(dest); click.start(time); click.stop(time + 0.03);
    // ringing tone with inharmonic partials
    const modes = [
      { f: f,         amp: 1.00, dec: 0.20 },
      { f: f * 1.59,  amp: 0.42, dec: 0.14 },
      { f: f * 2.14,  amp: 0.25, dec: 0.10 },
      { f: f * 2.92,  amp: 0.14, dec: 0.07 },
    ];
    modes.forEach(({ f: ff, amp, dec }) => {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = ff;
      const og = ac.createGain();
      og.gain.setValueAtTime(0, time);
      og.gain.linearRampToValueAtTime(gain * 0.7 * amp, time + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0006, time + dec);
      o.connect(og).connect(dest); o.start(time); o.stop(time + dec + 0.04);
    });
  }
  _drum(time, slot, gain) {
    // generic drum kit: kick / snare / hi-hat — closer to real drum samples
    const ac = this.ac;
    const dest = this.master;
    if (!this._noiseBuf) {
      const n = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      this._noiseBuf = n;
    }
    if (slot === "B") {
      // kick: click + body + sub
      const click = ac.createBufferSource(); click.buffer = this._noiseBuf;
      const chp = ac.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 2500;
      const cg = ac.createGain(); cg.gain.setValueAtTime(gain * 0.35, time); cg.gain.exponentialRampToValueAtTime(0.0008, time + 0.012);
      click.connect(chp).connect(cg).connect(dest); click.start(time); click.stop(time + 0.02);
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(140, time); o.frequency.exponentialRampToValueAtTime(45, time + 0.11);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(gain, time + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, time + 0.30);
      o.connect(g).connect(dest); o.start(time); o.stop(time + 0.32);
      return;
    }
    const high = slot === "K";
    if (high) {
      // hi-hat closed: tight metallic noise
      const src = ac.createBufferSource(); src.buffer = this._noiseBuf;
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
      const pk = ac.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 9000; pk.Q.value = 4; pk.gain.value = 6;
      const g = ac.createGain();
      g.gain.setValueAtTime(gain * 0.55, time);
      g.gain.exponentialRampToValueAtTime(0.0008, time + 0.045);
      src.connect(hp).connect(pk).connect(g).connect(dest);
      src.start(time); src.stop(time + 0.06);
      return;
    }
    // snare: short tone (180 Hz) + noise rattle (snares)
    const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 185;
    const og = ac.createGain();
    og.gain.setValueAtTime(gain * 0.5, time);
    og.gain.exponentialRampToValueAtTime(0.0008, time + 0.06);
    o.connect(og).connect(dest); o.start(time); o.stop(time + 0.08);
    const src = ac.createBufferSource(); src.buffer = this._noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4200; bp.Q.value = 0.7;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(gain * 0.7, time);
    ng.gain.exponentialRampToValueAtTime(0.0008, time + 0.16);
    src.connect(bp).connect(ng).connect(dest);
    src.start(time); src.stop(time + 0.18);
  }
  _chenda(time, slot, gain) {
    // Small bell — bright, clean "ting" (glockenspiel/hand-bell): a few
    // inharmonic partials, soft strike tick, short clear decay.
    const ac = this.ac;
    const fund = slot === "B" ? 784 : (slot === "K" ? 1318 : 1047); // low / high / mid bell
    // A bright bell has a strong fundamental plus a couple of inharmonic
    // overtones that fade quickly.
    const partials = [
      { r: 1.00, g: 1.00, d: 1.1 }, // strike tone
      { r: 2.76, g: 0.45, d: 0.7 }, // inharmonic overtone
      { r: 5.40, g: 0.18, d: 0.35 }, // shimmer
    ];
    for (const p of partials) {
      const o = ac.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(fund * p.r, time);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain * 0.5 * p.g, time + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, time + p.d);
      o.connect(g).connect(this.master);
      o.start(time); o.stop(time + p.d + 0.05);
    }
    // soft strike tick at the attack
    const frames = Math.floor(ac.sampleRate * 0.02);
    const nb = ac.createBuffer(1, frames, ac.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
    const src = ac.createBufferSource(); src.buffer = nb;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fund * 3; bp.Q.value = 1.5;
    const ng = ac.createGain(); ng.gain.setValueAtTime(gain * 0.3, time); ng.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    src.connect(bp).connect(ng).connect(this.master);
    src.start(time); src.stop(time + 0.03);
  }
  _cymbal(time, gain) {
    const ac = this.ac;
    const dest = this.master;
    // jhanj/jalra — short, bright cymbal hit. Hard onset (no fade-in) so the
    // strike lands exactly with the downbeat (sam), then a 0.7s shimmer tail.
    if (!this._noiseBuf) {
      const n = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = n;
    }
    const src = ac.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    // metallic colouring
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 4500;
    const pk1 = ac.createBiquadFilter(); pk1.type = "peaking"; pk1.frequency.value = 6500; pk1.Q.value = 6; pk1.gain.value = 9;
    const pk2 = ac.createBiquadFilter(); pk2.type = "peaking"; pk2.frequency.value = 9200; pk2.Q.value = 7; pk2.gain.value = 7;
    const env = ac.createGain();
    // hard attack — full level at the exact instant
    env.gain.setValueAtTime(gain * 1.2, time);
    env.gain.exponentialRampToValueAtTime(gain * 0.32, time + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0008, time + 0.70);
    src.connect(hp).connect(pk1).connect(pk2).connect(env).connect(dest);
    src.start(time); src.stop(time + 0.78);
    // bright initial "ts" tick so the strike point is perceptually obvious
    const tick = ac.createBufferSource(); tick.buffer = this._noiseBuf;
    const thp = ac.createBiquadFilter(); thp.type = "highpass"; thp.frequency.value = 7000;
    const tg = ac.createGain();
    tg.gain.setValueAtTime(gain * 0.9, time);
    tg.gain.exponentialRampToValueAtTime(0.0008, time + 0.025);
    tick.connect(thp).connect(tg).connect(dest);
    tick.start(time); tick.stop(time + 0.04);
  }
  startMridangam() {
    this.ensure();
    const m = this.mri;
    if (m.running) return;
    m.running = true; m.idx = 0; m.next = this._now() + 0.08;
    this._acquireWakeLock();
    const tick = () => {
      if (!m.running) return;
      const th = AudioEngine.THALAS[m.thala];
      const pat = th.pat;
      const subPerBeat = pat.length / th.beats; // = 2
      const subDur = (60 / m.bpm) / subPerBeat;
      while (m.next < this._now() + 0.25) {
        const slot = pat[m.idx % pat.length];
        const accent = m.idx % pat.length === 0;
        // each beat = 2 subdivisions: the beat ("on") and the off-beat ("and").
        // odd positions are the "and"; only sound them when andSound is enabled.
        const isAnd = (m.idx % pat.length) % subPerBeat !== 0;
        if (isAnd && !m.andSound) { m.idx++; m.next += subDur; continue; }
        // ring the cymbal at the head of every cycle
        if (accent) this._cymbal(m.next, m.gain * 0.85);
        if (slot === "B") this._perc(m.next, "B", m.gain * (accent ? 1 : 0.85), m.inst);
        else if (slot === "T") this._perc(m.next, "T", m.gain * 0.8, m.inst);
        else if (slot === "K") this._perc(m.next, "K", m.gain * 0.7, m.inst);
        m.idx++;
        m.next += subDur;
      }
      m.timer = setTimeout(tick, 25);
    };
    tick();
  }
  stopMridangam() { this.mri.running = false; clearTimeout(this.mri.timer); this._refreshWakeLock(); }

  // =========================================================================
  //  EXERCISE VOCAL PLAYER  (akaaram "aa" formant voice + scheduler)
  // =========================================================================
  _voice(time, freq, dur, gain, gender) {
    const ac = this.ac;
    const total = Math.max(0.16, dur);
    const dest = this._exDest || this.master;
    // Men sing ~an octave below women; vocal tract (formants) shifts only ~15%,
    // so timbre stays voice-like rather than just "lower".
    const male = gender === "male";
    const f0 = male ? freq * 0.5 : freq;

    // ---- Rosenberg-style glottal pulse: harmonics 1..N with -6 dB/oct tilt
    // gives a much warmer, more vocal source than a raw sawtooth.
    if (!this._glottalWave) {
      const N = 32;
      const re = new Float32Array(N + 1);
      const im = new Float32Array(N + 1);
      for (let k = 1; k <= N; k++) {
        // amplitude falls as 1/k (≈-6 dB/oct, like real glottal flow derivative)
        // with a small bump at H2 for chest body
        const bump = k === 2 ? 1.15 : 1.0;
        im[k] = (1 / k) * bump;
      }
      this._glottalWave = ac.createPeriodicWave(re, im, { disableNormalization: false });
    }

    // ---- three slightly detuned voiced oscillators = natural chorus thickness
    const detunes = [-6, 0, 7]; // cents
    const oscs = detunes.map(d => {
      const o = ac.createOscillator();
      o.setPeriodicWave(this._glottalWave);
      o.frequency.setValueAtTime(f0 * 0.985, time);
      o.frequency.exponentialRampToValueAtTime(f0, time + 0.09);
      o.detune.value = d;
      return o;
    });
    // chest sub (sine an octave down at low amplitude)
    const sub = ac.createOscillator(); sub.type = "sine";
    sub.frequency.setValueAtTime(f0 * 0.985, time);
    sub.frequency.exponentialRampToValueAtTime(f0, time + 0.09);

    // ---- vibrato (~5 Hz, delayed onset) + slow jitter (organic micro-pitch wobble)
    const vibRate = (male ? 4.6 : 5.4) + (Math.random() * 0.5 - 0.25);
    const lfo = ac.createOscillator(); lfo.type = "sine"; lfo.frequency.value = vibRate;
    const lfoG = ac.createGain();
    const vibOn = time + Math.min(0.18, total * 0.40);
    const vibFull = Math.min(0.55, total * 0.85);
    lfoG.gain.setValueAtTime(0, time);
    lfoG.gain.setValueAtTime(0, vibOn);
    lfoG.gain.linearRampToValueAtTime(f0 * (male ? 0.012 : 0.014), time + vibFull);
    lfo.connect(lfoG);

    // slow jitter: 2.5 Hz random-ish, tiny depth — the "alive" wobble
    const jit = ac.createOscillator(); jit.type = "triangle";
    jit.frequency.value = 2.3 + Math.random() * 0.6;
    const jitG = ac.createGain(); jitG.gain.value = f0 * 0.0028;

    oscs.forEach(o => { lfoG.connect(o.frequency); jitG.connect(o.frequency); });
    lfoG.connect(sub.frequency); jitG.connect(sub.frequency);
    jit.connect(jitG);

    // ---- spectral tilt: gentle LP so highs don't read as buzz
    const tilt = ac.createBiquadFilter(); tilt.type = "lowpass";
    tilt.frequency.value = male ? 3600 : 4400; tilt.Q.value = 0.5;
    const srcBus = ac.createGain(); srcBus.gain.value = 1;
    oscs.forEach((o, i) => {
      const og = ac.createGain(); og.gain.value = i === 1 ? 0.7 : 0.45;
      o.connect(og); og.connect(tilt);
    });
    tilt.connect(srcBus);
    const subG = ac.createGain(); subG.gain.value = male ? 0.32 : 0.22; sub.connect(subG); subG.connect(srcBus);

    // ---- breath: filtered noise; brief 'h' onset + sustained whisper
    if (!this._noiseBuf) {
      const n = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = n;
    }
    const noise = ac.createBufferSource(); noise.buffer = this._noiseBuf; noise.loop = true;
    const noiseBP = ac.createBiquadFilter(); noiseBP.type = "bandpass";
    noiseBP.frequency.value = male ? 1600 : 2200; noiseBP.Q.value = 0.6;
    const noiseG = ac.createGain();
    // little breath puff at the attack, then settle to a whisper
    noiseG.gain.setValueAtTime(0, time);
    noiseG.gain.linearRampToValueAtTime(gain * 0.10, time + 0.025);
    noiseG.gain.exponentialRampToValueAtTime(gain * 0.022, time + 0.20);
    noise.connect(noiseBP); noiseBP.connect(noiseG);

    // ---- output envelope (singer's slight swell after attack)
    const env = ac.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.92, time + 0.045);
    env.gain.linearRampToValueAtTime(gain * 1.0, time + 0.18);
    env.gain.linearRampToValueAtTime(gain * 0.9, time + Math.max(0.35, total * 0.7));
    env.gain.exponentialRampToValueAtTime(0.0006, time + total);
    noiseG.connect(env);

    // ---- chest resonance pole at ~300 Hz for body
    const chest = ac.createBiquadFilter(); chest.type = "peaking";
    chest.frequency.value = male ? 280 : 360; chest.Q.value = 1.4; chest.gain.value = 4;
    srcBus.connect(chest);

    // ---- 'aa' vowel: 5 resonant formants [freq, gain, bandwidth] (Peterson–Barney averages)
    const formants = male
      ? [[730, 1.0, 90], [1090, 0.55, 100], [2440, 0.28, 130], [3500, 0.14, 180], [4500, 0.06, 240]]
      : [[850, 1.0, 95], [1220, 0.58, 105], [2810, 0.30, 140], [3900, 0.16, 200], [4950, 0.07, 260]];
    formants.forEach(([f, g, bw]) => {
      const bp = ac.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = f; bp.Q.value = f / bw;
      const fg = ac.createGain(); fg.gain.value = g;
      chest.connect(bp); bp.connect(fg); fg.connect(env);
    });
    // singer's formant cluster (~3 kHz) for presence — characteristic of trained voice
    const sing = ac.createBiquadFilter(); sing.type = "peaking";
    sing.frequency.value = male ? 2900 : 3100; sing.Q.value = 5; sing.gain.value = male ? 5 : 4;
    chest.connect(sing); sing.connect(env);

    // tiny dry source so it reads present, not muffled
    const dry = ac.createGain(); dry.gain.value = 0.04; srcBus.connect(dry); dry.connect(env);

    env.connect(dest);
    const end = time + total + 0.10;
    oscs.forEach(o => { o.start(time); o.stop(end); });
    sub.start(time); sub.stop(end);
    lfo.start(time); lfo.stop(end);
    jit.start(time); jit.stop(end);
    noise.start(time); noise.stop(end);
  }
  // Instrument dispatcher for exercise playback
  _tone(time, freq, dur, gain, inst) {
    if (inst === "harmonium" || inst === "voice" || inst === "voice_f" || inst === "voice_m") return this._harmonium(time, freq, dur, gain);
    if (inst === "veena") return this._exPluck(time, freq, dur, gain);
    const ac = this.ac;
    const total = Math.max(0.16, dur);
    const dest = this._exDest || this.master;
    let oscType = "sine", filterFreq = 4000, attack = 0.02, vibrato = 0, decay = false, p2g = 0.12, lvl = 1.3;
    if (inst === "violin") { oscType = "sawtooth"; filterFreq = 3000; attack = 0.09; vibrato = 0.006; p2g = 0.1; lvl = 1.0; }
    else if (inst === "piano") { oscType = "triangle"; filterFreq = 4800; attack = 0.004; decay = true; p2g = 0.2; lvl = 1.7; }
    else if (inst === "flute") { oscType = "sine"; filterFreq = 3200; attack = 0.07; vibrato = 0.004; p2g = 0.1; lvl = 1.9; }
    gain = gain * lvl;
    const osc = ac.createOscillator(); osc.type = oscType; osc.frequency.value = freq;
    const osc2 = ac.createOscillator(); osc2.type = oscType; osc2.frequency.value = freq * 2;
    const o2g = ac.createGain(); o2g.gain.value = p2g;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = filterFreq;
    if (vibrato) {
      const lfo = ac.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 5.2;
      const lg = ac.createGain(); lg.gain.value = freq * vibrato;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(time); lfo.stop(time + total + 0.1);
    }
    const g = ac.createGain();
    const decayEnd = Math.min(total * 1.7, total + 0.7);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + attack);
    if (decay) { g.gain.exponentialRampToValueAtTime(0.0008, time + decayEnd); }
    else { g.gain.setValueAtTime(gain, time + total * 0.78); g.gain.exponentialRampToValueAtTime(0.0008, time + total); }
    osc.connect(lp); osc2.connect(o2g).connect(lp); lp.connect(g); g.connect(dest);
    const end = (decay ? time + decayEnd : time + total) + 0.06;
    osc.start(time); osc2.start(time); osc.stop(end); osc2.stop(end);
  }
  // Harmonium (free-reed organ): detuned saw banks + reed body + tremolo
  _harmonium(time, freq, dur, gain) {
    const ac = this.ac;
    const total = Math.max(0.18, dur);
    const dest = this._exDest || this.master;
    const out = ac.createGain();
    // organ-style envelope: quick attack, full sustain, short release
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(gain, time + 0.045);
    out.gain.setValueAtTime(gain, time + total * 0.85);
    out.gain.exponentialRampToValueAtTime(0.0007, time + total + 0.07);
    // tremolo — the gentle shimmer of bellows-driven reeds
    const trem = ac.createOscillator(); trem.type = "sine"; trem.frequency.value = 5.2;
    const tremG = ac.createGain(); tremG.gain.value = gain * 0.08;
    trem.connect(tremG); tremG.connect(out.gain);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.6;
    lp.connect(out).connect(dest);
    // reedy nasal colour
    const pk = ac.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 1200; pk.Q.value = 1.2; pk.gain.value = 6;
    pk.connect(lp);
    const oscs = [];
    // two slightly detuned sawtooth banks → characteristic harmonium beating
    [-6, 6].forEach(det => {
      const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det;
      const g = ac.createGain(); g.gain.value = 0.5;
      o.connect(g).connect(pk);
      oscs.push(o);
    });
    // sine body for warmth
    const sub = ac.createOscillator(); sub.type = "sine"; sub.frequency.value = freq;
    const sg = ac.createGain(); sg.gain.value = 0.32; sub.connect(sg).connect(lp);
    oscs.push(sub);
    const end = time + total + 0.1;
    oscs.forEach(o => { o.start(time); o.stop(end); });
    trem.start(time); trem.stop(end);
  }
  // Plucked string (veena) routed to the exercise bus
  _exPluck(time, freq, dur, gain) {
    const ac = this.ac;
    const len = Math.max(0.35, dur);
    const N = Math.max(2, Math.round(ac.sampleRate / freq));
    const frames = Math.floor(ac.sampleRate * len);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0; const decay = 0.996;
    for (let i = 0; i < frames; i++) {
      const cur = ring[idx], nxt = ring[(idx + 1) % N];
      const y = 0.5 * (cur + nxt) * decay;
      data[i] = cur; ring[idx] = y; idx = (idx + 1) % N;
    }
    const src = ac.createBufferSource(); src.buffer = buffer;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.005);
    g.gain.setTargetAtTime(0.0001, time + len * 0.5, 0.22);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
    src.connect(lp).connect(g).connect(this._exDest || this.master);
    src.start(time); src.stop(time + len);
  }
  playExercise(notes, opts) {
    this.ensure();
    const ac = this.ac;
    const ex = this.ex;
    if (!ex.bus) { ex.bus = ac.createGain(); ex.bus.connect(this.master); }
    this.stopExercise();
    const vb = ac.createGain(); vb.gain.value = 1; vb.connect(ex.bus);
    ex.curVB = vb; this._exDest = vb;
    const npb = opts.npb || 2;
    const bpm = opts.bpm || 70;
    const noteDur = (60 / bpm) / npb;
    // build slots; 'h' = kaarvai (hold previous); 'r' = rest (silence); '|' '||' = thala marks (zero-duration, visual only)
    const slots = notes.map(t => ({
      hold: t === "h", rest: t === "r",
      mark: t === "|" || t === "||" || t === "/",
      off: (t === "h" || t === "r" || t === "|" || t === "||" || t === "/") ? null : t,
    }));
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].hold && !slots[i].rest && !slots[i].mark) {
        let u = 1, j = i + 1;
        while (j < slots.length && (slots[j].hold || slots[j].mark)) { if (slots[j].hold) u++; j++; }
        slots[i].units = u;
      }
    }
    const t0 = ac.currentTime + 0.14;
    ex.times = [];
    ex.marks = [];
    // Build an event list (tone / click) with absolute times instead of
    // scheduling everything up front. A long "Play All" sequence (hundreds of
    // notes) would otherwise create thousands of live AudioNodes at once and
    // the browser drops/distorts the audio. We schedule a short window ahead.
    const events = [];
    let acc = 0;
    let pi = 0;
    for (let i = 0; i < slots.length; i++) {
      const tt = t0 + acc;
      ex.times.push(tt);
      ex.marks.push(slots[i].mark);
      if (!slots[i].mark) {
        if (opts.click && pi % npb === 0) events.push({ at: tt, kind: "click", accent: pi === 0 });
        if (!slots[i].hold && !slots[i].rest)
          events.push({ at: tt, kind: "tone", off: slots[i].off, dur: slots[i].units * noteDur * 0.92 });
        acc += noteDur;
        pi++;
      }
    }
    const endT = t0 + acc;
    ex.running = true; ex._lastIdx = -2;
    this._acquireWakeLock();
    ex.notes = notes; ex.opts = opts; ex.endT = endT;
    ex._evt = events; ex._ei = 0;
    const LOOKAHEAD = 0.4; // seconds of audio scheduled ahead of playback
    const tick = () => {
      if (!ex.running) return;
      const now = ac.currentTime;
      // schedule any events coming due within the look-ahead window
      while (ex._ei < events.length && events[ex._ei].at < now + LOOKAHEAD) {
        const e = events[ex._ei++];
        if (e.kind === "click") this._bellClick(e.at, e.accent, 0.4, vb);
        else this._tone(e.at, this.tonicHz * Math.pow(2, e.off / 12), e.dur, 0.5, opts.instrument);
      }
      let idx = -1;
      for (let i = 0; i < ex.times.length; i++) {
        if (now < ex.times[i]) break;
        if (!ex.marks[i]) idx = i;
      }
      if (idx !== ex._lastIdx) { ex._lastIdx = idx; if (opts.onNote) opts.onNote(idx); }
      if (now >= endT) {
        clearInterval(ex.timer); ex.timer = null;
        if (opts.loop) { this.playExercise(ex.notes, ex.opts); return; }
        ex.running = false; if (opts.onNote) opts.onNote(-1); if (opts.onDone) opts.onDone(); return;
      }
    };
    clearInterval(ex.timer);
    tick(); // prime the first window immediately
    ex.timer = setInterval(tick, 25);
    return { stop: () => this.stopExercise() };
  }
  stopExercise() {
    const ex = this.ex;
    ex.running = false;
    this._refreshWakeLock();
    if (ex.raf) cancelAnimationFrame(ex.raf);
    clearInterval(ex.timer); ex.timer = null;
    if (ex.curVB && this.ac) {
      const now = this.ac.currentTime;
      const vb = ex.curVB;
      vb.gain.cancelScheduledValues(now);
      vb.gain.setValueAtTime(vb.gain.value, now);
      vb.gain.linearRampToValueAtTime(0, now + 0.06);
      setTimeout(() => { try { vb.disconnect(); } catch (e) {} }, 200);
      ex.curVB = null;
    }
  }

  stopAll() { this.stopMetronome(); this.stopTanpura(); this.stopMridangam(); this.stopExercise(); }

  // =========================================================================
  //  SONG PLAYER  — load, play, independent pitch / tempo
  // =========================================================================
  async loadSong(arrayBuffer) {
    this.ensure();
    const buf = await this.ac.decodeAudioData(arrayBuffer);
    this.song.buffer = buf;
    this.song.dur = buf.duration;
    this.song.offset = 0;
    return buf.duration;
  }
  _buildSongChain() {
    const ac = this.ac;
    const s = this.song;
    s.gain = ac.createGain();
    s.gain.gain.value = 1;
    let usePitch = false;
    try {
      s.jungle = new Jungle(ac);
      usePitch = true;
    } catch (e) { s.jungle = null; }
    s.gain.connect(this.master);
    s.useJungle = usePitch;
    return usePitch;
  }
  playSong(onEnd) {
    this.ensure();
    const ac = this.ac; const s = this.song;
    if (!s.buffer) return false;
    if (!s.gain) this._buildSongChain();
    const src = ac.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = s.tempo;
    s.source = src;
    if (s.useJungle && s.jungle) {
      src.connect(s.jungle.input);
      s.jungle.output.connect(s.gain);
      this._applyPitch();
    } else {
      src.connect(s.gain);
    }
    src.onended = () => {
      if (s.playing) { s.playing = false; s.offset = 0; if (onEnd) onEnd(); }
    };
    src.start(0, s.offset);
    s.startedAt = ac.currentTime;
    s.playing = true;
    this._acquireWakeLock();
    return true;
  }
  stopSong() {
    const s = this.song;
    if (s.source) {
      // remember position
      s.offset += (this.ac.currentTime - s.startedAt) * s.tempo;
      if (s.offset > s.dur) s.offset = 0;
      try { s.source.onended = null; s.source.stop(); } catch (e) {}
      s.source = null;
    }
    s.playing = false;
    this._refreshWakeLock();
  }
  resetSong() { this.stopSong(); this.song.offset = 0; }
  songPosition() {
    const s = this.song;
    if (s.playing) return Math.min(s.dur, s.offset + (this.ac.currentTime - s.startedAt) * s.tempo);
    return s.offset;
  }
  setTempo(rate) {
    this.song.tempo = rate;
    if (this.song.source) this.song.source.playbackRate.value = rate;
    this._applyPitch();
  }
  setPitch(semitones) {
    this.song.pitch = semitones;
    this._applyPitch();
  }
  _applyPitch() {
    const s = this.song;
    if (!s.useJungle || !s.jungle) return;
    // net pitch the user wants, minus the pitch shift caused by playbackRate,
    // so perceived pitch = original + user semitones at any tempo.
    const tempoSemis = 12 * Math.log2(s.tempo);
    const net = s.pitch - tempoSemis;
    s.jungle.setPitchOffset(net / 12); // 1.0 = one octave
  }

  // Render the currently-loaded song to a WAV Blob at the given tempo (rate)
  // and pitch (semitones), mirroring the live playback chain offline.
  async renderSongToWav(tempo, pitch) {
    const buf = this.song.buffer;
    if (!buf) throw new Error("no-song");
    const rate = tempo || 1;
    const outLen = Math.ceil(buf.duration / rate * buf.sampleRate) + buf.sampleRate * 0.1;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(1, Math.max(1, Math.floor(outLen)), buf.sampleRate);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    let jungle = null;
    try { jungle = new Jungle(off); } catch (e) { jungle = null; }
    if (jungle) {
      const tempoSemis = 12 * Math.log2(rate);
      const net = (pitch || 0) - tempoSemis;
      jungle.setPitchOffset(net / 12);
      src.connect(jungle.input);
      jungle.output.connect(off.destination);
    } else {
      src.connect(off.destination);
    }
    src.start(0);
    const rendered = await off.startRendering();
    return AudioEngine.encodeWav(rendered);
  }

  static encodeWav(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const sr = audioBuffer.sampleRate;
    const len = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = len * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);
    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(audioBuffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        let v = Math.max(-1, Math.min(1, chans[c][i]));
        view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([view], { type: "audio/wav" });
  }

  // =========================================================================
  //  RECORDING + LIVE PITCH
  // =========================================================================
  async startRecording(onPitch) {
    this.ensure();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const r = this.rec;
    r.stream = stream;
    r.chunks = []; r.track = []; r.t0 = performance.now();
    const src = this.ac.createMediaStreamSource(stream);
    const analyser = this.ac.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    r.analyser = analyser;
    try {
      r.recorder = new MediaRecorder(stream);
      r.recorder.ondataavailable = e => { if (e.data.size) r.chunks.push(e.data); };
      r.recorder.start();
    } catch (e) { r.recorder = null; }
    const buf = new Float32Array(analyser.fftSize);
    const loop = () => {
      if (!r.stream) return;
      analyser.getFloatTimeDomainData(buf);
      const { freq, rms } = autoCorrelate(buf, this.ac.sampleRate);
      const t = (performance.now() - r.t0) / 1000;
      if (freq > 50 && freq < 1200) {
        r.track.push({ t, freq, rms });
        if (onPitch) onPitch(freq, freqToSwara(freq, this.tonicHz));
      } else if (onPitch) onPitch(-1, null);
      r.raf = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }
  async stopRecording() {
    const r = this.rec;
    if (r.raf) cancelAnimationFrame(r.raf);
    const blobPromise = new Promise(resolve => {
      if (r.recorder) {
        r.recorder.onstop = () => {
          const blob = new Blob(r.chunks, { type: r.recorder.mimeType || "audio/webm" });
          if (r.blobUrl) URL.revokeObjectURL(r.blobUrl);
          r.blobUrl = URL.createObjectURL(blob);
          resolve({ blob, url: r.blobUrl });
        };
        r.recorder.stop();
      } else resolve({ blob: null, url: null });
    });
    if (r.stream) { r.stream.getTracks().forEach(t => t.stop()); r.stream = null; }
    const out = await blobPromise;
    return { track: r.track.slice(), ...out };
  }

  // =========================================================================
  //  ANALYSIS — pitch / rhythm / raga
  // =========================================================================
  analyze(track, opts) {
    const appTonic = this.tonicHz;
    const selRaga = opts && opts.raga ? opts.raga : null;
    const bpm = opts && opts.bpm ? opts.bpm : 70;
    const selName = opts && opts.tonicName ? opts.tonicName : null;
    if (!track || track.length < 5) {
      return { empty: true };
    }
    // ---- cents of every voiced frame relative to the app's Sa ----
    const cents = [];
    for (const f of track) { if (f.freq > 0) cents.push(1200 * Math.log2(f.freq / appTonic)); }
    if (cents.length < 5) return { empty: true };

    // Signal strength (soft humming / quiet vowels vs full voice). Used to
    // temper expectations and coach volume — never a raw penalty.
    let rmsSum = 0, rmsN = 0;
    for (const f of track) { if (typeof f.rms === "number") { rmsSum += f.rms; rmsN++; } }
    const meanRms = rmsN ? rmsSum / rmsN : 0;
    const weak = meanRms > 0 && meanRms < 0.02;

    // Estimate the singer's systematic tuning offset within a semitone
    // (circular mean of cents mod 100) so note classification is key-fair —
    // i.e. we "consider the pitch of the singer", not just the app's Sa.
    let sx = 0, sy = 0;
    for (const c of cents) { const frac = ((c % 100) + 100) % 100; const a = 2 * Math.PI * frac / 100; sx += Math.cos(a); sy += Math.sin(a); }
    let tuneOffset = Math.atan2(sy, sx) / (2 * Math.PI) * 100; // [-50,50)

    // Histogram of swara positions for a candidate Sa shift (in semitones).
    const countsFor = (saShift) => {
      const pc = new Array(12).fill(0);
      for (const c of cents) {
        const nearest = Math.round((c - tuneOffset) / 100) - saShift;
        pc[((nearest % 12) + 12) % 12]++;
      }
      return pc;
    };

    // Find the Sa the singer actually used — key-independent, driven by which
    // shift yields the most coherent scale (so we judge against the singer's
    // real tonic, never bending the key to flatter the selected raga).
    let saShift = 0, detected = null;
    let bestScore = -1;
    for (let sh = 0; sh < 12; sh++) {
      const pc = countsFor(sh);
      const id = identifyRaga(pc);
      const tot = pc.reduce((a, b) => a + b, 0) || 1;
      const saWeight = pc[0] / tot; // Sa is usually among the most-sung notes
      const score = (id ? id.confidence : 0) + saWeight * 25;
      if (score > bestScore) { bestScore = score; saShift = sh; detected = id; }
    }
    const keyShift = ((saShift + 6) % 12) - 6; // signed semitones from the app's Sa
    const tonic = appTonic * Math.pow(2, saShift / 12);

    // How faithfully the singer sat on the SELECTED shruti (chosen Sa). This is
    // separate from swara-ID above, which re-anchors to the singer's own Sa so
    // humming / vowel singing in any key or octave is still classified right.
    const driftCents = keyShift * 100 + tuneOffset; // signed cents: singer's Sa vs selected Sa
    const shrutiMatch = Math.max(0, Math.min(100, Math.round(100 - Math.abs(driftCents) * 0.5)));

    // ---- per-frame analysis at the singer's actual Sa ----
    const posCounts = countsFor(saShift);
    const swaraSeq = [];
    let tuneErrSum = 0, tuneN = 0;
    for (const f of track) {
      if (f.freq <= 0) continue;
      const c = 1200 * Math.log2(f.freq / tonic);
      const nearest = Math.round(c);
      tuneErrSum += Math.abs(c - nearest);
      tuneN++;
      swaraSeq.push({ t: f.t, pos: ((nearest % 12) + 12) % 12, octave: Math.floor(nearest / 12), cents: c - nearest });
    }
    const meanCents = tuneN ? tuneErrSum / tuneN : 100;
    // pitch (intonation) accuracy: how close to true swaras
    const pitchAcc = Math.max(0, Math.min(100, Math.round(100 - meanCents * 1.6)));

    // ---- raga: strictly score adherence to the target raga's swaras ----
    if (!detected) detected = identifyRaga(posCounts);
    const targetRaga = selRaga || (detected && detected.raga);
    let ragaAcc = 0, foreign = [], missing = [];
    if (targetRaga && targetRaga.aro) {
      const set = ragaPositionSet(targetRaga);
      let inside = 0, total = 0;
      posCounts.forEach((c, p) => {
        if (c <= 0) return;
        total += c;
        if (set.has(p)) inside += c; else foreign.push({ pos: p, count: c });
      });
      ragaAcc = total ? Math.round((inside / total) * 100) : 0;
      foreign.sort((a, b) => b.count - a.count);
      // swaras the raga needs but the singer never sang (skip the upper Sa)
      set.forEach(p => { if (p !== 0 && posCounts[p] <= 0) missing.push({ pos: p }); });
    }

    // ---- rhythm: onset detection from the pitch energy gaps ----
    // Use note-change events as proxy onsets when no audio buffer is provided.
    const onsets = [];
    let lastPos = null, lastT = -10;
    for (const s of swaraSeq) {
      if (s.pos !== lastPos && s.t - lastT > 0.12) {
        onsets.push(s.t);
        lastT = s.t;
      }
      lastPos = s.pos;
    }
    let rhythmAcc = 0, ioiCV = 0;
    if (onsets.length >= 3) {
      const beat = 60 / bpm;
      // grid alignment: deviation of each onset from nearest beat multiple
      const t0 = onsets[0];
      let devSum = 0;
      for (const o of onsets) {
        const rel = (o - t0) / beat;
        const dev = Math.abs(rel - Math.round(rel));
        devSum += Math.min(dev, 0.5);
      }
      const meanDev = devSum / onsets.length; // 0..0.5
      rhythmAcc = Math.max(0, Math.round(100 - meanDev * 200));
      // steadiness via coefficient of variation of inter-onset intervals
      const iois = [];
      for (let i = 1; i < onsets.length; i++) iois.push(onsets[i] - onsets[i - 1]);
      const mean = iois.reduce((a, b) => a + b, 0) / iois.length;
      const sd = Math.sqrt(iois.reduce((a, b) => a + (b - mean) ** 2, 0) / iois.length);
      ioiCV = mean ? sd / mean : 0;
    } else {
      rhythmAcc = 60;
    }

    const overall = Math.round(pitchAcc * 0.34 + shrutiMatch * 0.16 + ragaAcc * 0.3 + rhythmAcc * 0.2);
    // Calibrate the tone of feedback to the student's current level, so a
    // beginner (or a soft, tentative take) isn't judged by concert standards.
    const level = overall >= 78 ? "advanced" : (overall >= 55 ? "intermediate" : "beginner");

    // ---- swaras actually used (sorted by prominence) ----
    const usedSwaras = posCounts
      .map((c, p) => ({ pos: p, count: c }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    // ---- guidance (Malayalam) ----
    const tips = [];
    if (weak) tips.push({ k: "ശബ്ദനില", ken: "Volume", t: "റെക്കോർഡിംഗ് വളരെ പതിഞ്ഞതാണ്. മൈക്കിനോട് അല്പം അടുത്ത്, കുറച്ചുകൂടെ ഉറക്കെ പാടിയാൽ വിലയിരുത്തൽ കൂടുതൽ കൃത്യമാകും.", ten: "Your recording is very soft. Sing a little louder and closer to the mic for a more accurate evaluation." });
    if (meanCents > 28) tips.push({ k: "ശ്രുതി", ken: "Shruti", t: `ശരാശരി ${Math.round(meanCents)} സെന്റ് വ്യതിയാനം ഉണ്ട്. തംപുര വെച്ച് ഓരോ സ്വരവും ശ്രുതിയിൽ ഉറപ്പിച്ച് പിടിക്കാൻ പരിശീലിക്കുക.`, ten: `Your average deviation is ${Math.round(meanCents)} cents. Practise holding each swara steady against the tanpura.` });
    else if (meanCents > 14) tips.push({ k: "ശ്രുതി", ken: "Shruti", t: `ശ്രുതി നന്നായിട്ടുണ്ട് (${Math.round(meanCents)} സെന്റ്). ഗമകങ്ങളിൽ കൂടുതൽ കൃത്യത വരുത്താം.`, ten: `Your shruti is good (${Math.round(meanCents)} cents). You can bring more precision to the gamakas.` });
    else tips.push({ k: "ശ്രുതി", ken: "Shruti", t: "മികച്ച ശ്രുതിശുദ്ധി! സ്വരസ്ഥാനങ്ങൾ കൃത്യമാണ്.", ten: "Excellent shruti purity! Your swarasthanas are accurate." });

    if (foreign.length) {
      const fl = foreign.slice(0, 2).map(f => swaraLabel(f.pos)).join(", ");
      const flEn = foreign.slice(0, 2).map(f => SWARAS[((f.pos % 12) + 12) % 12].latin).join(", ");
      const rn = targetRaga ? targetRaga.name : "";
      const rnEn = targetRaga ? (targetRaga.latin || targetRaga.name) : "";
      tips.push({ k: "രാഗം", ken: "Raga", t: `${rn} രാഗത്തിൽ ഇല്ലാത്ത സ്വരങ്ങൾ കടന്നുവന്നു: ${fl}. ഈ സ്വരങ്ങൾ ഒഴിവാക്കി ആരോഹണ–അവരോഹണം വീണ്ടും അഭ്യസിക്കുക.`, ten: `Swaras outside raga ${rnEn} crept in: ${flEn}. Leave them out and practise the arohana–avarohana again.` });
    } else if (targetRaga) {
      tips.push({ k: "രാഗം", ken: "Raga", t: `${targetRaga.name} രാഗത്തിന്റെ സ്വരങ്ങൾ ഭംഗിയായി പാലിച്ചു.`, ten: `You kept beautifully to the swaras of raga ${targetRaga.latin || targetRaga.name}.` });
    }
    if (selRaga && missing.length) {
      const ml = missing.slice(0, 3).map(m => swaraLabel(m.pos)).join(", ");
      const mlEn = missing.slice(0, 3).map(m => SWARAS[((m.pos % 12) + 12) % 12].latin).join(", ");
      tips.push({ k: "സ്വരം", ken: "Swara", t: `${selRaga.name} രാഗത്തിലെ ${ml} എന്നീ സ്വരങ്ങൾ പാടിയിട്ടില്ല. ആരോഹണ–അവരോഹണത്തിൽ ഇവ ഉൾപ്പെടുത്തുക.`, ten: `You did not sing ${mlEn} of raga ${selRaga.latin || selRaga.name}. Include them in the arohana–avarohana.` });
    }
    const saRef = selName ? selName : "ഷഡ്ജം";
    const saRefEn = selName ? selName : "Sa";
    if (Math.abs(keyShift) >= 1) {
      const dir = keyShift > 0 ? "മുകളിൽ" : "താഴെ";
      const dirEn = keyShift > 0 ? "above" : "below";
      const enc = level === "beginner"
        ? { t: `സാരമില്ല — തിരഞ്ഞെടുത്ത ശ്രുതി (${saRef}) തംപുരയിൽ വെച്ച്, ആ ഷഡ്ജത്തിൽ നിന്ന് തുടങ്ങി പതുക്കെ പരിശീലിക്കുക.`, ten: `No worries — set the tanpura to your chosen shruti (${saRefEn}), start from that Sa and practise slowly.` }
        : { t: `തംപുര ${saRef}-ൽ ക്രമീകരിച്ച്, ഓരോ ഫ്രെയ്‌സും ആ ഷഡ്ജത്തിലേക് മടങ്ങുന്നുവെന്ന് ഉറപ്പാക്കുക.`, ten: `Keep the tanpura on ${saRefEn} and make sure every phrase resolves back to that Sa.` };
      tips.push({ k: "ശ്രുതി", ken: "Shruti", t: `നിങ്ങൾ പാടിയത് തിരഞ്ഞെടുത്ത ഷഡ്ജത്തിൽ (${saRef}) നിന്ന് ${Math.abs(keyShift)} സ്വരസ്ഥാനം ${dir} ആണ്. ${enc.t}`, ten: `You sang ${Math.abs(keyShift)} swarasthana(s) ${dirEn} your selected Sa (${saRefEn}). ${enc.ten}` });
    } else if (Math.abs(driftCents) > 20) {
      const dir = driftCents > 0 ? "കൂടുതൽ" : "കുറവ്";
      const dirEn = driftCents > 0 ? "sharp" : "flat";
      tips.push({ k: "ശ്രുതി", ken: "Shruti", t: `തിരഞ്ഞെടുത്ത ഷഡ്ജത്തോട് (${saRef}) വളരെ അടുത്താണ് — ശരാശരി ${Math.abs(Math.round(driftCents))} സെന്റ് ${dir}. തംപുരയോട് ചേർന്ന് ഷഡ്ജം ഉറപ്പിക്കുക.`, ten: `Very close to your selected Sa (${saRefEn}) — about ${Math.abs(Math.round(driftCents))} cents ${dirEn}. Lock onto the tanpura's Sa.` });
    } else if (selName) {
      tips.push({ k: "ശ്രുതി", ken: "Shruti", t: `തിരഞ്ഞെടുത്ത ഷഡ്ജത്തിൽ (${saRef}) ഭംഗിയായി ഉറച്ചുനിന്നു. മികച്ചത്!`, ten: `You stayed right on your selected Sa (${saRefEn}). Excellent!` });
    }

    if (ioiCV > 0.35) tips.push({ k: "താളം", ken: "Thala", t: "താളത്തിന്റെ വേഗത ഏകീകൃതമല്ല. മെട്രോണോം/തംപുര ഉപയോഗിച്ച് കാലപ്രമാണം സ്ഥിരമാക്കുക.", ten: "Your tempo is not steady. Use the metronome/tanpura to keep the kalapramanam constant." });
    else if (rhythmAcc < 70) tips.push({ k: "താളം", ken: "Thala", t: "ചില സ്വരങ്ങൾ താളത്തിന്റെ അക്ഷരത്തിൽ വീഴുന്നില്ല. കുറഞ്ഞ വേഗതയിൽ പരിശീലിച്ച് കൃത്യത വരുത്തുക.", ten: "Some swaras are not landing on the beat. Practise at a slower speed to build precision." });
    else tips.push({ k: "താളം", ken: "Thala", t: "താളബോധം നന്നായിട്ടുണ്ട്.", ten: "Your sense of thala is good." });

    tips.push(level === "advanced"
      ? { k: "മൊത്തം", ken: "Overall", t: "മൊത്തത്തിൽ മികച്ച നിലവാരം. സൂക്ഷ്മമായ ഗമകങ്ങളിലും ഭാവത്തിലും ശ്രദ്ധിച്ച് ഇനിയും മെച്ചപ്പെടുത്താം.", ten: "Strong overall. Refine the subtle gamakas and bhava to go further." }
      : level === "intermediate"
      ? { k: "മൊത്തം", ken: "Overall", t: "നല്ല പുരോഗതി! ദിവസവും തംപുരയോടൊപ്പം പരിശീലിച്ചാൽ ശ്രുതിശുദ്ധി ഇനിയും ഉറയ്ക്കും.", ten: "Good progress! Daily practice with the tanpura will firm up your shruti further." }
      : { k: "മൊത്തം", ken: "Overall", t: "നല്ല തുടക്കം. ഓരോ സ്വരവും തംപുരയോട് ചേർത്ത് പതുക്കെ ഉറപ്പിച്ച് പാടി തുടങ്ങുക — ക്രമേണ മെച്ചപ്പെടും.", ten: "A good start. Sing each swara slowly and firmly with the tanpura — it will steadily improve." });

    return {
      empty: false,
      pitchAcc, ragaAcc, rhythmAcc, overall, meanCents: Math.round(meanCents),
      shrutiMatch, keyShift, driftCents: Math.round(driftCents), weak, meanRms, level, selName,
      usedSwaras, foreign, posCounts, swaraSeq,
      detected, targetRaga, tips, onsetCount: onsets.length,
      duration: track[track.length - 1].t,
    };
  }
}

const EXERCISES = {
  saptaswara: {
    label: "സപ്തസ്വരം", latin: "Sapta Swara",
    intro: "ഏഴ് സ്വരങ്ങൾ — ആരോഹണവും അവരോഹണവും. 1, 2, 3, 4 വേഗതകളിൽ അഭ്യസിക്കുക.",
    items: [
      { id: "sapasa", name: "സ പ സ", latin: "Sa Pa Sa", group: 3,
        desc: "ശ്രുതി ഉറപ്പിക്കാൻ — സ, പ, ഉയർന്ന സ. ആധാര സ്വരങ്ങൾ കൃത്യമായി പാടുക.",
        notes: [0,7,12,7,0] },
      { id: "sapta", name: "സ രി ഗ മ പ ധ നി സ", latin: "Sa Ri Ga Ma Pa Dha Ni Sa", group: 8,
        desc: "അടിസ്ഥാന ആരോഹണ–അവരോഹണം. ഓരോ സ്വരവും ശ്രുതിയിൽ ഉറപ്പിച്ച് പാടുക.",
        notes: [0,1,4,5,7,8,11,12, 12,11,8,7,5,4,1,0] },
    ],
  },
  sarali: {
    label: "സരളി വരിശ", latin: "Sarali Varisai",
    intro: "മായാമാളവഗൗള രാഗത്തിലെ അടിസ്ഥാന വരിശകൾ. ആദി താളം. പുരന്ദരദാസർ രചിച്ചത്.",
    items: [
      { id: "s1", name: "സരളി വരിശ 1", latin: "Plain ascent & descent", group: 8,
        notes: [0,1,4,5,7,8,11,12, 12,11,8,7,5,4,1,0],
        desc: "നേരായ ആരോഹണ–അവരോഹണം." },
      { id: "s2", name: "സരളി വരിശ 2", latin: "Focus on Ri / Ni", group: 8,
        notes: [0,1,0,1,0,1,4,5, 0,1,4,5,7,8,11,12, 12,11,12,11,12,11,8,7, 12,11,8,7,5,4,1,0],
        desc: "രണ്ടാം സ്വരത്തിൽ (രി, നി) ഊന്നൽ." },
      { id: "s3", name: "സരളി വരിശ 3", latin: "Focus on Ga / Dha", group: 8,
        notes: [0,1,4,0,1,4,0,1, 0,1,4,5,7,8,11,12, 12,11,8,12,11,8,12,11, 12,11,8,7,5,4,1,0],
        desc: "മൂന്നാം സ്വരത്തിൽ ഊന്നൽ." },
      { id: "s4", name: "സരളി വരിശ 4", latin: "Four-note groups", group: 8,
        notes: [0,1,4,5,0,1,4,5, 0,1,4,5,7,8,11,12, 12,11,8,7,12,11,8,7, 12,11,8,7,5,4,1,0],
        desc: "നാല് സ്വരങ്ങളുടെ കൂട്ടം." },
      { id: "s5", name: "സരളി വരിശ 5", latin: "Kaarvai on Pa / Ma", group: 8,
        notes: [0,1,4,5,7,8,0,1, 0,1,4,5,7,8,11,12, 12,11,8,7,5,4,12,11, 12,11,8,7,5,4,1,0],
        desc: "പ, മ സ്വരങ്ങളിൽ കാർവൈ (നീട്ടൽ)." },
      { id: "s8", name: "സരളി വരിശ 6", latin: "Kaarvai on Ni / Ri", group: 8,
        notes: [0,1,4,5,7,8,11,"h", 0,1,4,5,7,8,11,12, 12,11,8,7,5,4,1,"h", 12,11,8,7,5,4,1,0],
        desc: "നി, രി സ്വരങ്ങളിൽ കാർവൈ." },
      { id: "s9", name: "സരളി വരിശ 7", latin: "Zig-zag P M G R", group: 8,
        notes: [0,1,4,5,7,5,4,1, 0,1,4,5,7,8,11,12, 12,11,8,7,5,7,8,11, 12,11,8,7,5,4,1,0],
        desc: "സ്വരങ്ങൾ മുന്നോട്ടും പിന്നോട്ടും." },
      { id: "s10", name: "സരളി വരിശ 8", latin: "Zig-zag P M D P", group: 8,
        notes: [0,1,4,5,7,5,8,7, 0,1,4,5,7,8,11,12, 12,11,8,7,5,7,4,5, 12,11,8,7,5,4,1,0],
        desc: "കൂടുതൽ വളവുള്ള ചലനം." },
      { id: "s11", name: "സരളി വരിശ 9", latin: "Overlapping groups", group: 8,
        notes: [0,1,4,5,1,4,5,7, 0,1,4,5,7,8,11,12, 12,11,8,7,11,8,7,5, 12,11,8,7,5,4,1,0],
        desc: "സ്വരക്കൂട്ടങ്ങൾ പരസ്പരം ചേരുന്നു." },
      { id: "s12", name: "സരളി വരിശ 10", latin: "Rolling triads", group: 8,
        notes: [0,1,4,5,0,5,4,1, 0,1,4,5,7,8,11,12, 12,11,8,7,12,7,8,11, 12,11,8,7,5,4,1,0],
        desc: "മൂന്ന് സ്വരങ്ങളുടെ ഉരുൾചലനം." },
      { id: "s13", name: "സരളി വരിശ 11", latin: "Sa-anchored leaps", group: 8,
        notes: [0,4,1,5,4,7,5,4, 0,1,4,5,7,8,11,12, 12,8,11,7,8,5,7,8, 12,11,8,7,5,4,1,0],
        desc: "സ്ഥായി സ്വരത്തിലേക്ക് മടങ്ങുന്ന കുതിപ്പുകൾ." },
      { id: "s14", name: "സരളി വരിശ 12", latin: "Paired motion", group: 8,
        notes: [0,1,0,4,1,4,5,4, 0,1,4,5,7,8,11,12, 12,11,12,8,11,8,7,8, 12,11,8,7,5,4,1,0],
        desc: "ജോഡി സ്വരങ്ങളുടെ കയറ്റവും ഇറക്കവും." },
      { id: "s15", name: "സരളി വരിശ 13", latin: "Wide zig-zag", group: 8,
        notes: [1,0,4,1,5,4,7,5, 0,1,4,5,7,8,11,12, 11,12,8,11,7,8,5,7, 12,11,8,7,5,4,1,0],
        desc: "വിശാലമായ വളവുകൾ." },
      { id: "s16", name: "സരളി വരിശ 14", latin: "Full elaboration", group: 8,
        notes: [4,1,0,5,4,1,7,5,0,1,4,5,7,8,11,12,8,11,12,7,8,11,5,7,12,11,8,7,5,4,1,0],
        desc: "എല്ലാ ചലനങ്ങളും ചേർന്ന സമാപന വരിശ." },
      { id: "ce1783122788405", name: "സരളി വരിശ 15", latin: "", group: 8,
        notes: [5,4,1,0,7,5,4,1,0,1,4,5,7,8,11,12,7,8,11,12,5,7,8,11,12,11,8,7,5,4,1,0],
        desc: "" },
      { id: "ce1783123093475", name: "സരളി വരിശ 16", latin: "", group: 8,
        notes: [0,1,4,5,12,11,8,7,0,1,4,5,7,8,11,12,7,8,11,12,5,4,1,0,12,11,8,7,5,4,1,0],
        desc: "" },
    ],
  },
  madhyasthayi: {
    label: "മധ്യസ്ഥായി വരിശ", latin: "Madhya Sthayi Varisai",
    intro: "മധ്യസ്ഥായിയിൽ പൂർണ്ണ ഒക്ടേവ് ചലനങ്ങൾ — സ്വരസ്ഥാനങ്ങൾ ഉറപ്പിക്കാനും ശ്രുതിശുദ്ധി നേടാനും.",
    items: [
      { id: "md1", name: "മധ്യസ്ഥായി 1", latin: "Plain octave", group: 8,
        notes: [0,1,4,5,7,"h",4,5,7,"h","h","h",7,"h","h","h",4,5,7,8,11,8,7,5,4,5,7,4,5,4,1,0],
        desc: "നേർ ആരോഹണ–അവരോഹണം, മധ്യസ്ഥായിയിൽ ഉറപ്പിച്ച്." },
      { id: "md2", name: "മധ്യസ്ഥായി 2", latin: "Sa-Ga-Pa leaps", group: 8,
        notes: [12,"h",11,8,11,"h",8,7,8,"h",7,5,7,"h",7,"h",4,5,7,8,11,8,7,5,4,5,7,4,5,4,1,0],
        desc: "സ–ഗ–പ–സ̇ കുതിപ്പുകളും തിരിച്ചിറക്കവും." },
      { id: "md3", name: "മധ്യസ്ഥായി 3", latin: "With kaarvai", group: 8,
        notes: [12,12,11,8,11,11,8,7,8,8,7,5,7,"h",7,"h",4,5,7,8,11,8,7,5,4,5,7,4,5,4,1,0],
        desc: "കാർവൈ (നീട്ടൽ) സഹിതം മധ്യസ്ഥായി ചലനം." },
      { id: "md4", name: "മധ്യസ്ഥായി 4", latin: "Grouped with kaarvai", group: 8,
        notes: [0,1,4,1,4,"h",4,5,7,5,7,"h",8,7,8,"h",5,7,8,7,8,11,8,7,5,7,8,7,5,4,1,0],
        desc: "സ്വരക്കൂട്ടങ്ങളും കാർവൈയും ചേർന്ന മധ്യസ്ഥായി ചലനം." },
      { id: "md5", name: "മധ്യസ്ഥായി 5", latin: "Kaarvai ascent", group: 8,
        notes: [0,1,4,5,7,"h",7,"h",8,8,7,"h",5,5,7,"h",8,11,12,"h",12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "ഉയർന്ന സ്വരങ്ങളിലേക്കുള്ള കാർവൈ ചലനം." },
    ],
  },
  melsthayi: {
    label: "മേൽസ്ഥായി വരിശ", latin: "Mel Sthayi Varisai",
    intro: "മേൽസ്ഥായിയിലേക്ക് (താരസ്ഥായി) ശബ്ദം ഉയർത്താനുള്ള അഭ്യാസം. മേൽ കുത്തുള്ള സ്വരങ്ങൾ ശ്രദ്ധിക്കുക.",
    items: [
      { id: "ml1", name: "മേൽസ്ഥായി 1", latin: "Pa up to upper Pa", group: 8,
        notes: [0,1,4,5,7,8,11,12,12,"h","h","h",12,"h","h","h",8,11,12,13,12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "പ മുതൽ മേൽ പ വരെ — താരസ്ഥായിയിലേക്കുള്ള കയറ്റം." },
      { id: "ml2", name: "മേൽസ്ഥായി 2", latin: "Full tara octave", group: 8,
        notes: [0,1,4,5,7,8,11,12,12,"h","h","h",12,"h","h","h",8,11,12,13,12,12,13,12,12,13,12,11,8,7,5,7,8,11,12,13,12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "മേൽ സ മുതൽ അതിമേൽ സ വരെ പൂർണ്ണ ഒക്ടേവ്." },
      { id: "ml3", name: "മേൽസ്ഥായി 3", latin: "Madhya to tara span", group: 8,
        notes: [0,1,4,5,7,8,11,12,12,"h","h","h",12,"h","h","h",8,11,12,13,16,13,12,13,12,13,12,11,8,7,5,7,8,11,12,13,12,12,13,12,12,13,12,11,8,7,5,7,8,11,12,13,12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "മധ്യസ്ഥായിയിൽ നിന്ന് അതിമേൽ സ വരെ വിശാല ചലനം." },
      { id: "ml4", name: "മേൽസ്ഥായി 4", latin: "Tara elaboration 1", group: 8,
        notes: [0,1,4,5,7,8,11,12,12,"h","h","h",12,"h","h","h",8,11,12,13,16,17,16,13,12,13,12,11,8,7,5,7,8,11,12,13,16,13,12,13,12,13,12,11,8,7,5,7,8,11,12,13,12,12,13,12,12,13,12,11,8,7,5,7,8,11,12,13,12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "താരസ്ഥായിയിലേക്കുള്ള വിസ്തൃത ചലനം." },
      { id: "ml5", name: "മേൽസ്ഥായി 5", latin: "Tara elaboration 2", group: 8,
        notes: [0,1,4,5,7,8,11,12,12,"h","h","h",12,"h","h","h",8,11,12,13,16,17,19,17,16,13,12,11,8,7,5,7,8,11,12,13,16,17,16,13,12,13,12,11,8,7,5,7,8,11,12,13,16,13,12,13,12,13,12,11,8,7,5,7,8,11,12,13,12,12,13,12,12,13,12,11,8,7,5,7,8,11,12,13,12,11,8,7,12,11,8,7,5,4,1,0],
        desc: "മേൽ പ വരെ വ്യാപിക്കുന്ന ചലനം." },
    ],
  },
  keezhsthayi: {
    label: "കീഴ്സ്ഥായി വരിശ", latin: "Keezh Sthayi Varisai",
    intro: "കീഴ്സ്ഥായിയിലേക്ക് (മന്ദ്രസ്ഥായി) ശബ്ദം താഴ്ത്താനുള്ള അഭ്യാസം. കീഴ് കുത്തുള്ള സ്വരങ്ങൾ ശ്രദ്ധിക്കുക.",
    items: [
      { id: "kz1", name: "കീഴ്സ്ഥായി 1", latin: "Pa down to lower Pa", group: 8,
        notes: [12,11,8,7,5,4,1,0,0,"h","h","h",0,"h","h","h",4,1,0,-1,0,1,4,5,0,1,4,5,7,8,11,12],
        desc: "പ മുതൽ കീഴ് പ വരെ — മന്ദ്രസ്ഥായിയിലേക്കുള്ള ഇറക്കം." },
      { id: "kz2", name: "കീഴ്സ്ഥായി 2", latin: "Full mandra octave", group: 8,
        notes: [12,11,8,7,5,4,1,0,0,"h","h","h",0,"h","h","h",4,1,0,-1,0,0,-1,0,0,-1,0,1,4,5,7,5,4,1,0,-1,0,1,4,5,0,1,4,5,7,8,11,12],
        desc: "സ മുതൽ കീഴ് സ വരെ പൂർണ്ണ ഒക്ടേവ്." },
      { id: "kz3", name: "കീഴ്സ്ഥായി 3", latin: "Mandra to madhya span", group: 8,
        notes: [-12,11,8,7,5,4,1,0,0,"h","h","h",0,"h","h","h",4,1,0,-1,-4,-1,0,-1,0,-1,0,1,4,5,7,5,4,1,0,-1,0,0,-1,0,0,-1,0,1,4,5,7,5,4,1,0,-1,0,1,4,5,0,1,4,5,7,8,11,12],
        desc: "കീഴ്സ്ഥായിയിൽ നിന്ന് മധ്യസ്ഥായി വരെ വിശാല ചലനം." },
      { id: "kz4", name: "കീഴ്സ്ഥായി 4", latin: "Mandra elaboration", group: 8,
        notes: [12,11,8,7,5,4,1,0,0,"h","h","h",0,"h","h","h",4,1,0,-1,-4,-5,-4,-1,0,-1,0,1,4,5,7,5,4,1,0,-1,-4,-1,0,-1,0,-1,0,1,4,5,7,5,4,1,0,-1,0,0,-1,0,0,-1,0,1,4,5,7,5,4,1,0,-1,0,1,4,5,0,1,4,5,7,8,11,12],
        desc: "മന്ദ്രസ്ഥായിയിലേക്കുള്ള വിസ്തൃത ചലനം." },
    ],
  },
  janta: {
    label: "ജണ്ട വരിശ", latin: "Janta Varisai",
    intro: "ഓരോ സ്വരവും ഇരട്ടിച്ച് പാടുന്ന വരിശ. രണ്ടാമത്തെ സ്വരത്തിന് അൽപം ഊന്നൽ (സ്ഫുരിതം) നൽകുക.",
    items: [
      { id: "j1", name: "ജണ്ട വരിശ 1", latin: "Double notes", group: 8,
        notes: [0,0,1,1,4,4,5,5,7,7,8,8,11,11,12,12, 12,12,11,11,8,8,7,7,5,5,4,4,1,1,0,0],
        desc: "സ്വരങ്ങൾ ഇരട്ടിച്ച്. ശബ്ദത്തിന് ഉറപ്പും ഗാംഭീര്യവും നൽകുന്നു." },
      { id: "ce1783123292883", name: "ജണ്ട വരിശ 2", latin: "", group: 8,
        notes: [0,0,1,1,4,4,5,5,1,1,4,4,5,5,7,7,4,4,5,5,7,7,8,8,5,5,7,7,8,8,11,11,7,7,8,8,11,11,12,12,12,12,11,11,8,8,7,7,11,11,8,8,7,7,5,5,8,8,7,7,5,5,4,4,7,7,5,5,4,4,1,1,5,5,4,4,1,1,0,0],
        desc: "" },
      { id: "ce1783166495092", name: "Janta Varisai 3", latin: "", group: 8,
        notes: [0,0,1,1,4,4,1,1,0,0,1,1,4,4,5,5,1,1,4,4,5,5,4,4,1,1,4,4,5,5,7,7,4,4,5,5,7,7,5,5,4,4,5,5,7,7,8,8,5,5,7,7,8,8,7,7,5,5,7,7,8,8,11,11,7,7,8,8,11,11,8,8,7,7,8,8,11,11,12,12,12,12,11,11,8,8,11,11,12,12,11,11,8,8,7,7,11,11,8,8,7,7,8,8,11,11,8,8,7,7,5,5,8,8,7,7,5,5,7,7,8,8,7,7,5,5,4,4,7,7,5,5,4,4,5,5,7,7,5,5,4,4,1,1,5,5,4,4,1,1,4,4,5,5,4,4,1,1,0,0],
        desc: "" },
    ],
  },
  alankaram: {
    label: "അലങ്കാരം", latin: "Alankaram",
    intro: "സ്വരവും താളവും ചേർന്ന അഭ്യാസങ്ങൾ — സപ്ത താള അലങ്കാരങ്ങൾ. പുരന്ദരദാസർ രചിച്ചത്.",
    items: [
      { id: "a_triputa", name: "ത്രിപുട (ആദി) അലങ്കാരം", latin: "Triputa — 3-note groups", group: 3,
        notes: [0,1,4, 1,4,5, 4,5,7, 5,7,8, 7,8,11, 8,11,12, 12,11,8, 11,8,7, 8,7,5, 7,5,4, 5,4,1, 4,1,0],
        desc: "മൂന്ന് സ്വരങ്ങളുടെ കൂട്ടം. ഏറ്റവും ആദ്യം പഠിക്കുന്ന അലങ്കാരം." },
      { id: "a_eka", name: "ഏക താള അലങ്കാരം", latin: "Eka — 4-note groups", group: 4,
        notes: [0,1,4,5, 1,4,5,7, 4,5,7,8, 5,7,8,11, 7,8,11,12, 12,11,8,7, 11,8,7,5, 8,7,5,4, 7,5,4,1, 5,4,1,0],
        desc: "നാല് സ്വരങ്ങളുടെ കൂട്ടം, ഏക താളത്തിൽ." },
    ],
  },
  vakrajanta: {
    label: "വക്ര ജണ്ട വരിശ", latin: "Vakra Janta Varisai",
    intro: "ജണ്ട വരിശയുടെ വക്ര (വളവുള്ള) രൂപം. ഇരട്ടിച്ച സ്വരങ്ങൾ മുന്നോട്ടും പിന്നോട്ടും വളഞ്ഞ് ചലിക്കുന്നു.",
    items: [
      { id: "vj1", name: "വക്ര ജണ്ട 1", latin: "Zig-zag doubles", group: 4,
        notes: [0,1,0,1, 1,4,1,4, 4,5,4,5, 5,7,5,7, 7,8,7,8, 8,11,8,11, 11,12,11,12, 12,11,12,11, 11,8,11,8, 8,7,8,7, 7,5,7,5, 5,4,5,4, 4,1,4,1, 1,0,1,0],
        desc: "ഓരോ ജോഡിയും അടുത്ത സ്വരത്തിലേക്ക് വളയുന്നു." },
      { id: "vj2", name: "വക്ര ജണ്ട 2", latin: "Triple-step doubles", group: 6,
        notes: [0,0,4, 1,1,5, 4,4,7, 5,5,8, 7,7,11, 8,8,12, 12,12,8, 11,11,7, 8,8,5, 7,7,4, 5,5,1, 4,4,0],
        desc: "ഇരട്ടിച്ച സ്വരത്തിന് ശേഷം മൂന്നാമത്തേക്ക് കുതിപ്പ്." },
    ],
  },
  datu: {
    label: "ദാട്ടു വരിശ", latin: "Datu Varisai",
    intro: "സ്വരങ്ങൾ ഒഴിവാക്കി കുതിച്ചുള്ള (ലീപ്) വരിശ. സ്വരസ്ഥാനങ്ങൾ കൃത്യമായി ഉറപ്പിക്കാൻ ഏറ്റവും നല്ലത്.",
    items: [
      { id: "dt1", name: "ദാട്ടു വരിശ 1", latin: "Sa-anchored leaps", group: 4,
        notes: [0,4,0,5, 0,7,0,8, 0,11,0,12, 12,8,12,7, 12,5,12,4, 12,1,12,0],
        desc: "സ്ഥായി സ്വരത്തിലേക്ക് മടങ്ങുന്ന കുതിപ്പുകൾ." },
      { id: "dt2", name: "ദാട്ടു വരിശ 2", latin: "Alternating leaps", group: 4,
        notes: [0,4,1,5, 4,7,5,8, 7,11,8,12, 12,8,11,7, 8,5,7,4, 5,1,4,0],
        desc: "മാറിമാറി ഉയരുകയും താഴുകയും ചെയ്യുന്ന കുതിപ്പുകൾ." },
    ],
  },
  geethangal: {
    label: "ഗീതങ്ങൾ", latin: "Geethangal",
    intro: "ലളിതമായ ആദ്യ സംഗീത രചനകൾ. തിരഞ്ഞെടുത്ത രാഗത്തിൽ ഈണം പാടും. (പരമ്പരാഗത മൂലരാഗം ബ്രാക്കറ്റിൽ.)",
    items: [
      { id: "ge_gananatha", name: "ശ്രീ ഗണനാഥ", latin: "Sri Gananatha", group: 4,
        notes: [5,7,8,12,12,13,13,12,8,7,5,7,1,5,7,8,5,7,8,7,5,4,1,0,0,1,5,4,1,0,1,4,1,0,1,5,7,8,5,7,8,7,5,4,1,0,0,1,5,"h",4,1,0,1,4,1,0],
        desc: "പിള്ളയാർ സ്തുതി — ആദ്യം പഠിക്കുന്ന ഗീതം (മൂലം: മലഹരി)." },
      { id: "ge_varaveena", name: "വരവീണ", latin: "Varaveena", group: 4,
        notes: [0,4,7,4, 7,12,7,4, 5,4,1,0, 1,4,5,4, 7,8,12,8, 7,5,4,1, 4,5,7,8, 7,4,1,0],
        desc: "സരസ്വതി സ്തുതി ഗീതം (മൂലം: മോഹനം)." },
    ],
  },
  varnangal: {
    label: "വർണ്ണങ്ങൾ", latin: "Varnangal",
    intro: "സ്വരവും താള പ്രയോഗവും ചേർന്ന അഭ്യാസ രചന — കച്ചേരി തയ്യാറെടുപ്പിന്റെ പ്രധാന ഘട്ടം.",
    items: [
      { id: "va_ninnukori", name: "നിന്നുകോരി", latin: "Ninnukori", group: 4,
        notes: [0,4,7,8, 7,8,12,8, 7,4,7,8, 7,4,1,0, 4,7,8,12, 8,7,8,4, 7,4,1,4, 1,0,1,0],
        desc: "പ്രസിദ്ധമായ ആദി താള വർണം (മൂലം: മോഹനം)." },
      { id: "va_samininne", name: "സാമി നിന്നേ", latin: "Sami Ninne", group: 4,
        notes: [0,1,4,5, 7,8,11,12, 11,8,7,5, 4,1,0,1, 4,5,7,8, 11,12,11,8, 7,5,4,1, 4,1,0,0],
        desc: "ധീരശങ്കരാഭരണം വർണം — സ്വരസ്ഥാന അഭ്യാസത്തിന്." },
    ],
  },
  special: {
    label: "പ്രത്യേക അഭ്യാസം", latin: "Special Exercises",
    intro: "സ്വന്തമായി എഴുതുന്ന പ്രത്യേക അഭ്യാസങ്ങൾ — ഓരോ വരിക്കും വ്യത്യസ്ത നീളമാകാം. '↵ പുതിയ വരി' ഉപയോഗിച്ചോ ടെക്സ്റ്റ് ബോക്സിൽ എന്റർ അമർത്തിയോ വരി മുറിക്കാം. സ്വരങ്ങൾ കോപ്പി-പേസ്റ്റ് ചെയ്യാം.",
    items: [
      { id: "ce1783297799455", name: "Single Step Middle", latin: "", group: 8,
        notes: [0,"/",0,1,0,"/",0,1,4,1,0,"/",0,1,4,5,4,1,0,"/",0,1,4,5,7,5,4,1,0,"/",0,1,4,5,7,8,7,5,4,1,0,"/",0,1,4,5,7,8,11,8,7,5,4,1,0,"/",0,1,4,5,7,8,11,12,11,8,7,5,4,1,0],
        desc: "" },
      { id: "ce1783302147113", name: "Single Step Lower", latin: "", group: 8,
        notes: [0,"/",0,-1,0,"/",0,-1,-4,-1,0,"/",0,-1,-4,-5,-4,-1,0,"/",-12,-1,-4,-5,-7,-5,-4,-1,0],
        desc: "" },
      { id: "ce1783302233356", name: "Single Step High", latin: "", group: 8,
        notes: [12,"/",12,13,12,"/",12,13,16,13,12,"/",12,13,16,17,16,13,12,"/",12,13,16,17,19,17,16,13,12],
        desc: "" },
      { id: "ce1783302457361", name: "Single Step Lower Mix", latin: "", group: 8,
        notes: [0,"/",0,1,0,-1,-12,"/",0,1,4,1,0,-1,-4,-1,0,"/",0,1,4,5,4,1,0,-1,-4,-5,-4,-1,0,"/",0,1,4,5,7,5,4,1,0,-1,-4,-5,-7,-5,-4,-1,0],
        desc: "" },
    ],
  },
};

const EXERCISE_INFO = [
  { name: "ജതിസ്വരം", latin: "Jathiswaram",
    text: "സ്വരങ്ങൾ കൊണ്ട് മാത്രം രചിച്ച സംഗീത രചന — സാഹിത്യം (വരികൾ) ഇല്ല. പല്ലവി, അനുപല്ലവി, ചരണം എന്നീ ഭാഗങ്ങൾ. ചിലപ്പോൾ ജതികൾ (തക, തകിട മുതലായവ) ഉൾപ്പെടും. അലങ്കാരം കഴിഞ്ഞ് താളബോധവും രാഗഭാവവും വളർത്താൻ പഠിക്കുന്നു." },
  { name: "സ്വരജതി", latin: "Swarajathi",
    text: "സ്വരങ്ങൾക്കൊപ്പം സാഹിത്യവും (വരികളും) ഉള്ള രചന. ഭാവപ്രകടനത്തിന് കൂടുതൽ സാധ്യത. വർണത്തിലേക്കും കൃതികളിലേക്കും കടക്കുന്നതിന് മുമ്പുള്ള പ്രധാന ഘട്ടം. (ഉദാ: 'രാവേ ഹിമഗിരി കുമാരി' — കല്യാണി)." },
];

// Raga transposition for exercises. Exercises are authored in Mayamalavagowla
// degrees; we map each note to a scale degree, then to the chosen raga's
// 7-note ascending scale. Only sampoorna (7-note) ragas are offered so every
// varisai degree has a target.
const MAYA_SCALE = [0, 1, 4, 5, 7, 8, 11];
const EXERCISE_RAGAS = [
  { id: "mayamalavagowla", name: "മായാമാളവഗൗള", latin: "Mayamalavagowla", scale: [0,1,4,5,7,8,11] },
  { id: "sankarabharanam", name: "ധീരശങ്കരാഭരണം", latin: "Sankarabharanam", scale: [0,2,4,5,7,9,11] },
  { id: "kalyani", name: "മേചകല്യാണി", latin: "Kalyani", scale: [0,2,4,6,7,9,11] },
  { id: "kharaharapriya", name: "ഖരഹരപ്രിയ", latin: "Kharaharapriya", scale: [0,2,3,5,7,9,10] },
  { id: "harikambhoji", name: "ഹരികാംഭോജി", latin: "Harikambhoji", scale: [0,2,4,5,7,9,10] },
  { id: "todi", name: "ഹനുമതോടി", latin: "Todi", scale: [0,1,3,5,7,8,10] },
  { id: "natabhairavi", name: "നഠഭൈരവി", latin: "Natabhairavi", scale: [0,2,3,5,7,8,10] },
];
function mayaToDegree(semi) {
  const oct = Math.floor(semi / 12);
  const rem = ((semi % 12) + 12) % 12;
  let idx = MAYA_SCALE.indexOf(rem);
  if (idx < 0) idx = 0;
  return oct * 7 + idx;
}
function degreeToSemi(deg, scale) {
  const oct = Math.floor(deg / 7);
  const within = ((deg % 7) + 7) % 7;
  return oct * 12 + scale[within];
}
function transposeExercise(notes, scale) {
  return notes.map(n => ((n === "h" || n === "r" || n === "|" || n === "||" || n === "/") ? n : degreeToSemi(mayaToDegree(n), scale)));
}

// ---------------------------------------------------------------------------
//  72 MELAKARTHA RAGAS  (generated programmatically; each is sampoorna with
//  identical aro/ava using R-G × D-N combinations and M1 / M2)
// ---------------------------------------------------------------------------
const MELA_NAMES = [
  "Kanakangi","Ratnangi","Ganamurti","Vanaspati","Manavati","Tanarupi",
  "Senavati","Hanumatodi","Dhenuka","Natakapriya","Kokilapriya","Rupavati",
  "Gayakapriya","Vakulabharanam","Mayamalavagowla","Chakravakam","Suryakantam","Hatakambari",
  "Jhankaradhwani","Natabhairavi","Keeravani","Kharaharapriya","Gourimanohari","Varunapriya",
  "Mararanjani","Charukesi","Sarasangi","Harikambhoji","Dheerashankarabharanam","Naganandini",
  "Yagapriya","Ragavardhini","Gangeyabhushani","Vagadheeswari","Shulini","Chalanata",
  "Salagam","Jalarnavam","Jhalavarali","Navaneetam","Pavani","Raghupriya",
  "Gavambhodi","Bhavapriya","Shubhapantuvarali","Shadvidamargini","Suvarnangi","Divyamani",
  "Dhavalambari","Namanarayani","Kamavardhini","Ramapriya","Gamanashrama","Vishwambhari",
  "Shamalangi","Shanmukhapriya","Simhendramadhyamam","Hemavati","Dharmavati","Neetimati",
  "Kantamani","Rishabhapriya","Latangi","Vachaspati","Mechakalyani","Chitrambari",
  "Sucharitra","Jyotiswarupini","Dhatuvardhini","Nasikabhushani","Kosalam","Rasikapriya"
];
// Malayalam names for all 72 melakartha
const MELA_NAMES_ML = [
  "കനകാംഗി","രത്നാംഗി","ഗാനമൂർത്തി","വനസ്പതി","മാനവതി","താനരൂപി",
  "സേനാവതി","ഹനുമതോടി","ധേനുക","നാടകപ്രിയ","കോകിലപ്രിയ","രൂപവതി",
  "ഗായകപ്രിയ","വകുളാഭരണം","മായാമാളവഗൗള","ചക്രവാകം","സൂര്യകാന്തം","ഹാടകാംബരി",
  "ഝങ്കാരധ്വനി","നഠഭൈരവി","കീരവാണി","ഖരഹരപ്രിയ","ഗൗരിമനോഹരി","വരുണപ്രിയ",
  "മാരരഞ്ജനി","ചാരുകേശി","സരസാംഗി","ഹരികാംഭോജി","ധീരശങ്കരാഭരണം","നാഗനന്ദിനി",
  "യാഗപ്രിയ","രാഗവർദ്ധിനി","ഗാംഗേയഭൂഷണി","വാഗധീശ്വരി","ശൂലിനി","ചലനാട്ട",
  "സാലഗം","ജലാർണവം","ഝാലവരാളി","നവനീതം","പാവനി","രഘുപ്രിയ",
  "ഗവാംബോധി","ഭവപ്രിയ","ശുഭപന്തുവരാളി","ഷഡ്വിധമാർഗിണി","സുവർണാംഗി","ദിവ്യമണി",
  "ധവളാംബരി","നാമനാരായണി","കാമവർദ്ധിനി","രാമപ്രിയ","ഗമനശ്രമ","വിശ്വംഭരി",
  "ശ്യാമളാംഗി","ഷണ്മുഖപ്രിയ","സിംഹേന്ദ്രമധ്യമം","ഹേമവതി","ധർമവതി","നീതിമതി",
  "കാന്താമണി","ഋഷഭപ്രിയ","ലതാംഗി","വാചസ്പതി","മേചകല്യാണി","ചിത്രാംബരി",
  "സുചരിത്ര","ജ്യോതിസ്വരൂപിണി","ധാതുവർദ്ധിനി","നാസികാഭൂഷണി","കോസലം","രസികപ്രിയ"
];
const _RG = [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]; // (R,G) semitones
const _DN = [[8,9],[8,10],[8,11],[9,10],[9,11],[10,11]]; // (D,N) semitones
const MELAKARTHA = (function(){
  // role-aware swara token: subscript depends on which slot (Ri/Ga/Ma/Da/Ni) it is
  const SUB = { R:{1:"₁",2:"₂",3:"₃"}, G:{2:"₁",3:"₂",4:"₃"}, M:{5:"₁",6:"₂"}, D:{8:"₁",9:"₂",10:"₃"}, N:{9:"₁",10:"₂",11:"₃"} };
  const BASE = { S:"സ", R:"രി", G:"ഗ", M:"മ", P:"പ", D:"ധ", N:"നി" };
  const ROLES = ["S","R","G","M","P","D","N","S"];
  function toks(scale){
    return scale.map((off, i) => {
      const role = ROLES[i];
      const up = off >= 12;
      const o = ((off % 12) + 12) % 12;
      const sub = (role === "S" || role === "P") ? "" : (SUB[role][o] || "");
      return { base: BASE[role], sub, up, down: false, key: i };
    });
  }
  const list = [];
  for (let i = 0; i < 72; i++) {
    const M = i >= 36 ? 6 : 5; // M1=5, M2=6
    const block = i % 36;
    const rg = _RG[Math.floor(block / 6)];
    const dn = _DN[block % 6];
    const aro = [0, rg[0], rg[1], M, 7, dn[0], dn[1], 12];
    const ava = aro.slice().reverse();
    const latin = MELA_NAMES[i];
    const aroToks = toks(aro);
    const avaToks = aroToks.slice().reverse().map((t, k) => Object.assign({}, t, { key: k }));
    list.push({ mela: i + 1, id: latin.toLowerCase(), latin, name: MELA_NAMES_ML[i], scale: aro.slice(0, 7), aro, ava, aroToks, avaToks });
  }
  return list;
})();

window.SwsAudio = { SWARAS, swaraLabel, freqToSwara, RAGAS, ragaPositionSet, identifyRaga, autoCorrelate, AudioEngine, EXERCISES, EXERCISE_INFO, EXERCISE_RAGAS, transposeExercise, MELAKARTHA };
})();
