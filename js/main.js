import * as THREE from 'three';
import { construirPueblo } from './world.js';
import { Controles } from './controls.js';
import { Sonido } from './audio.js';
import { META, LUGARES, FOTO_ANTES, INICIO, RUTA } from './data.js';

const $ = (s) => document.querySelector(s);
const esMovil = matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------ render
const canvas = $('#escena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !esMovil, powerPreference: 'high-performance' });
let calidad = Math.min(window.devicePixelRatio || 1, esMovil ? 1.25 : 1.75);
renderer.setPixelRatio(calidad);
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
const CIELO = new THREE.Color('#bcd4e6');
scene.background = CIELO;
scene.fog = new THREE.Fog('#c9d8e2', 70, 560);
{
  // cúpula de cielo con degradado
  const g = new THREE.SphereGeometry(2600, 24, 12);
  const p = g.attributes.position, cols = [];
  const arriba = new THREE.Color('#7fa8d1'), horiz = new THREE.Color('#d6e2ea');
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / 2600); const c = horiz.clone().lerp(arriba, Math.pow(t, 0.6)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
}
scene.add(new THREE.HemisphereLight('#dfeaf5', '#7a6a4c', 1.5));
const sol = new THREE.DirectionalLight('#fff2dc', 2.1);
sol.position.set(-120, 200, 80);
scene.add(sol);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 3200);
camera.rotation.order = 'YXZ';

const pueblo = construirPueblo(scene, renderer);
const { colision, mapa, eras } = pueblo;

// ------------------------------------------------------------------ estado
const OJOS = 1.6;
const jugador = { x: INICIO.x, z: INICIO.z, paso: 0, bob: 0 };
let era = 'ahora';
let lugarCerca = null;
let pausado = true;
let fovBase = 70;
let comparando = null; // { x, z, yaw } cuando la vista está alineada con la foto
const sonido = new Sonido();

const ctl = new Controles($('#capa-toque'), $('#stick'), $('#knob'), {
  interactuar: () => lugarCerca && !pausado && abrirLugar(lugarCerca),
  era: () => !pausado && cambiarEra(era === 'ahora' ? 'antes' : 'ahora'),
  mapa: () => (mapaAbierto() ? cerrarMapa() : !pausado && abrirMapa()),
  cerrar: () => { cerrarPanel(); cerrarMapa(); },
  primerToque: () => document.body.classList.add('sin-pistas'),
});
ctl.yaw = INICIO.yaw;

// ------------------------------------------------------------------ tamaño de pantalla
function ajustar() {
  const w = innerWidth, h = innerHeight, asp = w / h;
  // mantener un campo horizontal cómodo en vertical sin deformar demasiado
  fovBase = asp < 1 ? Math.min(88, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(66) / 2) / asp))) : 68;
  if (!comparando) camera.fov = fovBase;
  camera.aspect = asp; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', ajustar);
ajustar();

// ------------------------------------------------------------------ colisiones
const RADIO = 0.35;
function resolver(p) {
  for (const c of colision.circulos) {
    if (c.era && c.era !== era) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    const rr = c.r + RADIO, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.001;
      p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr;
    }
  }
  for (const b of colision.rects) {
    if (b.era && b.era !== era) continue;
    if (p.x > b.x0 - RADIO && p.x < b.x1 + RADIO && p.z > b.z0 - RADIO && p.z < b.z1 + RADIO) {
      const izq = p.x - (b.x0 - RADIO), der = b.x1 + RADIO - p.x, arr = p.z - (b.z0 - RADIO), aba = b.z1 + RADIO - p.z;
      const m = Math.min(izq, der, arr, aba);
      if (m === izq) p.x = b.x0 - RADIO; else if (m === der) p.x = b.x1 + RADIO;
      else if (m === arr) p.z = b.z0 - RADIO; else p.z = b.z1 + RADIO;
    }
  }
  p.x = Math.max(-560, Math.min(560, p.x)); p.z = Math.max(-560, Math.min(560, p.z));
}

