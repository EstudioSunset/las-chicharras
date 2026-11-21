// Controles: palanca táctil (mitad izquierda), arrastrar para mirar (mitad derecha),
// teclado + ratón en computadora.
export class Controles {
  constructor(capa, stick, knob, acciones = {}) {
    this.capa = capa; this.stick = stick; this.knob = knob; this.acciones = acciones;
    this.yaw = 0; this.pitch = 0;
    this.joy = { x: 0, y: 0 };
    this.teclas = new Set();
    this.activo = true;
    this.stickId = null; this.lookId = null;
    this.ultimo = { x: 0, y: 0 };
    this.mirando = false; // el usuario giró la cámara en este cuadro
    this.radio = 52;

    capa.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => this.tecla(e, true));
    window.addEventListener('keyup', (e) => this.tecla(e, false));
    window.addEventListener('blur', () => { this.teclas.clear(); this.soltarStick(); });
    capa.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    if (!this.activo) return;
    const izquierda = e.clientX < window.innerWidth * 0.45;
    if (e.pointerType !== 'mouse' && izquierda && this.stickId === null) {
      this.stickId = e.pointerId;
      this.base = { x: e.clientX, y: e.clientY };
      this.stick.style.left = e.clientX + 'px';
      this.stick.style.top = e.clientY + 'px';
      this.stick.classList.add('activo');
      this.knob.style.transform = 'translate(-50%,-50%)';
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.ultimo = { x: e.clientX, y: e.clientY };
    }
    this.acciones.primerToque?.();
  }

  move(e) {
    if (e.pointerId === this.stickId) {
      let dx = e.clientX - this.base.x, dy = e.clientY - this.base.y;
      const d = Math.hypot(dx, dy), R = this.radio;
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.joy.x = dx / R; this.joy.y = dy / R;
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      e.preventDefault();
    } else if (e.pointerId === this.lookId) {
      const k = e.pointerType === 'mouse' ? 0.0042 : 0.0062;
      this.yaw -= (e.clientX - this.ultimo.x) * k;
      this.pitch -= (e.clientY - this.ultimo.y) * k;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
      this.ultimo = { x: e.clientX, y: e.clientY };
      this.mirando = true;
      e.preventDefault();
    }
  }

  up(e) {
    if (e.pointerId === this.stickId) this.soltarStick();
    if (e.pointerId === this.lookId) this.lookId = null;
  }

  soltarStick() {
    this.stickId = null; this.joy.x = 0; this.joy.y = 0;
    this.stick.classList.remove('activo');
  }

  tecla(e, abajo) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (abajo && !e.repeat) {
      if (k === 'e' || k === 'enter') this.acciones.interactuar?.();
      if (k === 't' || k === 'q') this.acciones.era?.();
      if (k === 'm') this.acciones.mapa?.();
      if (k === 'escape') this.acciones.cerrar?.();
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      if (abajo) this.teclas.add(k); else this.teclas.delete(k);
      e.preventDefault();
    }
  }

  // Devuelve { adelante, lado, correr } en el rango -1..1
  leer(dt) {
    let adelante = -this.joy.y, lado = this.joy.x;
    const t = this.teclas;
    if (!this.activo) return { adelante: 0, lado: 0, correr: false };
    if (t.has('w') || t.has('arrowup')) adelante += 1;
    if (t.has('s') || t.has('arrowdown')) adelante -= 1;
    if (t.has('a')) lado -= 1;
    if (t.has('d')) lado += 1;
    if (t.has('arrowleft')) this.yaw += 1.9 * dt;
    if (t.has('arrowright')) this.yaw -= 1.9 * dt;
    const m = Math.hypot(adelante, lado);
    if (m > 1) { adelante /= m; lado /= m; }
    const correr = t.has('shift') || Math.hypot(this.joy.x, this.joy.y) > 0.97;
    return { adelante, lado, correr };
  }
}
