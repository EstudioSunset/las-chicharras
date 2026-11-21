// Construcción del pueblo en 3D. Todo es geometría simple combinada (pocas llamadas de dibujo)
// para que corra fluido en teléfonos Android de gama media.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { GRID, CALLES_CONCRETO, CALLE_ANGOSTA } from './data.js';

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
function caja(w, h, d, { tile = null, uvEsc = null } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  if (tile !== null) {
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const t = f === 4 ? tile : 0;
      uv.setX(i, (t + 0.01 + uv.getX(i) * 0.98) / 4);
    }
  } else if (uvEsc) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvEsc[0], uv.getY(i) * uvEsc[1]);
  }
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
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 2 ? 0.5 : 0.05)), 2));
  g.computeVertexNormals();
  return g;
}

const PAL_MUROS = ['#f3efe6', '#f3efe6', '#efe3c2', '#cfe0c8', '#f0c9c0', '#c9dbe8', '#f2d98c', '#e7b98f', '#bdb6ad', '#bdb6ad', '#d9cfc0', '#9fc7b5'];
const PAL_TECHOS = ['#e6e9ec', '#e6e9ec', '#e6e9ec', '#dfe2e5', '#c3c7ca', '#c3c7ca', '#a2503e', '#9a4a3a', '#8a8f94', '#6d8fb3'];

