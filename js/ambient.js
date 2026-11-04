// Ambientes para estudiar, generados en vivo con Web Audio (sin archivos de audio):
// fogata, lluvia, bosque de noche, arroyo, olas, viento. Funcionan sin internet.
let ctx = null, master = null, current = null, vol = +(localStorage.getItem('ambVol') || .6);
const subs = new Set();
export const onAmbient = fn => { subs.add(fn); fn(state()); return () => subs.delete(fn); };
const state = () => ({ playing: current?.k || null, vol });
const emit = () => subs.forEach(f => f(state()));

export const AMBIENTS = [
  { k: 'fogata', name: 'Fogata', icon: 'fire' },
  { k: 'fogata-lluvia', name: 'Fogata con lluvia', icon: 'fire' },
  { k: 'bosque', name: 'Noche en el bosque', icon: 'moon' },
  { k: 'arroyo', name: 'Arroyo', icon: 'water' },
  { k: 'olas', name: 'Olas del mar', icon: 'wave' },
  { k: 'lluvia', name: 'Lluvia suave', icon: 'rain' },
  { k: 'viento', name: 'Viento en los árboles', icon: 'wind' },
];

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  window.__ambDbg = () => ({ ctx, master });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && current && ctx.state === 'suspended') ctx.resume(); });
}

// ---------- ruidos base ----------
const buffers = {};
function noise(type) {
  if (buffers[type]) return buffers[type];
  const n = ctx.sampleRate * 6, b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * .5;
      else if (type === 'pink') {
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }   // marrón
    }
  }
  return (buffers[type] = b);
}
function loop(type, out, gain = 1) {
  const s = ctx.createBufferSource(); s.buffer = noise(type); s.loop = true;
  s.loopStart = Math.random() * 2; s.playbackRate.value = .97 + Math.random() * .06;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(g).connect(out); s.start(0, Math.random() * 5);
  return { s, g };
}
function filt(type, f, q = .7) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
// modulación lenta y aleatoria de un parámetro (respira como algo natural)
function wander(param, lo, hi, secs, timers) {
  const step = () => {
    const t = ctx.currentTime, d = secs * (.6 + Math.random() * .8);
    param.linearRampToValueAtTime(lo + Math.random() * (hi - lo), t + d);
    timers.push(setTimeout(step, d * 1000));
  };
  step();
}
function every(min, max, fn, timers) {
  const go = () => { fn(); timers.push(setTimeout(go, (min + Math.random() * (max - min)) * 1000)); };
  timers.push(setTimeout(go, Math.random() * max * 1000));
}