// ------------------------------------------------------------------ bucle
const reloj = new THREE.Clock();
let promedio = 16, cuadros = 0, cuadroMapa = 0;
function ciclo() {
  requestAnimationFrame(ciclo);
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (!pausado) actualizar(dt);
  camera.position.set(jugador.x, OJOS + jugador.bob, jugador.z);
  camera.rotation.set(ctl.pitch, ctl.yaw, 0);
  renderer.render(scene, camera);
  if (!pausado) {
    brujula();
    if (++cuadroMapa % 2 === 0) minimapa();
  }
  // calidad adaptable para teléfonos de gama media
  promedio = promedio * 0.95 + dt * 1000 * 0.05;
  if (++cuadros % 120 === 0 && promedio > 30 && calidad > 0.7) {
    calidad = Math.max(0.7, calidad - 0.2);
    renderer.setPixelRatio(calidad); renderer.setSize(innerWidth, innerHeight, false);
  }
}

function actualizar(dt) {
  const { adelante, lado, correr } = ctl.leer(dt);
  const vel = correr ? 4.4 : 2.5;
  const sy = Math.sin(ctl.yaw), cy = Math.cos(ctl.yaw);
  // adelante = -z local; lado = +x local
  const vx = (-sy * adelante + cy * lado) * vel, vz = (-cy * adelante - sy * lado) * vel;
  const px = jugador.x, pz = jugador.z;
  const p = { x: jugador.x + vx * dt, z: jugador.z + vz * dt };
  resolver(p);
  jugador.x = p.x; jugador.z = p.z;
  const recorrido = Math.hypot(p.x - px, p.z - pz);
  if (recorrido > 0.001) {
    jugador.paso += recorrido;
    jugador.bob = Math.sin(jugador.paso * 4.2) * 0.035;
    if (jugador.paso > 0.78) { jugador.paso -= 0.78 * 1; sonido.paso(correr ? 1.2 : 0.9); }
  } else jugador.bob *= 0.85;

  // salir de la vista alineada si el visitante se mueve o gira
  if (comparando) {
    const mov = Math.hypot(jugador.x - comparando.x, jugador.z - comparando.z);
    const giro = Math.abs(angDif(ctl.yaw, comparando.yaw));
    $('#foto-superpuesta').style.opacity = mov > 1.2 || giro > 0.3 ? 0 : $('#opacidad').value / 100;
  }

  // lugar con historia más cercano
  let mejor = null, dm = Infinity;
  for (const l of LUGARES) {
    const d = Math.hypot(jugador.x - l.pos[0], jugador.z - l.pos[1]);
    if (d < l.radio && d < dm) { mejor = l; dm = d; }
  }
  if (mejor !== lugarCerca) {
    lugarCerca = mejor;
    const b = $('#btn-conocer');
    b.hidden = !mejor;
    if (mejor) b.querySelector('.n').textContent = mejor.nombre;
  }
  actualizarComparador();
}

const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// rumbo (0 = norte, 90 = este)
const rumbo = () => (THREE.MathUtils.radToDeg(Math.atan2(-Math.sin(ctl.yaw), Math.cos(ctl.yaw))) + 360) % 360;

// ------------------------------------------------------------------ brújula
const marcas = $('#brujula-marcas');
const PUNTOS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
const spans = PUNTOS.map(([t, a]) => { const s = document.createElement('span'); s.textContent = t; if (t.length > 1) s.classList.add('menor'); if (t === 'N') s.classList.add('norte'); marcas.appendChild(s); return [s, a]; });
const spansLugar = LUGARES.map((l) => { const s = document.createElement('span'); s.className = 'lugar'; s.textContent = l.corto; marcas.appendChild(s); return [s, l]; });
function brujula() {
  const w = marcas.clientWidth, h = rumbo(), ppg = w / 150;
  for (const [s, a] of spans) {
    const d = ((a - h + 540) % 360) - 180;
    s.style.display = Math.abs(d) > 75 ? 'none' : '';
    s.style.left = w / 2 + d * ppg + 'px';
  }
  // lugares cercanos (el más próximo primero; sin encimarse)
  const puestos = [];
  spansLugar
    .map(([s, l]) => [s, l, Math.hypot(l.pos[0] - jugador.x, l.pos[1] - jugador.z)])
    .sort((a, b) => a[2] - b[2])
    .forEach(([s, l, dist]) => {
      const a = (THREE.MathUtils.radToDeg(Math.atan2(l.pos[0] - jugador.x, -(l.pos[1] - jugador.z))) + 360) % 360;
      const d = ((a - h + 540) % 360) - 180, x = w / 2 + d * ppg;
      const ver = Math.abs(d) < 60 && dist < 160 && dist > l.radio && puestos.every((p) => Math.abs(p - x) > 56);
      s.style.display = ver ? '' : 'none';
      if (ver) { s.style.left = x + 'px'; puestos.push(x); }
    });
}