export function construirPueblo(scene, renderer) {
  const r = TX.rng(2026);
  const T = {
    concreto: TX.concreto(), tierra: TX.tierra(), pasto: TX.pasto(), plaza: TX.plaza(),
    lamina: TX.lamina(), teja: TX.teja(), atlas: TX.atlasFachadas(), cancha: TX.cancha(), sombra: TX.sombra(),
  };
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  Object.values(T).forEach((t) => (t.anisotropy = aniso));

  const MAT = {
    muros: new THREE.MeshLambertMaterial({ map: T.atlas, vertexColors: true }),
    techos: new THREE.MeshLambertMaterial({ map: T.lamina, vertexColors: true, side: THREE.DoubleSide }),
    tejas: new THREE.MeshLambertMaterial({ map: T.teja, vertexColors: true, side: THREE.DoubleSide }),
    lisos: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
  const L = { muros: new Lote(), techos: new Lote(), tejas: new Lote(), lisos: new Lote() };

  const colision = { rects: [], circulos: [] };
  const mapa = { suelos: [], edificios: [], arboles: [] };
  const arboles = [];
  const eras = { antes: new THREE.Group(), ahora: new THREE.Group() };
  eras.antes.visible = false;
  scene.add(eras.antes, eras.ahora);

  const rectMundo = (cx, cz, w, d, rotY) => {
    const sw = Math.abs(Math.sin(rotY)) > 0.5;
    const W = sw ? d : w, D = sw ? w : d;
    return { x0: cx - W / 2, x1: cx + W / 2, z0: cz - D / 2, z1: cz + D / 2 };
  };
  const solido = (rc, era = null) => colision.rects.push({ ...rc, era });

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
      p.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 2 ? 0.5 : 0.05)), 2));
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
    const rc = rectMundo(cx, cz, w, d, rotY);
    if (o.solido !== false) solido(rc);
    mapa.edificios.push({ ...rc, color: '#' + (o.techoMapa ?? techo.getHexString(THREE.SRGBColorSpace)) });
    return rc;
  }

  // Fila de casas a lo largo de un lado de manzana.
  function fila(bx, bz, lado, desde, hasta, { prob = 0.72, prof = [6, 10], tiendas = 0.1 } = {}) {
    const E = 46;
    let t = desde;
    while (t < hasta - 5) {
      const w = Math.min(7 + r() * 6, hasta - t);
      if (r() < prob) {
        const d = prof[0] + r() * (prof[1] - prof[0]);
        const s = 0.2 + r() * 1.8;
        const h = r() < 0.07 ? 5.6 : 2.6 + r() * 0.7;
        const tile = r() < tiendas ? 3 : undefined;
        if (lado === 'n') casa(bx + t + w / 2, bz - E + s + d / 2, w - 0.4, d, h, PI, { tile });
        if (lado === 's') casa(bx + t + w / 2, bz + E - s - d / 2, w - 0.4, d, h, 0, { tile });
        if (lado === 'o') casa(bx - E + s + d / 2, bz + t + w / 2, w - 0.4, d, h, -PI / 2, { tile });
        if (lado === 'e') casa(bx + E - s - d / 2, bz + t + w / 2, w - 0.4, d, h, PI / 2, { tile });
      } else if (r() < 0.7) {
        const k = 4 + r() * 4;
        if (lado === 'n') arbol(bx + t + w / 2, bz - E + k);
        if (lado === 's') arbol(bx + t + w / 2, bz + E - k);
        if (lado === 'o') arbol(bx - E + k, bz + t + w / 2);
        if (lado === 'e') arbol(bx + E - k, bz + t + w / 2);
      }
      t += w + r() * 1.2;
    }
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
    suelos[tipo].push(g);
    if (mapaColor) mapa.suelos.push({ x0, z0, x1, z1, color: mapaColor });
  };

  // terreno general (pasto) — grande para que el horizonte no se corte
  const base = suelo(-1500, -1500, 1500, 1500, T.pasto, 0, 8, '#ffffff');
  base.material.map.repeat.set(1, 1);
  mapa.suelos.push({ x0: -300, z0: -300, x1: 300, z1: 300, color: '#6b8b45' });
  // patios de tierra dentro del pueblo
  losa('tierra', -255, -255, 255, 255, 0.005, 6, '#8a7a5a');

  // calles
  const { paso, anchoCalle: AC, manzanas: N } = GRID;
  const lim = paso * N + paso / 2;
  const esConcreto = (ns, en, a, b) => CALLES_CONCRETO.find((c) => c.ns === ns && c.en === en && a >= c.desde - 0.1 && b <= c.hasta + 0.1);
  for (let k = -N; k <= N + 1; k++) {
    const en = k * paso - paso / 2;
    for (const ns of [true, false]) {
      // cada calle se divide en tramos de cuadra para alternar concreto/terracería
      for (let s = -N; s <= N; s++) {
        const a = s * paso - paso / 2, b = a + paso;
        const conc = esConcreto(ns, en, a, b);
        const tipo = conc ? 'concreto' : 'tierra';
        const y = conc ? 0.02 : 0.012;
        const col = conc ? '#cfcac0' : '#b49a72';
        if (ns) losa(tipo, en - AC / 2, a - AC / 2, en + AC / 2, b + AC / 2, y + (conc ? 0.001 : 0), 6, col);
        else losa(tipo, a - AC / 2, en - AC / 2, b + AC / 2, en + AC / 2, y, 6, col);
        if (conc) {
          // guarniciones (bordillo) a ambos lados
          for (const sgn of [-1, 1]) {
            if (ns) L.lisos.push(new THREE.BoxGeometry(0.2, 0.18, paso - AC), new THREE.Color('#d8d4cb'), M(en + sgn * (AC / 2 + 0.1), 0.09, (a + b) / 2));
            else L.lisos.push(new THREE.BoxGeometry(paso - AC, 0.18, 0.2), new THREE.Color('#d8d4cb'), M((a + b) / 2, 0.09, en + sgn * (AC / 2 + 0.1)));
          }
        }
      }
    }
  }
  // andador entre parque y escuela
  const CA = CALLE_ANGOSTA;
  losa('concreto', CA.x - CA.ancho / 2, CA.desde, CA.x + CA.ancho / 2, CA.hasta, 0.022, 6, '#cfcac0');

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
  fila(0, 0, 'e', 15, 46, { prob: 0.8 });
  fila(0, 0, 's', 5, 34, { prob: 0.8 });
  for (let i = 0; i < 12; i++) arbol(8 + r() * 26, 18 + r() * 16);

  // -------------------------------------------------------------- MANZANA DE LA IGLESIA Y LA AGENCIA (x -150..-50)
  const BX = -100;
  // Iglesia: nave de poniente a oriente, techo de lámina gris
  casa(-81.6, 9.4, 20, 11, 6, 0, { muro: '#f5f3ee', techo: '#a9adb1', tile: 0, tipoTecho: 'dos', techoMapa: '8e9296' });
  {
    // frontispicio con espadaña (provisional)
    const fx = -68.3, fz = 9.4;
    L.muros.push(caja(6.8, 9.5, 7.2, { tile: 0 }), new THREE.Color('#f7f5f0'), M(fx, 4.75, fz, PI / 2));
    L.muros.push(caja(3.6, 2.6, 0.8, { tile: 0 }), new THREE.Color('#f7f5f0'), M(fx + 1.5, 10.8, fz, PI / 2));
    L.lisos.push(new THREE.BoxGeometry(0.1, 1.4, 1.2), new THREE.Color('#2b2522'), M(fx + 1.95, 10.8, fz)); // vano de campana
    L.lisos.push(new THREE.BoxGeometry(0.15, 1.6, 0.15), new THREE.Color('#cfc6b4'), M(fx + 1.5, 12.9, fz));
    L.lisos.push(new THREE.BoxGeometry(0.15, 0.15, 0.9), new THREE.Color('#cfc6b4'), M(fx + 1.5, 13.2, fz));
    L.lisos.push(new THREE.BoxGeometry(0.1, 3.4, 2.2), new THREE.Color('#5b3a26'), M(fx + 3.63, 1.7, fz)); // puerta
    L.lisos.push(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 12, 1, false, 0, PI), new THREE.Color('#5b3a26'), M(fx + 3.63, 3.4, fz, 0, 0, PI / 2));
    L.lisos.push(new THREE.CircleGeometry(0.6, 12), new THREE.Color('#6a87a6'), M(fx + 3.63, 6.6, fz, PI / 2)); // óculo
    solido({ x0: fx - 3.6, x1: fx + 3.6, z0: fz - 3.4, z1: fz + 3.4 });
    mapa.edificios.push({ x0: fx - 3.4, x1: fx + 3.4, z0: fz - 3.6, z1: fz + 3.6, color: '#d9d6cf' });
    // atrio con pasto y barda baja
    losa('pasto', -64.9, 1.5, -54.6, 16, 0.03, 4, '#6f9a48');
    L.lisos.push(new THREE.BoxGeometry(0.25, 0.9, 5.4), new THREE.Color('#f1eee6'), M(-54.8, 0.45, 4.2));
    L.lisos.push(new THREE.BoxGeometry(0.25, 0.9, 5.4), new THREE.Color('#f1eee6'), M(-54.8, 0.45, 13.3));
    solido({ x0: -55, x1: -54.6, z0: 1.5, z1: 6.9 }); solido({ x0: -55, x1: -54.6, z0: 10.6, z1: 16 });
  }
  // Agencia Municipal: portal hacia la calle central (provisional), techos rojizos
  casa(-65, 28, 20, 14, 3.6, PI / 2, { muro: '#f4ecd8', techo: '#b5654a', tile: 2, tipoTecho: 'una', techoTeja: true, techoMapa: 'b5654a' });
  {
    // portal: columnas y techo de teja
    for (let i = 0; i < 6; i++) {
      const z = 19 + i * 3.6;
      L.lisos.push(new THREE.BoxGeometry(0.4, 3.3, 0.4), new THREE.Color('#f4ecd8'), M(-55.2, 1.65, z));
      colision.circulos.push({ x: -55.2, z, r: 0.3 });
    }
    L.tejas.push(caja(3.4, 0.08, 20.6, { uvEsc: [2, 10] }), new THREE.Color('#ffffff'), M(-56.4, 3.55, 28, 0, 0, -0.18));
    letreroPlano('AGENCIA MUNICIPAL', -57.9, 3.0, 28, 7, 0.7, PI / 2, { fondo: '#f4ecd8', color: '#7a2e1f', fuente: 'bold 46px serif', h: 90 });
    losa('concreto', -57.9, 18, -54.6, 38, 0.04, 3, null);
  }
  casa(-84.5, 28, 24, 25, 4.4, PI / 2, { muro: '#e9dfcc', techo: '#9a4a3a', tile: 0, tipoTecho: 'dos', caidaAtras: false });
  casa(-64.5, 43, 19, 5.5, 3, 0, { tile: 3, techo: '#e6e9ec' });
  // tramo norte de la calle central (lado poniente): tienda de fachada verde y techo rojo + barda gris (vistas en la foto)
  casa(-58.5, -40, 9, 8, 3.4, PI / 2, { muro: '#3f9a8c', techo: '#a2503e', tile: 3, tipoTecho: 'una' });
  barda2(-55.2, -35.5, -55.2, -21, '#b5b0a6');
  casa(-65.2, -8, 18, 20, 3.3, PI / 2, { muro: '#efe3c2', techo: '#e6e9ec', tile: 1, tipoTecho: 'dos' });
  casa(-84.5, -24, 25, 20, 3.4, 0, { techo: '#e6e9ec', tile: 0, tipoTecho: 'dos', solido: true });
  palma(-55.8, -45.2, 9);
  fila(BX, 0, 'n', -46, 30, {});
  fila(BX, 0, 'o', -33, 33, {});
  fila(BX, 0, 's', -46, -4, {});
  for (let i = 0; i < 14; i++) arbol(BX - 30 + r() * 22, -2 + r() * 26);

  // letreros de calle (solo conocemos «calle central»)
  const letreroCalle = (x, z, rot) => {
    L.lisos.push(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), new THREE.Color('#5a5f63'), M(x, 1.4, z));
    letreroPlano('CALLE CENTRAL', x, 2.65, z, 1.6, 0.35, rot, { fondo: '#1d4f91', fuente: 'bold 52px sans-serif', borde: '#ffffff', h: 110 });
    letreroPlano('CALLE CENTRAL', x, 2.65, z, 1.6, 0.35, rot + PI, { fondo: '#1d4f91', fuente: 'bold 52px sans-serif', borde: '#ffffff', h: 110 });
  };
  letreroCalle(-45.6, -45.6, 0); letreroCalle(-54.4, 45.4, 0); letreroCalle(-45.6, 45.6, 0);

  // -------------------------------------------------------------- RESTO DEL PUEBLO (genérico)
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    if ((i === 0 && j === 0) || (i === -1 && j === 0)) continue;
    const bx = i * paso, bz = j * paso;
    const borde = Math.max(Math.abs(i), Math.abs(j)) === N;
    const prob = borde ? 0.42 : 0.7;
    fila(bx, bz, 'n', -46, 46, { prob });
    fila(bx, bz, 's', -46, 46, { prob });
    fila(bx, bz, 'o', -33, 33, { prob });
    fila(bx, bz, 'e', -33, 33, { prob });
    const n = borde ? 26 : 16;
    for (let k = 0; k < n; k++) arbol(bx - 30 + r() * 60, bz - 30 + r() * 60);
  }
  // monte y cultivos alrededor del pueblo
  for (let k = 0; k < 520; k++) {
    const a = r() * PI * 2, d = 270 + r() * 380;
    if (r() < 0.35 && Math.abs(Math.cos(a)) > 0.5) continue; // claros (milpas)
    arbol(Math.cos(a) * d, Math.sin(a) * d, { r: 3 + r() * 3.5 });
  }

  // postes de luz con cables a lo largo de las calles principales
  {
    const postes = [];
    const lineas = [];
    const tramo = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 33);
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
    tramo(-45.2, -150, -45.2, 150); tramo(-150, -54.8, 150, -54.8); tramo(-150, 45.2, 150, 45.2); tramo(54.8, -150, 54.8, 150);
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
      for (let k = 0; k < 2; k++) {
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
