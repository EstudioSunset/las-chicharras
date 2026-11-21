// Sonido sintetizado (sin archivos): el canto de las chicharras y los pasos.
export class Sonido {
  constructor() { this.ctx = null; this.silencio = false; }

  iniciar() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    // ruido blanco reutilizable
    const len = ctx.sampleRate * 2;
    this.ruido = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.chicharra(4700, 27, -0.6);
    this.chicharra(3900, 21, 0.7);
    this.viento();
  }

  chicharra(freq, pulso, pan) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.ruido; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 9;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = pulso;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(am.gain);
    const ola = ctx.createGain(); ola.gain.value = 0.0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp).connect(am).connect(ola);
    if (p) { p.pan.value = pan; ola.connect(p).connect(this.master); } else ola.connect(this.master);
    src.start(); lfo.start();
    // el canto sube y baja como lo hacen las chicharras en la tarde
    const ciclo = () => {
      const t = ctx.currentTime;
      const fuerte = Math.random() < 0.55;
      ola.gain.setTargetAtTime(fuerte ? 0.18 + Math.random() * 0.2 : 0.01, t, fuerte ? 1.2 : 0.8);
      lfo.frequency.setTargetAtTime(pulso * (0.9 + Math.random() * 0.25), t, 0.5);
      setTimeout(ciclo, 2500 + Math.random() * 5000);
    };
    setTimeout(ciclo, 600 + Math.random() * 1500);
  }

  viento() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.ruido; src.loop = true; src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master); src.start();
  }

  paso(fuerza = 1) {
    if (!this.ctx || this.silencio) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.ruido;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + Math.random() * 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * fuerza, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, 0.16);
  }

  alternar() {
    this.silencio = !this.silencio;
    if (this.master) this.master.gain.setTargetAtTime(this.silencio ? 0 : 0.55, this.ctx.currentTime, 0.1);
    return this.silencio;
  }

  pausar(p) { if (this.ctx) (p ? this.ctx.suspend() : this.ctx.resume()); }
}