// ------------------------------------------------------------------ minimapa
const ESC = 2, EXT = 300; // 2 px por metro, de -300 a 300 m
const mapaBase = document.createElement('canvas');
mapaBase.width = mapaBase.height = EXT * 2 * ESC;
{
  const c = mapaBase.getContext('2d');
  const X = (x) => (x + EXT) * ESC;
  for (const s of mapa.suelos) { c.fillStyle = s.color; c.fillRect(X(s.x0), X(s.z0), (s.x1 - s.x0) * ESC, (s.z1 - s.z0) * ESC); }
  c.fillStyle = 'rgba(52,88,38,.75)';
  for (const [x, z, r] of mapa.arboles) { c.beginPath(); c.arc(X(x), X(z), r * ESC * 0.8, 0, 7); c.fill(); }
  for (const e of mapa.edificios) {
    c.fillStyle = e.color;
    if (e.redondo) { c.beginPath(); c.arc(X((e.x0 + e.x1) / 2), X((e.z0 + e.z1) / 2), (e.x1 - e.x0) * ESC / 2, 0, 7); c.fill(); }
    else c.fillRect(X(e.x0), X(e.z0), (e.x1 - e.x0) * ESC, (e.z1 - e.z0) * ESC);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
    if (!e.redondo) c.strokeRect(X(e.x0), X(e.z0), (e.x1 - e.x0) * ESC, (e.z1 - e.z0) * ESC);
  }
  c.strokeStyle = '#ffe08a'; c.lineWidth = 3; c.setLineDash([6, 5]);
  c.beginPath(); RUTA.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z)))); c.stroke(); c.setLineDash([]);
}
const mm = $('#minimapa'), mctx = mm.getContext('2d');
const dprMapa = Math.min(2, devicePixelRatio || 1);
mm.width = mm.height = 112 * dprMapa;
function minimapa() {
  const S = mm.width, ver = 70; // metros de radio visibles
  const k = S / (ver * 2);
  mctx.clearRect(0, 0, S, S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2, 0, 7); mctx.clip();
  mctx.drawImage(mapaBase, (jugador.x - ver + EXT) * ESC, (jugador.z - ver + EXT) * ESC, ver * 2 * ESC, ver * 2 * ESC, 0, 0, S, S);
  for (const l of LUGARES) {
    const x = S / 2 + (l.pos[0] - jugador.x) * k, y = S / 2 + (l.pos[1] - jugador.z) * k;
    mctx.fillStyle = '#b5523b'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2 * dprMapa;
    mctx.beginPath(); mctx.arc(x, y, 4.5 * dprMapa, 0, 7); mctx.fill(); mctx.stroke();
  }
  // jugador
  mctx.translate(S / 2, S / 2); mctx.rotate(THREE.MathUtils.degToRad(rumbo()));
  mctx.fillStyle = '#ffffff'; mctx.strokeStyle = '#1b1b1b'; mctx.lineWidth = 1.5 * dprMapa;
  const u = 6 * dprMapa;
  mctx.beginPath(); mctx.moveTo(0, -u * 1.5); mctx.lineTo(u, u); mctx.lineTo(0, u * 0.45); mctx.lineTo(-u, u); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  // N
  mctx.fillStyle = '#fff'; mctx.font = `bold ${11 * dprMapa}px system-ui`; mctx.textAlign = 'center';
  mctx.fillText('N', S / 2, 13 * dprMapa);
}

