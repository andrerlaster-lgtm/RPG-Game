'use strict';

// Sound and music.
// - Recorded effects: Kenney's RPG Audio, Interface Sounds and Music Jingles (CC0), converted to AAC.
// - Generated effects (Bfxr/jfxr-style: noise, filters, envelopes) for things with no recording.
// - Generated music: a quiet night soundscape for the streets and a driving loop for battles.
// Everything goes through one master gain that follows Options > Volume and Options > Music.

const SAMPLE_NAMES = [
  'step1', 'step2', 'step3', 'step4', 'coins', 'coins2', 'draw', 'slice', 'slice2', 'chop', 'clang', 'thud',
  'cloth', 'cloth2', 'latch', 'creak', 'book', 'belt',
  'uiMove', 'uiConfirm', 'uiBack', 'uiError', 'uiOpen', 'uiClose', 'uiToggle', 'uiTick',
  'jVictory', 'jLevel', 'jComplete', 'jCaught', 'jSpotted'
];
const SAMPLES = {};
const AUD = { ctx: null, sfxBus: null, musicBus: null, loaded: false, music: null, musicKind: null };

function initAudio() {
  if (AUD.ctx) { if (AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
  try { AUD.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  audio = AUD.ctx; // the simple beeps in game.js share this context
  AUD.sfxBus = AUD.ctx.createGain();
  AUD.musicBus = AUD.ctx.createGain();
  AUD.sfxBus.connect(AUD.ctx.destination);
  AUD.musicBus.connect(AUD.ctx.destination);
  applyVolumes();
  if (!AUD.loaded) {
    AUD.loaded = true;
    SAMPLE_NAMES.forEach((name) => {
      fetch(`audio/${name}.m4a`)
        .then((r) => r.arrayBuffer())
        .then((buf) => AUD.ctx.decodeAudioData(buf))
        .then((decoded) => { SAMPLES[name] = decoded; })
        .catch(() => { /* falls back to a generated sound */ });
    });
  }
}

function applyVolumes() {
  if (!AUD.ctx) return;
  const t = AUD.ctx.currentTime;
  AUD.sfxBus.gain.setTargetAtTime(SETTINGS.volume, t, 0.05);
  AUD.musicBus.gain.setTargetAtTime(SETTINGS.volume * SETTINGS.music * 0.6, t, 0.2);
}

// ---------- One-shot effects ----------
const SYNTH = {
  swish: () => noiseBurst({ dur: 0.18, from: 2600, to: 900, q: 1.2, vol: 0.35, type: 'bandpass' }),
  thump: () => { noiseBurst({ dur: 0.12, from: 220, to: 90, q: 0.7, vol: 0.6, type: 'lowpass' }); tone(90, 0.16, 'sine', 0.35, -40); },
  card: () => noiseBurst({ dur: 0.07, from: 4200, to: 3000, q: 2, vol: 0.25, type: 'bandpass' }),
  rustle: () => noiseBurst({ dur: 0.25, from: 1800, to: 1200, q: 0.8, vol: 0.18, type: 'bandpass' }),
  fire: () => { noiseBurst({ dur: 0.5, from: 600, to: 2400, q: 0.6, vol: 0.45, type: 'lowpass' }); tone(160, 0.4, 'sawtooth', 0.12, -60); },
  ice: () => { [1600, 2100, 2700, 3300].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12, 300), i * 45)); },
  heal: () => { [660, 880, 990, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.12), i * 70)); },
  smoke: () => { noiseBurst({ dur: 0.08, from: 900, to: 300, q: 0.7, vol: 0.7, type: 'lowpass' }); noiseBurst({ dur: 0.7, from: 1200, to: 400, q: 0.5, vol: 0.25, type: 'lowpass', delay: 0.05 }); },
  encounter: () => { [220, 330, 440, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.12), i * 60)); noiseBurst({ dur: 0.4, from: 400, to: 4000, q: 0.5, vol: 0.2, type: 'bandpass' }); },
  miss: () => tone(300, 0.12, 'triangle', 0.15, -120),
  ko: () => { tone(160, 0.3, 'sawtooth', 0.12, -90); noiseBurst({ dur: 0.2, from: 300, to: 120, q: 0.7, vol: 0.3, type: 'lowpass', delay: 0.05 }); }
};

function play(name, { vol = 1, rate = 1, delay = 0 } = {}) {
  if (!AUD.ctx || SETTINGS.volume <= 0) return;
  const s = SAMPLES[name];
  if (s) {
    const src = AUD.ctx.createBufferSource();
    const g = AUD.ctx.createGain();
    src.buffer = s;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08); // tiny variation so repeats don't sound robotic
    g.gain.value = vol;
    src.connect(g).connect(AUD.sfxBus);
    src.start(AUD.ctx.currentTime + delay);
    return;
  }
  if (SYNTH[name]) { if (delay) setTimeout(SYNTH[name], delay * 1000); else SYNTH[name](); }
}
const playStep = (sprint) => play(`step${1 + Math.floor(Math.random() * 4)}`, { vol: sprint ? 0.55 : 0.28, rate: sprint ? 1.08 : 1 });

function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  if (!AUD.ctx) return;
  const t = AUD.ctx.currentTime + delay;
  const o = AUD.ctx.createOscillator();
  const g = AUD.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AUD.sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuffer = null;