// ---------- capas ----------
function fire(out, T, amt = 1) {
  // rumor grave de las llamas
  const lp = filt('lowpass', 380); lp.connect(out);
  const r = loop('brown', lp, .55 * amt); wander(r.g.gain, .3 * amt, .7 * amt, 1.6, T);
  // siseo suave de la leña
  const hp = filt('bandpass', 3800, .6); hp.connect(out);
  const s = loop('pink', hp, .05 * amt); wander(s.g.gain, .02 * amt, .08 * amt, .9, T);
  // chasquidos: grupos de crujidos cortos, a veces un "pop" más fuerte
  const crackle = (strong) => {
    const t = ctx.currentTime, n = strong ? 1 : 1 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const st = t + i * (.008 + Math.random() * .05);
      const src = ctx.createBufferSource(); src.buffer = noise('white');
      const bp = filt('bandpass', strong ? 700 + Math.random() * 900 : 1800 + Math.random() * 4500, strong ? 1.2 : 2.5);
      const g = ctx.createGain(), pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - .5) * .9;
      const a = (strong ? .9 : .25 + Math.random() * .5) * amt, dur = strong ? .09 : .006 + Math.random() * .025;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(a, st + .001); g.gain.exponentialRampToValueAtTime(.0005, st + dur);
      src.connect(bp).connect(g).connect(pan).connect(out);
      src.start(st, Math.random() * 5, dur + .02);
    }
  };
  every(.05, .55, () => crackle(false), T);
  every(2.5, 9, () => crackle(true), T);
}
function rain(out, T, amt = 1) {
  const bp = filt('bandpass', 2200, .4); bp.connect(out);
  const r = loop('pink', bp, .5 * amt); wander(r.g.gain, .35 * amt, .6 * amt, 4, T);
  const lp = filt('lowpass', 900); lp.connect(out);
  loop('brown', lp, .18 * amt);
  // gotas sueltas cerca
  every(.08, .5, () => {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.setValueAtTime(1800 + Math.random() * 2400, t); o.frequency.exponentialRampToValueAtTime(600, t + .03);
    pan.pan.value = Math.random() * 2 - 1;
    g.gain.setValueAtTime(.025 * amt * Math.random(), t); g.gain.exponentialRampToValueAtTime(.0001, t + .04);
    o.connect(g).connect(pan).connect(out); o.start(t); o.stop(t + .05);
  }, T);
}
function wind(out, T, amt = 1) {
  const bp = filt('bandpass', 500, 1.2); bp.connect(out);
  const w = loop('pink', bp, .6 * amt);
  wander(bp.frequency, 250, 900, 5, T); wander(w.g.gain, .2 * amt, .75 * amt, 4, T);
}
function crickets(out, T) {
  const voice = (f, rate, panv) => {
    const pan = ctx.createStereoPanner(); pan.pan.value = panv; pan.connect(out);
    every(rate * .7, rate * 1.6, () => {
      const t = ctx.currentTime, pulses = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pulses; i++) {
        const st = t + i * .045, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f * (1 + (Math.random() - .5) * .01);
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.09, st + .008); g.gain.linearRampToValueAtTime(0, st + .03);
        o.connect(g).connect(pan); o.start(st); o.stop(st + .04);
      }
    }, T);
  };
  voice(4300, .9, -.6); voice(4700, 1.3, .5); voice(3900, 2.2, .1); voice(5100, 3.1, -.2);
  wind(out, T, .35);
  // un búho lejano de vez en cuando
  every(25, 60, () => {
    const t = ctx.currentTime;
    [0, .45, .62].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(i ? 390 : 420, t + d); o.frequency.linearRampToValueAtTime(i ? 360 : 400, t + d + .3);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.03, t + d + .05); g.gain.linearRampToValueAtTime(0, t + d + (i ? .25 : .35));
      o.connect(g).connect(out); o.start(t + d); o.stop(t + d + .4);
    });
  }, T);
}
function stream(out, T) {
  [600, 1100, 1700, 2600].forEach((f, i) => {
    const bp = filt('bandpass', f, 3 + i); const pan = ctx.createStereoPanner(); pan.pan.value = [-.6, .4, -.2, .6][i];
    bp.connect(pan).connect(out);
    const s = loop(i % 2 ? 'white' : 'pink', bp, [.5, .25, .18, .1][i]);
    wander(bp.frequency, f * .7, f * 1.4, .25 + i * .1, T); wander(s.g.gain, .05, [.5, .3, .2, .12][i], .3, T);
  });
  const lp = filt('lowpass', 500); lp.connect(out); loop('brown', lp, .25);
}
function waves(out, T) {
  const lp = filt('lowpass', 600); lp.connect(out);
  const s = loop('pink', lp, .0); const b = loop('brown', lp, .0);
  const swell = () => {
    const t = ctx.currentTime, up = 3 + Math.random() * 2, down = 4 + Math.random() * 3;
    [s.g.gain, b.g.gain].forEach((p, i) => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(i ? .5 : .55, t + up); p.linearRampToValueAtTime(.06, t + up + down); });
    lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + up); lp.frequency.linearRampToValueAtTime(450, t + up + down);
    T.push(setTimeout(swell, (up + down + Math.random()) * 1000));
  };
  swell();
}

const RECIPES = {
  'fogata': (o, T) => { fire(o, T); wind(o, T, .15); },
  'fogata-lluvia': (o, T) => { fire(o, T, .85); rain(o, T, .6); },
  'bosque': (o, T) => crickets(o, T),
  'arroyo': (o, T) => { stream(o, T); crickets(o, T); },
  'olas': (o, T) => { waves(o, T); wind(o, T, .2); },
  'lluvia': (o, T) => rain(o, T),
  'viento': (o, T) => wind(o, T),
};

export function play(k) {
  init();
  if (ctx.state === 'suspended') ctx.resume();
  if (current?.k === k) return;
  stop(true);
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master);
  const T = [];
  RECIPES[k](bus, T);
  const t = ctx.currentTime;
  bus.gain.linearRampToValueAtTime(1, t + 2.5);            // entra suave
  master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(vol, t + .4);
  current = { k, bus, T };
  localStorage.setItem('ambLast', k);
  emit();
}
export function stop(quick) {
  if (!current) return;
  const { bus, T } = current; current = null;
  T.forEach(clearTimeout);
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + (quick ? .6 : 1.8));
  setTimeout(() => bus.disconnect(), quick ? 800 : 2000);
  emit();
}
export function toggle() { current ? stop() : play(localStorage.getItem('ambLast') || 'fogata'); }
export function setVolume(v) {
  vol = Math.max(0, Math.min(1, +v.toFixed(2))); localStorage.setItem('ambVol', vol);
  if (ctx && current) master.gain.setTargetAtTime(vol, ctx.currentTime, .1);
  emit();
}
export const volume = () => vol;
export const playing = () => current?.k || null;