// mapa grande
const mapaAbierto = () => !$('#mapa-grande').hidden;
function abrirMapa() {
  const cv = $('#mapa-canvas'), r = cv.getBoundingClientRect.bind(cv);
  $('#mapa-grande').hidden = false; pausar(true);
  const tam = Math.round(Math.min(innerWidth * 0.94, innerHeight * 0.82) * Math.min(2, devicePixelRatio || 1));
  cv.width = cv.height = tam;
  const c = cv.getContext('2d'), ver = 150, k = tam / (ver * 2);
  const cx = -25, cz = -5; // centrado en el tramo
  c.drawImage(mapaBase, (cx - ver + EXT) * ESC, (cz - ver + EXT) * ESC, ver * 2 * ESC, ver * 2 * ESC, 0, 0, tam, tam);
  const P = (x, z) => [(x - cx + ver) * k, (z - cz + ver) * k];
  c.font = `600 ${Math.round(tam / 42)}px system-ui`; c.textAlign = 'center';
  for (const l of LUGARES) {
    const [x, y] = P(...l.pos);
    c.fillStyle = '#b5523b'; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, tam / 90, 0, 7); c.fill(); c.stroke();
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.65)'; c.fillStyle = '#fff';
    c.strokeText(l.nombre, x, y - tam / 55); c.fillText(l.nombre, x, y - tam / 55);
  }
  const [lx, ly] = P(-50, 75);
  c.save(); c.translate(lx, ly); c.rotate(-Math.PI / 2); c.fillStyle = '#3b3b3b'; c.fillText('Calle central', 0, 0); c.restore();
  const [jx, jy] = P(jugador.x, jugador.z);
  c.save(); c.translate(jx, jy); c.rotate(THREE.MathUtils.degToRad(rumbo()));
  const u = tam / 60; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -u * 1.5); c.lineTo(u, u); c.lineTo(0, u * 0.45); c.lineTo(-u, u); c.closePath(); c.fill(); c.stroke(); c.restore();
  c.fillStyle = '#fff'; c.font = `bold ${Math.round(tam / 30)}px system-ui`; c.fillText('N ↑', tam - tam / 18, tam / 18 + 8);
}
function cerrarMapa() { if (!mapaAbierto()) return; $('#mapa-grande').hidden = true; pausar(false); }
mm.addEventListener('click', abrirMapa);
$('#mapa-grande .cerrar').addEventListener('click', cerrarMapa);

// ------------------------------------------------------------------ panel de historia
function abrirLugar(l) {
  const foto = l.foto === 'FOTO_ANTES' ? FOTO_ANTES : null;
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let h = `<h2>${esc(l.nombre)}</h2>`;
  if (l.subtitulo) h += `<p class="sub">${esc(l.subtitulo)}</p>`;
  else h += `<p class="sub">Las Chicharras, Bella Vista</p>`;
  if (foto) h += `<figure><img src="${foto.src}" alt="Fotografía de ${esc(l.nombre)}"><figcaption>${esc(foto.credito)}</figcaption></figure>`;
  if (l.documentado.length) {
    h += `<h3><span class="etq doc">Documentado</span> Lo que sabemos</h3><ul>`;
    for (const d of l.documentado) h += `<li>${esc(d.texto)}${d.fuente ? `<span class="fuente">Fuente: ${esc(d.fuente)}</span>` : ''}</li>`;
    h += `</ul>`;
  }
  h += `<h3><span class="etq rec">Recuerdos</span> Lo que cuenta la gente</h3>`;
  if (l.recuerdos.length) {
    h += '<ul>' + l.recuerdos.map((r) => `<li>«${esc(r.texto)}»<span class="fuente">— ${r.autor && r.autorizado ? esc(r.autor) : 'Un vecino de Las Chicharras'}${r.fecha ? ', ' + esc(r.fecha) : ''}</span></li>`).join('') + '</ul>';
  } else {
    h += `<div class="invitacion">Todavía no tenemos recuerdos de este lugar. ¿Creciste cerca de aquí? Tu historia, con tu permiso, puede aparecer en este punto.${l.pendiente ? `<br><br><b>Nos falta saber:</b> ${esc(l.pendiente)}` : ''}</div>`;
  }
  if (l.antesAhora) h += `<button class="btn-antes" data-accion="antes">Comparar antes / ahora aquí</button>`;
  h += `<div class="reconst"><span class="etq ${l.provisional ? 'prov' : 'doc'}">${l.provisional ? 'Reconstrucción provisional' : 'Reconstrucción basada en referencias'}</span><br>${esc(l.notaReconstruccion)}</div>`;
  $('#panel-contenido').innerHTML = h;
  $('#panel').hidden = false;
  pausar(true);
  const b = $('#panel-contenido .btn-antes');
  if (b) b.onclick = () => { cerrarPanel(); cambiarEra('antes'); };
}
function cerrarPanel() { if ($('#panel').hidden) return; $('#panel').hidden = true; pausar(false); }
$('#panel .cerrar').addEventListener('click', cerrarPanel);
$('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel') cerrarPanel(); });
$('#btn-conocer').addEventListener('click', () => lugarCerca && abrirLugar(lugarCerca));