function getNoise() {
  if (noiseBuffer) return noiseBuffer;
  const len = AUD.ctx.sampleRate * 2;
  noiseBuffer = AUD.ctx.createBuffer(1, len, AUD.ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}
function noiseBurst({ dur, from, to, q = 1, vol = 0.3, type = 'bandpass', delay = 0, bus }) {
  if (!AUD.ctx) return;
  const t = AUD.ctx.currentTime + delay;
  const src = AUD.ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const f = AUD.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = AUD.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus || AUD.sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

// ---------- Music ----------
// Two generated pieces, scheduled a little ahead of time with the audio clock.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const MUSIC = {
  // Night streets: river hum + a far-off Lantern Quarter band (soft, filtered, slow).
  night: {
    bpm: 84,
    chords: [[50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64]], // Dm7, Gm7, C7, Fmaj7
    bass: [38, 45, 43, 38, 43, 50, 36, 43, 41, 48],
    melody: [69, null, 72, 70, null, 67, null, 65, 67, null, null, 62, 65, null, 64, null],
    filter: 900, swing: 0.62
  },
  // Battle: driving minor loop with snare hits.
  battle: {
    bpm: 148,
    chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]], // Am, F, G, E
    bass: [33, 33, 45, 33, 29, 29, 41, 29, 31, 31, 43, 31, 28, 28, 40, 32],
    melody: [76, 74, 72, 74, 76, null, 76, 77, 79, 77, 76, 74, 72, null, 71, 72],
    filter: 3200, swing: 0.5
  }
};

function setMusic(kind) {
  if (!AUD.ctx) return;
  if (AUD.musicKind === kind) return;
  stopMusic();
  AUD.musicKind = kind;
  if (!kind) return;
  const def = MUSIC[kind];
  const bus = AUD.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, AUD.ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(1, AUD.ctx.currentTime + 1.2);
  const lp = AUD.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = def.filter;
  bus.connect(lp).connect(AUD.musicBus);
  const m = { kind, def, bus, step: 0, next: AUD.ctx.currentTime + 0.1, timer: 0, river: null };
  if (kind === 'night') m.river = startRiver(bus);
  m.timer = setInterval(() => scheduleMusic(m), 50);
  AUD.music = m;
}

function stopMusic() {
  const m = AUD.music;
  if (!m) return;
  clearInterval(m.timer);
  const t = AUD.ctx.currentTime;
  m.bus.gain.cancelScheduledValues(t);
  m.bus.gain.setValueAtTime(Math.max(0.0001, m.bus.gain.value), t);
  m.bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  if (m.river) setTimeout(() => { try { m.river.stop(); } catch { /* already stopped */ } }, 700);
  AUD.music = null;
  AUD.musicKind = null;
}

function startRiver(bus) {
  const src = AUD.ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const f = AUD.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const g = AUD.ctx.createGain();
  g.gain.value = 0.05;
  const lfo = AUD.ctx.createOscillator();
  const lfoGain = AUD.ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(f).connect(g).connect(bus);
  src.start();
  lfo.start();
  return { stop: () => { src.stop(); lfo.stop(); } };
}

function musicNote(bus, freq, t, dur, type, vol) {
  const o = AUD.ctx.createOscillator();
  const g = AUD.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleMusic(m) {
  if (AUD.music !== m) return;
  const ctxNow = AUD.ctx.currentTime;
  const beat = 60 / m.def.bpm;
  const eighth = beat / 2;
  while (m.next < ctxNow + 0.25) {
    const i = m.step;
    const swing = i % 2 === 1 ? (m.def.swing - 0.5) * eighth : 0;
    const t = m.next + swing;
    const bar = Math.floor(i / 8) % m.def.chords.length;
    const chord = m.def.chords[bar];
    if (m.kind === 'night') {
      if (i % 8 === 0) chord.forEach((n) => musicNote(m.bus, NOTE(n), t, beat * 3.6, 'triangle', 0.025));
      if (i % 2 === 0) musicNote(m.bus, NOTE(m.def.bass[(i / 2) % m.def.bass.length]), t, beat * 0.9, 'sine', 0.06);
      const mel = m.def.melody[i % m.def.melody.length];
      if (mel && Math.floor(i / 16) % 2 === 1) musicNote(m.bus, NOTE(mel), t, beat * 0.8, 'triangle', 0.03);
    } else {
      musicNote(m.bus, NOTE(m.def.bass[i % m.def.bass.length]), t, eighth * 0.9, 'sawtooth', 0.05);
      if (i % 4 === 0) chord.forEach((n) => musicNote(m.bus, NOTE(n + 12), t, beat * 1.6, 'square', 0.012));
      const mel = m.def.melody[i % m.def.melody.length];
      if (mel && Math.floor(i / 16) % 2 === 1) musicNote(m.bus, NOTE(mel), t, eighth * 0.95, 'square', 0.025);
      if (i % 4 === 2) noiseBurst({ dur: 0.12, from: 2600, to: 1400, q: 0.8, vol: 0.09, type: 'bandpass', delay: Math.max(0, t - ctxNow), bus: m.bus });
      if (i % 4 === 0) musicNote(m.bus, 70, t, 0.14, 'sine', 0.09);
    }
    m.step += 1;
    m.next += eighth;
  }
}

// Pause music with the game; resume afterwards.
function suspendMusic(paused) {
  if (!AUD.music) return;
  const t = AUD.ctx.currentTime;
  AUD.music.bus.gain.cancelScheduledValues(t);
  AUD.music.bus.gain.setTargetAtTime(paused ? 0.0001 : 1, t, 0.15);
}
