// Texturas generadas en el navegador (canvas): carga inicial ligera, sin descargar imágenes.
import * as THREE from 'three';

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// pseudoaleatorio determinista para que el pueblo sea igual en cada visita
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ruido(ctx, w, h, n, colores, tam = [1, 3], alpha = 0.35, seed = 7) {
  const r = rng(seed);
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colores[(r() * colores.length) | 0];
    const s = tam[0] + r() * (tam[1] - tam[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function tex(c, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function concreto() {
  const [c, x] = lienzo(256, 256);
  x.fillStyle = '#b9b5ac'; x.fillRect(0, 0, 256, 256);
  ruido(x, 256, 256, 2500, ['#a7a39a', '#c9c5bc', '#9d998f', '#d2cec4'], [1, 3], 0.4, 3);
  // juntas de colado cada ~3 m (la textura cubre 6 m)
  x.strokeStyle = 'rgba(70,65,58,0.45)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 128); x.lineTo(256, 128); x.moveTo(0, 1); x.lineTo(256, 1); x.stroke();
  x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.stroke();
  // manchas
  ruido(x, 256, 256, 40, ['#8f8a80', '#a39f95'], [8, 26], 0.12, 9);
  return tex(c);
}

export function tierra() {
  const [c, x] = lienzo(256, 256);
  x.fillStyle = '#9c7a57'; x.fillRect(0, 0, 256, 256);
  ruido(x, 256, 256, 4000, ['#8a6a4b', '#b08c66', '#7d6045', '#c29d74', '#6e5640'], [1, 3], 0.45, 11);
  ruido(x, 256, 256, 60, ['#80644a', '#a98763'], [10, 30], 0.15, 12);
  return tex(c);
}

export function pasto() {
  const [c, x] = lienzo(256, 256);
  x.fillStyle = '#5f7a3a'; x.fillRect(0, 0, 256, 256);
  ruido(x, 256, 256, 5000, ['#4f6a2f', '#6f8b45', '#7a8f4a', '#566f33', '#8a8a55'], [1, 3], 0.5, 21);
  ruido(x, 256, 256, 50, ['#7d6a48', '#4a6230'], [12, 40], 0.16, 22);
  return tex(c);
}

export function plaza() {
  const [c, x] = lienzo(256, 256);
  x.fillStyle = '#b77a63'; x.fillRect(0, 0, 256, 256);
  const r = rng(31);
  // losetas de 50 cm (8 × 8 en 4 m)
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const k = 0.9 + r() * 0.2;
    x.fillStyle = `rgb(${(183 * k) | 0},${(122 * k) | 0},${(99 * k) | 0})`;
    x.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
  }
  ruido(x, 256, 256, 1500, ['#a06a55', '#c88d74'], [1, 2], 0.3, 32);
  return tex(c);
}

export function lamina() {
  const [c, x] = lienzo(128, 64);
  for (let i = 0; i < 128; i++) {
    const v = 0.78 + 0.22 * Math.sin((i / 128) * Math.PI * 2 * 8);
    const g = (235 * v) | 0;
    x.fillStyle = `rgb(${g},${g},${g})`;
    x.fillRect(i, 0, 1, 64);
  }
  ruido(x, 128, 64, 120, ['#9a8f84', '#c7c0b8', '#a07a5c'], [1, 4], 0.25, 41);
  return tex(c);
}

export function teja() {
  const [c, x] = lienzo(128, 128);
  x.fillStyle = '#a95a3d'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      const off = (j % 2) * 8;
      const g = x.createLinearGradient(i * 16 + off, 0, i * 16 + off + 16, 0);
      g.addColorStop(0, '#7e3f2a'); g.addColorStop(0.5, '#c4704f'); g.addColorStop(1, '#7e3f2a');
      x.fillStyle = g; x.fillRect(i * 16 + off - 16, j * 16, 16, 15);
      x.fillRect(i * 16 + off, j * 16, 16, 15);
    }
  }
  return tex(c);
}

// Atlas de fachadas (4 mosaicos). El color del muro se aplica por vértice (multiplica).
// 0: muro liso · 1: puerta + ventana · 2: ventana, puerta, ventana · 3: tienda con cortina · 4: tres ventanas (planta alta)
export function atlasFachadas() {
  const T = 256;
  const [c, x] = lienzo(T * 5, T);
  const r = rng(51);
  for (let t = 0; t < 5; t++) {
    const ox = t * T;
    x.fillStyle = '#f2efe8'; x.fillRect(ox, 0, T, T);
    // repellado
    x.globalAlpha = 0.25;
    for (let i = 0; i < 900; i++) {
      x.fillStyle = r() < 0.5 ? '#d9d4ca' : '#ffffff';
      x.fillRect(ox + r() * T, r() * T, 2, 2);
    }
    x.globalAlpha = 1;
    // rodapié (franja baja de otro color, muy común en la región)
    x.fillStyle = '#b77b6c'; x.fillRect(ox, T * 0.86, T, T * 0.14);
    // manchas de humedad
    const g = x.createLinearGradient(0, T * 0.7, 0, T);
    g.addColorStop(0, 'rgba(90,70,50,0)'); g.addColorStop(1, 'rgba(90,70,50,0.18)');
    x.fillStyle = g; x.fillRect(ox, T * 0.7, T, T * 0.3);
  }
  const puerta = (px, w, col = '#5a3b28') => {
    x.fillStyle = '#3a2a20'; x.fillRect(px - 3, T * 0.22, w + 6, T * 0.78);
    x.fillStyle = col; x.fillRect(px, T * 0.25, w, T * 0.75);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
    x.strokeRect(px + 5, T * 0.3, w - 10, T * 0.25); x.strokeRect(px + 5, T * 0.6, w - 10, T * 0.3);
  };
  const ventana = (px, w) => {
    x.fillStyle = '#e8e2d6'; x.fillRect(px - 4, T * 0.3 - 4, w + 8, T * 0.32 + 8);
    x.fillStyle = '#3d4a55'; x.fillRect(px, T * 0.3, w, T * 0.32);
    x.strokeStyle = '#2a2a2a'; x.lineWidth = 2; // herrería
    for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(px + (w * i) / 5, T * 0.3); x.lineTo(px + (w * i) / 5, T * 0.62); x.stroke(); }
    x.beginPath(); x.moveTo(px, T * 0.46); x.lineTo(px + w, T * 0.46); x.stroke();
  };
  // mosaico 1
  puerta(T + 50, 40); ventana(T + 150, 56);
  // mosaico 2
  ventana(2 * T + 22, 46); puerta(2 * T + 108, 40, '#2f4f6a'); ventana(2 * T + 186, 46);
  // mosaico 4: planta alta con tres ventanas (sin rodapié)
  x.fillStyle = '#f2efe8'; x.fillRect(4 * T, T * 0.86, T, T * 0.14);
  ventana(4 * T + 22, 50); ventana(4 * T + 103, 50); ventana(4 * T + 184, 50);
  // mosaico 3: tienda
  const ox = 3 * T;
  x.fillStyle = '#7d8388'; x.fillRect(ox + 40, T * 0.3, 176, T * 0.7);
  x.strokeStyle = 'rgba(40,40,40,0.5)'; x.lineWidth = 2;
  for (let y = T * 0.3; y < T; y += 7) { x.beginPath(); x.moveTo(ox + 40, y); x.lineTo(ox + 216, y); x.stroke(); }
  x.fillStyle = '#c23b2e'; x.fillRect(ox + 30, T * 0.16, 196, T * 0.1);
  x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center';
  x.fillText('ABARROTES', ox + 128, T * 0.24);
  return tex(c);
}