function pausar(p) {
  pausado = p; ctl.activo = !p;
  if (p) { ctl.soltarStick(); ctl.teclas.clear(); }
}

// ------------------------------------------------------------------ antes / ahora
let avisoT = 0;
function aviso(txt, ms = 4200) {
  const a = $('#aviso'); a.textContent = txt; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => (a.hidden = true), ms);
}
function cerca(radio = FOTO_ANTES.radio) {
  return Math.hypot(jugador.x - FOTO_ANTES.camara.x, jugador.z - FOTO_ANTES.camara.z) < radio;
}
function cambiarEra(e) {
  if (e === era) return;
  era = e;
  // se conserva la posición y la dirección de la cámara: solo cambian los elementos respaldados por referencias
  eras.antes.visible = e === 'antes'; eras.ahora.visible = e === 'ahora';
  canvas.classList.toggle('antes', e === 'antes'); $('#velo').classList.toggle('antes', e === 'antes');
  document.querySelectorAll('#antes-ahora button').forEach((b) => b.classList.toggle('activo', b.dataset.era === e));
  const ins = $('#insignia-era');
  ins.hidden = e !== 'antes';
  ins.textContent = FOTO_ANTES.etiqueta;
  if (e === 'antes') {
    if (!cerca()) aviso('En este punto todavía no hay referencias del pasado. La primera comparación documentada está en la esquina noroeste del parque («La esquina de los ficus»).', 5200);
    else aviso('Vista histórica: camionetas sobre la explanada de tierra, como en la foto. Lo demás se conserva igual hasta tener más referencias.');
  } else salirComparacion();
  actualizarComparador(true);
}
document.querySelectorAll('#antes-ahora button').forEach((b) => b.addEventListener('click', () => cambiarEra(b.dataset.era)));

function actualizarComparador(forzar) {
  const mostrar = era === 'antes' && (cerca() || comparando);
  const c = $('#comparador');
  if (c.hidden === !mostrar && !forzar) return;
  c.hidden = !mostrar;
}
$('#comp-mini').src = FOTO_ANTES.src;
$('#comp-credito').textContent = FOTO_ANTES.credito;
$('#foto-superpuesta').src = FOTO_ANTES.src;

