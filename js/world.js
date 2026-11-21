// Construcción del pueblo en 3D. Todo es geometría simple combinada (pocas llamadas de dibujo)
// para que corra fluido en teléfonos Android de gama media.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { CALLE_ANGOSTA } from './data.js';
import { CALLES } from './calles.js';

const PI = Math.PI;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function M(x, y, z, rotY = 0, rotX = 0, rotZ = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
  return new THREE.Matrix4().compose(V3(x, y, z), q, V3(1, 1, 1));
}

// Acumulador de geometrías que se combinan en una sola malla con color por vértice.
class Lote {
  constructor() { this.g = []; }
  push(geo, color, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2).fill(0.5), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const col = new Float32Array(n * 3);
    const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const c = typeof color === 'function' ? color(pos.getX(i), pos.getY(i), pos.getZ(i)) : color;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (matrix) g.applyMatrix4(matrix);
    this.g.push(g);
  }
  mesh(mat) {
    if (!this.g.length) return null;
    const m = new THREE.Mesh(mergeGeometries(this.g, false), mat);
    this.g = [];
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}

// Caja con UV para el atlas de fachadas (cara frontal = +z local).
const NT = 5; // mosaicos en el atlas
function caja(w, h, d, { tile = null, uvEsc = null } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  if (tile !== null) {
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const t = f === 4 ? tile : 0;
      uv.setX(i, (t + 0.01 + uv.getX(i) * 0.98) / NT);
    }
  } else if (uvEsc) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvEsc[0], uv.getY(i) * uvEsc[1]);
  }
  return g;
}