// Muro de adobe aparente: la textura cubre 1.6 m × 1.0 m (bloques de ~40 × 12 cm)
export function adobe() {
  const [c, x] = lienzo(256, 160);
  x.fillStyle = '#8e7a63'; x.fillRect(0, 0, 256, 160);
  const r = rng(71);
  for (let j = 0; j < 8; j++) {
    const off = (j % 2) * 32;
    for (let i = -1; i < 5; i++) {
      const k = 0.88 + r() * 0.22;
      x.fillStyle = `rgb(${(196 * k) | 0},${(170 * k) | 0},${(138 * k) | 0})`;
      x.fillRect(i * 64 + off + 2, j * 20 + 2, 60, 16);
    }
  }
  ruido(x, 256, 160, 1800, ['#a88d6e', '#d2b998', '#8c7458'], [1, 3], 0.35, 72);
  return tex(c);
}

// Pretil decorativo: tablero azul claro con un rombo blanco (1 tablero = 1.8 m)
export function rombos() {
  const [c, x] = lienzo(256, 128);
  x.fillStyle = '#a9d2db'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#f6f7f4'; x.strokeStyle = '#7f9aa3'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(6, 64); x.lineTo(128, 14); x.lineTo(250, 64); x.lineTo(128, 114); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#a9d2db'; x.beginPath(); x.arc(128, 64, 10, 0, 7); x.fill();
  x.strokeStyle = '#8d8a80'; x.lineWidth = 8; x.strokeRect(0, 0, 256, 128);
  ruido(x, 256, 128, 300, ['#c7b48a', '#8fb3bd'], [2, 6], 0.25, 81);
  return tex(c);
}