let anim = null;
$('#btn-alinear').addEventListener('click', () => {
  const cam = FOTO_ANTES.camara;
  const ini = { x: jugador.x, z: jugador.z, yaw: ctl.yaw, pitch: ctl.pitch, fov: camera.fov };
  const yawF = ini.yaw + angDif(cam.yaw, ini.yaw);
  // la foto (Street View) cubre ~55° en vertical; igualamos el campo visual para compararla
  const asp = innerWidth / innerHeight, aspFoto = 1811 / 795;
  const fovF = asp <= aspFoto ? 55 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(55) / 2) * aspFoto / asp));
  const t0 = performance.now();
  pausar(true);
  cancelAnimationFrame(anim);
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / 1100), s = k * k * (3 - 2 * k);
    jugador.x = ini.x + (cam.x - ini.x) * s; jugador.z = ini.z + (cam.z - ini.z) * s;
    ctl.yaw = ini.yaw + (yawF - ini.yaw) * s; ctl.pitch = ini.pitch + (cam.pitch - ini.pitch) * s;
    camera.fov = ini.fov + (fovF - ini.fov) * s; camera.updateProjectionMatrix();
    if (k < 1) anim = requestAnimationFrame(paso);
    else {
      pausar(false);
      comparando = { x: cam.x, z: cam.z, yaw: ctl.yaw };
      const img = $('#foto-superpuesta'); img.hidden = false; img.style.opacity = $('#opacidad').value / 100;
      document.body.classList.add('comparando');
      $('#lbl-opacidad').hidden = false; $('#btn-salir-comp').hidden = false; $('#btn-alinear').hidden = true;
      aviso('Desliza «Foto» para fundir la imagen antigua con la vista actual.');
    }
  };
  anim = requestAnimationFrame(paso);
});
$('#opacidad').addEventListener('input', (e) => ($('#foto-superpuesta').style.opacity = e.target.value / 100));
function salirComparacion() {
  if (!comparando) return;
  comparando = null;
  $('#foto-superpuesta').hidden = true;
  document.body.classList.remove('comparando');
  $('#lbl-opacidad').hidden = true; $('#btn-salir-comp').hidden = true; $('#btn-alinear').hidden = false;
  camera.fov = fovBase; camera.updateProjectionMatrix();
}
$('#btn-salir-comp').addEventListener('click', () => { salirComparacion(); actualizarComparador(true); });

// ------------------------------------------------------------------ otros botones
$('#btn-modo').addEventListener('click', () => ($('#menu-modo').hidden = !$('#menu-modo').hidden));
$('#menu-modo').addEventListener('click', (e) => { if (e.target.closest('button.activo')) $('#menu-modo').hidden = true; });
$('#btn-sonido').addEventListener('click', (e) => { e.currentTarget.textContent = sonido.alternar() ? '🔇' : '🔊'; });
$('#btn-ayuda').addEventListener('click', () => {
  $('#panel-contenido').innerHTML = `<h2>Cómo recorrer</h2><p class="sub">${META.version}</p>
  <ul>
    <li><b>Caminar:</b> mantén el dedo en la mitad izquierda y deslízalo. Llévalo hasta el borde para ir más rápido. En computadora: W A S D o flechas (Shift para correr).</li>
    <li><b>Mirar:</b> arrastra en la mitad derecha (o con el ratón).</li>
    <li><b>Conocer este lugar:</b> aparece al acercarte a un punto con historia (tecla E).</li>
    <li><b>Antes / Ahora:</b> cambia la época sin moverte de tu lugar (tecla T). La primera comparación con foto está en la esquina noroeste del parque.</li>
    <li><b>Mapa:</b> toca el círculo de arriba a la derecha (tecla M). La línea amarilla es la ruta sugerida.</li>
  </ul>
  <h3><span class="etq prov">Provisional</span> Cómo leer la reconstrucción</h3>
  <div class="reconst">Las calles, cuadras y techos vienen de imágenes satelitales. Las fachadas que todavía no hemos fotografiado son aproximadas. Cada lugar dice qué está documentado y qué es provisional.</div>`;
  $('#panel').hidden = false; pausar(true);
});
document.addEventListener('visibilitychange', () => sonido.pausar(document.hidden));

// ------------------------------------------------------------------ portada
$('#datos-pueblo').innerHTML = META.datos.map((d) => `<li>${d}</li>`).join('');
const entrar = $('#btn-entrar');
entrar.disabled = false; entrar.textContent = 'Entrar al pueblo';
entrar.addEventListener('click', () => {
  $('#portada').hidden = true;
  sonido.iniciar();
  pausar(false);
  aviso('Estás en la calle central. A tu izquierda, la iglesia; a tu derecha, el parque. Sigue la línea amarilla del mapa.', 6500);
});
// atajo para pruebas: ?x=..&z=..&yaw=..
const q = new URLSearchParams(location.search);
if (q.has('x')) { jugador.x = +q.get('x'); jugador.z = +q.get('z'); ctl.yaw = +(q.get('yaw') || 0); }
ciclo();
window.__juego = { jugador, ctl, camera, cambiarEra, renderer };