// Techo a cuatro aguas: cumbrera a lo largo de x, alero `o` alrededor.
function cuatroAguas(w, d, r, o) {
  const X = w / 2 + o, Z = d / 2 + o, k = Math.max(0, (w - d) / 2);
  const A = [-X, 0, -Z], B = [X, 0, -Z], C = [X, 0, Z], D = [-X, 0, Z], E = [-k, r, 0], F = [k, r, 0];
  const tris = [D, C, F, D, F, E, B, A, E, B, E, F, A, D, E, C, B, F];
  const pos = [], uv = [];
  for (const v of tris) { pos.push(...v); uv.push(v[0] * 1.2, v[2] * 0.6 + v[1]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Hastiales (triángulos) de un techo de dos aguas.
function hastiales(w, d, r) {
  const p = [];
  for (const sx of [-w / 2, w / 2]) {
    const a = [sx, 0, -d / 2], b = [sx, 0, d / 2], c = [sx, r, 0];
    p.push(...a, ...b, ...c, ...a, ...c, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 2 ? 0.5 : 0.02)), 2));
  g.computeVertexNormals();
  return g;
}

const PAL_MUROS = ['#f3efe6', '#f3efe6', '#efe3c2', '#cfe0c8', '#f0c9c0', '#c9dbe8', '#f2d98c', '#e7b98f', '#bdb6ad', '#bdb6ad', '#d9cfc0', '#9fc7b5'];
const PAL_TECHOS = ['#e6e9ec', '#e6e9ec', '#e6e9ec', '#dfe2e5', '#c3c7ca', '#c3c7ca', '#a2503e', '#9a4a3a', '#8a8f94', '#6d8fb3'];

export function construirPueblo(scene, renderer) {
  const r = TX.rng(2026);
  const T = {
    concreto: TX.concreto(), tierra: TX.tierra(), pasto: TX.pasto(), plaza: TX.plaza(),
    lamina: TX.lamina(), teja: TX.teja(), adobe: TX.adobe(), atlas: TX.atlasFachadas(), cancha: TX.cancha(), sombra: TX.sombra(),
  };
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  Object.values(T).forEach((t) => (t.anisotropy = aniso));

  const MAT = {
    muros: new THREE.MeshLambertMaterial({ map: T.atlas, vertexColors: true }),
    techos: new THREE.MeshLambertMaterial({ map: T.lamina, vertexColors: true, side: THREE.DoubleSide }),
    tejas: new THREE.MeshLambertMaterial({ map: T.teja, vertexColors: true, side: THREE.DoubleSide }),
    lisos: new THREE.MeshLambertMaterial({ vertexColors: true }),
    adobe: new THREE.MeshLambertMaterial({ map: T.adobe, vertexColors: true }),
  };
  const L = { muros: new Lote(), techos: new Lote(), tejas: new Lote(), lisos: new Lote(), adobe: new Lote() };

  const colision = { rects: [], circulos: [] };
  const mapa = { suelos: [], edificios: [], arboles: [] };
  const arboles = [];
  const eras = { antes: new THREE.Group(), ahora: new THREE.Group() };
  eras.antes.visible = false;
  scene.add(eras.antes, eras.ahora);

  // rectángulos orientados: { cx, cz, hw, hd, rot } (rot = giro en Y)
  const obb = (cx, cz, w, d, rot = 0) => ({ cx, cz, hw: w / 2, hd: d / 2, rot });
  const deAABB = (b) => obb((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 0);
  const esquinas = (o) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.cx + a * o.hw * c + b * o.hd * s, o.cz - a * o.hw * s + b * o.hd * c]);
  };
  const solido = (rc, era = null) => colision.rects.push({ ...(rc.hw ? rc : deAABB(rc)), era });

  // -------------------------------------------------------------- CASAS
  function casa(cx, cz, w, d, h, rotY, o = {}) {
    const H = M(cx, 0, cz, rotY);
    const muro = new THREE.Color(o.muro ?? PAL_MUROS[(r() * PAL_MUROS.length) | 0]);
    const techo = new THREE.Color(o.techo ?? PAL_TECHOS[(r() * PAL_TECHOS.length) | 0]);
    const tile = o.tile ?? (r() < 0.12 ? 0 : r() < 0.55 ? 1 : r() < 0.85 ? 2 : 3);
    L.muros.push(caja(w, h, d, { tile }), muro, H.clone().multiply(M(0, h / 2, 0)));
    const tipo = o.tipoTecho ?? (r() < 0.55 ? 'una' : 'dos');
    const lote = o.techoTeja ? L.tejas : L.techos;
    if (tipo === 'una') {
      const rise = 0.5 + d * 0.04;
      const run = d + 0.8, len = Math.hypot(run, rise), a = Math.atan2(rise, run);
      const flip = o.caidaAtras ? -1 : 1;
      lote.push(caja(w + 0.6, 0.06, len, { uvEsc: [(w + 0.6) * 1.2, len * 0.5] }), techo,
        H.clone().multiply(M(0, h + rise / 2 + 0.03, 0, 0, a * flip)));
      // relleno lateral (muro inclinado) para que no se vea hueco
      const p = new THREE.BufferGeometry();
      const yb = h, yt = h + rise, z0 = -d / 2, z1 = d / 2;
      const hi = flip > 0 ? z0 : z1;
      const tri = [];
      for (const sx of [-w / 2, w / 2]) tri.push(sx, yb, z0, sx, yb, z1, sx, yt, hi, sx, yb, z0, sx, yt, hi, sx, yb, z1);
      p.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      p.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 2 ? 0.5 : 0.02)), 2));
      p.computeVertexNormals();
      L.muros.push(p, muro, H);
    } else if (tipo === 'dos') {
      const rise = d * 0.2;
      const run = d / 2 + 0.4, len = Math.hypot(run, rise), a = Math.atan2(rise, run);
      for (const s of [1, -1]) {
        lote.push(caja(w + 0.6, 0.06, len, { uvEsc: [(w + 0.6) * 1.2, len * 0.5] }), techo,
          H.clone().multiply(M(0, h + rise / 2 + 0.03, (s * run) / 2, 0, a * s)));
      }
      L.muros.push(hastiales(w, d, rise), muro, H.clone().multiply(M(0, h, 0)));
    } else if (tipo === 'plana') {
      L.lisos.push(caja(w + 0.3, 0.25, d + 0.3), techo, H.clone().multiply(M(0, h + 0.12, 0)));
    }
    const rc = obb(cx, cz, w, d, rotY);
    if (o.solido !== false) solido(rc);
    mapa.edificios.push({ pts: esquinas(rc), color: '#' + (o.techoMapa ?? techo.getHexString(THREE.SRGBColorSpace)) });
    return rc;
  }

  // -------------------------------------------------------------- ÁRBOLES
  const VERDES = ['#3f6b2a', '#4c7a31', '#355e24', '#5a8536', '#466f2c', '#2f5520'];
  function arbol(x, z, o = {}) {
    const tipo = o.tipo ?? 'normal';
    const rad = o.r ?? 2.2 + r() * 2.6;
    const h = o.h ?? 1.6 + rad * 0.45;
    arboles.push({ x, z, rad, h, tipo, color: new THREE.Color(o.color ?? VERDES[(r() * VERDES.length) | 0]) });
    colision.circulos.push({ x, z, r: tipo === 'ficus' ? 0.6 : 0.35 });
    mapa.arboles.push([x, z, rad]);
  }
  function palma(x, z, h = 8) {
    L.lisos.push(new THREE.CylinderGeometry(0.18, 0.28, h, 6), new THREE.Color('#8b7a64'), M(x, h / 2, z));
    const hoja = new THREE.BoxGeometry(0.5, 0.05, 3.2);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      L.lisos.push(hoja.clone(), new THREE.Color('#4d7a2d'), M(x + Math.sin(a) * 1.4, h - 0.3, z + Math.cos(a) * 1.4, a, 0.55));
    }
    colision.circulos.push({ x, z, r: 0.35 });
    mapa.arboles.push([x, z, 1.8]);
  }

  // -------------------------------------------------------------- SUELOS
  const suelo = (x0, z0, x1, z1, tex, y, rep, color = '#ffffff', mapaColor = null) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / rep, uv.getY(i) * (z1 - z0) / rep);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, color }));
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m);
    if (mapaColor) mapa.suelos.push({ x0, z0, x1, z1, color: mapaColor });
    return m;
  };
  // Los suelos de un mismo material se combinan
  const suelos = { concreto: [], tierra: [], plaza: [], pasto: [] };
  const losa = (tipo, x0, z0, x1, z1, y, rep, mapaColor) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / rep, (-z1 + uv.getY(i) * (z1 - z0)) / rep);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    suelos[tipo].push(g.toNonIndexed());
    if (mapaColor) mapa.suelos.push({ x0, z0, x1, z1, color: mapaColor });
  };

  // terreno general (pasto) — grande para que el horizonte no se corte
  const base = suelo(-1500, -1500, 1500, 1500, T.pasto, 0, 8, '#ffffff');
  base.material.map.repeat.set(1, 1);
  mapa.suelos.push({ x0: -600, z0: -600, x1: 600, z1: 600, color: '#6b8b45' });
  // patios de tierra dentro del pueblo
  losa('tierra', -300, -300, 300, 300, 0.005, 6, null);

  // calles reales (OpenStreetMap vía CADMapper). Se omiten las que caen dentro de la manzana del parque,
  // que se dibuja con medidas propias tomadas del satélite.
  const SEG = [];
  for (const c of CALLES) {
    const w = c.tipo === 'principal' ? 8 : 7;
    for (let i = 0; i < c.pts.length - 1; i++) {
      const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (Math.abs(mx) < 46 && Math.abs(mz) < 46) continue;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      // la calle central al sur del parque es de terracería en Street View (foto de la casa de adobe)
      const conc = !(Math.abs(mx + 50) < 6 && mz > 54) && (c.tipo === 'principal' || (Math.abs(mx) < 160 && Math.abs(mz) < 160));
      SEG.push({ ax, az, bx, bz, len, dx: (bx - ax) / len, dz: (bz - az) / len, w, conc });
    }
  }
  const distSeg = (px, pz, sg) => {
    let t = (px - sg.ax) * sg.dx + (pz - sg.az) * sg.dz;
    t = Math.max(0, Math.min(sg.len, t));
    return Math.hypot(px - (sg.ax + sg.dx * t), pz - (sg.az + sg.dz * t));
  };
  const distCalle = (px, pz) => {
    let m = Infinity;
    for (const sg of SEG) { const d = distSeg(px, pz, sg) - sg.w / 2; if (d < m) m = d; }
    return m;
  };
  const franja = (tipo, sg, y) => {
    const g = new THREE.PlaneGeometry(sg.len, sg.w); g.rotateX(-PI / 2);
    g.rotateY(Math.atan2(-sg.dz, sg.dx));
    g.translate((sg.ax + sg.bx) / 2, y, (sg.az + sg.bz) / 2);
    const disco = new THREE.CircleGeometry(sg.w / 2, 12).rotateX(-PI / 2).translate(sg.bx, y, sg.bz);
    for (const gg of [g, disco]) {
      const p = gg.attributes.position, uv = gg.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, -p.getZ(i) / 6);
      suelos[tipo].push(gg.index ? gg.toNonIndexed() : gg);
    }
  };
  mapa.calles = [];
  for (const sg of SEG) {
    franja(sg.conc ? 'concreto' : 'tierra', sg, sg.conc ? 0.021 : 0.012);
    mapa.calles.push({ a: [sg.ax, sg.az], b: [sg.bx, sg.bz], w: sg.w, color: sg.conc ? '#d9d4ca' : '#b9a079' });
  }
  // andador entre parque y escuela
  const CA = CALLE_ANGOSTA;
  losa('concreto', CA.x - CA.ancho / 2, CA.desde, CA.x + CA.ancho / 2, CA.hasta, 0.022, 6, '#d9d4ca');

  // -------------------------------------------------------------- PARQUE CENTRAL
  // superficie: tierra al poniente (estacionamiento bajo los ficus), plaza al centro y sur
  losa('tierra', -46, -46, -31, 46, 0.03, 6, '#a88d66');
  losa('tierra', -46, -46, -26, -35, 0.031, 6, null);
  losa('plaza', -31, -2, -3, 46, 0.03, 4, '#b77a63');
  losa('plaza', -26, -46, -3, -2, 0.03, 4, '#bf8a72');
  // andadores en diagonal (más claros)
  {
    const diag = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.PlaneGeometry(2.4, len); g.rotateX(-PI / 2);
      g.rotateY(Math.atan2(x1 - x0, z1 - z0));
      g.translate((x0 + x1) / 2, 0.036, (z0 + z1) / 2);
      L.lisos.push(g, new THREE.Color('#d9b9a3'));
    };
    diag(-31, 0, -4, 45); diag(-4, 0, -31, 45);
  }
  // jardineras con pasto
  const jardinera = (x, z, rad) => {
    L.lisos.push(new THREE.CylinderGeometry(rad, rad, 0.4, 14, 1, true), new THREE.Color('#e9e3d6'), M(x, 0.2, z));
    L.lisos.push(new THREE.CircleGeometry(rad, 14).rotateX(-PI / 2), new THREE.Color('#5d7f37'), M(x, 0.35, z));
    colision.circulos.push({ x, z, r: rad + 0.2 });
  };

  // ficus del lado poniente, troncos encalados (visto en la foto)
  const ficus = [[-38, -31], [-34, -24], [-39, -17], [-35, -9], [-38, -1], [-35, 7], [-38, 15], [-35, 24], [-38, 33], [-35, 41], [-30, -29]];
  ficus.forEach(([x, z]) => arbol(x, z, { tipo: 'ficus', r: 4.6 + r() * 1.6, h: 3.2, color: r() < 0.5 ? '#3c6b26' : '#467a2c' }));
  // árboles de la plaza (posiciones de la imagen satelital)
  const plazaArb = [[-12, 1], [-7, 6], [-22, 9], [-29, 6], [-14, 19], [-8, 31], [-15, 38], [-32, 33], [-29, 42], [-23, 34], [-19, 27], [-9, 42], [-7, 17]];
  plazaArb.forEach(([x, z]) => { jardinera(x, z, 1.3); arbol(x, z, { r: 2.6 + r() * 1.8 }); });
  // bancas
  const banca = (x, z, rot) => {
    L.lisos.push(new THREE.BoxGeometry(1.8, 0.1, 0.5), new THREE.Color('#d6d0c4'), M(x, 0.45, z, rot));
    L.lisos.push(new THREE.BoxGeometry(0.2, 0.42, 0.4), new THREE.Color('#bdb6aa'), M(x - Math.cos(rot) * 0.7, 0.21, z + Math.sin(rot) * 0.7, rot));
    L.lisos.push(new THREE.BoxGeometry(0.2, 0.42, 0.4), new THREE.Color('#bdb6aa'), M(x + Math.cos(rot) * 0.7, 0.21, z - Math.sin(rot) * 0.7, rot));
  };
  [[-17, 13, 0.6], [-11, 25, 0.6], [-27, 17, -0.6], [-20, 40, 0], [-12, 44, 0], [-4.5, 10, PI / 2], [-4.5, 30, PI / 2]].forEach((b) => banca(...b));
  // faroles
  const farol = (x, z) => {
    L.lisos.push(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), new THREE.Color('#2f3336'), M(x, 1.8, z));
    L.lisos.push(new THREE.SphereGeometry(0.25, 8, 6), new THREE.Color('#f5f0dc'), M(x, 3.7, z));
  };
  [[-20, 0], [-6, 22], [-30, 22], [-17, 45], [-4, -40], [-28, -44]].forEach((f) => farol(...f));

  // kiosco (provisional)
  {
    const kx = -25, kz = 24;
    L.lisos.push(new THREE.CylinderGeometry(3.3, 3.5, 0.55, 8), new THREE.Color('#d8cfc0'), M(kx, 0.27, kz));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + PI / 8;
      L.lisos.push(new THREE.CylinderGeometry(0.12, 0.12, 2.7, 6), new THREE.Color('#f1ede4'), M(kx + Math.cos(a) * 2.9, 1.9, kz + Math.sin(a) * 2.9));
    }
    L.tejas.push(new THREE.ConeGeometry(4.1, 1.8, 8, 1), new THREE.Color('#ffffff'), M(kx, 4.1, kz, PI / 8));
    colision.circulos.push({ x: kx, z: kz, r: 3.5 });
    mapa.edificios.push({ x0: kx - 3.5, x1: kx + 3.5, z0: kz - 3.5, z1: kz + 3.5, color: '#a95a3d', redondo: true });
  }

  // construcción anexa al norte del domo (muro crema con franja roja, visible en la foto)
  casa(-17.5, -39, 15, 8, 3.4, PI, { muro: '#efe0bf', techo: '#6a6560', tipoTecho: 'plana', tile: 1, techoMapa: '6a6560' });

  // domo del parque
  domo(-16.75, -18.25, 22.5, 31.5, 6.2, 5.2, '#e3e6e8');

  // -------------------------------------------------------------- ESCUELA PRIMARIA "16 DE SEPTIEMBRE"
  domo(19.75, -12.5, 19.5, 33, 5.6, 4.4, '#f1f3f4');
  casa(5.75, -31.5, 21, 7.5, 3.2, -PI / 2, { muro: '#eef0e8', techo: '#c3c7ca', tile: 2, tipoTecho: 'una' });
  casa(18, -38, 14, 8, 3.2, 0, { muro: '#eef0e8', techo: '#e6e9ec', tile: 2, tipoTecho: 'dos' });
  casa(36, -34, 16, 12, 3.4, PI / 2, { muro: '#eef0e8', techo: '#a2503e', tile: 2, tipoTecho: 'dos' });
  casa(37.5, -16, 16, 13, 3.4, -PI / 2, { muro: '#eef0e8', techo: '#a2503e', tile: 2, tipoTecho: 'dos' });
  casa(19.5, 8.5, 19, 9, 3.2, PI, { muro: '#eef0e8', techo: '#e6e9ec', tile: 2, tipoTecho: 'una' });
  // barda (provisional): blanca con franja verde
  const barda = (x0, z0, x1, z1) => {
    const w = Math.abs(x1 - x0) || 0.25, d = Math.abs(z1 - z0) || 0.25;
    L.muros.push(caja(w, 2.2, d, { tile: 0 }), new THREE.Color('#e9f0e6'), M((x0 + x1) / 2, 1.1, (z0 + z1) / 2));
    solido({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15 });
  };
  barda(3.2, -21, 3.2, -14.5); barda(3.2, -9.5, 3.2, 13.5);
  barda(3.2, 13.5, 46, 13.5); barda(46, -46, 46, 13.5); barda(9.5, -45.8, 46, -45.8);
  // portón de entrada (provisional) frente al domo del parque
  for (const z of [-14.5, -9.5]) L.lisos.push(new THREE.BoxGeometry(0.5, 2.8, 0.5), new THREE.Color('#e9f0e6'), M(3.2, 1.4, z));
  L.lisos.push(new THREE.BoxGeometry(0.3, 0.5, 5.5), new THREE.Color('#e9f0e6'), M(3.2, 3.0, -12));
  // hojas del portón abiertas hacia dentro (herrería verde)
  for (const [z, s] of [[-14.3, 1], [-9.7, -1]]) for (let i = 0; i < 5; i++) L.lisos.push(new THREE.BoxGeometry(0.05, 2.2, 0.05), new THREE.Color('#2c5b3c'), M(3.5 + i * 0.45, 1.1, z));
  letreroPlano('ESCUELA PRIMARIA\n«16 DE SEPTIEMBRE»', 2.9, 1.65, -18, 5.6, 1.0, -PI / 2, { fondo: '#e9f0e6', color: '#1e5a36', fuente: 'bold 40px serif', h: 110 });
  letreroPlano('ESCUELA PRIMARIA «16 DE SEPTIEMBRE»', 3.05, 3.0, -12, 5.4, 0.45, -PI / 2, { fondo: '#1e5a36', color: '#ffffff', fuente: 'bold 30px sans-serif', w: 640, h: 56 });

  // resto de la manzana central (sureste): casas y huerta
  for (let i = 0; i < 10; i++) arbol(8 + r() * 24, 18 + r() * 12);

  // -------------------------------------------------------------- MANZANA DE LA IGLESIA Y LA AGENCIA (x -150..-50)
  const BX = -100;
  // Iglesia: nave de poniente a oriente, techo de lámina gris (satélite).
  // Fachada reconstruida con la foto aportada por la comunidad (2026): amarilla con molduras azules,
  // cuatro pilastras blancas con anillos azules, espadaña de tres arcos, óculo, puerta en arco
  // y reja blanca con portón azul de diseño de sol.
  casa(-81.6, 9.4, 20, 11, 6, 0, { muro: '#efc53a', techo: '#a9adb1', tile: 0, tipoTecho: 'dos', techoMapa: '8e9296' });
  {
    const F = -65, Z = 9.4; // plano de la fachada (mira al oriente) y su eje
    const AM = new THREE.Color('#ffd52e'), AZ = new THREE.Color('#4a9ad4'), BL = new THREE.Color('#eef0ee'), OS = new THREE.Color('#231f1d');
    const enFachada = (geo, col, y, z, sale = 0.02) => L.lisos.push(geo, col, M(F + sale, y, z));
    const arco = (y, z, r, col, sale) => L.lisos.push(new THREE.CylinderGeometry(r, r, 0.06, 14, 1, false, 0, PI), col, M(F + sale, y, z, 0, 0, PI / 2));
    // cuerpo de la fachada y espadaña
    L.lisos.push(new THREE.BoxGeometry(6.6, 8, 10), AM, M(F - 3.3, 4, Z));
    L.lisos.push(new THREE.BoxGeometry(0.8, 3.0, 3.4), AM, M(F - 0.4, 9.5, Z));
    // molduras azules
    enFachada(new THREE.BoxGeometry(0.4, 0.3, 10.4), AZ, 8.0, Z, 0.1);
    enFachada(new THREE.BoxGeometry(1.1, 0.25, 3.8), AZ, 11.1, Z, -0.35);
    for (const s of [-1, 1]) enFachada(new THREE.BoxGeometry(0.2, 0.16, 2.3), AZ, 4.95, Z + s * 3.9, 0.08);
    // pilastras blancas con anillos azules (sobresalen por encima de la cornisa)
    for (const dz of [-2.8, -1.75, 1.75, 2.8]) {
      enFachada(new THREE.CylinderGeometry(0.22, 0.24, 9.3, 10), BL, 4.65, Z + dz, 0.3);
      for (const [y, r, h] of [[0.15, 0.32, 0.3], [3.6, 0.29, 0.22], [6.5, 0.29, 0.22], [9.35, 0.33, 0.35]])
        enFachada(new THREE.CylinderGeometry(r, r, h, 10), AZ, y, Z + dz, 0.3);
    }
    // espadaña: tres arcos para campanas y cruz
    for (const dz of [-0.95, 0, 0.95]) {
      enFachada(new THREE.BoxGeometry(0.06, 0.95, 0.56), OS, 9.25, Z + dz);
      arco(9.72, Z + dz, 0.28, OS, 0.02);
      enFachada(new THREE.BoxGeometry(0.1, 0.07, 0.7), AZ, 8.75, Z + dz, 0.05);
    }
    enFachada(new THREE.BoxGeometry(0.4, 0.4, 0.7), AM, 11.45, Z, -0.4);
    enFachada(new THREE.BoxGeometry(0.14, 1.5, 0.14), BL, 12.4, Z, -0.4);
    enFachada(new THREE.BoxGeometry(0.14, 0.14, 0.95), BL, 12.75, Z, -0.4);
    enFachada(new THREE.BoxGeometry(0.18, 0.28, 0.28), AZ, 12.75, Z, -0.4);
    // óculo, escudo y puerta en arco
    enFachada(new THREE.CircleGeometry(0.55, 18).rotateY(PI / 2), OS, 5.1, Z, 0.03);
    enFachada(new THREE.TorusGeometry(0.6, 0.07, 6, 18).rotateY(PI / 2), AZ, 5.1, Z, 0.05);
    enFachada(new THREE.BoxGeometry(0.05, 1.2, 1.15), BL, 3.8, Z, 0.03);
    enFachada(new THREE.CircleGeometry(0.42, 16).rotateY(PI / 2), AZ, 3.8, Z, 0.07);
    enFachada(new THREE.CircleGeometry(0.3, 16).rotateY(PI / 2), BL, 3.8, Z, 0.08);
    enFachada(new THREE.BoxGeometry(0.02, 0.36, 0.08), AZ, 3.8, Z, 0.1);
    enFachada(new THREE.BoxGeometry(0.02, 0.08, 0.24), AZ, 3.86, Z, 0.1);
    enFachada(new THREE.BoxGeometry(0.06, 1.95, 2.2), OS, 0.975, Z);
    arco(1.95, Z, 1.1, OS, 0.02);
    // ventanas en arco de las calles laterales (dos niveles) y faroles
    for (const s of [-1, 1]) {
      const z = Z + s * 3.9;
      for (const [y, h, w] of [[4.15, 0.75, 0.6], [7.05, 0.6, 0.5]]) {
        enFachada(new THREE.BoxGeometry(0.06, h, w), OS, y, z);
        arco(y + h / 2, z, w / 2, OS, 0.02);
        enFachada(new THREE.BoxGeometry(0.14, 0.08, w + 0.2), AZ, y - h / 2 - 0.04, z, 0.06);
      }
      enFachada(new THREE.BoxGeometry(0.3, 0.42, 0.3), new THREE.Color('#2e2e2e'), 5.45, z - s * 0.9, 0.35);
      enFachada(new THREE.SphereGeometry(0.11, 8, 6), new THREE.Color('#fff2c4'), 5.4, z - s * 0.9, 0.35);
    }
    solido({ x0: -71.6, x1: F + 0.5, z0: Z - 5.1, z1: Z + 5.1 });
    mapa.edificios.push({ x0: -71.6, x1: F, z0: Z - 5, z1: Z + 5, color: '#f0c419' });

    // atrio y reja: barda baja blanca con barandal blanco y portón azul con diseño de sol (cerrado, como en la foto)
    losa('pasto', -64.9, 1.5, -54.6, 16, 0.03, 4, '#6f9a48');
    const RX = -54.85, G0 = Z - 1.85, G1 = Z + 1.85;
    for (const [z0, z1] of [[1.5, G0 - 0.25], [G1 + 0.25, 16]]) {
      const zc = (z0 + z1) / 2, lz = z1 - z0;
      L.lisos.push(new THREE.BoxGeometry(0.32, 1.0, lz), BL, M(RX, 0.5, zc));
      L.lisos.push(new THREE.BoxGeometry(0.06, 0.06, lz), BL, M(RX, 2.05, zc));
      for (let z = z0 + 0.12; z < z1; z += 0.24) L.lisos.push(new THREE.BoxGeometry(0.035, 1.05, 0.035), BL, M(RX, 1.53, z));
      for (const zz of [z0, z1]) L.lisos.push(new THREE.BoxGeometry(0.4, 2.2, 0.4), BL, M(RX, 1.1, zz));
    }
    for (const z of [G0 - 0.25, G1 + 0.25]) L.lisos.push(new THREE.BoxGeometry(0.5, 2.5, 0.5), BL, M(RX, 1.25, z));
    L.lisos.push(new THREE.BoxGeometry(0.08, 1.15, G1 - G0), AZ, M(RX, 0.6, Z));
    L.lisos.push(new THREE.BoxGeometry(0.06, 0.07, G1 - G0), AZ, M(RX, 2.2, Z));
    L.lisos.push(new THREE.BoxGeometry(0.06, 2.2, 0.07), AZ, M(RX, 1.1, Z));
    for (let z = G0 + 0.15; z < G1; z += 0.3) L.lisos.push(new THREE.BoxGeometry(0.035, 1.05, 0.035), AZ, M(RX, 1.7, z));
    for (const cz of [Z - 0.92, Z + 0.92]) for (let i = 0; i <= 6; i++) {
      const a = -PI / 2 + (i / 6) * PI; // rayos del sol desde la base de cada hoja
      L.lisos.push(new THREE.BoxGeometry(0.04, 0.8, 0.04), AZ, M(RX - 0.03, 1.2 + Math.cos(a) * 0.4, cz + Math.sin(a) * 0.4, 0, a));
    }
    solido({ x0: RX - 0.25, x1: RX + 0.25, z0: 1.5, z1: 16 });
  }
  // Agencia Municipal: construcción blanca de dos niveles junto a la iglesia (confirmado por la comunidad;
  // se alcanza a ver a la izquierda en la foto de la iglesia). Techos planos con impermeabilizante rojo (satélite).
  // Fachada, ventanas y letrero: provisionales hasta tener foto del frente.
  {
    const cx = -62.8, cz = 27.5, W = 21, D = 16.4, BL = new THREE.Color('#f3f2ee');
    L.muros.push(caja(W, 3.2, D, { tile: 2 }), BL, M(cx, 1.6, cz, PI / 2));
    L.muros.push(caja(W, 3.0, D, { tile: 4 }), BL, M(cx, 4.7, cz, PI / 2));
    L.lisos.push(new THREE.BoxGeometry(D + 0.3, 0.3, W + 0.3), new THREE.Color('#e9e7e1'), M(cx, 3.25, cz));
    L.lisos.push(new THREE.BoxGeometry(D + 0.4, 0.5, W + 0.4), BL, M(cx, 6.45, cz));
    L.lisos.push(new THREE.BoxGeometry(D - 0.6, 0.06, W - 0.6), new THREE.Color('#b5523b'), M(cx, 6.72, cz));
    letreroPlano('AGENCIA MUNICIPAL', cx + D / 2 + 0.16, 3.62, cz, 7, 0.55, PI / 2, { fondo: '#f3f2ee', color: '#7a2e1f', fuente: 'bold 46px serif', h: 84 });
    const rc = obb(cx, cz, W, D, PI / 2); solido(rc);
    mapa.edificios.push({ pts: esquinas(rc), color: '#b5523b' });
  }
  casa(-84.5, 28, 24, 25, 3.8, PI / 2, { muro: '#f3f2ee', techo: '#b5523b', tile: 0, tipoTecho: 'plana' });
  // tramo norte de la calle central (lado poniente): tienda de fachada verde y techo rojo + barda gris (vistas en la foto)
  casa(-58.5, -40, 9, 8, 3.4, PI / 2, { muro: '#3f9a8c', techo: '#a2503e', tile: 3, tipoTecho: 'una' });
  barda2(-55.2, -35.5, -55.2, -21, '#b5b0a6');
  casa(-65.2, -8, 18, 20, 3.3, PI / 2, { muro: '#efe3c2', techo: '#e6e9ec', tile: 1, tipoTecho: 'dos' });
  casa(-84.5, -24, 25, 20, 3.4, 0, { techo: '#e6e9ec', tile: 0, tipoTecho: 'dos', solido: true });
  palma(-55.8, -45.2, 9);

  // -------------------------------------------------------------- CASA DE ADOBE (esquina SO del parque, cruzando la calle)
  // Señalada por la comunidad sobre el mapa; reconstruida con una foto de Street View: muros de adobe aparente,
  // techo de lámina oxidada de una caída con tres láminas claras, puerta de madera, dos ventanas de postigo
  // y un letrero azul «Prohibido tirar basura en este lugar. Gracias». Profundidad y parte trasera: provisionales.
  {
    const cx = -40.6, cz = 60.2, W = 8.7, D = 6, H = 2.7, F = cz - D / 2; // frente hacia el norte (z menor)
    L.adobe.push(caja(W, H, D, { uvEsc: [W / 1.6, H / 1.0] }), new THREE.Color('#ffffff'), M(cx, H / 2, cz));
    // techo de una caída (más bajo al frente) y sus vigas
    const rise = 1.1, run = D + 1.4, len = Math.hypot(run, rise), a = Math.atan2(rise, run);
    L.techos.push(caja(W + 0.9, 0.06, len, { uvEsc: [(W + 0.9) * 1.2, len * 0.5] }), new THREE.Color('#9a5236'),
      M(cx, H + rise / 2 + 0.12, cz - 0.35, PI, a));
    for (const px of [-40.0, -41.9, -44.1]) L.lisos.push(new THREE.BoxGeometry(0.95, 0.02, len - 0.1), new THREE.Color('#e3e7e8'), M(px, H + rise / 2 + 0.17, cz - 0.35, PI, a));
    for (let i = 0; i <= 6; i++) L.lisos.push(new THREE.BoxGeometry(0.1, 0.12, 1.1), new THREE.Color('#5a4330'), M(cx - W / 2 + 0.3 + i * (W - 0.6) / 6, H + 0.05, F - 0.35));
    const hueco = (x, y, w, h) => {
      L.lisos.push(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), new THREE.Color('#9c8467'), M(x, y, F - 0.02));
      L.lisos.push(new THREE.BoxGeometry(w, h, 0.06), new THREE.Color('#7a5a3c'), M(x, y, F - 0.04));
      L.lisos.push(new THREE.BoxGeometry(0.03, h, 0.07), new THREE.Color('#4b3624'), M(x, y, F - 0.05));
    };
    hueco(-40.8, 0.9, 0.85, 1.8);                     // puerta
    hueco(-37.95, 1.3, 0.7, 0.72); hueco(-43.3, 1.3, 0.62, 0.7); // ventanas de postigo
    letreroPlano('PROHIBIDO TIRAR\nBASURA EN ESTE\nLUGAR  GRACIAS', -42.0, 1.75, F - 0.04, 0.78, 0.46, PI,
      { w: 256, h: 150, fondo: '#2f6fb0', color: '#ffffff', fuente: 'bold 30px sans-serif' });
    // vecino al oriente: poste de concreto y muro de block sin terminar
    L.lisos.push(new THREE.BoxGeometry(0.3, 2.9, 0.3), new THREE.Color('#b9b6ae'), M(cx + W / 2 + 0.25, 1.45, F + 0.1));
    L.muros.push(caja(0.25, 2.0, D, { tile: 0 }), new THREE.Color('#a9a59c'), M(cx + W / 2 + 0.55, 1.0, cz));
    losa('tierra', -46, 53.5, -33, F, 0.03, 6, null);
    const rc = obb(cx, cz, W, D, 0); solido(rc); solido(obb(cx + W / 2 + 0.55, cz, 0.4, D, 0));
    mapa.edificios.push({ pts: esquinas(rc), color: '#9a5236' });
  }

  // -------------------------------------------------------------- CRUCE CALLE CENTRAL × CALLE AL SUR DEL PARQUE
  // Reconstruido con una foto de Street View tomada en el cruce mirando al poniente (c. 2015, señalada por la comunidad).
  {
    const OX = new THREE.Color('#9a5a3a');
    // Esquina noroeste: casa blanca con techo de lámina oxidada a cuatro aguas; ventana hacia la calle central.
    {
      const cx = -63.5, cz = 43.6, W = 8, D = 5, H = 2.8;
      L.muros.push(caja(W, H, D, { tile: 0 }), new THREE.Color('#f4f2ec'), M(cx, H / 2, cz));
      L.techos.push(cuatroAguas(W, D, 1.3, 0.45), OX, M(cx, H, cz));
      L.lisos.push(new THREE.BoxGeometry(0.06, 0.8, 1.1), new THREE.Color('#2a2622'), M(cx + W / 2 + 0.03, 1.55, cz - 0.2));
      L.lisos.push(new THREE.BoxGeometry(0.1, 0.06, 1.2), new THREE.Color('#d9d3c6'), M(cx + W / 2 + 0.05, 1.12, cz - 0.2));
      const rc = obb(cx, cz, W, D, 0); solido(rc); mapa.edificios.push({ pts: esquinas(rc), color: '#9a5a3a' });
      // explanada de concreto entre la casa y la calle central (donde se para la gente en la foto)
      losa('concreto', -59.5, 38.2, -54.2, 46.3, 0.03, 6, '#d9d4ca');
    }
    // Junto a ella, hacia el norte: construcción amarilla con rodapié rojo y techo de lámina roja (provisional).
    {
      const cx = -57.6, cz = 39.5, W = 3.0, D = 4.2, H = 2.5;
      L.muros.push(caja(W, H, D, { tile: 0 }), new THREE.Color('#f0c54c'), M(cx, H / 2, cz, PI / 2));
      L.lisos.push(new THREE.BoxGeometry(D + 0.02, 0.45, W + 0.02), new THREE.Color('#b3362b'), M(cx, 0.22, cz));
      L.techos.push(caja(W + 0.6, 0.06, D + 1, { uvEsc: [(W + 0.6) * 1.2, 2] }), new THREE.Color('#a8402f'), M(cx, H + 0.3, cz, PI / 2, 0.12));
      const rc = obb(cx, cz, W, D, PI / 2); solido(rc); mapa.edificios.push({ pts: esquinas(rc), color: '#a8402f' });
    }
    // Esquina suroeste: casa de block sin enjarre, techo plano de lámina; puerta hacia la calle central y tejaban al poniente.
    {
      const cx = -61.8, cz = 58.6, W = 8.5, D = 6, H = 2.7, BK = new THREE.Color('#c7a48c');
      L.adobe.push(caja(W, H, D, { uvEsc: [W / 1.6, H / 1.0] }), BK, M(cx, H / 2, cz));
      for (const [x, z] of [[cx - W / 2, cz - D / 2], [cx + W / 2, cz - D / 2], [cx + W / 2, cz + D / 2]])
        L.lisos.push(new THREE.BoxGeometry(0.3, H + 0.05, 0.3), new THREE.Color('#b7b2a8'), M(x, H / 2, z));
      L.techos.push(caja(W + 0.5, 0.05, D + 0.5, { uvEsc: [(W + 0.5) * 1.2, 3] }), new THREE.Color('#c9cdd0'), M(cx, H + 0.08, cz, 0, 0.03));
      L.lisos.push(new THREE.BoxGeometry(0.06, 2.0, 0.9), new THREE.Color('#b5532e'), M(cx + W / 2 + 0.03, 1.0, cz + 1.2)); // puerta
      L.lisos.push(new THREE.BoxGeometry(0.06, 0.6, 0.6), new THREE.Color('#2a2622'), M(cx + W / 2 + 0.03, 1.5, cz - 1.5)); // ventanita
      losa('concreto', cx + W / 2, cz - 1.8, cx + W / 2 + 2.6, cz + 2.4, 0.06, 6, null); // banqueta frente a la puerta
      // tejaban de madera
      for (const [x, z] of [[cx - W / 2 - 6, cz - 2.6], [cx - W / 2 - 6, cz + 2.6], [cx - W / 2 - 3, cz - 2.6]]) {
        L.lisos.push(new THREE.BoxGeometry(0.15, 2.4, 0.15), new THREE.Color('#7d6a55'), M(x, 1.2, z));
        colision.circulos.push({ x, z, r: 0.2 });
      }
      L.techos.push(caja(6.6, 0.05, 6, { uvEsc: [8, 3] }), new THREE.Color('#9fa4a8'), M(cx - W / 2 - 3, 2.45, cz, 0, -0.06));
      const rc = obb(cx, cz, W, D, 0); solido(rc); mapa.edificios.push({ pts: esquinas(rc), color: '#c9cdd0' });
    }
    // registro (tapa redonda) en el cruce, como en la foto
    L.lisos.push(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), new THREE.Color('#77736b'), M(-50.5, 0.03, 52.3));
    L.lisos.push(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 16), new THREE.Color('#bdb8ae'), M(-50.5, 0.025, 52.3));
  }

  // letreros de calle (solo conocemos «calle central»)
  const letreroCalle = (x, z, rot) => {
    L.lisos.push(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), new THREE.Color('#5a5f63'), M(x, 1.4, z));
    letreroPlano('CALLE CENTRAL', x, 2.65, z, 1.6, 0.35, rot, { fondo: '#1d4f91', fuente: 'bold 52px sans-serif', borde: '#ffffff', h: 110 });
    letreroPlano('CALLE CENTRAL', x, 2.65, z, 1.6, 0.35, rot + PI, { fondo: '#1d4f91', fuente: 'bold 52px sans-serif', borde: '#ffffff', h: 110 });
  };
  letreroCalle(-45.6, -45.6, 0); letreroCalle(-45.6, 45.6, 0);

  // -------------------------------------------------------------- RESTO DEL PUEBLO (sobre las calles reales)
  // Zonas que no se llenan: parque, andador, escuela y atrio de la iglesia.
  const zonas = [obb(-24.5, 0, 43, 92), obb(0, 0, 6, 92), obb(24.5, -16.2, 43, 59.6), obb(-59.8, 8.75, 10.5, 14.5)];
  const ocupado = new Map(); // celdas de 20 m -> rectángulos ocupados
  const celda = (x, z) => Math.floor(x / 20) + ',' + Math.floor(z / 20);
  const celdasDe = (o) => {
    const p = esquinas(o), set = new Set();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let i = Math.floor(x0 / 20); i <= Math.floor(x1 / 20); i++) for (let j = Math.floor(z0 / 20); j <= Math.floor(z1 / 20); j++) set.add(i + ',' + j);
    return set;
  };
  const registrar = (o) => { for (const c of celdasDe(o)) { if (!ocupado.has(c)) ocupado.set(c, []); ocupado.get(c).push(o); } };
  colision.rects.forEach(registrar); zonas.forEach(registrar);
  const proyecta = (pts, ax) => { let a = Infinity, b = -Infinity; for (const [x, z] of pts) { const v = x * ax[0] + z * ax[1]; if (v < a) a = v; if (v > b) b = v; } return [a, b]; };
  const choca = (o1, o2) => {
    const p1 = esquinas(o1), p2 = esquinas(o2);
    for (const o of [o1, o2]) {
      const c = Math.cos(o.rot), s = Math.sin(o.rot);
      for (const ax of [[c, -s], [s, c]]) {
        const [a1, b1] = proyecta(p1, ax), [a2, b2] = proyecta(p2, ax);
        if (b1 < a2 || b2 < a1) return false;
      }
    }
    return true;
  };
  const libre = (o) => {
    const pts = esquinas(o);
    for (const [x, z] of pts.concat([[o.cx, o.cz]])) if (distCalle(x, z) < 0.5 || Math.abs(x) > 560 || Math.abs(z) > 560) return false;
    const grande = { ...o, hw: o.hw + 0.25, hd: o.hd + 0.25 };
    const vistos = new Set();
    for (const c of celdasDe(grande)) for (const q of ocupado.get(c) || []) {
      if (vistos.has(q)) continue; vistos.add(q);
      if (choca(grande, q)) return false;
    }
    return true;
  };
  const dentroCasa = (x, z, m = 1) => {
    for (const q of ocupado.get(celda(x, z)) || []) {
      const dx = x - q.cx, dz = z - q.cz, c = Math.cos(q.rot), s = Math.sin(q.rot);
      if (Math.abs(dx * c - dz * s) < q.hw + m && Math.abs(dx * s + dz * c) < q.hd + m) return true;
    }
    return false;
  };
  for (const sg of SEG) {
    const nx = -sg.dz, nz = sg.dx;
    for (const lado of [1, -1]) {
      let t = 1.5;
      while (t < sg.len - 6) {
        const w = 7 + r() * 6;
        const mx = sg.ax + sg.dx * (t + w / 2), mz = sg.az + sg.dz * (t + w / 2);
        const dc = Math.hypot(mx + 20, mz);
        const prob = dc < 230 ? 0.78 : dc < 380 ? 0.55 : 0.35;
        if (r() < prob) {
          const d = 6 + r() * 4, s = 0.6 + r() * 1.6;
          const off = sg.w / 2 + s + d / 2;
          const rot = Math.atan2(-lado * nx, -lado * nz);
          const o = obb(mx + nx * lado * off, mz + nz * lado * off, w - 0.5, d, rot);
          if (libre(o)) {
            const h = r() < 0.07 ? 5.6 : 2.6 + r() * 0.7;
            casa(o.cx, o.cz, w - 0.5, d, h, rot, { tile: dc < 160 && r() < 0.18 ? 3 : undefined });
            registrar(o);
          }
        } else if (r() < 0.6) {
          const k = sg.w / 2 + 4 + r() * 4;
          const x = mx + nx * lado * k, z = mz + nz * lado * k;
          if (distCalle(x, z) > 2 && !dentroCasa(x, z)) arbol(x, z);
        }
        t += w + r() * 1.2;
      }
    }
  }
  // huertas y solares arbolados (la vista satelital muestra mucha sombra de árboles dentro de las manzanas)
  for (let k = 0, n = 0; k < 9000 && n < 1100; k++) {
    const x = (r() - 0.5) * 1040, z = (r() - 0.5) * 1040;
    if (Math.abs(x) < 47 && Math.abs(z) < 47) continue;
    if (distCalle(x, z) < 3 || dentroCasa(x, z, 1.5)) continue;
    if (zonas.some((q) => Math.abs(x - q.cx) < q.hw && Math.abs(z - q.cz) < q.hd)) continue;
    arbol(x, z); n++;
  }
  // monte alrededor
  for (let k = 0; k < 300; k++) {
    const a = r() * PI * 2, d = 560 + r() * 260;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (distCalle(x, z) < 3) continue;
    arbol(x, z, { r: 3 + r() * 3.5 });
  }

  // postes de luz con cables a lo largo de las calles principales
  {
    const postes = [];
    const lineas = [];
    const tramo = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 33));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
        if (Math.hypot(x + 47.5, z + 52.5) > 7) postes.push([x, z]); // despejar la vista de la foto
        if (prev) {
          for (const dy of [7.6, 8.2]) {
            const mx = (prev[0] + x) / 2, mz = (prev[1] + z) / 2;
            lineas.push(prev[0], dy, prev[1], mx, dy - 0.45, mz, mx, dy - 0.45, mz, x, dy, z);
          }
        }
        prev = [x, z];
      }
    };
    for (const sg of SEG) if (sg.conc && sg.len > 20) {
      const ox = -sg.dz * (sg.w / 2 + 0.35), oz = sg.dx * (sg.w / 2 + 0.35);
      tramo(sg.ax + ox, sg.az + oz, sg.bx + ox, sg.bz + oz);
    }
    const g = new THREE.CylinderGeometry(0.11, 0.16, 8.6, 6); g.translate(0, 4.3, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#a7a49c' }), postes.length);
    postes.forEach(([x, z], i) => { im.setMatrixAt(i, M(x, 0, z)); colision.circulos.push({ x, z, r: 0.2 }); });
    scene.add(im);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lineas, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2a2a2a' })));
  }

  // -------------------------------------------------------------- ANTES / AHORA (parque, esquina noroeste)
  // AHORA (imagen satelital reciente): auto rojo en la calle norte y autos blancos al poniente
  vehiculo('auto', '#b3262a', -27, -48.3, PI / 2, eras.ahora);
  vehiculo('auto', '#e9e9e6', -43.8, -35, 0, eras.ahora);
  vehiculo('auto', '#e1e3e4', -43.8, -26, PI, eras.ahora);
  // ANTES (Street View, c. 2015): la calle al sur del parque era de terracería a ambos lados del cruce con la
  // calle central; el cruce mismo ya era de concreto (con tapa de registro). Hoy, frente a la casa de adobe, es de
  // concreto (confirmado por la comunidad, 2026); hacia el poniente, por confirmar.
  for (const [x0, x1] of [[-146, -54], [-46, -22]]) {
    const z0 = 46.3, z1 = 53.6;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-PI / 2).translate((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, -p.getZ(i) / 6);
    eras.antes.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: T.tierra })));
  }
  // ANTES (Street View): camionetas estacionadas sobre la tierra bajo los ficus
  vehiculo('pickup', '#1f2326', -44, -40.5, 0.75, eras.antes);
  vehiculo('pickup', '#3b1c20', -39.5, -42.5, 0.65, eras.antes);
  vehiculo('pickup', '#202426', -34.5, -42.2, 0.7, eras.antes, { caja: '#9a9a96' });
  vehiculo('pickup', '#b9bcbd', -30, -43.6, 0.55, eras.antes, { lona: '#2c4fa8' });
  vehiculo('pickup', '#1a2430', -27, -40.2, 0.8, eras.antes);
  vehiculo('pickup', '#232628', -41.6, -32, 0.3, eras.antes);

  // -------------------------------------------------------------- MALLAS FINALES
  const add = (m) => m && scene.add(m);
  add(L.muros.mesh(MAT.muros));
  add(L.techos.mesh(MAT.techos));
  add(L.tejas.mesh(MAT.tejas));
  add(L.lisos.mesh(MAT.lisos));
  add(L.adobe.mesh(MAT.adobe));
  const matSuelo = {
    concreto: new THREE.MeshLambertMaterial({ map: T.concreto }),
    tierra: new THREE.MeshLambertMaterial({ map: T.tierra }),
    plaza: new THREE.MeshLambertMaterial({ map: T.plaza }),
    pasto: new THREE.MeshLambertMaterial({ map: T.pasto }),
  };
  for (const k of Object.keys(suelos)) if (suelos[k].length) {
    const m = new THREE.Mesh(mergeGeometries(suelos[k]), matSuelo[k]);
    m.matrixAutoUpdate = false; m.updateMatrix();
    m.renderOrder = k === 'tierra' ? 0 : 1;
    scene.add(m);
  }
  construirArboles();
  montanas();

  return { colision, mapa, eras };

  // ============================================================ funciones internas
  function letreroPlano(texto, x, y, z, w, h, rotY, o = {}) {
    const t = TX.letrero(texto, { w: o.w ?? 512, h: o.h ?? 96, ...o });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    // separar un poco del muro
    m.position.x += Math.sin(rotY) * 0.03; m.position.z += Math.cos(rotY) * 0.03;
    scene.add(m);
  }

  function barda2(x0, z0, x1, z1, color) {
    const w = Math.abs(x1 - x0) || 0.25, d = Math.abs(z1 - z0) || 0.25;
    L.muros.push(caja(w, 2.1, d, { tile: 0 }), new THREE.Color(color), M((x0 + x1) / 2, 1.05, (z0 + z1) / 2));
    solido({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15 });
  }

  function domo(cx, cz, span, largo, colH, rise, color) {
    const R = (span * span / 4 + rise * rise) / (2 * rise);
    const A = Math.asin(span / 2 / R);
    const yc = colH + rise - R;
    const seg = 22;
    // superficie del arco
    const pos = [], uv = [];
    for (let i = 0; i < seg; i++) {
      const a0 = -A + (2 * A * i) / seg, a1 = -A + (2 * A * (i + 1)) / seg;
      const p = (a, z) => [R * Math.sin(a), yc + R * Math.cos(a), z];
      const v00 = p(a0, -largo / 2), v01 = p(a0, largo / 2), v10 = p(a1, -largo / 2), v11 = p(a1, largo / 2);
      pos.push(...v00, ...v10, ...v11, ...v00, ...v11, ...v01);
      const u0 = i / seg * span * 1.4, u1 = (i + 1) / seg * span * 1.4, L2 = largo * 0.6;
      uv.push(0, u0, 0, u1, L2, u1, 0, u0, L2, u1, L2, u0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    L.techos.push(g, new THREE.Color(color), M(cx, 0, cz));
    // arcos de acero y columnas
    const nArcos = Math.round(largo / 5.2);
    const acero = new THREE.Color('#4a4f55');
    for (let k = 0; k <= nArcos; k++) {
      const z = cz - largo / 2 + (largo * k) / nArcos;
      for (let i = 0; i < seg; i++) {
        const a = -A + (2 * A * (i + 0.5)) / seg;
        const segLen = (2 * A * R) / seg;
        L.lisos.push(new THREE.BoxGeometry(segLen, 0.35, 0.18), acero,
          M(cx + (R - 0.25) * Math.sin(a), yc + (R - 0.25) * Math.cos(a), z, 0, 0, -a));
      }
      for (const sx of [-1, 1]) {
        const x = cx + sx * span / 2;
        L.lisos.push(new THREE.BoxGeometry(0.45, colH, 0.45), new THREE.Color('#d7d3ca'), M(x, colH / 2, z));
        colision.circulos.push({ x, z, r: 0.4 });
      }
    }
    // cancha
    const cw = Math.min(span - 3, 15), cl = Math.min(largo - 3, 28);
    const cancha = new THREE.Mesh(new THREE.PlaneGeometry(cw, cl).rotateX(-PI / 2), new THREE.MeshLambertMaterial({ map: T.cancha }));
    cancha.position.set(cx, 0.06, cz); scene.add(cancha);
    // tableros
    for (const s of [-1, 1]) {
      const z = cz + s * (cl / 2 + 0.6);
      L.lisos.push(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 6), new THREE.Color('#3f4448'), M(cx, 1.65, z));
      L.lisos.push(new THREE.BoxGeometry(1.8, 1.05, 0.06), new THREE.Color('#f4f4f2'), M(cx, 3.4, z - s * 0.35));
      L.lisos.push(new THREE.TorusGeometry(0.23, 0.025, 4, 10).rotateX(PI / 2), new THREE.Color('#e0612e'), M(cx, 3.05, z - s * 0.65));
      colision.circulos.push({ x: cx, z, r: 0.3 });
    }
    mapa.edificios.push({ x0: cx - span / 2, x1: cx + span / 2, z0: cz - largo / 2, z1: cz + largo / 2, color: '#' + new THREE.Color(color).getHexString(THREE.SRGBColorSpace), domo: true });
  }

  function vehiculo(tipo, color, x, z, rot, grupo, o = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });
    const vidrio = new THREE.MeshLambertMaterial({ color: '#2a3138' });
    const llanta = new THREE.MeshLambertMaterial({ color: '#151515' });
    const add = (geo, m, px, py, pz) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); g.add(me); return me; };
    if (tipo === 'pickup') {
      add(new THREE.BoxGeometry(1.85, 0.75, 5.2), mat, 0, 0.85, 0);
      add(new THREE.BoxGeometry(1.75, 0.75, 1.9), mat, 0, 1.6, 0.9);
      add(new THREE.BoxGeometry(1.7, 0.5, 0.05), vidrio, 0, 1.68, 1.86);
      add(new THREE.BoxGeometry(1.6, 0.06, 2.6), new THREE.MeshLambertMaterial({ color: o.caja ?? '#111' }), 0, 1.24, -1.25);
      if (o.lona) add(new THREE.BoxGeometry(1.85, 1.0, 2.5), new THREE.MeshLambertMaterial({ color: o.lona }), 0, 1.75, -1.3);
    } else {
      add(new THREE.BoxGeometry(1.75, 0.7, 4.3), mat, 0, 0.7, 0);
      add(new THREE.BoxGeometry(1.6, 0.6, 2.2), mat, 0, 1.3, -0.2);
      add(new THREE.BoxGeometry(1.5, 0.45, 0.05), vidrio, 0, 1.33, 0.92);
    }
    const lg = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10).rotateZ(PI / 2);
    const L2 = tipo === 'pickup' ? 1.7 : 1.4;
    for (const sx of [-0.88, 0.88]) for (const sz of [-L2, L2]) add(lg, llanta, sx, 0.38, sz);
    g.position.set(x, 0, z); g.rotation.y = rot;
    grupo.add(g);
    const era = grupo === eras.antes ? 'antes' : 'ahora';
    const largo = tipo === 'pickup' ? 5.3 : 4.4;
    // colisión aproximada con dos círculos
    for (const s of [-1, 1]) colision.circulos.push({ x: x + Math.sin(rot) * s * largo * 0.25, z: z + Math.cos(rot) * s * largo * 0.25, r: 1.25, era });
  }

  function construirArboles() {
    const n = arboles.length;
    const tronco = new THREE.CylinderGeometry(0.16, 0.26, 1, 6); tronco.translate(0, 0.5, 0);
    // troncos encalados (blanco abajo) para los ficus del parque
    const troncoCal = tronco.clone();
    const cols = []; const p = troncoCal.attributes.position;
    for (let i = 0; i < p.count; i++) { const c = new THREE.Color(p.getY(i) < 0.27 ? '#f2f0ea' : '#6b5440'); cols.push(c.r, c.g, c.b); }
    troncoCal.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const ficus = arboles.filter((a) => a.tipo === 'ficus');
    const normales = arboles.filter((a) => a.tipo !== 'ficus');
    const tN = new THREE.InstancedMesh(tronco, new THREE.MeshLambertMaterial({ color: '#6b5440' }), normales.length);
    const tF = new THREE.InstancedMesh(troncoCal, new THREE.MeshLambertMaterial({ vertexColors: true }), ficus.length);
    const copa = new THREE.IcosahedronGeometry(1, 1);
    const cM = new THREE.InstancedMesh(copa, new THREE.MeshLambertMaterial(), n * 2);
    const sM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2),
      new THREE.MeshBasicMaterial({ map: T.sombra, transparent: true, depthWrite: false }), n);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    const mt = new THREE.Matrix4();
    let iN = 0, iF = 0, iC = 0;
    arboles.forEach((a, i) => {
      const tw = a.tipo === 'ficus' ? 1.7 : 0.9 + a.rad * 0.05;
      mt.compose(V3(a.x, 0, a.z), q.identity(), V3(tw, a.h + a.rad * 0.3, tw));
      if (a.tipo === 'ficus') tF.setMatrixAt(iF++, mt); else tN.setMatrixAt(iN++, mt);
      const nCopas = Math.hypot(a.x, a.z) < 260 ? 2 : 1;
      for (let k = 0; k < nCopas; k++) {
        const s = k === 0 ? 1 : 0.7;
        const ox = k === 0 ? 0 : (r() - 0.5) * a.rad, oz = k === 0 ? 0 : (r() - 0.5) * a.rad;
        e.set(0, r() * PI, 0); q.setFromEuler(e);
        mt.compose(V3(a.x + ox, a.h + a.rad * 0.55 * s + (k ? a.rad * 0.25 : 0), a.z + oz), q,
          V3(a.rad * s, a.rad * 0.68 * s, a.rad * s));
        cM.setMatrixAt(iC, mt);
        cM.setColorAt(iC, k ? a.color.clone().multiplyScalar(1.12) : a.color);
        iC++;
      }
      mt.compose(V3(a.x, 0.045 + (i % 7) * 0.001, a.z), q.identity(), V3(a.rad * 2.3, 1, a.rad * 2.3));
      sM.setMatrixAt(i, mt);
    });
    cM.count = iC;
    sM.renderOrder = 2;
    scene.add(tN, tF, cM, sM);
  }

  function montanas() {
    // Sierra alrededor del pueblo (provisional: forma y altura aproximadas; en la foto se ven cerros cercanos al sur y sureste)
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * PI * 2 + r() * 0.2;
      const sur = Math.max(0, Math.cos(a - PI / 2 - 0.4)); // más altos hacia el sur/sureste
      const d = 700 + r() * 700 - sur * 120;
      const h = 90 + r() * 120 + sur * 210;
      const rad = 380 + r() * 320;
      const geo = new THREE.ConeGeometry(rad, h, 11, 5, true);
      const p = geo.attributes.position, cols = [];
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < h / 2 - 1) { p.setX(i, p.getX(i) * (0.85 + r() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + r() * 0.3)); p.setY(i, y + (r() - 0.5) * h * 0.12); }
        const t = (y + h / 2) / h;
        const c = new THREE.Color().lerpColors(new THREE.Color('#5d7a4f'), new THREE.Color('#8ea3a6'), Math.min(1, t * 0.8 + d / 2600));
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * d, h / 2 - 20, Math.sin(a) * d);
      g.add(m);
    }
    scene.add(g);
  }
}