// Block de concreto sin enjarre: la textura cubre 1.6 m × 0.8 m (blocks de 40 × 20 cm)
export function block() {
  const [c, x] = lienzo(256, 128);
  x.fillStyle = '#7f7c76'; x.fillRect(0, 0, 256, 128);
  const r = rng(91);
  for (let j = 0; j < 4; j++) {
    const off = (j % 2) * 32;
    for (let i = -1; i < 5; i++) {
      const k = 0.9 + r() * 0.16;
      x.fillStyle = `rgb(${(168 * k) | 0},${(165 * k) | 0},${(158 * k) | 0})`;
      x.fillRect(i * 64 + off + 2, j * 32 + 2, 60, 28);
    }
  }
  ruido(x, 256, 128, 1500, ['#8e8b84', '#b9b6ae', '#77746e'], [1, 3], 0.35, 92);
  return tex(c);
}

export function cancha() {
  const [c, x] = lienzo(256, 512);
  x.fillStyle = '#8f9a8a'; x.fillRect(0, 0, 256, 512);
  ruido(x, 256, 512, 2000, ['#848e7f', '#9ba693'], [1, 3], 0.4, 61);
  x.strokeStyle = '#f3f0e6'; x.lineWidth = 4;
  x.strokeRect(16, 16, 224, 480);
  x.beginPath(); x.moveTo(16, 256); x.lineTo(240, 256); x.stroke();
  x.beginPath(); x.arc(128, 256, 34, 0, Math.PI * 2); x.stroke();
  x.strokeRect(88, 16, 80, 90); x.strokeRect(88, 406, 80, 90);
  x.beginPath(); x.arc(128, 16, 120, 0, Math.PI); x.stroke();
  x.beginPath(); x.arc(128, 496, 120, Math.PI, 0); x.stroke();
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function sombra() {
  const [c, x] = lienzo(64, 64);
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

// Letrero pintado (texto sobre fondo)
export function letrero(texto, { w = 512, h = 96, fondo = '#1d4f91', color = '#ffffff', fuente = 'bold 44px sans-serif', borde = null } = {}) {
  const [c, x] = lienzo(w, h);
  x.fillStyle = fondo; x.fillRect(0, 0, w, h);
  if (borde) { x.strokeStyle = borde; x.lineWidth = 6; x.strokeRect(4, 4, w - 8, h - 8); }
  x.fillStyle = color; x.font = fuente; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lineas = texto.split('\n');
  lineas.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lineas.length - 1) / 2) * (h / (lineas.length + 0.4))));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
